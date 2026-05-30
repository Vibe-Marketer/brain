---
policy_id: SAT-017
title: Security Awareness Training Policy
owner: Andrew Naegele
approver: Andrew Naegele
version: 1.0
effective_date: 2026-05-29
next_review_due: 2027-05-29
parent_policy: ISP-001
trust_services_criteria: ["CC1.4", "CC2.2"]
---

# Security Awareness Training Policy

## 1. Purpose

Defines required security awareness training for the CallVault workforce.

## 2. Scope

All workforce members with access to CallVault production systems or customer data.

## 3. Required Topics

Each training cycle covers, at minimum:

- This Information Security Policy and the derivative policies
- Data Classification — what customer data is, how to handle it, what's prohibited
- Phishing recognition — including AI-assisted phishing tactics current in the threat landscape
- Password and credential hygiene (Password Policy, Access Control Policy)
- MFA enrollment verification
- Incident reporting procedure (Incident Response Plan)
- Acceptable Use Policy expectations
- Subprocessor data flow awareness — what gets sent to AI subprocessors and when

## 4. Cadence

- **Initial training** — within 30 days of access provisioning for new workforce members
- **Annual refresh** — every 12 months from the most recent completion date
- **Topical updates** — issued ad hoc when a new threat or policy change warrants

## 5. Format

For the current single-principal workforce, training takes the form of self-administered annual review of this Policy library, recent industry threat advisories (e.g., from CISA, the Cloud Security Alliance), and updated subprocessor documentation. Completion is recorded in `.compliance/evidence/{YYYY-MM-DD}/awareness-training/`.

When the workforce expands, training is delivered via:

- A vendor platform (e.g., KnowBe4, Curricula, or open-source equivalents) for structured coursework, OR
- A documented in-house curriculum with quizzes

## 6. Phishing Simulation

Phishing simulation is not currently performed. When the workforce reaches 5+ members or the threat profile changes, simulated phishing campaigns will be run quarterly.

## 7. Records

Completion records are retained for at least three years as evidence for SOC 2 and customer security reviews.

## 8. Review

Annual or on material change to the threat landscape.
