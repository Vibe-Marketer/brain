---
policy_id: VMP-006
title: Vendor and Subprocessor Management Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC9.2", "CC2.3"]
---

# Vendor and Subprocessor Management Policy

## 1. Purpose

Defines how CallVault selects, engages, monitors, and discloses third-party vendors that process customer data on CallVault's behalf ("subprocessors") and other vendors that materially support the CallVault service ("supporting vendors").

## 2. Distinction

| Category | Definition | Examples |
|----------|------------|----------|
| **Subprocessor** | A third party that processes customer-classified data on CallVault's behalf | Supabase, Vercel, Polar, Stripe, OpenRouter, Anthropic, OpenAI |
| **Supporting vendor** | A third party material to operations but not processing customer data | 1Password, GitHub, Sentry, domain registrar |

Subprocessors are disclosed publicly on `callvaultai.com/trust`. Supporting vendors are tracked internally but not publicly disclosed unless they begin processing customer data.

## 3. Subprocessor Inventory (effective date)

| Name | Role | Customer data processed | Region | Inheritance claims |
|------|------|-------------------------|--------|---------------------|
| **Supabase** | Primary database, authentication, Edge Functions | All customer-classified data (transcripts, contacts, auth records, MCP tokens) | Project region per CallVault's Supabase configuration | SOC 2 Type II, HIPAA-eligible plans, GDPR DPA available |
| **Vercel** | Frontend hosting, edge deployment, CI/CD | Request metadata, deployment logs (does not include customer transcript text) | Vercel multi-region | SOC 2 Type II, ISO 27001:2022, HIPAA BAA on Enterprise, EU-US DPF |
| **Polar** | Subscription billing of record | Billing email, subscription state | Per Polar configuration | Polar's published posture (to be linked from trust page) |
| **Stripe** | Payment processing under Polar | Card data (Stripe-hosted Checkout iframe; never touches CallVault servers), payment receipts | Stripe global | PCI DSS Level 1, SOC 1/2 Type 2, ISO 27001, EU-US DPF |
| **OpenRouter** | Routing layer to LLM providers for AI-tier MCP tools | Transcript text submitted at AI-tool invocation | Per OpenRouter routing | Per OpenRouter's published policy |
| **Anthropic** | LLM provider via OpenRouter | Transcript text submitted at AI-tool invocation | US | SOC 2 Type II, HIPAA BAA available, ISO 27001 |
| **OpenAI** | LLM provider via OpenRouter | Transcript text submitted at AI-tool invocation | US | SOC 2 Type II, CSA STAR Level 1, HIPAA BAA available |

The current inventory is mirrored in `.compliance/facts.yaml` and on the public trust page. Any change to this inventory requires a Policy revision, an updated trust page, and customer notification per Section 7.

## 4. Selection Criteria

Before engaging a new subprocessor, the Information Security Officer evaluates:

1. **Necessity.** Does the engagement materially improve the service or reduce a risk that cannot be addressed in-house?
2. **Posture.** Does the vendor maintain a security posture appropriate to the data class involved?
   - For Confidential — Customer Data, vendors should hold at minimum SOC 2 Type II or equivalent.
   - Vendors handling regulated data classes (PHI, PCI) must hold the applicable certification or attestation.
3. **Documentation.** Does the vendor publish a DPA, a security overview, and an active trust page?
4. **Subprocessor transparency.** Does the vendor disclose its own subprocessors?
5. **Data residency.** Does the vendor support a region appropriate to the customer base?
6. **Exit terms.** Can CallVault offboard the vendor without orphaning customer data?

A vendor that does not meet these criteria may still be engaged on a documented exception basis; the exception is captured in the risk register.

## 5. Engagement

A new subprocessor is engaged only after:

1. A Data Processing Addendum (DPA) is executed
2. The vendor's current SOC 2 / ISO / equivalent attestation is reviewed
3. The vendor is added to `.compliance/facts.yaml` and the public trust page
4. Customers are notified per Section 7

## 6. Ongoing Monitoring

For each subprocessor:

- **Annually**, the Information Security Officer reviews:
  - Current attestation validity (SOC 2 reports rotate annually; expired attestations trigger an inquiry)
  - DPA validity and any updates
  - The vendor's own subprocessor disclosures
  - Any security advisories or incidents publicly disclosed by the vendor

- **On notification** from the vendor of an incident affecting CallVault customer data, the response follows the Incident Response Plan.

Review evidence is recorded in `.compliance/evidence/{YYYY-MM-DD}/subprocessor-review/`.

## 7. Customer Notification of Subprocessor Changes

CallVault provides customers with advance notice of material changes to the subprocessor list. The notification mechanism is:

- The trust page at `callvaultai.com/trust` is the source of truth
- Material additions are announced via email to existing customers at least **fifteen days** before the new subprocessor begins processing customer data, where contractually committed
- Material removals (a vendor is no longer used) are announced when the offboarding is complete

Customers who object to a new subprocessor have the rights granted in their customer agreement. As of the effective date, no customer agreement explicitly grants a veto right; CallVault commits to the notice period above as a matter of policy.

## 8. Termination

Subprocessor engagements are terminated when:

- The vendor's security posture materially degrades
- The vendor is acquired by an entity that materially changes the risk profile
- CallVault no longer requires the service
- The customer agreement obligates removal

Upon termination, CallVault confirms (where contractually available) that the vendor has deleted CallVault customer data per the DPA's exit terms.

## 9. Supporting Vendor Inventory

| Name | Role | Sensitive material handled |
|------|------|----------------------------|
| 1Password | Credential vault | Production credentials (Restricted data) |
| GitHub | Source code hosting, CI/CD | Source code, GitHub Actions secrets |
| Sentry | Error monitoring | Stack traces (may include incidental user identifiers) |
| Domain registrar (to be specified in evidence capture) | DNS and domain control | Domain credentials |
| Google Workspace (if used) | Email and document storage | Internal correspondence |

Supporting vendors are reviewed annually under the same criteria as subprocessors.

## 10. Review

This Policy is reviewed at least annually and upon any addition, removal, or material change to a subprocessor or supporting vendor.
