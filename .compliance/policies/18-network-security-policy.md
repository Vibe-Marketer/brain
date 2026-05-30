---
policy_id: NSP-018
title: Network Security Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.6", "CC6.7"]
---

# Network Security Policy

## 1. Purpose

Defines how CallVault's network surfaces are protected.

## 2. Scope

The public network surfaces of CallVault: `callvaultai.com`, `app.callvaultai.com`, `api.callvaultai.com`, and any other public DNS-resolvable endpoint operated by 7x Systems LLC.

## 3. Network Topology

CallVault does not operate its own network infrastructure. The production network surface is entirely managed by:

- **Vercel** — frontend hosting, edge functions, CDN
- **Supabase** — database, Edge Functions, API gateway
- **Cloudflare** — DNS authority for `callvaultai.com`
- **Google Workspace** — email infrastructure

## 4. Public Endpoint Controls

- **TLS 1.3** on all public endpoints (Cryptography & Encryption Policy)
- **HSTS preload** on `app.callvaultai.com`
- **CSP** locking script/connect sources on `app.callvaultai.com`
- **X-Frame-Options DENY** on the application — prevents clickjacking
- **X-Content-Type-Options nosniff**
- **Permissions-Policy** locks camera/geolocation; allows microphone for self-origin (used by call recording)
- **Referrer-Policy strict-origin-when-cross-origin**

Verified via evidence sweep 2026-05-29 (`evidence/2026-05-29/dns-tls/CAPTURE.md`).

## 5. DDoS / Edge Protection

Inherited from:

- **Vercel** — edge-network DDoS protection on customer plan tier
- **Cloudflare** — DNS-layer protection (with potential upgrade to proxied/orange-cloud mode if a future attack warrants it)

## 6. Firewall / Network Segmentation

CallVault does not operate firewalls. Network isolation is enforced by:

- **Supabase project boundary** — multi-tenant database isolation at the platform level
- **Vercel deployment isolation** — each deployment runs in its own context
- **No customer-shared infrastructure** — CallVault customers do not share an isolation domain with non-CallVault customers of Vercel or Supabase that would be relevant to a security boundary

## 7. VPN / Bastion

Not in use. Production access is performed through authenticated platform consoles (Supabase Studio, Vercel dashboard, GitHub web) and authenticated CLIs.

## 8. Email Authentication

| Mechanism | Status |
|-----------|--------|
| DMARC | `v=DMARC1; p=quarantine` — present |
| SPF | **TO BE ADDED** — `v=spf1 include:_spf.google.com ~all` required to fully align with DMARC quarantine policy |
| DKIM | Inherited from Google Workspace; selector verification pending |
| DNSSEC | unsigned — recommend enabling at Cloudflare |

Evidence and gap items: `evidence/2026-05-29/dns-tls/CAPTURE.md` Findings F5–F7.

## 9. Review

Annual or on material change to the network surface, subprocessor list, or threat landscape.
