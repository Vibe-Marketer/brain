# OWASP Top 10:2025 — Launch Checklist

This is the full categorized checklist that `security_checklist.py` prints. Use it as a printable reference during pre-launch reviews.

Items are grouped by OWASP category (A01–A10). Each category lists which checks are automated by `security_checklist.py` plus the manual items that require human judgment.

---

## A01: Broken Access Control

**Auto-checks:** unauthenticated_api, path_traversal_probe

**Manual:**
- Verify RLS (Row Level Security) is enabled on all Supabase tables
- Confirm users cannot access other users' data via IDOR (change IDs in URLs)
- Check admin routes are protected by role checks, not just auth
- Verify API endpoints enforce ownership checks (user owns the resource)
- Test that JWT tokens from one user cannot access another user's resources

> **Tip:** Automate the RLS check with `rls_verifier.py` instead of doing it by hand.

---

## A02: Security Misconfiguration

**Auto-checks:** security_headers, cors_policy

**Manual:**
- Confirm all `.env` secrets are excluded from version control (`.gitignore`)
- Verify Supabase anon key is publishable-only (RLS enforces all restrictions)
- Check that `service_role` key is NEVER exposed to the client
- Review Vercel environment variables — no secrets in `VITE_` prefixed vars
- Confirm error messages don't leak stack traces or DB schema in production
- Disable Supabase Studio public access for production project

---

## A03: Injection

**Auto-checks:** *(none — static analysis required)*

**Manual:**
- Verify all Supabase queries use parameterized PostgREST filters (not string concat)
- Check any raw SQL (rpc calls) uses `$1`/`$2` params, not string interpolation
- Validate user-supplied search terms are sanitized before API calls
- Review any server-side rendering or edge functions for template injection
- Confirm file upload paths (if any) are sanitized and restricted

---

## A04: Insecure Design

**Auto-checks:** *(none — design review required)*

**Manual:**
- Verify rate limiting is applied to auth endpoints (Supabase project settings)
- Confirm password reset flow uses short-lived tokens (Supabase default: 1hr)
- Check that new user signup doesn't expose enumerable user data
- Verify OAuth flows (Google, Zoom) use PKCE, not implicit flow
- Ensure trial/subscription gating cannot be bypassed client-side

---

## A05: Security Misconfiguration (Supply Chain)

**Auto-checks:** npm_audit (run with `--npm-audit`)

**Manual:**
- Run `npm audit --audit-level=high` and resolve all high/critical issues
- Pin critical dependency versions in `package.json` (no bare `^` for auth libs)
- Review recently added dependencies for suspicious activity
- Enable GitHub Dependabot alerts on the repository
- Check that GitHub Actions use pinned SHA refs, not floating tags

---

## A06: Vulnerable and Outdated Components

**Auto-checks:** *(none — version review)*

**Manual:**
- Verify Node.js version is LTS and not EOL
- Check that Supabase client library is up to date
- Review Vite, React, and TypeScript versions against latest stable
- Confirm Playwright and test tooling are up to date

---

## A07: Identification and Authentication Failures

**Auto-checks:** auth_headers

**Manual:**
- Verify Supabase JWT expiry is set appropriately (recommend: 1hr access, 7d refresh)
- Confirm multi-factor authentication is available (or planned) for user accounts
- Check that logout invalidates the refresh token server-side
- Verify failed login attempts are rate-limited (Supabase default protects this)
- Confirm OAuth state parameter is validated to prevent CSRF
- Test that session tokens are stored in httpOnly cookies OR memory (not localStorage)

---

## A08: Software and Data Integrity Failures

**Auto-checks:** *(none — pipeline review)*

**Manual:**
- Verify Subresource Integrity (SRI) hashes for any CDN-loaded scripts
- Confirm Vercel deployment uses signed deployments (default: enabled)
- Check GitHub branch protection: require PR reviews before merge to main
- Verify CI/CD pipeline cannot be bypassed to deploy untested code
- Confirm webhooks (Polar, Stripe) validate signatures before processing

---

## A09: Security Logging and Monitoring Failures

**Auto-checks:** *(none — runtime config review)*

**Manual:**
- Verify Sentry is initialized and capturing errors in production
- Confirm auth events (login, logout, password reset) are logged in Supabase
- Check that Sentry alerts are routed to the team (email/Slack notification)
- Verify Supabase audit logs are retained for at least 30 days
- Confirm there is a process to review security alerts (not just collect them)

---

## A10: Server-Side Request Forgery (SSRF)

**Auto-checks:** *(none — code review)*

**Manual:**
- Review any edge functions or server actions that fetch external URLs
- Verify user-supplied URLs (if any) are validated against an allowlist
- Check that AI API calls (OpenAI, Anthropic) don't proxy user-controlled URLs
- Confirm webhook targets are validated and cannot be pointed at internal services

---

## Verification SQL Snippets

**Verify RLS is enabled on every public table:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All rows should show: rowsecurity = true
```

**List all RLS policies:**

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

**Find tables with RLS but no policies (locks everyone out):**

```sql
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;
```

`rls_verifier.py` automates all three queries.
