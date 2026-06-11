# Phase 10: Autopilot Spike (go/no-go gate) - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A throwaway 2-day spike that retires the two load-bearing unknowns of the entire Autopilot workstream before any real infrastructure is built: (1) can a headless `claude` fix planted bugs unattended, and (2) can it execute from a launchd (non-interactive) context within subscription rate limits. Output is a written go/no-go decision + execution-isolation design (ISA ISC-115/ISC-116). Nothing in this phase is production code; all of it is disposable by design.

</domain>

<decisions>
## Implementation Decisions

### Spike Execution Design (accepted 2026-06-10)
- Execution identity: dedicated macOS user `autopilot` with its own `claude` login (same subscription, separate device session) — tests the real sandbox primitive end-to-end
- Fixtures: throwaway clone of `brain` with 3 real historical bug-fixes reverted (candidates: issues #270 save-pasted-transcript 500, #296 Fireflies key state, #300 load-more) + 1 vague/unreproducible report fixture (must escalate, not guess) + 1 fixture whose fix requires touching a migration (must divert as out-of-policy, not force-fix)
- Workspace: `~/dev/autopilot-spike/` — fully disposable, never touches `~/dev/brain`
- Permission mode: `--dangerously-skip-permissions` INSIDE the dedicated `autopilot` user; the OS user boundary is the security control (ISA mechanical-not-prompt doctrine)
- Rate-limit soak: 5 fixture runs spread across ≥5h via launchd intervals; timestamps + completion statuses logged to prove execution entitlement (ISC-115)

### Claude's Discretion
- Spike harness language/structure (bun/TS or bash — whatever is fastest to throw away)
- Exact launchd plist intervals and log format
- How fixture results are judged (diff inspection + test run is sufficient; no UI verification needed at spike level)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PromptProcessing.hook.ts` pattern (PAI) — proven subscription-billed headless `claude` spawn (interactive-session context only; the spike extends this to launchd)
- Real bug history in `git log` / closed issues #270/#296/#300 — authentic fixtures with known-good fixes to diff against
- CI test suite (`npm test`, Vitest) — fixture pass/fail oracle inside the clone

### Established Patterns
- CLAUDECODE env blocks nested sessions — the spike daemon must NOT run from inside a Claude session; launchd context avoids this (also the production requirement)
- npm only inside the brain clone; spike harness itself may use bun (lives outside the repo)

### Integration Points
- None — the spike is deliberately isolated. Its only outputs are a log, a go/no-go doc, and the isolation design doc consumed by Phase 13.

</code_context>

<specifics>
## Specific Ideas

- Go/no-go gate: ≥3/5 fixtures handled correctly (incl. the escalate and divert cases counting as "correct handling"), zero rate-limit hard-fails across the soak window
- Spike verdict is presented to Andrew before Phases 12/13/14 begin (hard gate from autonomous-run instructions)
- The isolation design doc must reconcile ISA ISC-104/105 with ISC-30 (claude auth in user context) — that's the dedicated-user test's whole purpose

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
