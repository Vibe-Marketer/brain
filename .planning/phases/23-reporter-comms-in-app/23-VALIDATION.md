---
phase: 23
slug: reporter-comms-in-app
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | {brain: vitest; supabase linked} |
| **Quick run command** | `{quick}` |
| **Full suite command** | `{full}` |

## Sampling Rate
- After every task commit: `{quick}` · Before verify: full suite green

## Per-Task Verification Map
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 | only source=in-app-user gets comms | unit | `{cmd}` | ✅/❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
- [ ] {stubs}

*If none: "Existing infrastructure covers all phase requirements."*

## Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-app notification render | RSP-01 | visual | view a reporter's ticket notifications |

## Validation Sign-Off
- [ ] Comms HARD-gated on source=in-app-user (Sentry/QA/internal silent) — tested fail-closed
- [ ] Content filter default-deny (paths/SHAs/stacktraces/"agent" redacted) — tested
- [ ] `nyquist_compliant: true` set

**Approval:** {pending}
