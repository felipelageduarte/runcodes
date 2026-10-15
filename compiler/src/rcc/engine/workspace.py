"""Workspace management: download inputs, prepare files, store outputs."""

import asyncio
import math
import os
import shutil
import zipfile
from typing import TYPE_CHECKING, cast

from ..config import Config
from ..languages import deduce_language, is_compilable, language_from_extension
from ..model import Commit, TestCase
from .common import (
    DEFAULT_MKDIR_PERMISSIONS,
    raise_first_error,
    set_extension,
)

if TYPE_CHECKING:
    from ..provider.data import DataProvider
    from ..provider.storage import StorageProvider

# Guardrails for student-submitted zip archives (overridable through the
# optional config keys ``max_zip_members`` and ``max_zip_uncompressed_size``).
# They bound what extractall() may write to disk, so a crafted archive (a zip
# bomb, or one with thousands of members) cannot exhaust the worker's disk.
DEFAULT_MAX_ZIP_MEMBERS = 4096
DEFAULT_MAX_ZIP_UNCOMPRESSED_SIZE = 256 * 1024 * 1024  # 256 MiB


def check_zip_safety(
    zip_file: zipfile.ZipFile, max_members: int, max_total_size: int
) -> None:
    """Reject archives that are unsafe to extract.

    * Member names that are absolute or contain a ``..`` path component are
      rejected outright. ``extractall()`` on modern Python already sanitizes
      such names instead of writing outside the target directory, but it does
      so *silently* (relocating the file); failing the commit visibly is both
      safer and easier to debug.
    * The archive is rejected when it has more than ``max_members`` members or
      when its declared total uncompressed size exceeds ``max_total_size``
      (zip-bomb protection; the sizes are validated against the actual stream
      by zipfile's CRC/size checks during extraction).
    """
    infos = zip_file.infolist()
    if len(infos) > max_members:
        raise ValueError(
            f"Zip archive has too many members ({len(infos)} > {max_members})"
        )
    total_size = 0
    for info in infos:
        name = info.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/"):
            raise ValueError(
                f"Zip archive has an unsafe member name: {info.filename!r}"
            )
        total_size += info.file_size
    if total_size > max_total_size:
        raise ValueError(
            f"Zip archive expands to too much data ({total_size} > {max_total_size} bytes)"
        )


async def download_commit_file(
    cfg: Config, storage_provider: StorageProvider, commit: Commit, base_dir: str
) -> None:
    """Download the commit source file into ``<base_dir>/<cfg.src_dir>``.

    Split out of :func:`copy_source_files` so the download can start
    concurrently with the prefetch database queries in ``process_commit``.
    """
    if commit.fname is None:
        raise ValueError("Commit has no filename; cannot download its source file")
    src_dir = os.path.join(base_dir, str(cfg.src_dir))
    os.makedirs(src_dir, DEFAULT_MKDIR_PERMISSIONS)
    destination = os.path.join(src_dir, os.path.basename(commit.fname))
    # boto3 download runs in a worker thread
    await asyncio.to_thread(storage_provider.fetch_commit_file, commit, destination)


async def copy_source_files(
    cfg: Config,
    data_provider: DataProvider,
    storage_provider: StorageProvider,
    commit: Commit,
    base_dir: str,
    semaphore: asyncio.Semaphore,
) -> None:
    """Copy the exercise's extra source files into ``<base_dir>/<cfg.src_dir>``.

    The commit file itself was already downloaded concurrently with the
    prefetch queries (see :func:`download_commit_file`); zip handling happens
    here. Exercise-file downloads are independent of each other and run
    concurrently, bounded by ``semaphore``.
    """
    fname = commit.fname
    if fname is None:
        raise ValueError("Commit has no filename; cannot copy its source files")
    src_dir = os.path.join(base_dir, str(cfg.src_dir))
    destination = os.path.join(src_dir, os.path.basename(fname))

    set_extension(commit)
    extension = commit.extension
    if extension == "zip":
        with zipfile.ZipFile(destination) as zip_file:
            check_zip_safety(
                zip_file,
                int(str(cfg.get("max_zip_members", DEFAULT_MAX_ZIP_MEMBERS))),
                int(
                    str(
                        cfg.get(
                            "max_zip_uncompressed_size",
                            DEFAULT_MAX_ZIP_UNCOMPRESSED_SIZE,
                        )
                    )
                ),
            )
            extension = deduce_language(zip_file)
            commit.extension = extension
            commit.language = language_from_extension(extension)
            zip_file.extractall(src_dir)
    elif extension is not None:
        commit.language = language_from_extension(extension)
    commit.is_compilable = is_compilable(extension)

    # Copy files uploaded with exercise
    fnames = await data_provider.fetch_exercise_files(commit)

    async def copy_exercise_file(fname: str) -> None:
        source = os.path.join(str(commit.real_exercise_id), fname)
        file_destination = os.path.join(src_dir, os.path.basename(fname))
        async with semaphore:
            await asyncio.to_thread(
                storage_provider.fetch_exercise_file, source, file_destination
            )

    results = await asyncio.gather(
        *(copy_exercise_file(fname) for fname in fnames), return_exceptions=True
    )
    raise_first_error(results)


