---
captured: 2026-05-29
captured_by: Claude under Andrew's direction
sweep: Phase A — initial evidence sweep across Supabase, Vercel, GitHub, DNS/TLS
status: 4 corrective findings + 4 confirmed strengths
---

# Phase A Evidence Sweep — Findings

> **Truth-vs-belief reconciliation.** Self-reported facts gathered in Session 1 (Phase B interview) said "MFA enabled on all 5 critical accounts" and policies claimed Dependabot/branch-protection-review were active. Direct evidence capture surfaces a different picture. This document is the honest reconciliation.

---

## Confirmed strengths ✅

### TLS / Encryption in transit (CC6.6, CC6.7)

- **TLS 1.3** negotiated on both `callvaultai.com` and `app.callvaultai.com`
- **AEAD-CHACHA20-POLY1305-SHA256** cipher
- **HSTS preload** on `app.callvaultai.com` (2-year max-age, includeSubDomains, preload)
- **HSTS** on marketing site (2-year max-age)
- **Comprehensive CSP** on `app.callvaultai.com` locking script/connect to self + supabase + sentry
- **X-Frame-Options DENY**, **X-Content-Type nosniff**, **Permissions-Policy** locking camera/geolocation, **Referrer-Policy strict-origin-when-cross-origin**

Evidence: `dns-tls/CAPTURE.md`

### Email auth — DMARC

- **DMARC** in place with `p=quarantine`
- Cloudflare-managed DNS, Google Workspace MX

Evidence: `dns-tls/CAPTURE.md`

### GitHub account MFA

- **Two-factor authentication: Enrolled** ✅ (green badge confirmed)
- Methods configured: Passkeys (1 registered, preferred 2FA method), GitHub Mobile (2 devices), Recovery codes (viewed)
- SMS configured but GitHub itself flags it as "less secure" — recommend removing once passkey + mobile are working

Evidence: `github/account-2fa.png`

### GitHub branch protection exists on `main`

- A protection rule does apply to `main`
- Status checks required (`security` check listed)
- Requires branches up-to-date before merging

Evidence: `github/branch-protection-list.png`, `github/branch-protection-rule-detail.png`

---

## Corrective findings — gaps between policy/facts.yaml claims and reality

### 🔴 FINDING-001 — Supabase account has zero authenticator apps configured

**What the evidence shows:** `https://supabase.com/dashboard/account/security` → "Authenticator app — 0 APPS CONFIGURED."

**What Session-1 facts.yaml claimed:** `mfa.supabase: enabled (self-reported)`.

**Likely actual state:** Andrew signs into Supabase via GitHub OAuth, so the effective MFA enforcement happens at GitHub. **GitHub MFA is strong (passkeys + recovery codes)**, so the effective access is MFA-protected — but the Supabase native MFA dialog itself shows zero.

**Auditor risk:** A quick screenshot of the Supabase MFA dialog will read as "MFA not enabled." Need to either:
1. Enroll a Supabase native authenticator app for clarity (~5 min), OR
2. Document the OAuth chain explicitly in the Access Control Policy with this screenshot + a GitHub-side MFA screenshot as the inheritance evidence

Evidence: `supabase/account-security-mfa.png`

### 🔴 FINDING-002 — Vercel reports "Two-Factor Authentication: Inactive"

**What the evidence shows:** `https://vercel.com/account/login-connections` → "Two-Factor Authentication — Inactive. It is strongly recommended to enable two-factor authentication." But the page also shows: **1 passkey registered**, Google sign-in, GitHub sign-in (Vibe-Marketer), GitLab sign-in.

**Likely actual state:** Andrew authenticates with passkey + GitHub OAuth + Google OAuth. **Passkeys are stronger than TOTP** — they're hardware-backed and phishing-resistant. Vercel's UI just doesn't count passkeys as 2FA enrollment.

**Auditor risk:** Same as Supabase. "Vercel TFA inactive" is a literal banner on the page. Recommend clicking "Activate" on the passkey 2FA row + adding a TOTP authenticator as a belt-and-suspenders.

