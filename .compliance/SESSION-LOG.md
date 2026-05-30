---
title: Compliance bootstrap — session log
last_session: 2026-05-29
---

# Compliance bootstrap — session log

> Tracks what's done, what's next, and where to resume.

## Sessions

### 2026-05-29 — Session 1 (initial bootstrap)

**Status: foundation complete.**

**Delivered:**
- `.compliance/` directory structure
- `.compliance/facts.yaml` — complete facts ledger from Phase B AskUserQuestion interview + code verification of customer deletion paths + T&Cs gap
- 6 Tier-1 policies (Information Security, Access Control, Data Classification, Data Retention & Deletion, Incident Response, Vendor & Subprocessor Management)
- `.compliance/policies/MANIFEST.md` — full library scope with Tier 2 (21 more) + Tier 3 (legal docs)
- `.compliance/trust/trust-page-content.md` — full trust page draft, ready to hand to marketing-site dev
- `.compliance/questionnaires/caiq-lite-callvault.md` — pre-filled CAIQ-Lite covering 16 CSA control families
- `.compliance/readiness/initial-score-2026-05-29.md` — 47% MET / 81% MET-or-PARTIAL against AICPA TSP Section 100

**Open questions Andrew answered in this session:**
- Entity: 7X Systems LLC, Wyoming
- Workforce: solo principal (Andrew Naegele)
- Retention: indefinite by default; self-serve deletion at every level
- Trust URL: `callvaultai.com/trust`
- Buyer demand: none active — pre-positioning mode
- Incidents: zero in last 12 months
- Cyber insurance: none
- Password manager: 1Password primary, LastPass legacy (flagged for migration)
- MFA: enabled on all 5 critical accounts (self-reported; needs Interceptor evidence)
- Security contact: support@callvaultai.com (shared with general support)
- Status page: doesn't exist; wants free tier

**Code verifications performed:**
- Customer self-serve deletion: confirmed present (AccountTab, DeleteOrganizationDialog, DeleteWorkspaceDialog, delete_call MCP tool)
- T&Cs / Privacy Policy: NOT FOUND in repo — flagged as top blocking item

**Top blocking items (carried into next session):**
1. Publish Terms of Service, Privacy Policy, DPA — none exist; biggest single-action lift
2. Run Phase A evidence sweep (Interceptor against Supabase / Vercel / GitHub / DNS) — converts 10+ PARTIALs to MET
3. Publish trust page at `callvaultai.com/trust`
4. Draft Tier-2 policies (21 remaining; recommended order in MANIFEST.md)

## Next session — start here

1. **Decide:** publish Terms / Privacy / DPA first (highest leverage), OR run Phase A Interceptor evidence sweep first (more PARTIAL-to-MET conversions per hour). Both are doable in a single next session if Andrew has ~1 hour for the questions Phase A doesn't surface from observation.
2. **Run:** whichever was decided.
3. **Re-run:** `readiness/initial-score-{date}.md` — score should jump from 47% to ~70%.

## Resume command (next session)

```
Continue compliance bootstrap. Read .compliance/SESSION-LOG.md for status, then proceed with [next action].
```

## Files at session 1 close

```
.compliance/
├── SESSION-LOG.md                                   (this file)
├── facts.yaml                                       (complete ledger)
├── evidence/                                        (empty — Phase A pending)
├── policies/
│   ├── 01-information-security-policy.md
│   ├── 02-access-control-policy.md
│   ├── 03-data-classification-policy.md
│   ├── 04-data-retention-and-deletion-policy.md
│   ├── 05-incident-response-plan.md
│   ├── 06-vendor-and-subprocessor-management-policy.md
│   └── MANIFEST.md
├── questionnaires/
│   └── caiq-lite-callvault.md
├── trust/
│   └── trust-page-content.md
└── readiness/
    └── initial-score-2026-05-29.md
```
