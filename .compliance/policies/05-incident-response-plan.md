---
policy_id: IRP-005
title: Incident Response Plan
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC7.3", "CC7.4", "CC7.5"]
---

# Incident Response Plan

## 1. Purpose

Defines how CallVault detects, classifies, responds to, and learns from security incidents affecting CallVault systems, customer data, or 7X Systems LLC operations.

## 2. Definitions

**Security event.** Any observable occurrence in a CallVault system that is potentially security-relevant: a failed-login spike, an unexpected `403`, a Sentry error in an authentication code path, a suspicious entry in audit logs.

**Security incident.** A security event that is confirmed or reasonably believed to have caused, or attempted to cause, one of:

- Unauthorized disclosure of customer data
- Unauthorized modification of customer data
- Unavailability of the CallVault service beyond the published availability target
- Compromise of any production credential, MCP token, or OAuth grant
- Compromise of a workforce account with production access
- Compromise of a subprocessor that materially affects CallVault customer data

**Data breach.** An incident that meets the legal definition of a data breach under any law applicable to an affected customer (GDPR, CCPA, state breach-notification statutes).

## 3. Roles

| Role | Holder | Responsibility |
|------|--------|----------------|
| Incident Response Lead | Andrew Naegele (sole principal) | Declares incidents, coordinates response, owns the post-mortem |
| Communications Lead | Andrew Naegele | Drafts and sends customer notifications |
| Technical Lead | Andrew Naegele | Performs containment and remediation actions |
| Legal Counsel | External counsel, engaged as needed | Advises on notification obligations and disclosure timing |

The single-principal staffing of these roles is acknowledged as a known structural limitation. As the workforce grows, the roles are allocated to distinct individuals.

## 4. Detection Sources

CallVault security events are detected from the following sources:

- **Sentry** (`@sentry/react`) — production error monitoring on the frontend and Edge Functions
- **Supabase** audit logs and Auth logs
- **Vercel** deployment and request logs
- **GitHub** security alerts (Dependabot, code scanning, secret scanning)
- **External reports** from customers (`support@callvaultai.com`) or security researchers
- **Subprocessor notifications** received under DPAs with Supabase, Vercel, Polar, Stripe, OpenRouter, Anthropic, OpenAI

## 5. Classification

Incidents are classified by severity. The classification drives the response timeline and notification obligations.

| Severity | Definition | Response time |
|----------|------------|---------------|
| **SEV-1 (Critical)** | Confirmed or strongly suspected unauthorized access to customer data, OR full production outage exceeding two hours, OR confirmed compromise of a principal account or production credential | Containment work begins within **1 hour** of detection |
| **SEV-2 (High)** | Suspected unauthorized access; partial outage; compromised non-production credential; significant security control failure | Containment within **4 hours** |
| **SEV-3 (Medium)** | Security-relevant misconfiguration with no evidence of exploitation; subprocessor security advisory requiring action | Remediation within **2 business days** |
| **SEV-4 (Low)** | Informational; security observation that does not require immediate action | Logged for review in next quarterly access review |

## 6. Response Phases

### 6.1 Detect

When a security event is observed, the observer creates a written incident record (in the Evidence Vault under `.compliance/evidence/{YYYY-MM-DD}/incident-{id}/`) capturing time of detection, source, observed facts, and initial hypothesis.

### 6.2 Classify

The Incident Response Lead reviews the record within the response window for the suspected severity and assigns a final SEV classification.

### 6.3 Contain

Containment actions, applied as warranted:

- Rotate compromised credentials (Supabase service role, Vercel env vars, integration API keys, MCP tokens, OAuth grants)
- Revoke active sessions for affected accounts
- Disable affected MCP tokens via the `mcp_tokens` table
- Revoke affected OAuth grants via the `mcp_oauth_org_bindings` table
- Block traffic at Vercel firewall level if applicable
- Temporarily disable affected Edge Functions if a vulnerability is confirmed
- Notify affected subprocessors

### 6.4 Eradicate

Root cause is identified. Code fixes, configuration changes, or policy changes are applied to prevent recurrence.

### 6.5 Recover

Service is restored to normal operation. Restored state is verified before declaring the incident closed.

### 6.6 Communicate

#### Customer notification

Customer notification is required for any incident meeting the definition of a data breach under applicable law. The default notification timeline is:

- **GDPR-affected customers:** notification to the Information Commissioner's Office and affected customers within **72 hours** of becoming aware of the breach
- **CCPA-affected customers:** notification "in the most expedient time possible and without unreasonable delay," consistent with statute
- **State breach-notification statutes:** per the strictest applicable timeline (most U.S. states require 30-90 days; some require 45 days)

Customer notifications include:

- Description of the incident in plain language
- Categories and approximate volume of affected data
- Likely consequences for the customer
- Mitigation steps CallVault has taken and is taking
- Mitigation steps the customer is advised to take (e.g., password rotation)
- A contact for further questions (`support@callvaultai.com`)

#### Public disclosure

Public disclosure is made at `callvaultai.com/trust` when:

- The incident affected a material number of customers, or
- The incident is otherwise newsworthy and silence would undermine customer trust

Public disclosure timing balances customer notification, regulatory obligations, and legal counsel guidance.

### 6.7 Learn (Post-mortem)

Within **two weeks** of incident closure, the Incident Response Lead authors a written post-mortem capturing:

- Timeline (detection → containment → eradication → recovery)
- Root cause (technical, process, human factors)
- Contributing factors
- What worked
- What did not work
- Concrete actions to prevent recurrence, each with an owner and due date

Post-mortems are stored in `.compliance/evidence/{YYYY-MM-DD}/incident-{id}/post-mortem.md` and are reviewed during the next quarterly access review for action-item completion.

## 7. Evidence Preservation

For SEV-1 and SEV-2 incidents, the Incident Response Lead preserves:

- Relevant log excerpts (Supabase, Vercel, GitHub, Sentry)
- Relevant database snapshots (where customer data integrity is in question)
- Screenshots of administrative actions taken during response
- Communications with customers, subprocessors, and regulators

Evidence is retained for a minimum of three years.

## 8. Tabletop Exercises

The Incident Response Lead conducts a tabletop exercise at least annually, walking through a hypothetical SEV-1 scenario end to end. Findings are captured and used to revise this Plan.

## 9. Incident History (as of effective date)

As of the effective date, **no security-relevant incidents have been reported in the preceding twelve months**, per the Information Security Officer.

## 10. Review

This Plan is reviewed at least annually, after every SEV-1 or SEV-2 incident, and upon material change to the CallVault architecture or subprocessor list.
