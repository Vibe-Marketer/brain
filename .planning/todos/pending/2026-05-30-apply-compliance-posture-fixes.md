---
created: 2026-05-30T05:14:26.711Z
title: Apply 15-min compliance posture fixes (GitHub + Vercel + Supabase + Cloudflare)
area: general
owner: andrew
estimated_effort: 15 minutes
references:
  - .compliance/evidence/2026-05-29/FINDINGS.md
  - .compliance/facts.yaml
files: []
---

## Problem

Phase A evidence sweep on 2026-05-29 surfaced 4 corrective findings where the self-reported security posture diverged from reality. Each gap has a free, in-browser fix that takes 1-3 minutes. Total: ~15 minutes of clicks. Net effect: readiness score moves from **58% MET → ~74% MET** AND brings policy claims into alignment with what auditors will actually see.

Full diagnosis + screenshots in `.compliance/evidence/2026-05-29/FINDINGS.md`.

## Status as of 2026-05-31

Claude executed Steps 1, 2, and 5 via CLI (`gh api` + Cloudflare API). Step 3 was triggered via Interceptor — recovery codes generated, awaiting your 1Password save. Steps 4 and the new Step 6 (DKIM, surfaced by this remediation pass) require your phone / Google Admin.

| Step | Status | Owner |
|---|---|---|
| 1 GitHub security features | ✅ DONE | Claude (gh api) |
| 2 Branch protection | ✅ DONE (with solo-principal modification) | Claude (gh api) |
| 3 Vercel passkey TFA | 🟡 PARTIAL — codes generated, your action below | Claude + Andrew |
| 4 Supabase native TOTP | ⏳ STILL YOURS — needs phone | Andrew |
| 5 Cloudflare SPF | ✅ DONE | Claude (CF API) |
| 6 Google Workspace DKIM (NEW — surfaced 2026-05-31) | ⏳ YOURS — needs Google Admin | Andrew |

## Solution detail

Each step references its evidence file in the vault.

### Step 1 — GitHub security features — ✅ DONE

Evidence: `.compliance/evidence/2026-05-30/github-recapture/security-features-post-enable.png`

Enabled via `gh api`:
- [x] Dependency graph (auto-on for public repos)
- [x] Dependabot alerts (`PUT /vulnerability-alerts`)
- [x] Dependabot security updates
- [x] Secret scanning
- [x] Push protection
- [x] Private vulnerability reporting
- [x] CodeQL analysis — confirmed configured (you enabled on 2026-05-30; languages: actions, js, ts, python; weekly)
- [ ] Secret scanning non-provider patterns + validity checks — require GHAS subscription; skipped

### Step 2 — GitHub branch protection on `main` — ✅ DONE (modified)

Evidence: `.compliance/evidence/2026-05-30/github-recapture/branch-protection-rules-list.png`

Applied state:
- [x] PR required
- [x] Status check `security` required (strict / up-to-date)
- [x] Force push blocked
- [x] Deletion blocked
- [x] Stale review dismissal enabled
- [ ] **MODIFIED:** `required_approving_review_count: 0` (not 1) because GitHub doesn't allow self-approval. Tighten to 1 when a second reviewer exists.
- [ ] **MODIFIED:** `enforce_admins: false` (not true) because your active workflow (25+ uncommitted files) operates direct-to-main; flipping `true` would deadlock current work. Tighten when ready.

Both deviations documented in `facts.yaml` under `code_and_change_management.deviation_note` and reflected in updated Change Management Policy.

### Step 3 — Vercel passkey TFA — 🟡 PARTIAL (your finish)

Evidence: `.compliance/evidence/2026-05-30/vercel-recapture/post-activate-recovery-codes-visible.png`

- [x] Clicked "Activate" via Interceptor; Vercel generated 6 recovery codes
- [x] Codes saved to `/tmp/vercel-recovery-codes-2026-05-31.txt` (mode 600, NOT in git)
- [ ] **YOUR ACTION:** Move codes from `/tmp/` to 1Password under "Vercel — Recovery codes"
- [ ] **YOUR ACTION:** `rm /tmp/vercel-recovery-codes-2026-05-31.txt`
- [ ] **YOUR ACTION:** In the still-open Vercel modal: click "I've saved these codes"

Status went **Inactive → Incomplete**. "Incomplete" clears when you finish Step 4 (TOTP authenticator app addition — same auth app).

### Step 4 — Supabase native TOTP — ⏳ STILL YOURS

URL: `https://supabase.com/dashboard/account/security`

- [ ] Click "Authenticator app"
- [ ] Scan QR with phone authenticator (or 1Password)
- [ ] Enter the rotating code to confirm

Cannot proxy — requires physical device with authenticator.

### Step 5 — Cloudflare SPF — ✅ DONE

Evidence: `.compliance/evidence/2026-05-30/dns-recapture/CAPTURE.txt`

- [x] TXT `v=spf1 include:_spf.google.com ~all` added via Cloudflare API
- [x] Propagation confirmed (`dig +short @1.1.1.1 TXT callvaultai.com`)

### Step 6 — NEW — Google Workspace DKIM — ⏳ YOURS

Surfaced during this remediation: DKIM has no record under `google._domainkey` or any of 7 common selectors tried. Without DKIM, the existing DMARC quarantine policy can't align outbound email — affects deliverability of `support@callvaultai.com`.

Evidence: `.compliance/evidence/2026-05-30/dns-recapture/DKIM-AND-MCP-AUDIT-EVIDENCE.md`

URL: `https://admin.google.com` → Apps → Google Workspace → Gmail → Authenticate email

- [ ] Click "Generate new record" (2048-bit, selector `google`)
- [ ] Copy the long TXT record value
- [ ] At Cloudflare: add TXT record `google._domainkey` → that value, TTL Auto
- [ ] Wait 24-48 hours
- [ ] Back in Google Admin → click "Start authentication"

## When the remaining items are done (Steps 3-finish, 4, 6)

Ping Claude with "Vercel codes saved, Supabase TOTP done, DKIM provisioned" and the partial Interceptor re-sweep will:
1. Capture final green-state screenshots
2. Flip the last facts.yaml fields to MET
3. Recompute readiness score Rev 7 — expected ~80% MET

## Why this matters

Before any external auditor or B2B buyer's security team looks at CallVault, they will check exactly these things first. Showing them the screenshots BEFORE they ask is a posture multiplier.
