---
name: saas-launch-readiness-playbook
description: End-to-end battle-tested playbook for taking a SaaS product from "works on my machine" to production. Generates CI/CD pipelines (GitHub Actions), runs load tests (k6 + Locust), audits security against OWASP Top 10:2025, verifies Supabase RLS, runs Lighthouse Core Web Vitals checks, and produces a launch-day runbook. Use this skill whenever the user is preparing for a SaaS launch, asks about pre-launch reviews, mentions launch readiness, OWASP audit, load testing, k6, Locust, GitHub Actions for SaaS, Lighthouse audit, RLS verification, post-deploy smoke tests, go-live checklist, or production launch — even if they don't explicitly say "launch readiness." If the user is in pre-launch territory and asks about CI/CD, monitoring, security, or testing for a SaaS product, fire this skill rather than generic dev tooling skills.
---

# SaaS Launch Readiness Playbook

A battle-tested playbook for taking a SaaS product from "works on my machine" to production. Six launch domains, seven scripts, one runbook.

## Launch Gate Criteria

All six gates must pass before go-live:

| # | Domain        | Gate                                                                 | Script                                |
|---|---------------|----------------------------------------------------------------------|---------------------------------------|
| 1 | CI/CD         | GitHub Actions pipeline green on `main`, branch protection enabled    | `generate_ci_workflow.py`             |
| 2 | Testing       | E2E smoke tests pass, unit coverage ≥80%                              | (Interceptor + Vitest in CI)           |
| 3 | Load          | p95 < 2s, p99 < 5s, error rate < 1% under expected peak load          | `k6_load_test_template.js` or `locust_load_test.py` |
| 4 | Security      | OWASP Top 10:2025 P0 + P1 items resolved, RLS verified                | `security_checklist.py`, `rls_verifier.py` |
| 5 | Performance   | Lighthouse Performance ≥85, LCP < 2.5s, CLS < 0.1                     | `lighthouse_audit.sh`                 |
| 6 | Monitoring    | Sentry capturing errors, alerts routed to team                         | (config in this SKILL.md)             |

Post-deploy canary: `smoke_test.sh` for the first 60 seconds after every production deploy.

## When to Use This Skill

Trigger on:
- "launch readiness review", "pre-launch checklist", "are we ready to ship", "go-live checklist"
- "run k6 against staging", "load test my saas", "locust load test"
- "owasp audit", "owasp top 10", "security checklist for launch"
- "generate a ci workflow", "github actions for our saas"
- "lighthouse audit", "core web vitals", "performance budget"
- "verify rls", "supabase rls audit"
- "post-deploy smoke test", "canary check"

Do NOT trigger for:
- Generic feature testing → use `generate-tests` or Playwright directly
- General security advice → use security-auditor persona
- Day-to-day debugging → use `gsd-debug`

## Quick Start (Most Common Commands)

```bash
# 1. Generate CI/CD workflows for the repo
python3 scripts/generate_ci_workflow.py \
  --app-url https://staging.your-app.com --output both

# 2. Run security audit (network probes + npm audit + Supabase lint)
python3 scripts/security_checklist.py --url https://your-app.com --npm-audit --supabase-lint

# 3. Verify Supabase RLS — tables, views, AND SECURITY DEFINER funcs
python3 scripts/rls_verifier.py

# 4. Adversarial RLS test — proves policies actually block cross-user reads
SUPABASE_URL=... SUPABASE_ANON_KEY=... USER_A_JWT=... USER_B_ID=... \
  bash scripts/rls_adversarial_test.sh calls user_id

# 5. Email deliverability check (SPF/DKIM/DMARC)
bash scripts/email_deliverability_check.sh your-domain.com --selector resend

# 6. Run staged load test (9 minutes)
k6 run scripts/k6_load_test_template.js \
  -e BASE_URL=https://app.callvaultai.com \
  -e TEST_EMAIL=hello@callvaultai.com \
  -e TEST_PASSWORD=ZoomTest1!

# 7. Lighthouse audit
bash scripts/lighthouse_audit.sh https://your-app.com

# 8. Post-deploy smoke test
BASE_URL=https://your-app.com bash scripts/smoke_test.sh
```

**Quick wins (< 5 minutes each):**

```bash
# Drop in production-grade security headers
cp assets/vercel.json.template /path/to/your/repo/vercel.json
# Then customize the CSP connect-src for the third parties you actually call
```

---

## Domain 1: CI/CD Pipeline

**Script:** `scripts/generate_ci_workflow.py`

Outputs two GitHub Actions workflows:

- `ci.yml` — runs on every PR: lint → typecheck → unit tests → E2E → all-checks gate
- `security-scan.yml` — runs daily + on every push: npm audit → TruffleHog secret scan → CodeQL static analysis