async def copy_test_case_files(
    storage_provider: StorageProvider,
    test_cases: list[TestCase],
    base_dir: str,
    semaphore: asyncio.Semaphore,
) -> None:
    """Download every test case's input and additional files concurrently.

    Each test case's downloads are independent of the others', so one task per
    test case runs in parallel, bounded by ``semaphore``. Directory creation
    stays per test case, right before that case's additional files are
    downloaded.
    """

    async def copy_one(test_case: TestCase) -> None:
        # Copy test case input file (boto3 call in a worker thread)
        dest = os.path.join(base_dir, f"{test_case.id}.in")
        async with semaphore:
            await asyncio.to_thread(
                storage_provider.fetch_test_case_input_file, test_case, dest
            )

        # Copy additional files uploaded to this test case
        test_case_dir = os.path.join(base_dir, f"test_{test_case.id}")
        os.makedirs(test_case_dir, DEFAULT_MKDIR_PERMISSIONS)
        async with semaphore:
            await asyncio.to_thread(
                storage_provider.fetch_test_case_files, test_case, test_case_dir
            )

    results = await asyncio.gather(
        *(copy_one(test_case) for test_case in test_cases), return_exceptions=True
    )
    raise_first_error(results)


def create_container_cfg_file(
    cfg: Config, commit: Commit, test_cases: list[TestCase], base_dir: str
) -> None:
    # Every numeric value is serialized as a non-negative integer: the
    # hardened load_container_config in base-script.sh validates them with
    # ^[0-9]+$ and hard-fails on anything else -- a float like the config
    # default compilation_timeout=10.0 would kill every commit. Ceil, not
    # trunc, so a fractional timeout never gets shorter than configured.
    container_cfg: list[tuple[str, object, bool]] = [
        ("monitor_max_fs", math.ceil(cfg.monitor_max_file_size), False),
        ("monitor_max_ms", math.ceil(cfg.monitor_max_mem_size), False),
        ("compilation_timeout", math.ceil(cfg.compilation_timeout), False),
        ("src_file", commit.fname, True),
    ]
    container_cfg.extend(
        [(f"t_{test.id}", math.ceil(test.cpu_time), False) for test in test_cases]
    )
    # Per-test memory ceiling (m_<id>) is deliberately NOT emitted, even
    # though TestCase carries max_mem_size and base-script.sh understands
    # the key. The legacy server hardcodes maxmemsize=4096 on every case
    # and the legacy pipeline never forwarded it, so the unit was never
    # pinned down -- enforced as bytes (what monitor -m takes) it is 4KiB
    # and kills any process instantly (a bare python3 needs ~9MB RSS);
    # even read as KiB it is below interpreter baseline. Threading it
    # through was tried in 2026-10 and broke every existing exercise.
    # Revisit only together with a DB migration that defines the unit and
    # fixes the stored values.
    with open(os.path.join(base_dir, str(cfg.container_cfg_file)), "w") as cfg_file:
        for cfg_item in container_cfg:
            if cfg_item[2]:  # value needs shell quoting
                # The config file is sourced by base-script.sh inside the
                # container, and the value (the submitted filename) is
                # student-controlled: escape embedded single quotes so a
                # crafted name cannot break out of the quoting and inject
                # shell into the container startup.
                value = str(cfg_item[1]).replace("'", "'\\''")
                print(f"{cfg_item[0]}='{value}'", file=cfg_file)
            else:
                print(f"{cfg_item[0]}={cfg_item[1]}", file=cfg_file)


def prepare_output_file(cfg: Config, commit: Commit, base_dir: str) -> str:
    def should_truncate(fname: str) -> bool:
        return fname.endswith((".output", ".error"))

    def truncate(fname: str) -> None:
        with open(fname, "a") as f:
            size = f.seek(0, 2)
            if size > cast(int, cfg.max_output_file_size):
                _ = f.seek(0, 0)
                _ = f.truncate(cast(int, cfg.max_output_file_size))

    output_dir = os.path.join(base_dir, str(cfg.output_files_dir))
    output_fname = os.path.join(base_dir, f"{commit.id}.zip")
    with zipfile.ZipFile(output_fname, "w") as output_file:
        for dir_path, _, fnames in os.walk(output_dir):
            for fname in fnames:
                fs_fname = os.path.join(dir_path, fname)
                if should_truncate(fs_fname):
                    truncate(fs_fname)
                ar_dirname = os.path.dirname(fs_fname).replace(output_dir, ".")
                ar_fname = os.path.join(ar_dirname, fname)
                output_file.write(fs_fname, ar_fname)
    return output_fname


def cleanup_tests(base_dir: str) -> None:
    if os.path.isdir(base_dir):
        # Errors propagate: no error handler is passed, so rmtree() raises on
        # the first failure. The previous onexc handler re-raised the same
        # exception, which is equivalent but crashed on Python 3.12+ where
        # the handler receives the exception itself, not a 3-tuple.
        shutil.rmtree(base_dir)
