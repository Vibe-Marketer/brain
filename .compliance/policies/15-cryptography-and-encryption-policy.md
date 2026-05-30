---
policy_id: CEP-015
title: Cryptography and Encryption Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC6.6", "CC6.7", "CC6.1"]
references:
  - "Evidence: .compliance/evidence/2026-05-29/dns-tls/CAPTURE.md"
---

# Cryptography and Encryption Policy

## 1. Purpose

Defines how cryptography is applied to protect CallVault customer data and authentication material.

## 2. Encryption in Transit

| Surface | Mechanism | Status (evidence 2026-05-29) |
|---------|-----------|------------------------------|
| `app.callvaultai.com` | TLS 1.3 | TLS 1.3 negotiated; AEAD-CHACHA20-POLY1305-SHA256; HSTS preload (2y) |
| `callvaultai.com` | TLS 1.3 | HSTS 2y |
| `api.callvaultai.com` (MCP) | TLS 1.3 | Served via Supabase |
| Inter-service (frontend ↔ Supabase) | TLS 1.2+ with Supabase JWT | Default |
| Inter-service (LLM via OpenRouter) | TLS 1.2+ | Default |

TLS 1.1 and below are not accepted on any production endpoint.

## 3. Encryption at Rest

| Data store | Mechanism |
|------------|-----------|
| Supabase Postgres (production) | AES-256 managed by Supabase |
| Supabase Storage (if used) | AES-256 managed by Supabase |
| Vercel build artifacts and logs | Vercel-managed encryption |
| 1Password vault | End-to-end encryption with secret key + master password |
| Workforce workstation disk | FileVault (macOS native AES-256) |

## 4. Certificate Management

- TLS certificates for `*.callvaultai.com` are managed and rotated automatically by Vercel (Let's Encrypt + Vercel CA chain)
- TLS for `*.supabase.co` endpoints is managed by Supabase
- No CallVault-managed private CAs

## 5. Key Management

- **Platform-managed keys** for Supabase + Vercel + Stripe encryption at rest — keys never leave the provider boundary; no customer-managed key (CMK) support currently
- **Application secrets** (Supabase service role key, OpenRouter API key, Polar API key, Sentry DSN, third-party integration keys) — stored in 1Password and in platform secret stores (Vercel Environment Variables, Supabase Edge Function secrets, GitHub Actions secrets)
- **MCP customer tokens** — generated server-side by Supabase Auth or by CallVault's hex-token mint flow; stored hashed in `mcp_tokens` table; only the customer ever sees the plaintext value at issuance

## 6. Cryptographic Algorithms

- Symmetric: AES-256-GCM or ChaCha20-Poly1305 (both AEAD)
- Asymmetric: RSA-2048+ or ECDSA P-256+ for TLS
- Hashing: SHA-256 or stronger for general use; bcrypt/scrypt/argon2 for password storage (managed by Supabase Auth)

Deprecated/banned: MD5, SHA-1, RC4, DES, 3DES, RSA < 2048.

## 7. Key Rotation

| Key | Rotation cadence |
|-----|-------------------|
| Supabase service role | Annually or on suspected compromise |
| Integration API keys (OpenRouter, Polar, Sentry, etc.) | Annually or on vendor request |
| TLS certificates | Automatic (Vercel + Supabase managed) |
| Customer-issued MCP tokens | Customer-controlled at any time via `/settings/mcp` |

## 8. Customer Use of Cryptography

Customers do not currently have access to customer-managed keys, customer-controlled encryption contexts, or BYOK. These are roadmap considerations if enterprise customer demand emerges.

## 9. Review

Annual or on material change to TLS posture, key management strategy, or customer cryptographic requirements.
