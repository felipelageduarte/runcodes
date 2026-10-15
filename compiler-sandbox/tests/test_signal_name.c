/* Unit tests for the small, pure, publicly-exposed helpers in monitor.c:
 * signal_name() and status_name(). The rest of monitor.c's logic (process
 * spawning, limits, timeouts) is exercised by tests/integration_test.sh
 * instead, since it is only meaningful end-to-end. */
#include <assert.h>
#include <signal.h>
#include <string.h>

#include "../src/monitor.h"

static void
test_signal_name_known(void) {
    assert(strcmp(signal_name(SIGSEGV), "SIGSEGV") == 0);
    assert(strcmp(signal_name(SIGKILL), "SIGKILL") == 0);
    assert(strcmp(signal_name(SIGXCPU), "SIGXCPU") == 0);
    assert(strcmp(signal_name(SIGHUP), "SIGHUP") == 0);
}

static void
test_signal_name_no_signal(void) {
    /* -1 is the sentinel used throughout monitor.c for "no signal". */
    assert(strcmp(signal_name(-1), "") == 0);
}

static void
test_signal_name_out_of_range(void) {
    assert(strcmp(signal_name(-2), "UNKNOWN") == 0);
    assert(strcmp(signal_name(9999), "UNKNOWN") == 0);
}

static void
test_status_name(void) {
    assert(strcmp(status_name(MONITOR_STATUS_OK), "OK") == 0);
    assert(strcmp(status_name(MONITOR_STATUS_NZEC), "NZEC") == 0);
    assert(strcmp(status_name(MONITOR_STATUS_RE), "RE") == 0);
    assert(strcmp(status_name(MONITOR_STATUS_TLE), "TLE") == 0);
    assert(strcmp(status_name(MONITOR_STATUS_UNKNOWN), "UNKNOWN") == 0);
}

int main(void) {
    test_signal_name_known();
    test_signal_name_no_signal();
    test_signal_name_out_of_range();
    test_status_name();
    return 0;
}
