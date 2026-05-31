# Incident Response Tabletop Exercise — Template

**Template version:** 1.0
**Owner:** Andrew Naegele (Incident Response Lead)
**Governed by:** [Incident Response Plan (IRP-005) §8](../policies/05-incident-response-plan.md)
**Frequency:** At least annually

---

## How to use this template

1. Copy this file to `.compliance/evidence/{YYYY-MM-DD}/tabletop-exercise/{YYYY-scenario-slug}.md`
2. Pick a scenario (see Section 2) or write a custom one
3. Walk through the response phases (Section 4) in real time, capturing decisions as they happen
4. Capture findings (Section 5) and feed back into the Incident Response Plan
5. Commit + retain for 3 years

---

## Exercise metadata

| Field | Value |
|-------|-------|
| Exercise date | (YYYY-MM-DD) |
| Lead facilitator | Andrew Naegele |
| Participants | (Andrew Naegele; future: full IR team) |
| Scenario | (e.g., "Compromised principal account") |
| Severity classification (target) | SEV-1 / SEV-2 / SEV-3 / SEV-4 |
| Time budget | (e.g., 60 minutes) |

## 1. Goals of this exercise

- Verify that the Incident Response Plan procedures are executable as written
- Test detection-to-containment cycle time
- Identify gaps in tooling, documentation, or workforce knowledge
- Update the IRP with any improvements surfaced

## 2. Suggested scenarios (rotate annually)

### Scenario A — Compromised principal account
A phishing email convinces the principal to authenticate via a fake Supabase login page. The attacker captures the session and begins exfiltrating customer transcripts.

### Scenario B — Leaked production secret
A Supabase service role key is accidentally committed to a public gist. GitHub secret scanning flags it (if enabled).

### Scenario C — Subprocessor outage
Supabase has a multi-hour regional outage. CallVault is unavailable for the duration. Customer support volume spikes.

### Scenario D — Data corruption from migration
A new database migration silently corrupts the `transcripts` table for a subset of customers. Discovered 6 hours post-deploy when customers report missing data.

### Scenario E — Subprocessor breach notification
Anthropic notifies CallVault of a confirmed breach affecting API customers between dates X and Y. CallVault customers used AI-tier MCP tools during the window.

## 3. Selected scenario detail

| Field | Value |
|-------|-------|
| Scenario name | (e.g., Scenario A — Compromised principal account) |
| Trigger event | (Walk through the inciting event as the participants would experience it) |
| Initial indicators | (What the team would actually see — Sentry alert, customer email, dashboard anomaly) |
| Time of detection | (T+0) |

## 4. Response walkthrough

### Phase 1 — Detect (IRP §6.1)

- [ ] Who notices first? What signal?
- [ ] What's the first written record? Where is it captured?
- [ ] Time from detection to written record: ___ minutes

### Phase 2 — Classify (IRP §6.2)

- [ ] Severity assignment
- [ ] Rationale
- [ ] Time from detection to classification: ___ minutes

### Phase 3 — Contain (IRP §6.3)

- [ ] First containment action
- [ ] Subsequent actions
- [ ] What was rotated / revoked / disabled?
- [ ] Time from detection to containment: ___ minutes vs SLA

### Phase 4 — Eradicate (IRP §6.4)

- [ ] Root cause hypothesis
- [ ] Confirmation method
- [ ] Code / config / policy changes applied

### Phase 5 — Recover (IRP §6.5)

- [ ] Restoration steps
- [ ] Verification steps
- [ ] Time to full recovery

### Phase 6 — Communicate (IRP §6.6)

- [ ] Customer notification — drafted? sent? template used?
- [ ] Regulator notification — required? drafted? sent?
- [ ] Public disclosure — required? trust page updated?

### Phase 7 — Learn (IRP §6.7)

- [ ] Post-mortem author + due date
- [ ] Improvements queued

## 5. Findings

Concrete gaps surfaced during the exercise:

| # | Gap | Owner | Due | Status |
|---|-----|-------|-----|--------|
| F1 | (e.g., "No template for SEV-1 customer notification email") | Andrew | (date) | (open / closed) |

## 6. IRP updates queued

Specific changes to feed back into `.compliance/policies/05-incident-response-plan.md`:

| Section | Change |
|---------|--------|
| (e.g., §6.6) | (e.g., "Add customer notification email template at templates/sev1-notification-email.md") |

## 7. Records retention

This record is retained for at least 3 years per the Logging & Monitoring Policy and IRP §7.

## 8. Sign-off

| | |
|---|---|
| Facilitator | Andrew Naegele |
| Date completed | (YYYY-MM-DD) |
| Findings count | (number) |
| Critical issues escalated | (none / list) |

---

## History

| Date | Scenario | Findings | IRP updates |
|------|----------|----------|--------------|
| _next exercise scheduled_ | _to be selected_ | | |
