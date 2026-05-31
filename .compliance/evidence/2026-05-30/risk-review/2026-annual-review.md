# Risk Register Annual Review — 2026

**Review date:** 2026-05-31
**Reviewer:** Andrew Naegele (Information Security Officer)
**Governed by:** [Risk Assessment Policy (RAP-008)](../../policies/08-risk-assessment-policy.md)
**Register version reviewed:** v1.0 (2026-05-30)
**Next review due:** 2027-05-31 (or on material change)

---

## Scope

Inaugural annual review of `.compliance/risk-register.yaml`. 12 risks were identified during the Session 1.x compliance bootstrap; this review confirms their accuracy, currency, and treatment status as of the review date.

## Risk-by-risk review

| ID | Title | Status at review | Notes |
|----|-------|------------------|-------|
| RISK-001 | Single-principal bus factor | Open / accepted | Compensating controls verified: 1Password emergency kit + estate planning doc; revisit 2027-05-31 |
| RISK-002 | No cyber liability insurance | Open / accepted | No enterprise contract trigger yet; revisit annually or on first enterprise execution |
| RISK-003 | LastPass legacy vault | Mitigation in progress | Andrew confirmed high-value credentials rotated; remaining migration target 2026-09-30 |
| RISK-004 | LLM subprocessor transit | Accept-with-disclosure | Trust page + DPA §4.2 disclose; no change required |
| RISK-005 | Indefinite retention default | Partially mitigated | Self-serve deletion at all levels verified in code 2026-05-29; per-workspace retention scheduling remains future product work |
| RISK-006 | Single-region Supabase | Open / accepted | Revisit on first enterprise availability commitment |
| RISK-007 | No formal pentest | Open / mitigate | Scheduled with SOC 2 Type II prep (estimated 2027) |
| RISK-008 | GitHub security features disabled | Mitigation pending Andrew action | Captured in todo `.planning/todos/pending/2026-05-30-apply-compliance-posture-fixes.md` Step 1 |
| RISK-009 | Branch protection laxer than policy claims | Mitigation pending Andrew action | Same todo Step 2 |
| RISK-010 | Vercel + Supabase native MFA not enrolled | Mitigation pending Andrew action | Same todo Steps 3-4 |
| RISK-011 | Missing SPF record | Mitigation pending Andrew action | Same todo Step 5 |
| RISK-012 | DNSSEC unsigned | Tracked, not actively treated | Score 2; below threshold |

## New risks identified during review

None. The Phase A evidence sweep on 2026-05-29 was thorough; no additional risks surfaced between then and this review.

## Risks closed since prior review

This is the inaugural review; no prior register existed. None closed.

## Risk trends

Not applicable for the inaugural review. Trend tracking begins with the 2027 review.

## Treatment effectiveness

The 4 risks pending Andrew action (RISK-008/-009/-010/-011) all have a single in-browser remediation path scheduled within the next week. The treatments are appropriate and proportionate.

The 5 accepted risks (RISK-001/-002/-004/-006 + post-mitigation -010) all have explicit justification + revisit dates. The acceptance decisions are appropriate at current company scale.

## Methodology check

The Risk Assessment Policy I×L methodology is being applied as specified. No methodology adjustments queued.

## Actions for next quarter

- Andrew applies the 5-step remediation todo → RISK-008/-009/-010/-011 mitigation actions close
- Update RISK-008/-009/-010/-011 status to `mitigated` after evidence vault captures green-state screenshots
- Re-baseline RISK-005 once per-workspace retention scheduling UX is shipped (timing TBD by product roadmap)

## Actions for next annual review

- Re-score all 12 existing risks
- Add any new risks surfaced by:
  - Quarterly access reviews
  - Security-relevant incidents
  - Subprocessor changes
  - Material regulatory changes
  - Material architecture changes
- Validate compensating controls still in place for accepted risks
- Confirm cyber-liability acceptance decision is still appropriate (likely revisits if enterprise contracts execute)

## Sign-off

| | |
|---|---|
| Reviewer | Andrew Naegele |
| Date completed | 2026-05-31 |
| Risks reviewed | 12 |
| New risks identified | 0 |
| Risks closed | 0 |
| Critical issues escalated | None |
| Register version after review | v1.0 (no changes — only status updates queued post-Andrew-action) |
