# `monitor_out` output format

The monitor binary writes one `key=value` line per field to stdout. This
file is what `runcodes-compiler`'s `grading.py` reads back (as
`<test_id>.monitor_out`) to decide a test case's outcome.

## v1 fields (unchanged since the original implementation)

These three fields have the exact same name, meaning, and text formatting
as before the `-t`/`-T`/rusage work landed. `runcodes-compiler` only reads
`signal` and `time` today; both are guaranteed to keep this shape so a
v1-only consumer keeps working unmodified.

| Field | Type | Meaning |
|---|---|---|
| `exit_status` | int | The command's exit code, or `-1` if it was killed by a signal. |
| `signal` | string | The signal name (e.g. `SIGSEGV`), or empty if the command exited normally. |
| `time` | float | Wall-clock seconds the command ran for. |

## v2 fields (additive)

Added alongside the v1 fields -- never replacing them -- so any consumer
that only looks for the three keys above is unaffected. A consumer that
wants the richer classification or resource-usage data reads these
instead/in addition:

| Field | Type | Meaning |
|---|---|---|
| `status` | string | One of `OK`, `NZEC`, `RE`, `TLE`, or `UNKNOWN`. See below. |
| `timeout` | 0 or 1 | `1` if the monitor itself killed the command for exceeding `-t` (wall-clock). |
| `cpu_user` | float | User CPU seconds (`getrusage` `ru_utime`). |
| `cpu_sys` | float | System CPU seconds (`getrusage` `ru_stime`). |
| `max_rss_kb` | long | Peak resident set size, in KB (`getrusage` `ru_maxrss`). |
| `major_faults` | long | Major page faults (`getrusage` `ru_majflt`). |

### `status` values

- `OK` -- exited normally with status 0.
- `NZEC` -- exited normally with a non-zero status.
- `RE` -- terminated by a signal (a crash, e.g. `SIGSEGV`, `SIGABRT`).
- `TLE` -- killed by the monitor's own `-t` (wall-clock) or `-T` (CPU-time)
  limit. Distinguishable from an arbitrary `RE`/`SIGKILL` precisely because
  the monitor -- not some external wrapper -- did the killing and knows
  why.

`UNKNOWN` is never emitted by the current implementation; it exists as the
zero-value of the `MonitorStatus` enum so uninitialized stats are visibly
wrong rather than silently matching `OK`.

### What does *not* exist yet

There is intentionally no `IE` (internal/judge error) status in this file:
when the monitor itself fails before it can run the command at all (e.g.
`parse_args` rejects an empty command, or `set_limits`/`reopen_streams`
fail), it exits with a distinct non-zero code and writes nothing to
`monitor_out` -- there's no process to report stats about. The caller
(currently `runcodes-compiler`'s `grading.process_test_results`) is expected
to treat a missing or unparseable `monitor_out` as its own "judge error"
case, which it already does.

## Exit codes of the `monitor` process itself

These are about the monitor binary's own exit code (as opposed to
`exit_status=` inside its output, which is about the *monitored* command):

| Code | Meaning |
|---|---|
| `0` | The monitor ran to completion (the monitored command may have failed in any way -- that is what `monitor_out` describes). |
| `1` | Bad command-line arguments (see `monitor -h`), or `fork()` itself failed. |
| `252` | Failed to set resource limits (`setrlimit`). |
| `253` | Failed to open/redirect the in/out/err files (including a symlink being refused -- see `-S5` in `runcodes-compiler-sandbox-oportunidades.md`). |
| `254` | Failed to drop privileges requested via `-u`. |
| `255` | The command itself could not be parsed or executed (empty/over-long command, or `execvp` failed). |
