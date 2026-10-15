"""Unit tests for workspace.create_container_cfg_file, in particular the
per-test memory ceiling (`m_<id>`) added alongside the existing per-test
timeout (`t_<id>`) -- runcodes-compiler-sandbox-oportunidades.md item S1/S7: TestCase
already carried `max_mem_size`, but it was never threaded through to the
container, so every test ran under the same global memory limit regardless
of what an exercise configured per case.
"""

import datetime
import io
import os
import tempfile
import unittest
import zipfile
from typing import override

from rcc.config import Config
from rcc.engine.workspace import check_zip_safety, create_container_cfg_file
from rcc.model import Commit, TestCase


def build_commit(fname: str = "hello.c") -> Commit:
    return Commit(
        1,
        "user@example.com",
        1,
        1,
        Commit.STATUS_RUNNING,
        "",
        0,
        0,
        False,
        "",
        datetime.datetime.now(tz=datetime.UTC),
        None,
        None,
        None,
        "",
        None,
        fname,
        1,
        1,
        1,
        fname,
        None,
    )


def build_test_case(
    test_case_id: int, cpu_time: int = 5, max_mem_size: int = 0
) -> TestCase:
    return TestCase(
        test_case_id,
        1,
        TestCase.IO_TYPE_TEXT,
        TestCase.IO_TYPE_TEXT,
        False,
        False,
        max_mem_size,
        cpu_time,
        0,
        False,
        0,
        None,
        None,
    )


class TestCreateContainerCfgFile(unittest.TestCase):
    cfg: Config = Config(
        {
            "monitor_max_file_size": 5242880,
            "monitor_max_mem_size": 268435456,
            "compilation_timeout": 10,
            "container_cfg_file": "container.config",
        }
    )
    tmpdir: tempfile.TemporaryDirectory[str] = tempfile.TemporaryDirectory()

    @override
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()

    @override
    def tearDown(self) -> None:
        self.tmpdir.cleanup()

    def read_cfg(self) -> list[str]:
        path = os.path.join(self.tmpdir.name, "container.config")
        with open(path) as f:
            return [line.rstrip("\n") for line in f]

    def test_global_fields_unchanged(self) -> None:
        commit = build_commit()
        create_container_cfg_file(self.cfg, commit, [], self.tmpdir.name)
        lines = self.read_cfg()
        self.assertIn("monitor_max_fs=5242880", lines)
        self.assertIn("monitor_max_ms=268435456", lines)
        self.assertIn("compilation_timeout=10", lines)
        self.assertIn("src_file='hello.c'", lines)

    def test_per_test_timeout_always_emitted(self) -> None:
        commit = build_commit()
        test_cases = [build_test_case(1, cpu_time=3), build_test_case(2, cpu_time=7)]
        create_container_cfg_file(self.cfg, commit, test_cases, self.tmpdir.name)
        lines = self.read_cfg()
        self.assertIn("t_1=3", lines)
        self.assertIn("t_2=7", lines)

    def test_per_test_memory_never_emitted(self) -> None:
        # m_<id> is deliberately not emitted even when max_mem_size is set:
        # the legacy server hardcodes maxmemsize=4096 on every case with an
        # undefined unit, and enforcing it (monitor -m takes bytes) kills any
        # process instantly. See the comment in create_container_cfg_file —
        # revisit together with a DB migration that pins the unit down.
        commit = build_commit()
        test_cases = [
            build_test_case(1, max_mem_size=0),
            build_test_case(2, max_mem_size=1073741824),
        ]
        create_container_cfg_file(self.cfg, commit, test_cases, self.tmpdir.name)
        lines = self.read_cfg()
        self.assertFalse(any(line.startswith("m_") for line in lines))

    def test_src_file_single_quotes_are_escaped(self) -> None:
        # The config file is sourced by base-script.sh inside the container:
        # a single quote in the (student-controlled) filename must not break
        # out of the quoting.
        commit = build_commit("a'$(touch pwned)'.c")
        create_container_cfg_file(self.cfg, commit, [], self.tmpdir.name)
        lines = self.read_cfg()
        self.assertIn("src_file='a'\\''$(touch pwned)'\\''.c'", lines)


def build_zip(members: dict[str, bytes]) -> zipfile.ZipFile:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return zipfile.ZipFile(io.BytesIO(buffer.getvalue()))


class TestCheckZipSafety(unittest.TestCase):
    def test_accepts_a_plain_archive(self) -> None:
        with build_zip({"main.c": b"int main(){}", "lib/util.h": b""}) as zf:
            check_zip_safety(zf, max_members=10, max_total_size=1024)

    def test_rejects_too_many_members(self) -> None:
        with (
            build_zip({f"f{i}.c": b"x" for i in range(5)}) as zf,
            self.assertRaisesRegex(ValueError, "too many members"),
        ):
            check_zip_safety(zf, max_members=4, max_total_size=1024)

    def test_rejects_oversized_total_uncompressed_size(self) -> None:
        with (
            build_zip({"a.c": b"x" * 600, "b.c": b"y" * 600}) as zf,
            self.assertRaisesRegex(ValueError, "too much data"),
        ):
            check_zip_safety(zf, max_members=10, max_total_size=1024)

    def test_rejects_parent_directory_traversal(self) -> None:
        with (
            build_zip({"../evil.c": b"x"}) as zf,
            self.assertRaisesRegex(ValueError, "unsafe member name"),
        ):
            check_zip_safety(zf, max_members=10, max_total_size=1024)

    def test_rejects_absolute_member_names(self) -> None:
        with (
            build_zip({"/etc/passwd": b"x"}) as zf,
            self.assertRaisesRegex(ValueError, "unsafe member name"),
        ):
            check_zip_safety(zf, max_members=10, max_total_size=1024)

    def test_rejects_backslash_traversal(self) -> None:
        with (
            build_zip({"..\\evil.c": b"x"}) as zf,
            self.assertRaisesRegex(ValueError, "unsafe member name"),
        ):
            check_zip_safety(zf, max_members=10, max_total_size=1024)


if __name__ == "__main__":
    _ = unittest.main()
