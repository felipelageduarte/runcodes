#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "monitor.h"

#define MONITOR_VERSION "2.0.0"

static MonitorParams DEFAULT_PARAMS = {
        NULL,
        "monitored.out",
        "monitored.err",
        0,
        0,
        0.0,
        0,
        -1,
        -1,
        NULL
};

/*
 * Parses arguments and store extracted monitor parameters in 'params'.
 *
 * Returns NULL on success (no error message); otherwise returns a string
 * describing the error.
 */
const char *parse_args(int argc, char *argv[], MonitorParams *params);

/*
 * Print usage info.
 */
void usage(void);

/*
 * Prints error messages in a standard way.
 */
void print_error(const char *msg);

/*
 * Parses `text` as an unsigned integer in [0, ULONG_MAX], rejecting empty
 * strings, leading '-', trailing garbage, and overflow -- unlike a bare
 * `sscanf("%lu")`, which silently accepts all of those (e.g. "-1" wraps
 * around to a huge limit instead of being rejected, and "10abc" is read as
 * just "10").
 */
static int
parse_ulong(const char *text, unsigned long *out) {
    if (text == NULL || text[0] == '\0' || text[0] == '-')
        return 0;

    errno = 0;
    char *end;
    unsigned long value = strtoul(text, &end, 10);
    if (errno == ERANGE || end == text || *end != '\0')
        return 0;

    *out = value;
    return 1;
}

/* Same validation as parse_ulong(), for a non-negative floating point
 * value (used by -t, which takes fractional seconds). */
static int
parse_positive_double(const char *text, double *out) {
    if (text == NULL || text[0] == '\0' || text[0] == '-')
        return 0;

    errno = 0;
    char *end;
    double value = strtod(text, &end);
    if (errno == ERANGE || end == text || *end != '\0')
        return 0;

    *out = value;
    return 1;
}

/*
 * Parses a "uid:gid" pair for -u. Both parts must be valid non-negative
 * integers.
 */
static int
parse_uid_gid(const char *text, int *uid, int *gid) {
    if (text == NULL)
        return 0;

    const char *sep = strchr(text, ':');
    if (sep == NULL || sep == text || *(sep + 1) == '\0')
        return 0;

    char uid_buf[32];
    size_t uid_len = (size_t) (sep - text);
    if (uid_len == 0 || uid_len >= sizeof(uid_buf))
        return 0;
    memcpy(uid_buf, text, uid_len);
    uid_buf[uid_len] = '\0';

    unsigned long uid_val, gid_val;
    if (!parse_ulong(uid_buf, &uid_val) || !parse_ulong(sep + 1, &gid_val))
        return 0;
    if (uid_val > INT_MAX || gid_val > INT_MAX)
        return 0;

    *uid = (int) uid_val;
    *gid = (int) gid_val;
    return 1;
}

const char *
parse_args(int argc, char *argv[], MonitorParams *params) {
    if (params == NULL)
        return "'params' not set";

    int opt;
    unsigned long ulong_value;
    double double_value;
    while ((opt = getopt(argc, argv, "i:o:e:f:m:t:T:u:c:hv")) != -1) {
        switch (opt) {
            case 'h':
                usage();
                exit(0);
            case 'v':
                printf("monitor %s\n", MONITOR_VERSION);
                exit(0);
            case 'i':
                params->in_fname = optarg;
                break;
            case 'o':
                params->out_fname = optarg;
                break;
            case 'e':
                params->err_fname = optarg;
                break;
            case 'f':
                if (!parse_ulong(optarg, &ulong_value))
                    return "incorrect -f parameter";
                params->fs_limit = ulong_value;
                break;
            case 'm':
                if (!parse_ulong(optarg, &ulong_value))
                    return "incorrect -m parameter";
                params->ms_limit = ulong_value;
                break;
            case 't':
                if (!parse_positive_double(optarg, &double_value))
                    return "incorrect -t parameter";
                params->wall_limit_sec = double_value;
                break;
            case 'T':
                if (!parse_ulong(optarg, &ulong_value))
                    return "incorrect -T parameter";
                params->cpu_limit_sec = ulong_value;
                break;
            case 'u':
                if (!parse_uid_gid(optarg, &params->drop_uid, &params->drop_gid))
                    return "incorrect -u parameter (expected uid:gid)";
                break;
            case 'c':
                params->command = optarg;
                break;
            default:
                return "incorrect parameters";
        }
    }

    if (!params->command)
        return "missing -c option";
    return NULL;
}

void usage(void) {
    fprintf(stderr,
            "Usage: monitor [options]"
            "\n\t-i INFILE"
            "\n\t-o OUTFILE          \t Default: %s"
            "\n\t-e ERRFILE          \t Default: %s"
            "\n\t-f MAX_FILE_SIZE    \t In bytes, 0 = unlimited (default)"
            "\n\t-m MAX_MEM_SIZE     \t In bytes, 0 = unlimited (default)"
            "\n\t-t MAX_WALL_SECONDS \t Fractional seconds, 0 = unlimited (default)"
            "\n\t-T MAX_CPU_SECONDS  \t 0 = unlimited (default)"
            "\n\t-u UID:GID          \t Drop privileges before exec"
            "\n\t-c COMMAND"
            "\n\t-v                  \t Print version and exit"
            "\n\t-h                  \t Print this help and exit\n",
            DEFAULT_PARAMS.out_fname,
            DEFAULT_PARAMS.err_fname);
}

void
print_error(const char *msg) {
    fprintf(stderr, "monitor: error: %s\n", msg);
}

int main(int argc, char *argv[]) {
    MonitorParams params = DEFAULT_PARAMS;

    const char *error_msg = parse_args(argc, argv, &params);
    if (error_msg) {
        print_error(error_msg);
        exit(EXIT_FAILURE);
    }

    MonitorStats stats;
    if (run_monitor(&params, &stats) != 0) {
        /* fork() itself failed: no child ever ran, so there is nothing
         * meaningful to report as a result. Fail loudly instead of
         * printing a fabricated "exit_status=-1" line that a caller could
         * mistake for an actual (if unusual) execution outcome. */
        print_error("failed to fork the monitored process");
        exit(EXIT_FAILURE);
    }

    printf("exit_status=%d\n"
           "signal=%s\n"
           "time=%f\n"
           "status=%s\n"
           "timeout=%d\n"
           "cpu_user=%f\n"
           "cpu_sys=%f\n"
           "max_rss_kb=%ld\n"
           "major_faults=%ld\n",
           stats.exit_status,
           signal_name(stats.signal),
           stats.time_sec,
           status_name(stats.status),
           stats.timed_out,
           stats.cpu_user_sec,
           stats.cpu_sys_sec,
           stats.max_rss_kb,
           stats.major_faults);
    return 0;
}
