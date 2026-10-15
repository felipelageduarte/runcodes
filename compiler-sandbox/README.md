# run.codes Compiler - Monitor

This program monitors the execution of another program. In particular, it
gathers information such as the running time, exit status and/or signal that
ended its execution.

**Disclaimer:** this solution, even though it works, might not be sufficient on preventing
miss-use from the users. See `runcodes-compiler-sandbox-oportunidades.md` for a full audit of
remaining gaps, and `docs/adr-sandbox-isolation.md` for the trade-off between continuing
to harden this binary versus adopting a dedicated sandbox (isolate/nsjail/gVisor).

## Usage

```sh
monitor [options]
```

### Options

| Option | Description                                                                  |
| ------ | ----------------------------------------------------------------------------- |
| `-f`   | Maximum file size (bytes) that the program can create                        |
| `-m`   | Maximum memory size (bytes) the program can allocate                         |
| `-t`   | Maximum wall-clock time (fractional seconds); killed with SIGKILL past this   |
| `-T`   | Maximum CPU time (seconds); killed with SIGXCPU past this                     |
| `-u`   | Drop privileges to `uid:gid` before exec'ing the command                      |
| `-i`   | File path to where the monitored program will read from                      |
| `-o`   | File path to where the monitored program will output to                      |
| `-e`   | File path to where the monitored program will output errors to               |
| `-c`   | Command to be executed (single string with the command and its args)         |
| `-v`   | Print the monitor's version and exit                                         |

The output format (including the resource-usage and status fields added
alongside the original `exit_status`/`signal`/`time`) is documented in
[`docs/output-format.md`](docs/output-format.md).

### Example

```sh
monitor -t 5 -T 3 -u 1000:1000 -i input.txt -o output.txt -e error.txt -c 'program arg1 arg2'
```

### Running the test suite

```sh
cmake -B build .
cmake --build build
ctest --test-dir build --output-on-failure
```

## License

For information on the license of this project, please see our [license file](LICENSE.md).

## Contributors

For information of the contributors of this project, please see our [contributors file](CONTRIBUTORS.md).

## Contributing

For information on contributing to this project, please see our [contribution guidelines](CONTRIBUTING.md).
