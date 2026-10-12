#define _DEFAULT_SOURCE /* wait4() is a glibc extension, not strict POSIX */

#include "monitor.h"

#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define COMMAND_MAX 2000
#define TIMEOUT_POLL_NSEC 2000000L /* 2ms: wall-timeout poll resolution */

const char *
signal_name(int signal) {
    static const char *const signal_list[] = {
            "UNKNOWN",   /* 0 */
            "SIGHUP",    /* 1 */
            "SIGINT",    /* 2 */
            "SIGQUIT",   /* 3 */
            "SIGILL",    /* 4 */
            "SIGTRAP",   /* 5 */
            "SIGABRT",   /* 6 */
            "SIGBUS",    /* 7 */
            "SIGFPE",    /* 8 */
            "SIGKILL",   /* 9 */
            "SIGUSR1",   /* 10 */
            "SIGSEGV",   /* 11 */
            "SIGUSR2",   /* 12 */
            "SIGPIPE",   /* 13 */
            "SIGALRM",   /* 14 */
            "SIGTERM",   /* 15 */
            "SIGSTKFLT", /* 16 */
            "SIGCHLD",   /* 17 */
            "SIGCONT",   /* 18 */
            "SIGSTOP",   /* 19 */
            "SIGTSTP",   /* 20 */
            "SIGTTIN",   /* 21 */
            "SIGTTOU",   /* 22 */
            "SIGURG",    /* 23 */
            "SIGXCPU",   /* 24 */
            "SIGXFSZ",   /* 25 */
            "SIGVTALRM", /* 26 */
            "SIGPROF",   /* 27 */
            "SIGWINCH",  /* 28 */
            "SIGIO",     /* 29 */
            "SIGPWR",    /* 30 */
            "SIGSYS",    /* 31 */
    };
    const int signal_count = (int) (sizeof(signal_list) / sizeof(signal_list[0]));

    if (signal == -1)
        return ""; /* No signal */

    if (signal < 0 || signal >= signal_count)
        signal = 0; /* Unknown signal */
    return signal_list[signal];
}

const char *
status_name(MonitorStatus status) {
    switch (status) {
        case MONITOR_STATUS_OK:
            return "OK";
        case MONITOR_STATUS_NZEC:
            return "NZEC";
        case MONITOR_STATUS_RE:
            return "RE";
        case MONITOR_STATUS_TLE:
            return "TLE";
        default:
            return "UNKNOWN";
    }
}

static double
elapsed_secs(const struct timespec *ts_start, const struct timespec *ts_end) {
    double delta_sec = (double) (ts_end->tv_sec - ts_start->tv_sec);
    double delta_nsec = (double) (ts_end->tv_nsec - ts_start->tv_nsec);
    return delta_sec + delta_nsec * 1e-9;
}

static char **
parse_args(char *command) {
    char **args = NULL, **tmp,
            *arg;
    int i;

    arg = strtok(command, " \t");
    for (i = 0; arg != NULL; i++) {
        tmp = (char **) realloc(args, sizeof(char *) * (i + 2));
        if (!tmp) {
            free(args);
            return NULL;
        }
        args = tmp;
        args[i] = arg;
        arg = strtok(NULL, " \t");
    }

    if (i == 0) {
        /* Empty (or whitespace-only) command: nothing to exec. */
        return NULL;
    }

    args[i] = NULL;
    return args;
}

static int
set_limits(const MonitorParams *params) {
    /* Core dumps serve no purpose in the sandbox and only waste disk; the
     * terminating signal is already reported via WTERMSIG regardless of
     * whether a core would have been produced. */
    struct rlimit core_limit = {0, 0};
    if (setrlimit(RLIMIT_CORE, &core_limit) < 0)
        return 0;

    /* File size limit */
    if (params->fs_limit > 0) {
        struct rlimit fs_limit;

        fs_limit.rlim_cur = fs_limit.rlim_max = params->fs_limit;
        if (setrlimit(RLIMIT_FSIZE, &fs_limit) < 0)
            return 0;
    }

    /* Memory size limit */
    if (params->ms_limit > 0) {
        struct rlimit ms_limit;

        ms_limit.rlim_cur = ms_limit.rlim_max = params->ms_limit;
        if (setrlimit(RLIMIT_AS, &ms_limit) < 0)
            return 0;
    }

    /* CPU-time limit: a one-second cushion between the soft and hard
     * limits means the process is terminated with SIGXCPU (the default
     * disposition) rather than racing straight to an unconditional
     * SIGKILL, so the caller can tell a CPU-time timeout apart from an
     * arbitrary kill. */
    if (params->cpu_limit_sec > 0) {
        struct rlimit cpu_limit;

        cpu_limit.rlim_cur = params->cpu_limit_sec;
        cpu_limit.rlim_max = params->cpu_limit_sec + 1;
        if (setrlimit(RLIMIT_CPU, &cpu_limit) < 0)
            return 0;
    }

    return 1;
}

