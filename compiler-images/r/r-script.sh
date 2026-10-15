# NOTE: no support for Makefile

make_src() {
    cat /bin/run_codes_functions.r "${src_file}" >/tmp/src.r
    # `mv src dst`, not `mv src >dst`: the redirect form truncated the
    # student's source file to empty and left mv failing with a missing
    # destination operand.
    mv /tmp/src.r "${src_file}"
}

# NOTE: make_src is currently NOT wired in. To enable it, pass it to
# run_tests as the second argument (`run_tests "$run_command" make_src`);
# assigning pre_run_command here has no effect because run_tests overwrites
# it with its own $2. Before wiring it in, fix run_codes_functions.r: its
# library() override passes `lib.loc` twice, which is an error in R, so
# enabling the prepend as-is would break any submission that calls
# library().
pre_run_command=make_src
run_command="Rscript --silent --slave --vanilla ${src_file}"

run_tests "$run_command"