```bash
python3 scripts/generate_ci_workflow.py \
  --app-url https://brain-sable-kappa.vercel.app \
  --node-version 20 \
  --output both > workflows.txt
```

The script prints both YAML files to stdout, separated by headers. Pipe to a file and split, or write each section to its own file.

### Branch Protection (Required Before Launch)

In GitHub → Settings → Branches → main:

- [x] Require status checks to pass before merging
- [x] Require `all-checks` as a required status check
- [x] Require at least 1 PR review
- [x] Dismiss stale reviews on new pushes
- [x] Do not allow bypassing these rules

### GitHub Secrets Required

| Secret                          | Used by                 |
|---------------------------------|-------------------------|
| `VITE_SUPABASE_URL`             | E2E job                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | E2E job                 |
| `E2E_TEST_USER`                 | E2E job                 |
| `E2E_TEST_PASSWORD`             | E2E job                 |
| `SENTRY_AUTH_TOKEN`             | Sentry release upload   |

### What good output looks like

CI runs complete in under 10 minutes. All four jobs (lint-typecheck, unit-tests, e2e, all-checks) green. Coverage report uploaded as artifact. Playwright HTML report uploaded as artifact (retained 14 days).

### Common failure modes

- **E2E flakiness in CI but not locally** → Add `retries: 2` and `workers: 1` to playwright.config.ts for CI mode
- **`npm ci` fails with lockfile mismatch** → Run `npm install` locally and commit the new `package-lock.json`
- **CodeQL times out** → It's expected for first run; second run uses cache and is much faster

---

## Domain 2: E2E + Unit Testing

The CI workflow runs Playwright (E2E) and Vitest (unit) in parallel. This skill doesn't ship test code — it ships the runner config.

**Critical path tests Playwright must cover:**

- **Auth flow:** sign up → email confirm → login → logout → password reset
- **Core feature:** primary user journey end-to-end
- **Billing gate:** upgrade prompt fires at free-tier limit
- **Settings:** profile update, account deletion

**Run locally against staging:**

```bash
CALLVAULTAI_LOGIN=test@example.com \
CALLVAULTAI_LOGIN_PASSWORD=testpassword \
BASE_URL=https://staging.your-app.com \
npx playwright test
```

**Tag critical-path tests `@smoke`** so they can run as a quick pre-deploy gate:

```typescript
test('@smoke user can sign in', async ({ page }) => { ... });
// Run only smoke tests:
// npx playwright test --grep @smoke
```

**Vitest coverage thresholds** (in `vite.config.ts`):

```typescript
coverage: {
  thresholds: { lines: 80, functions: 80, branches: 70 }
}
```

What to unit-test (priority order): pure utility functions → data transformations → business-logic hooks (subscription/permission checks) → form validation → error handling.

---

## Domain 3: Load Testing

Two options. Pick one and stick with it.

### Option A: k6 (recommended for CI)

JavaScript, single binary, integrates cleanly into GitHub Actions.

```bash
brew install k6   # macOS

k6 run scripts/k6_load_test_template.js \
  -e BASE_URL=https://staging.your-app.com \
  -e TEST_EMAIL=loadtest@example.com \
  -e TEST_PASSWORD=loadtest-password
```

**9-minute staged ramp:** 0→20 VUs (warm-up) → hold 20 → 20→50 (peak) → hold 50 → ramp down.

**Launch-gate thresholds (built into the script):**
- `http_req_duration p(95) < 2000ms`
- `http_req_duration p(99) < 5000ms`
- `http_req_failed rate < 1%`
- `auth_duration p(95) < 3000ms`

If any threshold fails, k6 exits non-zero and the CI step fails.

### Option B: Locust (recommended for complex scenarios)

Python, web UI, better for sophisticated multi-user simulations.

```bash
pip install locust

# Interactive mode (web UI on http://localhost:8089)
locust -f scripts/locust_load_test.py --host https://your-app.com

# Headless / CI mode
locust -f scripts/locust_load_test.py \
  --host https://your-app.com \
  --headless -u 50 -r 5 --run-time 5m \
  -e TEST_EMAIL=loadtest@example.com \
  -e TEST_PASSWORD=loadtest-password
```

Two user classes: `SaaSUser` (1–5s think time, most traffic) and `HeavyUser` (0.5–2s, peak stress).

### Tuning Thresholds for Your App Type

The default thresholds (`p95 < 2s, p99 < 5s, error rate < 1%`) are calibrated for a typical B2B SaaS dashboard. **Adjust them for your app type** — don't ship someone else's gates.