/*
 * Opens `path` for the child's stdin/stdout/stderr and installs it as `fd`,
 * refusing to follow a symlink (O_NOFOLLOW): a test's output/error files are
 * siblings writable by whatever a monitored program does in the same
 * directory, and transparently following a symlink planted there (e.g. onto
 * another test's files, or a binary elsewhere in the container) would let
 * the monitored program corrupt state it has no business touching.
 */
static int
open_safe(const char *path, int for_write, int fd) {
    int flags = for_write ? (O_WRONLY | O_CREAT | O_TRUNC) : O_RDONLY;
    int opened = open(path, flags | O_NOFOLLOW | O_CLOEXEC, 0644);
    if (opened < 0)
        return 0;
    if (dup2(opened, fd) < 0) {
        close(opened);
        return 0;
    }
    close(opened);
    return 1;
}

static int
reopen_streams(const MonitorParams *params) {
    if (params->in_fname)
        if (!open_safe(params->in_fname, 0, STDIN_FILENO))
            return 0;
    if (!open_safe(params->out_fname, 1, STDOUT_FILENO))
        return 0;
    if (!open_safe(params->err_fname, 1, STDERR_FILENO))
        return 0;
    return 1;
}

/*
 * Switches to an unprivileged uid/gid before exec, when configured (`-u`).
 * A no-op when `drop_uid`/`drop_gid` are unset (-1): existing callers that
 * never pass `-u` keep running exactly as before.
 */
static int
drop_privileges(const MonitorParams *params) {
    if (params->drop_uid < 0)
        return 1;

    if (setgroups(0, NULL) != 0)
        return 0;
    if (setgid((gid_t) params->drop_gid) != 0)
        return 0;
    if (setuid((uid_t) params->drop_uid) != 0)
        return 0;
    /* Belt and suspenders: even if some inherited capability survived the
     * uid/gid switch, this stops it from granting anything extra across
     * the exec. */
    prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);
    return 1;
}

static void
exec_cmd(const MonitorParams *params) {
    /* A copy of the monitor's original stderr, taken before stdin/out/err
     * are redirected to the test's files: diagnostics about the monitor
     * itself failing to set up (as opposed to anything the monitored
     * program did) must not land in the test's `.error` file, where the
     * grader would mistake an infrastructure failure for the submission's
     * own stderr output. */
    int diag_fd = dup(STDERR_FILENO);

    /* Every process the monitored command spawns is placed in a fresh
     * process group (this one's own pid becomes the group id). That lets
     * the parent clean up the whole subtree at once -- directly-forked
     * helpers as well as anything that tries to survive by daemonizing --
     * instead of only ever being able to wait for/signal its one direct
     * child. */
    setpgid(0, 0);

    char buf[COMMAND_MAX + 1];

    if (strlen(params->command) > COMMAND_MAX) {
        dprintf(diag_fd, "monitor: error: command exceeds %d characters\n", COMMAND_MAX);
        exit(255);
    }
    strncpy(buf, params->command, COMMAND_MAX);
    buf[COMMAND_MAX] = '\0';

    char **args = parse_args(buf);
    if (!args) {
        dprintf(diag_fd, "monitor: error: empty or invalid command\n");
        exit(255);
    }

    if (!set_limits(params)) {
        dprintf(diag_fd, "monitor: error: failed to set process limits\n");
        exit(252);
    }

    if (!reopen_streams(params)) {
        dprintf(diag_fd, "monitor: error: failed to initialize streams\n");
        exit(253);
    }

    if (!drop_privileges(params)) {
        dprintf(diag_fd, "monitor: error: failed to drop privileges\n");
        exit(254);
    }

    close(diag_fd);
    if (execvp(args[0], args) == -1) {
        /* diag_fd is closed; stderr is already the test's own .error file
         * at this point, which is the best remaining place to explain why
         * exec itself never got off the ground (e.g. a bad command). */
        fprintf(stderr, "monitor: exec failed\n");
        exit(255);
    }
}

