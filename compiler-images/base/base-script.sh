#!/bin/bash

# Configuration variables shared by all containers
container_config_file=container.config
compilation_monitor_error=compilation.monitor_err
compilation_monitor_output=compilation.monitor_out
compilation_error=compilation.err
compilation_output=compilation.out
outputfiles_dir=outputfiles
monitor_bin=/usr/bin/monitor
user_bin=executable

# Variables we expect to be inside ${container_config_file}:
# monitor_max_fs, monitor_max_ms, compilation_timeout, src_file, t_<id>,
# m_<id> (per test case; see load_container_config below).
# We also set defaults here just in case :)
monitor_max_fs=5242880   # 5MB
monitor_max_ms=268435456 #256MB
compilation_timeout=10
src_file=''
make_file=false

declare -A test_timeout
declare -A test_max_ms

# Reads ${container_config_file} as plain `key=value` lines, one per line,
# with no shell metacharacters evaluated -- unlike `source`/`eval`, which
# would execute anything placed in a value (e.g. a value crafted as
# `x=1; curl ...`). Only a fixed set of known keys is accepted; every other
# line (including anything that doesn't parse as `key=value` at all) is
# rejected outright instead of being silently ignored, so a malformed or
# unexpected config file fails loudly rather than partially applying.
load_container_config() {
    local file="$1"
    [[ -e "${file}" ]] || return 0

    local line key value
    while IFS= read -r line || [ -n "${line}" ]; do
        [[ -z "${line}" ]] && continue
        if [[ ! "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            echo "monitor: error: malformed container.config line: ${line}" >&2
            exit 1
        fi
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        # Config-supplied string values are always single-quoted by the
        # generator (see compiler-engine's create_container_cfg_file); strip
        # exactly one matching pair, never arbitrary shell quoting.
        if [[ "${value}" == \'*\' ]]; then
            value="${value:1:-1}"
        fi

        case "${key}" in
            monitor_max_fs | monitor_max_ms | compilation_timeout)
                [[ "${value}" =~ ^[0-9]+$ ]] || {
                    echo "monitor: error: ${key} must be a non-negative integer, got '${value}'" >&2
                    exit 1
                }
                printf -v "${key}" '%s' "${value}"
                ;;
            src_file)
                src_file="${value}"
                ;;
            t_[0-9]*)
                [[ "${value}" =~ ^[0-9]+$ ]] || {
                    echo "monitor: error: ${key} must be a non-negative integer, got '${value}'" >&2
                    exit 1
                }
                test_timeout["${key#t_}"]="${value}"
                ;;
            m_[0-9]*)
                [[ "${value}" =~ ^[0-9]+$ ]] || {
                    echo "monitor: error: ${key} must be a non-negative integer, got '${value}'" >&2
                    exit 1
                }
                test_max_ms["${key#m_}"]="${value}"
                ;;
            *)
                echo "monitor: error: unknown container.config key: ${key}" >&2
                exit 1
                ;;
        esac
    done <"${file}"
}

load_container_config "${container_config_file}"

# Messages sent for notifying of current status
compilation_start_msg='compilation.start'
compilation_done_msg='compilation.done'
run_start_msg='run.start'
run_done_msg='run.done'

compile() {
    compilation_command=$1
    pre_compilation_command=$2
    post_compilation_command=$3

    echo "${compilation_start_msg}"

    # Save working dir to return to it later
    wd="$(pwd)"
    cd ./src || exit

    [ -z "${pre_compilation_command}" ] || eval "${pre_compilation_command}"

    "${monitor_bin}" -f "${monitor_max_fs}" \
        -m "${monitor_max_ms}" \
        -t "${compilation_timeout}" \
        -o "../${compilation_output}" \
        -e "../${compilation_error}" \
        -c "${compilation_command}" \
        >"../${compilation_monitor_output}" \
        2>"../${compilation_monitor_error}"

    [ -z "${post_compilation_command}" ] || eval "${post_compilation_command}"

    # Back to original working dir
    cd "${wd}" || exit

    cp "${compilation_monitor_output}" "${outputfiles_dir}"
    cp "${compilation_monitor_error}" "${outputfiles_dir}"
    cp "${compilation_output}" "${outputfiles_dir}"
    cp "${compilation_error}" "${outputfiles_dir}"

    echo "${compilation_done_msg}"
}

run_tests() {
    run_command=$1
    pre_run_command=$2
    post_run_command=$3

    echo "${run_start_msg}"

    # Save working dir to return to it later
    wd="$(pwd)"

    # Every test case's `.in` file is already present at the workspace root
    # (compiler-engine stages them all up front); lock them all down to the
    # owner only before the loop starts, and open up only the one belonging
    # to the test about to run. Tests run sequentially here, so there's no
    # concurrent access to race against.
    #
    # IMPORTANT: this is currently a no-op against the monitored program
    # itself. Permission bits only stop a process that is NOT the file's
    # owner and is not root; today the monitored program runs as the same
    # root user as everything else in the container (compiler-monitor's
    # `-u` privilege-drop flag exists but is not wired in here yet -- see
    # compiler-monitor-oportunidades.md, item S3), so it can read any
    # `.in` file regardless of this chmod. This becomes real test-to-test
    # input isolation the moment a non-root `-u` is wired in for an image;
    # until then it is kept because it costs nothing and is still correct
    # defense-in-depth for anything else that might read this workspace
    # without running as root.
    chmod 600 ./*.in 2>/dev/null

    while IFS= read -r -d '' test_dir; do
        test_id="${test_dir#./test_}"
        cp -r --update=none ./src/* "${test_dir}"

        cd "${test_dir}" || exit

        timeout="${test_timeout[${test_id}]:-3}"
        max_ms="${test_max_ms[${test_id}]:-${monitor_max_ms}}"

        [ -z "${pre_run_command}" ] || eval "${pre_run_command} ${test_id}"

        chmod 644 "../${test_id}.in" 2>/dev/null

        # Save output files outside of the test dir
        "${monitor_bin}" -f "${monitor_max_fs}" \
            -m "${max_ms}" \
            -t "${timeout}" \
            -i "../${test_id}.in" \
            -o "../${test_id}.output" \
            -e "../${test_id}.error" \
            -c "${run_command}" \
            >"../${test_id}.monitor_out" \
            2>"../${test_id}.monitor_err"

        chmod 600 "../${test_id}.in" 2>/dev/null

        [ -z "${post_run_command}" ] || eval "${post_run_command} ${test_id}"

        # Back to original working dir
        cd "${wd}" || exit

        cp "${test_id}.monitor_out" "${outputfiles_dir}"
        cp "${test_id}.monitor_err" "${outputfiles_dir}"
        cp "${test_id}.output" "${outputfiles_dir}"
        cp "${test_id}.error" "${outputfiles_dir}"
    done < <(find . -maxdepth 1 -type d -name 'test_*' -print0)

    chmod 644 ./*.in 2>/dev/null

    echo "${run_done_msg}"
}

# Make sure we have our directory for output files
mkdir -p "${outputfiles_dir}"

# Standard commands for a Makefile-based submission. This can change depending
# on the particular needs of each language.
if compgen -G "src/?akefile" >/dev/null; then
    make_file=true
    compilation_command='make all'
    run_command='make -s run'
fi
