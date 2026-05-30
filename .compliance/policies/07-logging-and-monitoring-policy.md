---
policy_id: LMP-007
title: Logging and Monitoring Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC7.1", "CC7.2", "CC7.3"]
---

# Logging and Monitoring Policy

## 1. Purpose

Defines what CallVault logs, how long logs are retained, who reviews them, and how anomalous activity surfaces for action.

## 2. Scope

All CallVault production systems and supporting platforms — Supabase, Vercel, GitHub, Polar/Stripe, OpenRouter, Sentry, and the MCP server's own per-tool-call audit trail.

## 3. What Gets Logged

| Source | Events | Notes |
|--------|--------|-------|
| Supabase Auth | Sign-in, sign-up, password change, MFA enrollment | Platform-managed |
| Supabase Postgres | DDL changes, role changes, query logs at the platform default level | Audit log via Supabase dashboard |
| Supabase Edge Functions | Function invocations, errors, cold-start metrics | Supabase Logs Explorer |
| Vercel | Deployments, request logs, function invocations | Vercel dashboard |
| GitHub | Repo events, branch protection bypass attempts, secret-scanning alerts, Dependabot alerts | GitHub audit log + Security tab |
| MCP server (in-app) | Every tool call: org ID, tool name, outcome, timing | Custom log table in Supabase |
| Sentry | Production errors on frontend + Edge Functions | Sentry dashboard with alerts |
| Polar / Stripe | Payment events, webhook deliveries | Vendor dashboard |

MCP tool call logs **do not** include transcript content. They include identifiers (org, tool name) and timing only.

## 4. Retention

| Source | Retention |
|--------|-----------|
| Supabase Auth + audit logs | Platform default (currently ~7 days for free tier, longer on paid tiers) |
| Supabase Edge Function logs | Platform default |
| Vercel request + function logs | Platform default per plan tier |
| GitHub audit log | Platform default (90 days for free orgs, longer for Enterprise) |
| MCP server custom audit table | **12 months** rolling, then purged |
| Sentry | Per-plan retention (typically 30-90 days for free / pro tier) |

The 12-month MCP audit retention is set deliberately to match the auditor sampling window for SOC 2 Type II monitoring. Extend if a longer retention is contractually required.

## 5. Review Cadence

- **Daily** — Sentry alerts surface to email/Slack on any production error
- **Weekly** — Information Security Officer skims Vercel + Sentry dashboards for trend anomalies
- **Monthly** — review of GitHub Security tab (Dependabot, secret scanning, code scanning advisories) and MCP audit log volume trends
- **Quarterly** — formal access review (per Access Control Policy) cross-references Supabase Auth logs

Evidence of review is recorded in `.compliance/evidence/{YYYY-MM-DD}/log-review/`.

## 6. Alerting

| Condition | Alert path |
|-----------|------------|
| Production frontend or Edge Function error | Sentry → email |
| GitHub Dependabot critical-severity advisory | GitHub → email |
| GitHub secret scanning alert | GitHub → email |
| Supabase auth anomaly (e.g., repeated failed logins on the principal account) | Supabase platform notifications |
| Vercel deployment failure | Vercel dashboard + email |

When the workforce expands beyond a single principal, alerts route to a shared `security@` distribution.

## 7. Log Integrity

Platform-managed logs (Supabase, Vercel, GitHub, Stripe, Sentry) inherit the platform's integrity guarantees. The custom MCP audit table is append-only at the application layer; direct row deletion requires the Supabase service-role key, restricted to the principal per Access Control Policy.

## 8. Privacy

Logs may incidentally contain identifiers (email, org name). They do not contain transcript content, customer call audio, or payment card data. Customers who request log purges for their own data follow the Data Retention & Deletion Policy.

## 9. Review

This Policy is reviewed at least annually or on material change to logging surfaces.
