#!/bin/bash
# Integration test suite for the monitor binary. Builds the fixture
# programs under tests/fixtures and exercises every behavior documented in
# runcodes-compiler-sandbox-oportunidades.md that is observable end-to-end (as
# opposed to tests/test_signal_name.c's pure-function unit tests).
#
# Usage: integration_test.sh /path/to/monitor /path/to/tests/fixtures
#
# Exits 0 if every check passes, non-zero (printing which check failed) on
# the first failure.
set -u

MONITOR="${1:?usage: integration_test.sh <monitor_bin> <fixtures_dir>}"
FIXTURES="${2:?usage: integration_test.sh <monitor_bin> <fixtures_dir>}"
WORK=$(mktemp -d)
chmod 755 "$WORK" # needed for the -u privilege-drop case to exec into it
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" || exit 1

FAILED=0

fail() {
    echo "FAIL: $1"
    FAILED=1
}

pass() {
    echo "ok: $1"
}

# field <monitor_out_file> <key> -> prints the value of key=... (first match)
field() {
    grep -m1 "^$2=" "$1" | cut -d= -f2-
}

assert_field() {
    local mout="$1" key="$2" expected="$3" label="$4"
    local actual
    actual=$(field "$mout" "$key")
    if [ "$actual" = "$expected" ]; then
        pass "$label ($key=$actual)"
    else
        fail "$label: expected $key=$expected, got $key=$actual"
    fi
}

echo "== building fixtures =="
for src in "$FIXTURES"/*.c; do
    name=$(basename "${src%.c}")
    gcc -O0 -g -o "$name" "$src" || {
        fail "failed to build fixture $name"
        exit 1
    }
done

echo "== legacy-compatible scenarios (output must match the pre-wave-2 monitor) =="

"$MONITOR" -c "./ok" -o out -e err >mout
assert_field mout exit_status 0 "normal exit reports exit_status=0"
assert_field mout signal "" "normal exit reports no signal"
[ "$(cat out)" = "hello world" ] && pass "stdout captured correctly" || fail "stdout not captured correctly"

"$MONITOR" -c "./exit42" -o out -e err >mout
assert_field mout exit_status 42 "non-zero exit code is reported verbatim"

"$MONITOR" -c "./segv" -o out -e err >mout
assert_field mout signal SIGSEGV "segfault reports SIGSEGV"

"$MONITOR" -c "" -o out -e err >mout
assert_field mout exit_status 255 "empty command fails cleanly with exit_status=255"
assert_field mout signal "" "empty command does not report a signal (no crash masquerading as one)"

echo "== B1: signal is reported even when a core dump would be produced =="
(
    ulimit -c unlimited
    "$MONITOR" -c "./segv" -o out -e err >mout
)
assert_field mout signal SIGSEGV "segfault with core dump still reports SIGSEGV"
if [ -e core ] || [ -e core.* ]; then
    fail "a core file was produced even though RLIMIT_CORE is zeroed by the monitor"
else
    pass "no core file produced"
fi

echo "== E1/E2/E3/B2: native wall-clock timeout, no external 'timeout' wrapper =="
start=$(date +%s)
"$MONITOR" -t 1 -c "./slow" -o out -e err >mout
elapsed=$(( $(date +%s) - start ))
assert_field mout status TLE "wall-clock timeout is classified as TLE"
assert_field mout timeout 1 "wall-clock timeout sets timeout=1"
if [ "$elapsed" -le 3 ]; then
    pass "wall-clock timeout fired close to the configured limit (${elapsed}s)"
else
    fail "wall-clock timeout took too long (${elapsed}s, expected ~1s)"
fi

echo "== E2/E3: native CPU-time timeout =="
"$MONITOR" -T 1 -c "./busy" -o out -e err >mout
assert_field mout status TLE "CPU-time timeout is classified as TLE"
assert_field mout signal SIGXCPU "CPU-time timeout terminates with SIGXCPU"

echo "== E1: rusage fields are populated =="
"$MONITOR" -c "./ok" -o out -e err >mout
max_rss=$(field mout max_rss_kb)
if [ -n "$max_rss" ] && [ "$max_rss" -gt 0 ] 2>/dev/null; then
    pass "max_rss_kb is a positive number ($max_rss)"
else
    fail "max_rss_kb missing or not positive: '$max_rss'"
fi

echo "== S3: privilege drop via -u =="
"$MONITOR" -u 65534:65534 -c "./whoami_uid" -o out -e err >mout
if [ "$(cat out)" = "uid=65534 gid=65534" ]; then
    pass "process ran as the requested unprivileged uid/gid"
else
    fail "process did not run as the requested uid/gid: $(cat out)"
fi

echo "== S5: symlink targets are refused instead of followed =="
echo PRECIOUS >sentinel.txt
ln -sf sentinel.txt evil_out.txt
"$MONITOR" -c "./ok" -o evil_out.txt -e err >mout
if [ "$(cat sentinel.txt)" = "PRECIOUS" ]; then
    pass "symlinked output target was not followed; sentinel file untouched"
else
    fail "sentinel file was overwritten through a symlinked output path"
fi

echo "== S6/E11: the whole process group is cleaned up, not just the direct child =="
rm -f grandchild_survived
"$MONITOR" -c "./forker" -o out -e err >mout
sleep 1
if [ -f grandchild_survived ]; then
    fail "an orphaned grandchild survived past the monitored command"
else
    pass "orphaned grandchild was killed along with the rest of the process group"
fi

echo "== B7: malformed/negative numeric options are rejected, not silently misparsed =="
"$MONITOR" -f '10abc' -c "./ok" >/dev/null 2>&1
[ $? -ne 0 ] && pass "-f '10abc' rejected" || fail "-f '10abc' was accepted"
"$MONITOR" -f '-1' -c "./ok" >/dev/null 2>&1
[ $? -ne 0 ] && pass "-f '-1' rejected" || fail "-f '-1' was accepted"
"$MONITOR" -u 'notanumber:5' -c "./ok" >/dev/null 2>&1
[ $? -ne 0 ] && pass "-u 'notanumber:5' rejected" || fail "-u 'notanumber:5' was accepted"

echo "== B3/B4: previously-undefined-behavior inputs now fail deterministically =="
long_cmd=$(printf 'A%.0s' $(seq 1 2500))
"$MONITOR" -c "echo $long_cmd" -o out -e err >mout
assert_field mout exit_status 255 "command over COMMAND_MAX is rejected explicitly"

if [ "$FAILED" -eq 0 ]; then
    echo "ALL CHECKS PASSED"
    exit 0
else
    echo "SOME CHECKS FAILED"
    exit 1
fi
