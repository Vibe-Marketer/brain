---
policy_id: BCP-011
title: Business Continuity and Disaster Recovery Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["A1.2", "A1.3", "CC7.5"]
---

# Business Continuity and Disaster Recovery Policy

## 1. Purpose

Defines how CallVault maintains continuity of service during disruptions and how it recovers from disasters affecting production systems or the principal's availability.

## 2. Scope

- CallVault application (frontend + Edge Functions + database)
- Subprocessor disruptions (Supabase outage, Vercel outage, etc.)
- Principal availability (illness, incapacitation, loss of access to systems)

## 3. Recovery Objectives

| Metric | Target |
|--------|--------|
| **RTO** (Recovery Time Objective) — service restoration after disruption | 4 hours for application-level issues; 24 hours for full database restore |
| **RPO** (Recovery Point Objective) — maximum acceptable data loss | 24 hours, bounded by Supabase managed backup frequency |
| **Availability target** | 99.5% monthly, inherited from underlying platform SLAs |

These targets are revisited annually and may tighten as the customer base or contractual obligations grow.

## 4. Disruption Categories

### 4.1 Subprocessor outage

Inherited from the provider's SLA. CallVault's response:

- Acknowledge on `support@callvaultai.com` and (when warranted) on status page
- Customer notification if outage exceeds 1 hour
- No mitigation possible beyond the provider's own recovery work

### 4.2 Application-level bug

Treated under the Incident Response Plan. Rollback to last-known-good Vercel deployment is the first containment action.

### 4.3 Data corruption or loss

Trigger Supabase backup restore per Section 5. Customer notification per the Incident Response Plan if customer data is affected.

### 4.4 Principal unavailable

Bus-factor scenario. Handled via Section 6.

## 5. Backup and Restore

- **Backup mechanism** — Supabase managed daily backups
- **Backup retention** — per Supabase plan tier
- **Backup encryption** — at rest by Supabase
- **Restore testing** — at least annually; the principal has performed at least one successful restore as of the effective date
- **Restore procedure** — documented in `docs/operations/` (or in a future `docs/operations/backup-restore-runbook.md` to be drafted)

## 6. Principal Continuity (Bus Factor)

The principal currently holds sole control of every production system. To mitigate bus-factor risk:

- **1Password emergency kit** stored in two physical locations
- **Estate planning document** (held by personal counsel) includes credentials and instructions for an emergency successor to assume control
- **Annual review** of the kit, the emergency successor designation, and the access list

When the workforce expands to include a second principal or named successor, this section will be updated to reflect the new shared-responsibility model.

## 7. Communications During Disruption

- **Customers** — `support@callvaultai.com` + (when provisioned) status page at `status.callvaultai.com` (BetterStack or UptimeRobot free tier — to be set up)
- **Subprocessors** — direct engagement via vendor support channels
- **Public** — material disruptions disclosed on the trust page at `callvaultai.com/trust`

## 8. Tabletop Exercises

The principal conducts an annual tabletop exercise simulating a major disruption (full Supabase outage, principal incapacitation, customer-data-loss scenario). Findings update this Policy.

## 9. Insurance

No cyber liability insurance is in force at the effective date. The principal has accepted this risk per the Risk Assessment Policy (RISK-002). Revisited on first enterprise customer execution.

## 10. Known Limitations

- Single-region Supabase project — no multi-region failover (Risk RISK-006 in Risk Assessment Policy)
- No documented runbook for the most common disruption categories beyond this Policy — to be drafted in `docs/operations/`
- Status page not yet provisioned

These are tracked and prioritized for closure.

## 11. Review

This Policy is reviewed at least annually, after every SEV-1 incident, and on material change to subprocessor SLAs.
