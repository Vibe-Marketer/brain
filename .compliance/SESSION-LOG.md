---
title: Compliance bootstrap — session log
last_session: 2026-05-29
---

# Compliance bootstrap — session log

> Tracks what's done, what's next, and where to resume.

## Sessions

### 2026-05-29 — Session 1.4 (Phase A evidence sweep + remaining 12 Tier-2 policies)

**Trigger:** "go ahead and do 1 and 2" — Phase A Interceptor sweep + remaining Tier-2 policies.

**Phase A evidence captured:**
- `evidence/2026-05-29/dns-tls/CAPTURE.md` — TLS 1.3, HSTS preload, comprehensive security headers, CSP, DMARC quarantine; gaps: SPF missing, DNSSEC unsigned
- `evidence/2026-05-29/supabase/account-security-mfa.png`
- `evidence/2026-05-29/vercel/authentication.png`
- `evidence/2026-05-29/github/account-2fa.png` + `branch-protection-list.png` + `branch-protection-rule-detail.png` + `security-features-disabled.png`
- `evidence/2026-05-29/FINDINGS.md` — 4 corrective findings + 6 confirmed strengths + 15-minute remediation list

**4 corrective findings (truth ≠ self-report):**
- FINDING-001: Supabase native MFA shows 0 authenticator apps (likely OAuth-chain inheritance via GitHub, but Supabase UI doesn't show it)
- FINDING-002: Vercel reports "TFA Inactive" despite passkey + OAuth providers configured
- FINDING-003: GitHub branch protection on `main` does NOT enforce PR or review requirement — only status checks
- FINDING-004: GitHub Dependabot, secret scanning, CodeQL, code scanning are ALL DISABLED

These contradict claims in Vulnerability Management Policy, Change Management Policy, and CAIQ-Lite. Honest documentation captured in FINDINGS.md + facts.yaml.

**12 remaining Tier-2 policies drafted (compact form):**
- `12-acceptable-use-policy.md`
- `13-asset-management-policy.md`
- `14-code-of-conduct.md`
- `15-cryptography-and-encryption-policy.md`
- `16-hr-security-policy.md`
- `17-security-awareness-training-policy.md`
- `18-network-security-policy.md`
- `19-password-policy.md`
- `20-physical-security-policy.md`
- `21-secure-development-policy.md`
- `22-supplier-security-policy.md`
- `23-workstation-security-policy.md`

Each cites evidence-vault paths where applicable. Where evidence revealed gaps, the policy honestly describes current state with named remediation rather than papering over.

**Policy library: COMPLETE.** 23 distinct policies (6 Tier-1 + 17 Tier-2). All v1.0, all `next_review_due: 2027-05-29`.

**Score Rev 4 (honest, post-evidence):** 22 MET / 10 PARTIAL / 6 MISSING = **58% MET, 84% MET-or-PARTIAL**.

After Andrew applies the 15-minute remediation list in FINDINGS.md (enable GitHub security features + fix branch protection + add SPF), expected score: **~74% MET**. The sweep temporarily lowered the score by 5 points by catching dishonest items; honesty + remediation lifts it 16 points above the pre-sweep number.

**Top remaining items:**
1. Apply the 15-minute remediation list (Andrew, in browser)
2. Inaugural `.compliance/risk-register.yaml` materializing the 7 risks named in Policy 08
3. Status page (BetterStack/UptimeRobot free tier — Andrew sign-up required)
4. Re-run partial evidence sweep after remediation to capture green-state screenshots

---

### 2026-05-29 — Session 1.3 (5 Tier-2 policies drafted, compact form)

**Trigger:** Andrew said "keep moving, compact if needed, get this shit done."

**Drafted (highest-leverage Tier-2):**
- `07-logging-and-monitoring-policy.md` — covers CC7.1, CC7.2, CC7.3
- `08-risk-assessment-policy.md` — covers CC3.1, CC3.2, CC3.3, CC3.4, CC9.1; includes inaugural 7-entry risk register
- `09-vulnerability-management-policy.md` — covers CC7.1, CC7.2, CC8.1; named SLAs (Critical 24h, High 7d, Medium 30d, Low 90d)
- `10-change-management-policy.md` — covers CC8.1; documents what branch protection enforces
- `11-business-continuity-and-dr-policy.md` — covers A1.2, A1.3, CC7.5; RTO 4h app / 24h DB, RPO 24h, bus-factor section

**MANIFEST consolidation pass:** distinct policy count compressed from 27 → 22 by folding redundant standards-template duplicates (Encryption into Cryptography, Patch Management into Vuln Mgmt, Subprocessor Mgmt into Vendor Mgmt, BAA out of scope). Live count: 6 Tier-1 ✅ + 5 Tier-2 ✅ + 11 Tier-2 remaining.

**Score Rev 3:** 24 MET / 9 PARTIAL / 5 MISSING (from 14 / 13 / 11 initial). Effective rise to ~70% MET pending re-walk of Tier-2-touched controls.

**Pushed:** brain @ this commit.

---

### 2026-05-29 — Session 1.2 (phone update + DPA draft + Trust/DPA publish)

**Trigger:** Andrew flagged the 307 phone in Terms is no longer active; provided +1 315-335-8779 (cell) and said "keep moving and get this shit done — draft DPA, publish trust pages."

**Phone update applied:**
- `.compliance/facts.yaml` — entity_address.phone, with note explaining the swap
- `.compliance/trust/trust-page-content.md` — hero contact line
- `.compliance/questionnaires/caiq-lite-callvault.md` — Company & contact phone field
- `.compliance/SESSION-LOG.md` — Session 1.1 entry footnoted
- `callvault-website/public/terms.html` — 3 occurrences
- `callvault-website/public/cookies.html` — 1 occurrence
- `callvault-website/out/terms.html` + `out/cookies.html` — Next.js export artifacts

**DPA drafted from Common Paper v2.0** (CC-BY-4.0):
- Source markdown: `.compliance/trust/dpa-callvault.md`
- Published HTML: `callvault-website/public/dpa.html`
- Next.js route: `callvault-website/src/app/dpa/page.tsx`
- Module Two: Controller to Processor
- EU SCCs incorporated by reference (Commission Implementing Decision (EU) 2021/914) + UK IDTA + Swiss DPA
- Subprocessor table mirrors trust page
- 72-hour Security Incident notification window
- Customer-self-serve deletion paths enumerated (matches actual code paths)
- CCPA "service provider" not "third party" affirmation

**Trust page published:**
- Source markdown: `.compliance/trust/trust-page-content.md`
- Published HTML: `callvault-website/public/trust.html`
- Next.js route: `callvault-website/src/app/trust/page.tsx`

**Footer + sitemap updates** (callvault-website):
- All 6 legal-page footers (terms, privacy, cookies, disclaimer, acceptable-use, LegalPageLayout) now include Trust + DPA links
- Sitemap.ts adds /trust (priority 0.6) and /dpa (priority 0.4)
- `npm run build` green; all 39 routes prerendered including /trust and /dpa

**Commits:**
- `callvault-website`: `16275b6 Add /trust and /dpa public pages + phone number update` (pushed to origin/main → Vercel auto-deploy)
- `brain` (.compliance/): forthcoming this commit

**Readiness score Rev 2:** 57% → **63% MET**, 83% → **87% MET-or-PARTIAL**. Legal trifecta is now COMPLETE.

**Remaining top items:**
1. Phase A Interceptor evidence sweep → ~75% MET
2. Tier-2 policies (Logging, Risk, Vulnerability, Change Mgmt, BCDR) → ~88-92% MET
3. Public status page (BetterStack/UptimeRobot free tier)

---

### 2026-05-29 — Session 1.1 (legal-doc discovery + retro update)

**Trigger:** Andrew flagged that Terms and Privacy already exist on the marketing site.

**Discovery:** Published at `/Users/admin/dev/callvault-website/public/`:
- `terms.html` — Termly-generated, last updated 2025-11-02
- `privacy.html` — Termly-generated (~231KB) covering GDPR + CCPA + California + Europe + cookies + controller/processor + retention + deletion
- `cookies.html` — Termly-generated companion

**Entity facts confirmed from Terms:** 7x Systems LLC (d/b/a CallVault), Wyoming, 1309 Coffeen Ave Ste 17642 Sheridan WY 82801, originally +1 307-218-2437 (later updated to +1 315-335-8779 — see Session 1.2).

**Files updated:**
- `facts.yaml` — `legal_documents.*` flipped to `exists: true` with public URLs; `entity_address` block added
- `policies/MANIFEST.md` — Tier 3 corrected (L1/L2/L3 = ✅ PUBLISHED; L4 DPA only remaining)
- `trust/trust-page-content.md` — hero entity + Documents section now lives links
- `questionnaires/caiq-lite-callvault.md` — Company & contact section lists URLs and address
- `readiness/initial-score-2026-05-29.md` — score: 47% → **57% MET**, 81% → **83% MET-or-PARTIAL**

**Remaining legal-trifecta gap:** DPA only. ~1-2 hr task using Common Paper open template.


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
