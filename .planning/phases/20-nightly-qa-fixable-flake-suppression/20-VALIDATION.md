---
phase: 20
slug: nightly-qa-fixable-flake-suppression
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | {brain: vitest; autopilot: bun test + typecheck; supabase linked for schema} |
| **Config file** | {paths} |
| **Quick run command** | `{quick}` |
| **Full suite command** | `{full}` |
| **Estimated runtime** | ~{N}s |

## Sampling Rate
- **After every task commit:** `{quick}`
- **After every plan wave:** `{full}`
- **Before `/gsd-verify-work`:** Full suite green
- **Max feedback latency:** {N}s

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {behavior} | unit | `{cmd}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements
- [ ] {stubs}

*If none: "Existing infrastructure covers all phase requirements."*

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

## Validation Sign-Off
- [ ] All tasks have `<automated>` verify or Wave 0 deps
- [ ] No 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set

**Approval:** {pending}
