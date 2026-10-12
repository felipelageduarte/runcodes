"""Unit tests for workspace.create_container_cfg_file, in particular the
per-test memory ceiling (`m_<id>`) added alongside the existing per-test
timeout (`t_<id>`) -- compiler-monitor-oportunidades.md item S1/S7: TestCase
already carried `max_mem_size`, but it was never threaded through to the
container, so every test ran under the same global memory limit regardless
of what an exercise configured per case.
"""

import datetime
import os
import tempfile
import unittest
from typing import override

from rcc.config import Config
from rcc.engine.workspace import create_container_cfg_file
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

    def test_per_test_memory_omitted_when_unset(self) -> None:
        # Control case: a test case that leaves max_mem_size at its default
        # (0) must NOT get an `m_<id>` line, so base-script.sh's existing
        # fallback to the global monitor_max_ms keeps applying exactly as
        # it did before this field existed.
        commit = build_commit()
        test_cases = [build_test_case(1, max_mem_size=0)]
        create_container_cfg_file(self.cfg, commit, test_cases, self.tmpdir.name)
        lines = self.read_cfg()
        self.assertFalse(any(line.startswith("m_1=") for line in lines))

    def test_per_test_memory_emitted_when_set(self) -> None:
        commit = build_commit()
        test_cases = [
            build_test_case(1, max_mem_size=0),
            build_test_case(2, max_mem_size=1073741824),
        ]
        create_container_cfg_file(self.cfg, commit, test_cases, self.tmpdir.name)
        lines = self.read_cfg()
        self.assertFalse(any(line.startswith("m_1=") for line in lines))
        self.assertIn("m_2=1073741824", lines)


if __name__ == "__main__":
    _ = unittest.main()
