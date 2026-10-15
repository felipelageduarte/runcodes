# ADR: how far to take sandbox isolation (own monitor vs. isolate/nsjail vs. gVisor)

Status: proposed (not yet acted on). Written as part of the audit in
`runcodes-compiler-sandbox-oportunidades.md`, item E5.

## Context

`runcodes-compiler-sandbox` is a ~400-line C program: `fork()`, `setrlimit()`
(FSIZE/AS/CORE/CPU), redirect stdio, `exec()`, and now (as of this change)
a native wall-clock timeout, `getrusage()` reporting, process-group
cleanup, symlink-safe I/O, and an optional privilege drop. It runs inside a
Docker container that `runcodes-compiler` starts per commit.

Containment today is layered:

1. `runcodes-compiler-sandbox`: per-process rlimits, timeouts, process-group kill.
2. Docker (`runcodes-compiler`'s `container.run()`): `network_mode=none`,
   `cap_drop=["ALL"]`, `no-new-privileges` (added in an earlier change in
   this same audit).
3. Nothing yet at the cgroup level beyond whatever Docker's defaults give
   the container as a whole (no per-test memory/CPU/pids ceiling).

## The question

Keep hardening the bespoke monitor+rlimits approach, or replace the
containment layer with a tool purpose-built for exactly this problem
(competitive-programming/online-judge sandboxing)?

## Options considered

### A. Keep hardening the bespoke monitor

Already done in this change: native timeouts, rusage, process-group kill,
symlink-safe I/O, optional privilege drop. Still missing relative to a
dedicated sandbox: per-test cgroup (memory/CPU/pids) limits, seccomp
filtering, and real namespace isolation (the process-group kill is a
meaningful improvement but a process that calls `setsid()` can still
escape the group).

**Pros**: no new dependency; the team already owns and understands every
line; the output format is already the one `runcodes-compiler` expects.
**Cons**: every one of those missing pieces (cgroups, seccomp, namespaces)
is exactly the kind of security-critical, easy-to-get-subtly-wrong code
that dedicated sandboxes exist to not have every project reinvent.

### B. Adopt [isolate](https://github.com/ioi/isolate) (used by IOI/CMS) or [nsjail](https://github.com/google/nsjail)

Both are purpose-built for this exact problem (untrusted-code execution
with resource limits) and already implement cgroups, namespaces, and
(nsjail) seccomp. `runcodes-compiler-sandbox` would become a thin adapter: build
the `isolate`/`nsjail` invocation from the same `MonitorParams`-shaped
input, and translate its result back into the `monitor_out` format
documented in `docs/output-format.md` so `runcodes-compiler` needs no
changes.

**Pros**: cgroups/namespaces/seccomp come for free, maintained by people
whose whole job is getting this right. **Cons**: a new dependency to
vendor/package into the per-language Docker images; `isolate` in
particular expects to manage cgroups itself, which needs validating inside
whatever container runtime `runcodes-compiler` ends up using in production
(rootless Docker, Kubernetes, etc.) -- not yet done.

### C. Run the whole container under gVisor (`runsc`) or Kata

Moves isolation to the container *runtime* instead of the process inside
it; `runcodes-compiler-sandbox` itself would not need to change at all.

**Pros**: strongest isolation boundary of the three options (a userspace
kernel, in gVisor's case); zero changes to `runcodes-compiler-sandbox` or
`runcodes-compiler`. **Cons**: runtime switch is an infrastructure/ops
decision outside either repo's control, adds per-container startup
overhead, and does nothing for the "one container runs every test
sequentially" model's existing flaws (S5/S6/S9 in the audit -- interference
between tests in the same commit) since it isolates the container as a
whole, not each test within it.

## Recommendation

Option B (isolate/nsjail as the containment engine, `runcodes-compiler-sandbox` or
a thin wrapper around it as the `runcodes-compiler`-facing adapter),
introduced incrementally:

1. This change (bespoke monitor hardening) ships first -- it is a strict
   improvement over the prior state regardless of what happens next, and
   needed no new infrastructure.
2. Evaluate `isolate` specifically against the target deployment's cgroup
   delegation model (this needs an environment where that can actually be
   tested end-to-end, which was not available while writing this ADR --
   see the accompanying PR descriptions for why).
3. If it fits, migrate by keeping `docs/output-format.md`'s field set as
   the contract: `runcodes-compiler` should not need to change regardless of
   which binary produces `monitor_out`.

Option C is not rejected outright -- it is complementary (nothing stops
running an isolate/nsjail-based container under gVisor too) -- but it is a
platform decision for whoever owns the deployment, not something to
resolve inside this repository.