| App type                       | Recommended p95 | Recommended p99 | Reasoning                                    |
|--------------------------------|-----------------|-----------------|----------------------------------------------|
| B2C marketing site / landing   | < 800ms         | < 2s            | First-impression sensitive, high bounce risk |
| B2B SaaS dashboard (default)   | < 2s            | < 5s            | Authenticated users tolerate more            |
| Search / list-heavy CRUD       | < 1.5s          | < 3s            | Users perceive search as "should be instant" |
| AI / LLM-backed feature        | < 8s            | < 20s           | Streaming + LLM round-trip is unavoidable    |
| File upload / video processing | < 10s connect   | n/a             | Test the upload start, not the full transfer |

To override the built-in thresholds, edit the `thresholds` block at the top of `k6_load_test_template.js`. The script's launch-gate behavior (exit non-zero on threshold breach) still applies.

### Load Testing Best Practices

- **Use a dedicated test user.** Never run load tests against real user data.
- **Run against staging,** not production, unless you have a maintenance window.
- **Warm up the database** — Supabase connection pools need a minute.
- **Watch the Supabase dashboard** during the test for connection count and slow queries.
- **After the test,** review Supabase logs for queries > 1s.

---

## Domain 4: Security (OWASP Top 10:2025)

**Script:** `scripts/security_checklist.py`

Runs automated network probes (security headers, CORS policy, unauthenticated API access, npm audit) plus a structured manual checklist for items that can't be automated.

```bash
# Network probes + checklist
python3 scripts/security_checklist.py --url https://your-app.com

# With npm audit
python3 scripts/security_checklist.py --url https://your-app.com --npm-audit

# JSON output for CI
python3 scripts/security_checklist.py --url https://your-app.com --output json
```

### Critical items by priority

**P0 — block launch:**
- Supabase RLS enabled on ALL tables (A01)
- `service_role` key never exposed to client (A02)
- Secrets out of version control (A02)
- Webhook signatures validated (Polar, Stripe) (A08)
- No `npm audit` critical/high vulnerabilities (A05)

**P1 — fix before launch:**
- Security headers present (CSP, HSTS, X-Frame-Options) (A02)
- Auth endpoints rate-limited (A04)
- JWT tokens not in localStorage (A07)
- OAuth flows use PKCE (A04)
- Sentry capturing errors in production (A09)

**P2 — first week post-launch:**
- CORS restricts to known origins (A02)
- Admin routes role-protected (A01)
- Error messages don't leak stack traces (A02)
- MFA available for user accounts (A07)

Full categorized checklist: see `references/owasp-top-10-2025-checklist.md`.

### Supabase RLS Verification (the two-script pattern)

`security_checklist.py` flags RLS as a manual item. The skill provides **two automated scripts** that together cover what manual review used to require:

**Step 1 — Verify RLS is configured** (`rls_verifier.py`):

```bash
export DATABASE_URL='postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres'
python3 scripts/rls_verifier.py
```