static void
classify_status(MonitorStats *stats, const MonitorParams *params) {
    if (stats->timed_out) {
        stats->status = MONITOR_STATUS_TLE;
    } else if (params->cpu_limit_sec > 0 && stats->signal == SIGXCPU) {
        stats->status = MONITOR_STATUS_TLE;
    } else if (stats->signal != -1) {
        stats->status = MONITOR_STATUS_RE;
    } else if (stats->exit_status == 0) {
        stats->status = MONITOR_STATUS_OK;
    } else {
        stats->status = MONITOR_STATUS_NZEC;
    }
}

static void
trace_child(pid_t child_pid, const MonitorParams *params, MonitorStats *stats) {
    struct timespec ts_start, ts_now;
    struct rusage usage;
    int status = 0;
    pid_t r;
    int killed_for_timeout = 0;
    int have_wall_limit = params->wall_limit_sec > 0;

    memset(&usage, 0, sizeof(usage));
    clock_gettime(CLOCK_MONOTONIC, &ts_start);

    for (;;) {
        int wait_flags = __WALL | ((have_wall_limit && !killed_for_timeout) ? WNOHANG : 0);
        r = wait4(child_pid, &status, wait_flags, &usage);
        if (r == child_pid)
            break;
        if (r == -1) {
            if (errno == EINTR)
                continue;
            fprintf(stderr, "monitor: error: wait4()\n");
            break;
        }

        /* r == 0: still running, and we're only here because a wall
         * timeout is configured and hasn't fired yet. */
        clock_gettime(CLOCK_MONOTONIC, &ts_now);
        if (elapsed_secs(&ts_start, &ts_now) >= params->wall_limit_sec) {
            kill(-child_pid, SIGKILL); /* whole process group */
            stats->timed_out = 1;
            killed_for_timeout = 1; /* next iteration blocks for the reap */
        } else {
            struct timespec poll_delay = {0, TIMEOUT_POLL_NSEC};
            nanosleep(&poll_delay, NULL);
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &ts_now);
    stats->time_sec = elapsed_secs(&ts_start, &ts_now);

    if (r == child_pid) {
        if (WIFEXITED(status)) {
            stats->exit_status = WEXITSTATUS(status);
        } else if (WIFSIGNALED(status)) {
            /* Report the terminating signal regardless of whether a core
             * dump was produced: a core dump does not mean the process
             * exited cleanly, and omitting the signal here let a crash
             * (e.g. SIGSEGV) be mistaken for a clean run by callers that
             * only check `signal`. */
            stats->signal = WTERMSIG(status);
        }
        stats->cpu_user_sec = (double) usage.ru_utime.tv_sec + (double) usage.ru_utime.tv_usec * 1e-6;
        stats->cpu_sys_sec = (double) usage.ru_stime.tv_sec + (double) usage.ru_stime.tv_usec * 1e-6;
        stats->max_rss_kb = usage.ru_maxrss;
        stats->major_faults = usage.ru_majflt;
    }

    /* Best-effort cleanup of anything left behind in the process group
     * (e.g. a daemonized grandchild that tried to outlive this test) --
     * this is the one direct child's group id, so it also covers
     * processes that were never this monitor's own children to reap. */
    kill(-child_pid, SIGKILL);

    classify_status(stats, params);
}

static void
init_stats(MonitorStats *stats) {
    memset(stats, 0, sizeof(*stats));
    stats->exit_status = -1;
    stats->signal = -1;
    stats->time_sec = -1.0;
    stats->status = MONITOR_STATUS_UNKNOWN;
}

int
run_monitor(const MonitorParams *params, MonitorStats *stats) {
    init_stats(stats);

    pid_t pid = fork();
    switch (pid) {
        case -1:
            // failure
            return -1;
        case 0:
            // child
            exec_cmd(params);
            break;
        default:
            trace_child(pid, params, stats);
            break;
    }

    return 0;
}
