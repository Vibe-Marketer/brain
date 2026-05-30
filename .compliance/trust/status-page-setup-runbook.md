---
title: Public status page — setup runbook
audience: Andrew Naegele (single-principal, in-browser execution)
estimated_effort: 20 minutes total
last_updated: 2026-05-30
---

# Public Status Page Setup Runbook

> Goal: provision `status.callvaultai.com` as a public uptime page showing CallVault availability, recent incidents, and subscriber notifications. Deflects half the "is CallVault down?" support emails before they arrive and counts toward SOC 2 availability monitoring evidence.

## Provider choice

Three viable free-tier options. **Recommendation: BetterStack** for the polished public page + subscriber notifications even on free tier.

| Provider | Free-tier offer | Pros | Cons |
|----------|-----------------|------|------|
| **BetterStack** (recommended) | 10 monitors, 3-min checks, 1 public status page, subscriber email notifications, custom domain | Best-looking public page; subscriber emails included on free tier | Subscription paywalls SMS + advanced incident response |
| **UptimeRobot** | 50 monitors, 5-min checks, 1 public status page | Most monitors on free tier | Older UI, no subscriber emails on free tier (just visual status) |
| **Statuspage** (Atlassian) | None — no free tier | Industry-standard | Paid only ($79/mo entry) |

The rest of this runbook uses BetterStack. UptimeRobot steps are nearly identical — substitute the URL.

## Step 1 — Create BetterStack account (5 min)

URL: `https://betterstack.com/uptime/signup`

- Sign up with `support@callvaultai.com` or your personal admin email
- Enable MFA on the account from settings → security (BetterStack supports TOTP)
- Add the account to 1Password
- Add to `.compliance/facts.yaml` under `supporting_vendors` section (RISK register + Supplier Security Policy reference it)

## Step 2 — Create monitors (5 min)

Add these monitors. All HTTP/HTTPS, 3-minute check interval, alert if 2 consecutive failures.

| Monitor name | URL | Expected status | Why |
|--------------|-----|-----------------|-----|
| CallVault App | `https://app.callvaultai.com/` | 200 | Production app |
| CallVault Marketing | `https://callvaultai.com/` | 200 | Marketing site (Vercel) |
| CallVault MCP | `https://api.callvaultai.com/mcp` | 200 or 401 (401 is the expected default — unauthenticated MCP) | MCP endpoint health |
| Supabase API (CallVault project) | `https://<project-ref>.supabase.co/rest/v1/` | 200 or 401 | Database availability |
| Vercel Health | `https://www.vercel-status.com/api/v2/status.json` | 200 | Upstream provider weather |

(Optional later: add per-subprocessor monitors that pull from each provider's status API — useful but not required for v1.)

## Step 3 — Create public status page (5 min)

In BetterstStack: Status Pages → Create status page.

- **Name:** CallVault
- **Subdomain (default):** `callvault.betteruptime.com` (will be replaced by custom domain in Step 4)
- **Branding:** logo from `/Users/admin/dev/callvault-website/public/logo-full-transparent.png`
- **Page layout:** Group monitors into 3 sections:
  - **CallVault Services** — App, MCP, Marketing
  - **Infrastructure** — Supabase project, Vercel platform
  - **(future)** — Subprocessor weather (Anthropic, OpenAI, Stripe, etc.)
- **Page settings:**
  - "Show uptime history" — enabled (90 days)
  - "Show incidents" — enabled
  - "Allow subscriptions" — enabled (email)
- **Footer:** link back to `callvaultai.com/trust` and `support@callvaultai.com`

## Step 4 — Custom domain `status.callvaultai.com` (3 min)

In BetterStack status page settings → Custom domain:

- Enter `status.callvaultai.com`
- BetterStack will display a CNAME record to add at Cloudflare DNS
- At Cloudflare: add CNAME `status` → BetterStack-provided target (orange-cloud the proxy off for cert provisioning, then re-enable if desired)
- Wait for cert provisioning (~2-5 minutes)
- Verify `https://status.callvaultai.com/` loads the BetterStack page

## Step 5 — Update trust page + DPA (2 min — Claude does this once Andrew provisions)

When the page is live, update:

- `.compliance/trust/trust-page-content.md` — replace "A public status page is being provisioned..." with "Status page: https://status.callvaultai.com"
- `callvault-website/public/trust.html` — same
- `.compliance/facts.yaml` — `status_page.public_url: "https://status.callvaultai.com"`, `exists: true`, `setup_planned: false`
- Optionally announce in next changelog or release note

## Notification subscribers

Once the page is live:

- Subscribe `support@callvaultai.com` (so incident emails route to the principal inbox)
- Invite existing customers to subscribe via a one-time email from the principal: "We've launched a public status page at status.callvaultai.com — you can subscribe to incident emails directly there."

## Maintenance discipline

- **Monthly:** review monitor health, prune any false-positive alert thresholds
- **Quarterly:** review group structure + add any new subprocessor or surface that materially affects customer-perceived availability
- **On any SEV-1 or SEV-2 incident:** post an incident on the status page within the same 1-hour containment window as the Incident Response Plan requires

## Trust Services Criteria coverage upgrade

Once provisioned, this closes / strengthens:

- **A1.1** (Availability — capacity and demand) — public uptime evidence over time
- **A1.2** (Availability — environmental + technical infra) — monitor health logged
- **CC2.2** (Communication of policies to external users) — public-facing status communication

Approximately **+2 MET points** to the readiness score once Step 4 confirms the page is live.

---

*Runbook reviewed annually or on provider change.*
