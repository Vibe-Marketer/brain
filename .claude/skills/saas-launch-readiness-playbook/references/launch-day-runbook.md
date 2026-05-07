# Launch Day Runbook

Pull this open during a launch and tick items off in order. Don't skip — the order matters.

---

## T-72 Hours (the boring-but-existential checks)

These three are silent killers. They never fail loudly until users complain that signups don't work / their data is gone / your site got blocked by Apple Mail.

### Email Deliverability

- [ ] **Run `bash scripts/email_deliverability_check.sh <your-domain>`** — verifies SPF, DKIM, DMARC, MX
- [ ] **Send a test signup email to `your-name+test@gmail.com`** and confirm it lands in **Inbox**, not Spam
- [ ] **Run `https://www.mail-tester.com`** — paste the tester address, send your transactional template, confirm 9/10 or higher
- [ ] **Verify password-reset email** from production lands in real inbox (not just dev console log)
- [ ] **DMARC tightening plan** — start with `p=none`, monitor for 1 week via `rua=` aggregate reports, then move to `p=quarantine`. Required by Gmail/Yahoo for bulk senders since 2024.

If any of these fail, signups silently bounce on launch day and you find out 48 hours later from angry users.

### Backup Restore Drill

A backup you've never restored is not a backup.

- [ ] **Trigger a manual Supabase backup** today (dashboard → Database → Backups → Create backup)
- [ ] **Restore to a throwaway project** — Supabase Pro+ supports cross-project restore
- [ ] **Verify the restored project has your real data** — log in, list 5 records, confirm they match prod
- [ ] **Time the restore** — note how long it took. That's your RTO (recovery time objective). Document it.
- [ ] **Document the restore command/click-path** — pin it in #engineering. On launch day under stress, no one remembers.

### Legal / Compliance

- [ ] **Terms of Service published** — link from footer + signup page
- [ ] **Privacy Policy published** — accurate to what you actually collect (Sentry replays, Supabase auth events, Stripe customer data, etc.)
- [ ] **Cookie banner** if you have any EU traffic — even a simple "we use cookies" + reject button is required by GDPR/ePrivacy
- [ ] **DPA (Data Processing Agreement)** with each subprocessor — Supabase, Vercel, Sentry, OpenRouter, etc. all publish standard DPAs you sign electronically
- [ ] **Subprocessor list** — public page listing every third party that touches user data (required by GDPR Art. 28)
- [ ] **Right-to-deletion endpoint** — if you have EU users, you need a way for them to request data deletion. Even a contact form pointing at a manual process is acceptable for v1.

If you're B2B SaaS targeting enterprise, you'll also want:
- [ ] **SOC 2 Type 1** in motion (if not already certified) — most enterprise prospects require it
- [ ] **Status page** at `status.<your-domain>` (Statuspage, Statuspal, BetterStack)

---

## T-48 Hours

- [ ] **All E2E tests passing on staging** — run `npx playwright test` against the staging URL, not just CI
- [ ] **Load test completed** — k6 or Locust with thresholds met (p95 < 2s, error rate < 1%)
- [ ] **OWASP P0 and P1 items resolved** — `python3 scripts/security_checklist.py --url $PROD_URL --supabase-lint`
- [ ] **RLS verified on tables AND views AND security definer funcs** — `python3 scripts/rls_verifier.py`
- [ ] **Adversarial RLS test passed** — `bash scripts/rls_adversarial_test.sh calls user_id` for each sensitive table
- [ ] **Lighthouse audit passes** — `bash scripts/lighthouse_audit.sh $PROD_URL` (Performance ≥85, LCP <2.5s)
- [ ] **Sentry alerts configured and tested** — trigger a test error, confirm it lands in the right channel
- [ ] **CI pipeline green on `main`** — no in-flight PRs blocking releases
- [ ] **Production env vars set** — every `VITE_` and server-side secret present in Vercel project settings
- [ ] **Security headers via `vercel.json`** — copy from `assets/vercel.json.template`, customize CSP `connect-src` for your third parties

---

## T-24 Hours

- [ ] **DNS TTLs reduced to 300s** — for fast rollback if you need to re-point
- [ ] **Database backups confirmed and tested** — run the restore drill from T-72 again if it's been more than a few days
- [ ] **Rollback plan documented** — Vercel offers instant rollback via dashboard → Deployments → previous → Promote
- [ ] **Team availability confirmed** — engineering on-call for the launch window
- [ ] **Customer support briefed** — comms team knows what to say if there's an outage
- [ ] **Status page ready** — if you have one, draft the "we're investigating" template
- [ ] **Code freeze** — only critical-bug PRs allowed past this point
- [ ] **Stripe live mode** verified (not test mode). Triple check.

---

## Launch Day (T-0)

**First 30 minutes are critical.**

- [ ] **Promote production deploy** — push to `main`, watch Vercel deploy succeed
- [ ] **Run smoke test** — `BASE_URL=$PROD_URL bash scripts/smoke_test.sh` — must return all 200s
- [ ] **Make a real test purchase** — verify webhook fires + DB row appears (the single most common launch-day surprise is broken billing)
- [ ] **Monitor Sentry error rate** — watch for the first 30 minutes; spike → rollback
- [ ] **Watch Supabase connection count** — dashboard → Reports → Database → Connections. If maxed, scale up.
- [ ] **Watch Supabase query performance** — anything > 1s should be investigated
- [ ] **Check Vercel function invocations** — logs show errors? Investigate before they propagate.
- [ ] **Confirm transactional email is firing** — sign up as a fresh test user, watch the welcome/confirmation email actually land
- [ ] **Tweet / post / announce** — only after smoke test + 30 min of clean Sentry

---

## Post-Launch (Week 1)

- [ ] **Daily Sentry triage** — review new issues each morning, resolve P0/P1 same-day
- [ ] **Re-run load test at actual traffic levels** — peak traffic might exceed your 50-VU pre-launch baseline
- [ ] **Address OWASP P2 items** — admin role checks, MFA, error sanitization
- [ ] **Tighten DMARC policy** — move from `p=none` to `p=quarantine` after a week of clean aggregate reports
- [ ] **Enable Dependabot security alerts** — GitHub Settings → Security → Dependabot
- [ ] **Schedule monthly security review cadence** — recurring calendar block, owner assigned
- [ ] **Performance review** — Lighthouse scores still passing? Bundle size still under 200KB initial JS?
- [ ] **First retro** — what broke? what worked? captured in writeup before memory fades

---

## Rollback Decision Tree

```
Production smoke test fails?
  └─ YES → Vercel: Promote previous deployment immediately. Investigate after.
  └─ NO  → Continue.

Sentry error rate >10x baseline within first 30 min?
  └─ YES → Investigate. If not fixable in 5 min, rollback.
  └─ NO  → Continue monitoring.

Supabase connection count maxed?
  └─ YES → Scale up tier (dashboard → Settings → Compute). Don't rollback.
  └─ NO  → Continue.

User reports of broken auth / payment / core feature?
  └─ YES → Reproduce. If real, rollback. Don't debate.
  └─ NO  → Continue.

User reports they never got the signup email?
  └─ YES → Check email provider dashboard for bounces/spam reports.
            If domain is being blocked, this is bigger than a code rollback —
            page the founder.
  └─ NO  → Continue.
```

---

## After-Action Notes

Capture in a writeup within 24 hours of launch — memory fades fast:

- What broke that we didn't predict?
- What worked better than expected?
- Which checklist items were skipped or rushed?
- Which items need to be added to next launch's checklist?
- Action items for the next sprint?
