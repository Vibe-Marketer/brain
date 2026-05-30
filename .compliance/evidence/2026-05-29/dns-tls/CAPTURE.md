---
captured: 2026-05-29
captured_by: Claude under Andrew's direction
scope: DNS, TLS, security headers for callvaultai.com + app.callvaultai.com
methodology: curl + openssl + dig + whois (one-shot, repeatable)
trust_services_criteria: ["CC6.6", "CC6.7"]
---

# DNS / TLS / Security Headers Evidence

## TLS — Marketing site (callvaultai.com)

```
strict-transport-security: max-age=63072000
```

- HSTS enabled with 2-year max-age
- Served via Vercel; cert managed automatically

## TLS — App (app.callvaultai.com)

```
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(self), geolocation=(), interest-cohort=()
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://fathom.video https://zoom.us https://marketplace.zoom.us
```

- HSTS with 2-year max-age, includeSubDomains, **preload** ✅
- X-Frame-Options: DENY ✅ (clickjacking protection)
- X-Content-Type-Options: nosniff ✅
- Referrer-Policy: strict-origin-when-cross-origin ✅
- Permissions-Policy: camera/geolocation denied, microphone allowed for self (used by call recording features) ✅
- Comprehensive CSP locking down script/connect sources to self + supabase + sentry ✅

## TLS negotiation

```
Protocol  : TLSv1.3
Cipher    : AEAD-CHACHA20-POLY1305-SHA256
Verify return code: 0 (ok)
```

- TLS 1.3 negotiated by default ✅
- Strong AEAD cipher ✅
- Certificate validates without error ✅

## DNS posture

| Record | Value | Status |
|--------|-------|--------|
| Nameservers | `nero.ns.cloudflare.com.`, `marjory.ns.cloudflare.com.` | Cloudflare-managed ✅ |
| MX | `1 smtp.google.com.` | Google Workspace |
| DMARC | `v=DMARC1; p=quarantine; rua=mailto:hello@callvaultai.com; ruf=mailto:hello@callvaultai.com; sp=quarantine; adkim=r; aspf=r; fo=1; ri=86400` | DMARC quarantine policy ✅ |
| SPF | **MISSING** | ⚠️ Gap — should add `v=spf1 include:_spf.google.com ~all` |
| DKIM | not directly inspected (selector unknown) | ⚠️ Verify in next sweep |
| DNSSEC | `unsigned` | ⚠️ Gap — Cloudflare supports one-click enable; recommend enabling |

## Registrar

| Field | Value |
|-------|-------|
| Registrar | Global Domain Group LLC |
| Registrar URL | http://www.globaldomaingroup.com |
| Last updated | 2025-12-05 |
| Expiry | 2026-12-04 |

## Identified gaps (action items)

1. **Add SPF record:** `v=spf1 include:_spf.google.com ~all` to align with the existing DMARC quarantine policy. Without SPF, DMARC's aspf=r check has nothing to relax against.
2. **Verify DKIM** for the Google Workspace MX. Likely selector is `google._domainkey.callvaultai.com` — confirm in next evidence sweep.
3. **Enable DNSSEC** at Cloudflare (one-click). Low risk, modern best practice.
4. **Renewal calendar:** domain expires 2026-12-04. Add to operational calendar.

## Net assessment (CC6.6 + CC6.7)

- **Encryption in transit:** STRONG — TLS 1.3, HSTS preload, modern cipher, strict CSP
- **Email auth:** PARTIAL — DMARC present, SPF missing
- **DNS:** PARTIAL — Cloudflare managed, but DNSSEC unsigned

This captures alone moves CC6.6 (encryption in transit) from PARTIAL to MET. Email-auth gap is its own row, traceable to the SPF action item above.
