"""The run.codes compiler: entry point and application bootstrap."""

import argparse
import asyncio
import logging
import logging.handlers
import sys
from typing import cast

from . import config, util
from .model import Commit
from .provider import data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="The run.codes compiler")
    _ = parser.add_argument(
        "--config",
        type=str,
        help="Path to configuration file or config mode.",
        default="env",
    )
    return parser.parse_args()


def setup_logger(name: str, log_config: dict[str, object] | None) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stderr)
    console_fmt = logging.Formatter(
        "[%(asctime)s] %(module)s:%(lineno)d: <%(taskName)s> %(message)s",
        defaults={"taskName": "-"},
    )
    console_handler.setFormatter(console_fmt)
    logger.addHandler(console_handler)

    if log_config is not None:
        fmt = "%(asctime)s [%(levelname)s] <%(taskName)s> %(message)s"
        formatter = logging.Formatter(fmt, defaults={"taskName": "-"})
        handler = logging.handlers.TimedRotatingFileHandler(
            str(log_config["file"]), when="D"
        )
        handler.setLevel(str(log_config["level"]))
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


async def _stop_consumer(
    consumer: asyncio.Task[None] | None,
    task_queue: asyncio.Queue[Commit | None],
    logger: logging.Logger,
) -> None:
    """Ask the consumer to stop and wait for it to finish.

    The ``None`` hint is put directly on the task queue: the queue is bounded,
    so a full queue makes the put wait until the consumer drains it (which is
    exactly the graceful stop condition). A second interruption aborts the
    wait and cancels the consumer.
    """
    if consumer is None or consumer.done():
        return
    try:
        await task_queue.put(None)
        results = await asyncio.gather(consumer, return_exceptions=True)
        if isinstance(results[0], BaseException):
            logger.error("Consumer failed during shutdown", exc_info=results[0])
    except KeyboardInterrupt:
        # Give up and cancel it
        logger.info("Aborted")
        _ = consumer.cancel()


async def _cancel_poller(poller_task: asyncio.Task[None] | None) -> None:
    """Cancel the poller task and wait for it to wind down."""
    if poller_task is None or poller_task.done():
        return
    _ = poller_task.cancel()
    _ = await asyncio.gather(poller_task, return_exceptions=True)


def _load_config() -> tuple[config.Config, logging.Logger]:
    """Parse arguments, build the configuration and set up logging.

    Exits the process when the configuration is invalid.
    """
    args = vars(parse_args())
    config_arg = str(args.get("config"))
    try:
        if config_arg == "env":
            cfg = config.from_env()
        else:
            cfg = config.from_json(config_arg)
    except config.ConfigError as e:
        # The configuration could not even be built (e.g. an unparseable
        # parallelism env var). The configured logger is not available yet,
        # so report on stderr and refuse to start.
        print(f"Invalid configuration: {e}", file=sys.stderr)
        sys.exit(1)

    log_config = cast(dict[str, object], cfg.log) if isinstance(cfg.log, dict) else None
    logger = setup_logger(config.DEFAULT_LOGGER, log_config)

    # Refuse to start on nonsensical parallelism values instead of crashing
    # obscurely later (e.g. a semaphore of size 0 deadlocking the consumer).
    try:
        config.validate(cfg)
    except config.ConfigError as e:
        logger.error(f"Invalid configuration: {e}")
        sys.exit(1)

    return cfg, logger


async def main() -> None:
    # Imported here (and not at module level) to break the import cycle:
    # rcc.engine imports submodules of this package.
    from . import engine
    from .engine import poller

    if (current := asyncio.current_task()) is not None:
        current.set_name("main")

    cfg, logger = _load_config()

    concurrency = config.get_concurrency(cfg)
    logger.info(f"Parallelism: concurrency={concurrency}")

    with util.SingletonContext(cast(str, cfg.lock_file)):
        logger.info("Started")
        logger.debug(f"Configuration: {cfg}")

        data_provider = data.from_config(cfg)

        # Bounded task queue (2x the commit slots): the awaited put() below
        # is the backpressure mechanism.
        task_queue: asyncio.Queue[Commit | None] = asyncio.Queue(
            maxsize=config.queue_maxsize(cfg)
        )
        consumer: asyncio.Task[None] | None = None
        poller_task: asyncio.Task[None] | None = None

        try:
            # The pool's lifecycle is owned here: it is opened before the
            # poller and the consumer start, and closed in the finally below.
            # (It used to be opened by the consumer, but the poller's first
            # fetch always ran before the consumer task was even scheduled,
            # so every startup logged a spurious "connection pool is not
            # open" poll failure.) Connections are still established lazily
            # (the pool opens with wait=False), so a database that is not up
            # yet does not crash the process: poll cycles simply fail and are
            # retried.
            await data_provider.open()

            consumer = asyncio.create_task(
                engine.process_commits(data_provider, task_queue, cfg),
                name="consumer",
            )
            poller_task = asyncio.create_task(
                poller.poll_commits(data_provider, task_queue, cfg, logger),
                name="poller",
            )

            # The poller never returns on its own, so the wait normally ends
            # because the consumer stopped (a non-retryable failure). Shut
            # the poller down and exit instead of polling forever (and
            # eventually hanging on a full task queue) with nothing consuming
            # commits — the supervisor (docker/systemd) restarts the process.
            _ = await asyncio.wait(
                (consumer, poller_task), return_when=asyncio.FIRST_COMPLETED
            )
            _ = poller_task.cancel()
            _ = await asyncio.gather(poller_task, return_exceptions=True)
            # Drain the consumer (no-op when it already stopped), then
            # surface whichever side failed.
            await _stop_consumer(consumer, task_queue, logger)
            for task in (consumer, poller_task):
                if (
                    task.done()
                    and not task.cancelled()
                    and (error := task.exception()) is not None
                ):
                    raise error
            logger.error("Consumer stopped; exiting")
        except KeyboardInterrupt:
            # Only possible for a second Ctrl-C while the first one is already
            # being handled (see the CancelledError branch below).
            logger.info("Interrupted; waiting for consumer")
            await _cancel_poller(poller_task)
            await _stop_consumer(consumer, task_queue, logger)
        except asyncio.CancelledError:
            # asyncio.run() (Python >= 3.11) translates the first Ctrl-C into
            # cancellation of this task. Run the same graceful shutdown, then
            # re-raise so asyncio.run() turns the cancellation back into a
            # KeyboardInterrupt for the caller.
            logger.info("Interrupted; waiting for consumer")
            await _cancel_poller(poller_task)
            await _stop_consumer(consumer, task_queue, logger)
            raise
        finally:
            await data_provider.close()
            logger.info("Exited")
