# Quarterly Access Review — Template

**Template version:** 1.0
**Owner:** Andrew Naegele (Information Security Officer)
**Governed by:** [Access Control Policy (ACP-002) §6](../policies/02-access-control-policy.md)
**Frequency:** Quarterly (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)

---

## How to use this template

1. At the start of each quarter, copy this file to `.compliance/evidence/{YYYY-MM-DD}/access-review/{YYYY-Q#}.md`
2. Fill in the **Review** section for each platform
3. Take screenshots where relevant; save alongside in the same directory
4. Sign off at the bottom + commit
5. Address any "action required" items before next quarter's review

---

## Review metadata

| Field | Value |
|-------|-------|
| Review quarter | (e.g., 2026-Q3) |
| Review date | (YYYY-MM-DD) |
| Reviewer | Andrew Naegele |
| Reviewed against | Access Control Policy v1.0 (2026-05-29) |

## 1. Workforce inventory

List every workforce member with production access at the time of review.

| Name | Role | Status (active / departed) | Engagement type |
|------|------|----------------------------|-------------------|
| Andrew Naegele | Principal / Information Security Officer | active | Principal |

Changes since last review: (e.g., "no change" / "X joined on YYYY-MM-DD" / "Y departed on YYYY-MM-DD")

## 2. Per-platform account review

For each platform, confirm:
- The list of named accounts matches the workforce inventory above
- MFA is enrolled on every named account
- No inactive accounts (no login in last 90 days)
- No leaked / compromised credentials reported

### 2.1 Supabase

| Account | MFA status | Last login | Action |
|---------|------------|------------|--------|
| Andrew Naegele | (enrolled / inherited via GitHub OAuth) | _from Supabase audit log_ | (none / revoke / re-enroll) |

Notes: _Document any anomalies or platform changes since last review._

Screenshot: `supabase-team-{YYYY-Q#}.png`

### 2.2 Vercel

| Account | MFA status | Last activity | Action |
|---------|------------|---------------|--------|
| Andrew Naegele | (passkey active / inactive) | _from Vercel activity log_ | (none / revoke) |

Notes:

Screenshot: `vercel-team-{YYYY-Q#}.png`

### 2.3 GitHub (Vibe-Marketer org)

| Account | MFA status | Role | Last activity | Action |
|---------|------------|------|---------------|--------|
| Andrew Naegele (Vibe-Marketer) | (passkey + mobile + recovery codes) | Owner | _from GitHub audit log_ | (none) |

Org-level review:
- 2FA enforcement on org: enabled / disabled
- Any pending invites: list them
- Outside collaborators: list them

Screenshot: `github-org-{YYYY-Q#}.png`

### 2.4 Stripe + Polar

| Account | MFA status | Action |
|---------|------------|--------|
| Andrew Naegele (Stripe) | (TOTP enrolled) | (none) |
| Andrew Naegele (Polar) | (TOTP enrolled) | (none) |

### 2.5 OpenRouter, Cloudflare, Google Workspace, Domain Registrar

| Platform | Account | MFA status | Action |
|----------|---------|------------|--------|
| OpenRouter | Andrew Naegele | | |
| Cloudflare | Andrew Naegele | | |
| Google Workspace | Andrew Naegele | | |
| Domain Registrar (Global Domain Group) | Andrew Naegele | | |

## 3. Customer-issued MCP token audit

High-level review of the `mcp_tokens` table. Specific token contents are not reviewed unless a customer reports compromise.

| Metric | Value |
|--------|-------|
| Total active tokens | _query: `SELECT COUNT(*) FROM mcp_tokens WHERE revoked_at IS NULL;`_ |
| Tokens issued this quarter | _query: `SELECT COUNT(*) FROM mcp_tokens WHERE created_at >= '<quarter-start>';`_ |
| Tokens revoked this quarter | _query: `SELECT COUNT(*) FROM mcp_tokens WHERE revoked_at >= '<quarter-start>';`_ |
| Customer-reported token compromises | (count + summary; default 0) |

OAuth grants review (mcp_oauth_org_bindings):

| Metric | Value |
|--------|-------|
| Total active grants | _query_ |
| Grants issued this quarter | _query_ |

## 4. Inactive account remediation

List any accounts with no login activity in the prior 90 days and the action taken:

| Account | Platform | Last activity | Action |
|---------|----------|---------------|--------|
| (none / list) | | | |

## 5. Subprocessor access review

Review delegated access by subprocessor representatives (typically none). If any subprocessor has been granted CallVault account access (e.g., support engineer co-pilot), confirm it remains necessary.

## 6. Anomalies and follow-ups

Any unusual access patterns surfaced in audit logs:

| Pattern | Source | Action |
|---------|--------|--------|
| (e.g., repeated failed logins on principal account on YYYY-MM-DD) | Supabase Auth log | (e.g., verified as Andrew typo / treated as event per IRP) |

## 7. Sign-off

| | |
|---|---|
| Reviewer | Andrew Naegele |
| Date completed | (YYYY-MM-DD) |
| Action items captured for next quarter | (count) |
| Critical issues escalated | (none / list with incident IDs) |

This review record is committed to git and retained for at least 3 years per the Logging & Monitoring Policy.

---

## History

| Quarter | Date | Reviewer | Action items raised | Critical issues |
|---------|------|----------|---------------------|------------------|
| 2026-Q2 | _to be filled_ | Andrew Naegele | | |
