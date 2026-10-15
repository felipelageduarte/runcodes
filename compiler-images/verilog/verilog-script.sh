if ! compgen -G "src/?akefile" >/dev/null; then
    # Compile against the current test's own `.in` file. This must be a
    # function (invoked by run_tests as `eval "${pre_run_command} ${test_id}"`,
    # so the test id arrives as $1): the previous inline-string form embedded
    # a literal `$1` that, at eval time, expanded to run_tests' first
    # positional parameter (the run command) instead of the test id,
    # producing `iverilog ... .././executable.in <id>` and failing every
    # non-Makefile submission.
    verilog_pre_run() {
        iverilog -o "${user_bin}" ${src_file} "../$1.in"
    }
    pre_run_command=verilog_pre_run
    run_command="./${user_bin}"
fi

run_tests "$run_command" "$pre_run_command"