Evidence: `vercel/authentication.png`

### 🔴 FINDING-003 — Branch protection on `main` does NOT require pull requests

**What the evidence shows:** `https://github.com/Vibe-Marketer/brain/settings/branches` → branch protection rule on `main` has these settings:
- ⬜ **Require a pull request before merging — UNCHECKED**
- ✅ Require status checks to pass (CHECKED, `security` check required)
- ✅ Require branches up-to-date before merging (CHECKED)
- ⬜ Require conversation resolution
- ⬜ Require signed commits
- ⬜ Lock branch
- ⬜ Do not allow bypassing the above settings (UNCHECKED — admins can bypass)
- ⬜ Allow force pushes (UNCHECKED — good)
- ⬜ Allow deletions (UNCHECKED — good)

**What policies claimed:**
- Access Control Policy §3.1: "All production code changes require peer review and are merged to `main` through GitHub branch protection rules"
- Change Management Policy §5: "Required pull request before merge"
- Information Security Policy §3 objective: "100% of production code changes reviewed and approved before merge to main"
- CAIQ-Lite CCC-01: "GitHub branch protection on `main` requires reviewer approval before merge" — **YES** answer

**Reality:** The rule enforces status checks but NOT a PR or review requirement. Direct commits to `main` are permitted as long as they pass the `security` status check. Admin bypass is also possible.

**Action required:** Either (a) enable "Require a pull request before merging" + "Require approvals" + "Do not allow bypassing the above settings" on GitHub (~2 minutes, free), OR (b) update Access Control, Change Management, ISP, and CAIQ-Lite to honestly describe the enforced state. **Option (a) is strongly recommended** — it's a free posture upgrade and brings policy claims into reality.

Evidence: `github/branch-protection-rule-detail.png`

### 🔴 FINDING-004 — GitHub code security features are DISABLED

**What the evidence shows:** `https://github.com/Vibe-Marketer/brain/settings/security_analysis` → every code-security feature is offering an "Enable" button:
- Private vulnerability reporting — DISABLED
- Dependency graph — DISABLED
- Dependabot alerts — DISABLED
- Dependabot security updates — DISABLED
- Grouped security updates — DISABLED
- Dependabot version updates — DISABLED
- CodeQL analysis — DISABLED ("Set up")
- Secret Protection / push protection — DISABLED

Only **Copilot Autofix** appears to be enabled (toggle on).

**What policies claimed:**
- Vulnerability Management Policy §3: "Dependabot, secret scanning, CodeQL enabled"
- Logging & Monitoring Policy §3: "GitHub events, secret-scanning alerts, Dependabot alerts" as a log source
- CAIQ-Lite IVS-04 + TVM-01: "Dependabot, secret scanning, code scanning enabled" — **YES** answer

**Reality:** None of those features are currently active.

**Action required:** This is the highest-leverage Phase A finding by far. All of these features are **free for public + private repos** and enable in literally 1-2 clicks each. Recommend enabling:
1. Dependency graph (prerequisite for Dependabot)
2. Dependabot alerts
3. Dependabot security updates
4. Secret scanning + push protection
5. CodeQL analysis (set up with default config)
6. Private vulnerability reporting

This brings policy claims into reality AND meaningfully upgrades security posture — about 10 minutes of clicks, $0 cost.

Evidence: `github/security-features-disabled.png`

---

## Smaller follow-ups (not corrective, but worth noting)

| # | Item | Source | Effort |
|---|------|--------|--------|
| F5 | SPF record missing | `dns-tls/CAPTURE.md` | Add 1 TXT record at Cloudflare: `v=spf1 include:_spf.google.com ~all` |
| F6 | DNSSEC unsigned | `dns-tls/CAPTURE.md` | Cloudflare 1-click enable |
| F7 | DKIM selector not verified in capture | `dns-tls/CAPTURE.md` | Next sweep: dig `google._domainkey.callvaultai.com` |
| F8 | Domain registrar 2FA not yet verified | facts.yaml gap | Sign into Global Domain Group, screenshot |
| F9 | Supabase project region not yet captured | facts.yaml gap | Sign into Supabase project settings, screenshot |
| F10 | Vercel project region / env-var inventory not yet captured | facts.yaml gap | Sign into Vercel project settings, screenshot |

