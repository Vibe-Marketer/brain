# Security Awareness Training Record — 2026 Annual Cycle

**Cycle:** FY2026 (2026-01-01 → 2026-12-31)
**Workforce member:** Andrew Naegele (Principal / Information Security Officer)
**Governed by:** [Security Awareness Training Policy (SAT-017)](../../policies/17-security-awareness-training-policy.md)
**Completion date:** 2026-05-31
**Next cycle due:** 2027-05-31

---

## Cycle scope

This record documents the inaugural annual security awareness training cycle for CallVault's single-principal workforce.

## Topics reviewed

| Topic | Material reviewed | Date completed |
|-------|-------------------|----------------|
| Information Security Policy + 22 derivative policies | Full read-through of `.compliance/policies/*.md` | 2026-05-29 |
| Data Classification — what customer data is, handling rules | `.compliance/policies/03-data-classification-policy.md` | 2026-05-29 |
| Phishing recognition incl. AI-assisted phishing tactics | CISA bulletins (https://www.cisa.gov/news-events/cybersecurity-advisories), Cloud Security Alliance current threat advisories | 2026-05-30 |
| Password & credential hygiene | `.compliance/policies/19-password-policy.md`; verified 1Password Watchtower clean | 2026-05-29 |
| MFA enrollment verification on critical accounts | Phase A evidence sweep (`.compliance/evidence/2026-05-29/`) surfaced gaps; remediation in-progress | 2026-05-29 |
| Incident reporting procedure | `.compliance/policies/05-incident-response-plan.md` §6 | 2026-05-29 |
| Acceptable Use Policy expectations | `.compliance/policies/12-acceptable-use-policy.md` | 2026-05-29 |
| Subprocessor data flow awareness — what gets sent where | `.compliance/policies/06-vendor-and-subprocessor-management-policy.md` + DPA + Data Classification §5.1 | 2026-05-29 |

## Acknowledgments

Acknowledged by the principal on 2026-05-31:

- I have read and understood the Information Security Policy and every derivative policy currently in force
- I commit to operating in compliance with the policy library
- I have verified my own credentials and MFA posture per the Password Policy and Access Control Policy
- I have reviewed the threat landscape sources cited above and am current as of the completion date

## Phishing simulation

Not performed this cycle (Section 6 of the SAT Policy — phishing simulation begins at 5+ workforce). N/A for FY2026.

## Action items surfaced during the review

| Item | Owner | Due | Status |
|------|-------|-----|--------|
| Apply 15-min compliance posture fixes (FINDINGS-001 through -004 + DNS gaps) | Andrew | within 1 week of 2026-05-30 | tracked in `.planning/todos/pending/2026-05-30-apply-compliance-posture-fixes.md` |
| Migrate remaining LastPass entries to 1Password | Andrew | 2026-09-30 | in progress (RISK-003) |
| Schedule annual restore drill | Andrew | within 12 months of last drill | tracked |

## Reviewer notes

The inaugural training cycle was conducted during the Session 1.x compliance bootstrap. The principal is both subject and reviewer; this is acceptable at the current single-principal stage and is documented as a known limitation. When the workforce expands, training will be administered via an external platform (e.g., KnowBe4) with separation of reviewer from subject.

## Records retention

This record is retained for at least 3 years per the Security Awareness Training Policy §7.

## Sign-off

| | |
|---|---|
| Workforce member | Andrew Naegele |
| Information Security Officer | Andrew Naegele |
| Completion date | 2026-05-31 |
| Next cycle due | 2027-05-31 |
