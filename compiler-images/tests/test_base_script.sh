#!/bin/bash
# Tests for base/base-script.sh's load_container_config(), the S8 fix in
# compiler-monitor-oportunidades.md: container.config must be parsed as
# plain `key=value` data, never executed as shell (as `source`/`eval` would
# have done with it before this change).
#
# Usage: tests/test_base_script.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_SCRIPT="${SCRIPT_DIR}/../base/base-script.sh"

FAILED=0
pass() { echo "ok: $1"; }
fail() {
    echo "FAIL: $1"
    FAILED=1
}

run_in_tmp_workspace() {
    local dir
    dir=$(mktemp -d)
    (
        cd "$dir" || exit 1
        "$@"
    )
    local rc=$?
    rm -rf "$dir"
    return $rc
}

echo "== valid container.config is loaded, with no command execution =="
run_in_tmp_workspace bash -c "
    cat > container.config <<'EOF'
monitor_max_fs=1048576
monitor_max_ms=67108864
compilation_timeout=15
src_file='hello.c'
t_1=4
m_1=33554432
EOF
    source '$BASE_SCRIPT' >/dev/null
    [ \"\$monitor_max_fs\" = 1048576 ] || { echo 'monitor_max_fs mismatch'; exit 1; }
    [ \"\$monitor_max_ms\" = 67108864 ] || { echo 'monitor_max_ms mismatch'; exit 1; }
    [ \"\$compilation_timeout\" = 15 ] || { echo 'compilation_timeout mismatch'; exit 1; }
    [ \"\$src_file\" = 'hello.c' ] || { echo \"src_file mismatch: '\$src_file'\"; exit 1; }
    [ \"\${test_timeout[1]}\" = 4 ] || { echo 'test_timeout[1] mismatch'; exit 1; }
    [ \"\${test_max_ms[1]}\" = 33554432 ] || { echo 'test_max_ms[1] mismatch'; exit 1; }
"
if [ $? -eq 0 ]; then pass "valid config parsed correctly"; else fail "valid config was not parsed correctly"; fi

echo "== an unknown key is rejected =="
run_in_tmp_workspace bash -c "
    echo 'totally_made_up_key=1' > container.config
    source '$BASE_SCRIPT' >/dev/null 2>&1
"
[ $? -ne 0 ] && pass "unknown key rejected" || fail "unknown key was accepted"

echo "== a line that isn't key=value at all is rejected =="
run_in_tmp_workspace bash -c "
    echo 'not a valid line' > container.config
    source '$BASE_SCRIPT' >/dev/null 2>&1
"
[ $? -ne 0 ] && pass "malformed line rejected" || fail "malformed line was accepted"

echo "== a non-numeric value for a numeric key is rejected =="
run_in_tmp_workspace bash -c "
    echo 'monitor_max_fs=not_a_number' > container.config
    source '$BASE_SCRIPT' >/dev/null 2>&1
"
[ $? -ne 0 ] && pass "non-numeric monitor_max_fs rejected" || fail "non-numeric monitor_max_fs was accepted"

echo "== shell metacharacters in a value never execute (no source/eval of the file) =="
run_in_tmp_workspace bash -c "
    rm -f /tmp/test_base_script_pwned
    printf \"src_file='x'; touch /tmp/test_base_script_pwned #'\\n\" > container.config
    source '$BASE_SCRIPT' >/dev/null 2>&1
    [ -f /tmp/test_base_script_pwned ] && exit 1
    exit 0
"
if [ $? -eq 0 ] && [ ! -f /tmp/test_base_script_pwned ]; then
    pass "shell metacharacters in a config value are not executed"
else
    fail "a shell metacharacter in a config value was executed"
fi
rm -f /tmp/test_base_script_pwned

if [ "$FAILED" -eq 0 ]; then
    echo "ALL CHECKS PASSED"
    exit 0
else
    echo "SOME CHECKS FAILED"
    exit 1
fi
