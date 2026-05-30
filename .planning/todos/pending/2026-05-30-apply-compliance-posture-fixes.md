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

## Solution

Execute these 5 steps in order. Each links straight to the page that needs changing.

### Step 1 — GitHub security features (8 min)

URL: `https://github.com/Vibe-Marketer/brain/settings/security_analysis`

Click "Enable" on each:
- [ ] Dependency graph (prerequisite for everything else)
- [ ] Dependabot alerts
- [ ] Dependabot security updates
- [ ] Secret scanning
- [ ] Push protection (under Secret Protection)
- [ ] Private vulnerability reporting
- [ ] CodeQL analysis — click "Set up" → choose "Default" config

### Step 2 — GitHub branch protection on `main` (3 min)

URL: `https://github.com/Vibe-Marketer/brain/settings/branches`

Edit the rule that applies to `main`:
- [ ] Check "Require a pull request before merging"
- [ ] Set "Require approvals" to **1**
- [ ] Check "Do not allow bypassing the above settings"
- [ ] Click "Save changes"

### Step 3 — Vercel passkey TFA activation (1 min)

URL: `https://vercel.com/account/login-connections`

- [ ] Scroll to "Two-Factor Authentication" section
- [ ] Click **Activate** on the Passkeys row (1 passkey already registered — this just flips the UI from "Inactive" → "Active")

### Step 4 — Supabase native MFA enrollment (2 min)

URL: `https://supabase.com/dashboard/account/security`

- [ ] Click "Authenticator app"
- [ ] Add a TOTP entry to 1Password (or Authy)
- [ ] Confirm enrollment

(You're effectively MFA-protected via GitHub OAuth already, but this gives auditors a clean Supabase-native MFA screenshot.)

### Step 5 — Cloudflare SPF record (1 min)

URL: `https://dash.cloudflare.com/` → callvaultai.com → DNS records → Add record

- [ ] Type: TXT
- [ ] Name: `@` (or `callvaultai.com`)
- [ ] Content: `v=spf1 include:_spf.google.com ~all`
- [ ] TTL: Auto
- [ ] Save

(Optional bonus while you're there: enable DNSSEC — one click under DNS → Settings.)

## When done

Ping Claude with "compliance fixes done" and the partial Interceptor re-sweep will:
1. Capture green-state screenshots for each of the 5 surfaces
2. Replace the red screenshots in `.compliance/evidence/2026-05-29/` (or write new ones in `2026-MM-DD/`)
3. Update `facts.yaml` MFA + branch-protection + GitHub security sections
4. Update affected policies (Access Control, Vulnerability Mgmt, Change Mgmt) to flip "not currently enforced" language to "enforced"
5. Recompute readiness score (Rev 5) — expected jump 58% → ~74% MET

## Why this matters

Before any external auditor or B2B buyer's security team looks at CallVault, they will check exactly these things first. Showing them the screenshots BEFORE they ask is a posture multiplier.