Three checks per run:
- **Tables:** `rowsecurity` flag + policy count → PASS / WARN (no policies) / FAIL (RLS off)
- **Views:** `security_invoker` setting (PG 15+) → PASS / FAIL. Views without `security_invoker=true` run as the owner and bypass RLS — a Supabase-specific footgun.
- **SECURITY DEFINER functions:** flagged for manual review (the script can't tell if the function is safe — you have to read the body for an `auth.uid()` check).

Exit code 1 on any FAIL. Use `--json` for CI.

**Step 2 — Verify the policies actually work** (`rls_adversarial_test.sh`):

`rls_verifier.py` proves a policy *exists*. It can't prove the policy is *correct* — a policy of `using (true)` passes the verifier but lets everyone read everything. The adversarial test is the proof:

```bash
export SUPABASE_URL='https://xxx.supabase.co'
export SUPABASE_ANON_KEY='eyJhbG...'
export USER_A_JWT='eyJhbG...'   # access_token from a logged-in test user
export USER_B_ID='uuid-of-different-user'
bash scripts/rls_adversarial_test.sh calls user_id
```

Three attacks:
1. Anon key, no JWT — should return `[]` or 401
2. User A reads own rows — should return User A's rows (sanity check)
3. **User A reads User B's rows — must return `[]`. If it returns data, your policy is broken.**

Run this for each sensitive table (calls, transcripts, contacts, notes, etc.).

The Supabase service role bypasses RLS entirely — never use it client-side.

---

### Email Deliverability (the silent killer)

If signup/password-reset emails don't arrive, your launch is dead in 48 hours and you'll find out from angry users — not your monitoring. SPF, DKIM, and DMARC are now mandatory for bulk senders (Gmail/Yahoo enforced this in 2024).

```bash
bash scripts/email_deliverability_check.sh your-domain.com --selector resend
```

The script checks: SPF TXT record, DKIM at `<selector>._domainkey.<domain>`, DMARC at `_dmarc.<domain>`, MX records. If any are missing, exit code 1.

**After the script passes, do these three manual checks before launch:**
1. Send a test signup email to `your-name+test@gmail.com` — must land in **Inbox**, not Spam
2. Run `https://www.mail-tester.com` — paste the tester address, send a real transactional template, score 9/10 or higher
3. Tighten DMARC after 1 week: `p=none` → `p=quarantine`

Common selectors: `resend`, `s1`/`s2` (SendGrid), `google` (Workspace), `amazonses` (SES), `mailo` (Mailgun).

### Vercel Headers Template

`assets/vercel.json.template` ships with a production-grade headers block: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Drop it in your repo root as `vercel.json`, then customize the `Content-Security-Policy` `connect-src` to match the third parties your app actually calls (Stripe, Supabase, Sentry, OpenRouter, etc.). Comments inside the template list common additions.

Verify the headers landed correctly after deploy:

```bash
python3 scripts/security_checklist.py --url https://your-app.com
# Should show [PASS] for all 5 security headers in the output
```

---

## Domain 5: Performance (Lighthouse / Core Web Vitals)

**Script:** `scripts/lighthouse_audit.sh`

Runs Lighthouse against a target URL with hard launch-gate thresholds. Fails (exit 1) if any threshold is missed.

```bash
bash scripts/lighthouse_audit.sh https://your-app.com
```

**Thresholds:**

| Metric          | Threshold |
|-----------------|-----------|
| Performance     | ≥ 85      |
| Accessibility   | ≥ 95      |
| Best Practices  | ≥ 90      |
| SEO             | ≥ 90      |
| LCP             | < 2.5s    |
| CLS             | < 0.1     |
| TBT             | < 300ms   |

Outputs human-readable summary plus JSON report at `./lighthouse-report.json` for CI consumption.

**Common Lighthouse failures and fixes:**
- **LCP > 2.5s** → preload hero images, lazy-load below-fold, check Vercel Edge Network is hitting
- **CLS > 0.1** → set explicit width/height on images, reserve space for ads/embeds
- **TBT > 300ms** → code-split with `React.lazy`, defer third-party scripts
- **Accessibility < 95** → run axe DevTools locally, most issues are missing ARIA labels or color contrast

---

## Domain 6: Monitoring (Sentry)

Sentry must be initialized in production with replay enabled, alerts routed to the team, and source maps uploaded.

### Initialize Sentry

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,    // GDPR: mask PII in replays
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,             // 10% of transactions
  replaysSessionSampleRate: 0.05,    // 5% of sessions
  replaysOnErrorSampleRate: 1.0,     // 100% of errored sessions
});
```

### Upload source maps via GitHub Actions

Add to deploy step in `.github/workflows/ci.yml`:

```yaml
- name: Create Sentry release
  uses: getsentry/action-release@v3
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: your-project
  with:
    environment: production
    version: ${{ github.sha }}
```

### Required alerts

In Sentry → Alerts → Create Alert Rule:

- **P0 error spike:** new issue or error spike > 10/min → PagerDuty or SMS
- **Auth errors:** `auth.*` transactions with 4xx → Slack #alerts
- **Payment errors:** `billing.*` or `polar.*` errors → Slack #alerts
- **Daily digest:** all new issues → email to engineering team

---

## Post-Deploy Smoke Test

**Script:** `scripts/smoke_test.sh`

60-second canary check after every production deploy. Hits the homepage, the auth health endpoint, and one authenticated API call. Expects HTTP 200 on all.

```bash
BASE_URL=https://your-app.com \
TEST_JWT=eyJhbGciOiJI... \
bash scripts/smoke_test.sh
```

Wire this into the deploy workflow as a post-deploy step. If it fails, trigger an automatic rollback.

---

## Launch Day Checklist

48-hour, 24-hour, launch-day, and week-1 checklists live in `references/launch-day-runbook.md`. Pull this open during a launch and tick items off in order.

## Stack-Specific Gotchas

Supabase, Vercel, and React+Vite each have idiosyncrasies that bite during launch (PostgREST auth headers, instant rollback location, the `VITE_` env var prefix gotcha, etc.). See `references/stack-specific-notes.md`.

---

## How This Skill Operates

When the user invokes any of the trigger phrases above, **lead with diagnosis, not action**. Ask:

1. Where is the user in the launch arc? (greenfield setup → pre-launch audit → live triage)
2. Which of the six domains do they want to address? (or all six)
3. What's their stack? (Supabase + Vercel + Vite is the assumed default — adjust commands for other stacks)

Then run the relevant script(s), interpret the output for them in plain language, and identify which gates are passing vs. blocking. **Do the work — don't dump the script and ask them to run it themselves.** The user is a non-dev vibe coder; translate the numbers into "this is fine" or "this will block launch and here's the fix."

For OWASP audits and RLS checks, read the JSON output and surface the most concerning items first. Don't just print a 200-line checklist and call it done.
