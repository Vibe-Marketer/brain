---
phase: 22
slug: recurrence-structural-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | {brain: vitest; autopilot: bun test + typecheck; supabase linked} |
| **Quick run command** | `{quick}` |
| **Full suite command** | `{full}` |

## Sampling Rate
- After every task commit: `{quick}` · Before verify: full suite green

## Per-Task Verification Map
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 | {behavior} | unit | `{cmd}` | ✅/❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
- [ ] {stubs}

*If none: "Existing infrastructure covers all phase requirements."*

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Structural fix admin-approval surface | REC-02 | requires admin judgment | review the surfaced class + proposed structural fix |

## Validation Sign-Off
- [ ] All tasks have `<automated>` verify or Wave 0 deps
- [ ] `nyquist_compliant: true` set

**Approval:** {pending}
