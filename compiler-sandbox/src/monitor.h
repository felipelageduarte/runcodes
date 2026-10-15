#ifndef MONITOR_H
#define MONITOR_H

#include <stdio.h>
#include <sys/types.h>

typedef struct {
    const char *in_fname;
    const char *out_fname;
    const char *err_fname;
    unsigned long fs_limit;   /* file size limit, in bytes; 0 = unset */
    unsigned long ms_limit;   /* memory (address space) limit, in bytes; 0 = unset */
    double wall_limit_sec;    /* wall-clock timeout, in seconds; 0 = unset */
    unsigned long cpu_limit_sec; /* CPU-time timeout, in seconds; 0 = unset */
    int drop_uid;             /* uid to switch to before exec; -1 = don't drop */
    int drop_gid;             /* gid to switch to before exec; -1 = don't drop */
    const char *command;
} MonitorParams;

/*
 * Coarse outcome classification, printed as `status=` in addition to the
 * raw `exit_status`/`signal` fields (which are kept byte-for-byte
 * compatible with older monitor versions).
 */
typedef enum {
    MONITOR_STATUS_UNKNOWN = 0,
    MONITOR_STATUS_OK,    /* exited normally with status 0 */
    MONITOR_STATUS_NZEC,  /* exited normally with a non-zero status */
    MONITOR_STATUS_RE,    /* terminated by a signal (runtime error/crash) */
    MONITOR_STATUS_TLE,   /* killed by the monitor's own wall/CPU timeout */
} MonitorStatus;

typedef struct {
    int exit_status;
    int signal;
    int timed_out;        /* 1 if killed by -t/-T, 0 otherwise */
    double time_sec;       /* wall-clock time */
    double cpu_user_sec;   /* user CPU time (getrusage) */
    double cpu_sys_sec;    /* system CPU time (getrusage) */
    long max_rss_kb;       /* peak resident set size, in KB (getrusage) */
    long major_faults;     /* major page faults (getrusage) */
    MonitorStatus status;
} MonitorStats;

/*
 * Returns a string with the name of the signal (SIGSOMETHING) or UNKNOWN if the
 * signal is unkown.
 */
const char *signal_name(int signal);

/*
 * Returns a short machine-readable name for a MonitorStatus (OK, NZEC, RE,
 * TLE, or UNKNOWN).
 */
const char *status_name(MonitorStatus status);

/*
 * Runs a monitored child command using the given parameters, storing execution
 * info in `stats`. Returns 0 on success (the command was launched, however it
 * then behaved) or -1 if `fork()` itself failed.
 */
int run_monitor(const MonitorParams *params, MonitorStats *stats);

#endif // MONITOR_H