These are deferred to a follow-on Interceptor sweep; not gating.

---

## Score impact

| Control | Before sweep | After sweep |
|---------|---------------|-------------|
| CC6.6 (encryption in transit) | MET | **MET** ✅ stronger evidence |
| CC6.2 (MFA) | MET (self-reported) | **PARTIAL** — needs honest documentation of OAuth-chain inheritance OR direct enrollment |
| CC8.1 (change management) | MET (per policy) | **PARTIAL** — policy claim divergence from actual branch protection settings |
| CC7.1 (vulnerability management) | MET (per policy) | **MISSING** — no Dependabot, no secret scanning, no CodeQL |

**Net effect on overall score:** mixed. We MET fewer controls than the self-reported pass thought, but we now have a 10-minute action list that, if executed, would clear all four corrective findings AND raise the score above its pre-sweep level. Honesty beats inflation every time — auditors detect the latter immediately.

**Revised score after Phase A corrections (before remediation):**

| | Pre-sweep (Rev 3) | Post-sweep (honest) | After ~15 min of remediation |
|---|---|---|---|
| MET | 24 | 22 | **28+** |
| PARTIAL | 9 | 10 | 7 |
| MISSING | 5 | 6 | 3 |
| **MET %** | 63% | **58%** | **~74%** |

The sweep temporarily lowers the score by ~5 points because honesty caught two PARTIAL/MISSING items. The 15-minute remediation list (enable GitHub security features + fix branch protection + add SPF) lifts it ~16 points above the dishonest pre-sweep number.

---

## Recommended Andrew actions (15 minutes total, all free, all in your browser)

1. **GitHub** — `https://github.com/Vibe-Marketer/brain/settings/security_analysis` — enable Dependency graph → Dependabot alerts → Dependabot security updates → Secret scanning → Push protection → Private vuln reporting → set up CodeQL with default config (8 min)
2. **GitHub** — `https://github.com/Vibe-Marketer/brain/settings/branches` — Edit `main` rule → check "Require a pull request before merging" → require 1 approval → check "Do not allow bypassing the above settings" → Save (3 min)
3. **Vercel** — `https://vercel.com/account/login-connections` — click **Activate** on the Passkeys row in the Two-Factor Authentication section (1 min)
4. **Supabase** — `https://supabase.com/dashboard/account/security` — add an Authenticator app for native-MFA evidence (2 min)
5. **Cloudflare** — DNS settings for callvaultai.com → add TXT record `v=spf1 include:_spf.google.com ~all` (1 min)

After step 5, re-run a partial evidence sweep to capture the green-state screenshots; updated FINDINGS-2026-MM-DD.md supersedes this one for those controls.

---

## Files updated as a result of this sweep

After Andrew confirms the remediation list (or asks to proceed without), the following will be updated to match reality:

- `.compliance/facts.yaml` — `mfa.*` section + `code_and_change_management.required_reviewers_count` + new `github_security_features` section
- `.compliance/policies/02-access-control-policy.md` — §3.2 MFA table (note OAuth-chain inheritance if not directly enrolling)
- `.compliance/policies/09-vulnerability-management-policy.md` — §3 Detection Sources (mark features as "to enable" until they are)
- `.compliance/policies/10-change-management-policy.md` — §5 Branch Protection (describe enforced state honestly)
- `.compliance/questionnaires/caiq-lite-callvault.md` — CCC-01, IVS-04, TVM-01 answers
- `.compliance/readiness/initial-score-2026-05-29.md` — Rev 4 score reflecting honest assessment

This is the difference between a compliance program that survives an auditor and one that doesn't.
