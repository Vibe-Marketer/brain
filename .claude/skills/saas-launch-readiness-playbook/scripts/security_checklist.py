#!/usr/bin/env python3
"""
security_checklist.py

OWASP Top 10:2025 security audit helper for SaaS launch readiness.
Runs automated checks where possible and prints a structured checklist
for manual review where automation isn't feasible.

Usage:
    python3 security_checklist.py --url https://your-app.com
    python3 security_checklist.py --url https://your-app.com --output json
    python3 security_checklist.py --url https://your-app.com --skip-network
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
import ssl

# OWASP Top 10:2025 Checklist

OWASP_CHECKLIST = [
    {
        "id": "A01",
        "name": "Broken Access Control",
        "auto_checks": ["unauthenticated_api", "path_traversal_probe"],
        "manual": [
            "Verify RLS (Row Level Security) is enabled on all Supabase tables",
            "Confirm users cannot access other users' data via IDOR (change IDs in URLs)",
            "Check admin routes are protected by role checks, not just auth",
            "Verify API endpoints enforce ownership checks (user owns the resource)",
            "Test that JWT tokens from one user cannot access another user's resources",
        ],
    },
    {
        "id": "A02",
        "name": "Security Misconfiguration",
        "auto_checks": ["security_headers", "cors_policy"],
        "manual": [
            "Confirm all .env secrets are excluded from version control (.gitignore)",
            "Verify Supabase anon key is publishable-only (RLS enforces all restrictions)",
            "Check that service_role key is NEVER exposed to the client",
            "Review Vercel environment variables — no secrets in VITE_ prefixed vars",
            "Confirm error messages don't leak stack traces or DB schema in production",
            "Disable Supabase Studio public access for production project",
        ],
    },
    {
        "id": "A03",
        "name": "Injection",
        "auto_checks": [],
        "manual": [
            "Verify all Supabase queries use parameterized PostgREST filters (not string concat)",
            "Check any raw SQL (rpc calls) uses $1/$2 params, not string interpolation",
            "Validate user-supplied search terms are sanitized before API calls",
            "Review any server-side rendering or edge functions for template injection",
            "Confirm file upload paths (if any) are sanitized and restricted",
        ],
    },
    {
        "id": "A04",
        "name": "Insecure Design",
        "auto_checks": [],
        "manual": [
            "Verify rate limiting is applied to auth endpoints (Supabase project settings)",
            "Confirm password reset flow uses short-lived tokens (Supabase default: 1hr)",
            "Check that new user signup doesn't expose enumerable user data",
            "Verify OAuth flows (Google, Zoom) use PKCE, not implicit flow",
            "Ensure trial/subscription gating cannot be bypassed client-side",
        ],
    },
    {
        "id": "A05",
        "name": "Security Misconfiguration (Supply Chain)",
        "auto_checks": ["npm_audit"],
        "manual": [
            "Run `npm audit --audit-level=high` and resolve all high/critical issues",
            "Pin critical dependency versions in package.json (no bare `^` for auth libs)",
            "Review recently added dependencies for suspicious activity",
            "Enable GitHub Dependabot alerts on the repository",
            "Check that GitHub Actions use pinned SHA refs, not floating tags",
        ],
    },
    {
        "id": "A06",
        "name": "Vulnerable and Outdated Components",
        "auto_checks": [],
        "manual": [
            "Verify Node.js version is LTS and not EOL",
            "Check that Supabase client library is up to date",
            "Review Vite, React, and TypeScript versions against latest stable",
            "Confirm Playwright and test tooling are up to date",
        ],
    },
    {
        "id": "A07",
        "name": "Identification and Authentication Failures",
        "auto_checks": ["auth_headers"],
        "manual": [
            "Verify Supabase JWT expiry is set appropriately (recommend: 1hr access, 7d refresh)",
            "Confirm multi-factor authentication is available (or planned) for user accounts",
            "Check that logout invalidates the refresh token server-side",
            "Verify failed login attempts are rate-limited (Supabase default protects this)",
            "Confirm OAuth state parameter is validated to prevent CSRF",
            "Test that session tokens are stored in httpOnly cookies OR memory (not localStorage)",
        ],
    },
    {
        "id": "A08",
        "name": "Software and Data Integrity Failures",
        "auto_checks": [],
        "manual": [
            "Verify Subresource Integrity (SRI) hashes for any CDN-loaded scripts",
            "Confirm Vercel deployment uses signed deployments (default: enabled)",
            "Check GitHub branch protection: require PR reviews before merge to main",
            "Verify CI/CD pipeline cannot be bypassed to deploy untested code",
            "Confirm webhooks (Polar, Stripe) validate signatures before processing",
        ],
    },
    {
        "id": "A09",
        "name": "Security Logging and Monitoring Failures",
        "auto_checks": [],
        "manual": [
            "Verify Sentry is initialized and capturing errors in production",
            "Confirm auth events (login, logout, password reset) are logged in Supabase",
            "Check that Sentry alerts are routed to the team (email/Slack notification)",
            "Verify Supabase audit logs are retained for at least 30 days",
            "Confirm there is a process to review security alerts (not just collect them)",
        ],
    },
    {
        "id": "A10",
        "name": "Server-Side Request Forgery (SSRF)",
        "auto_checks": [],
        "manual": [
            "Review any edge functions or server actions that fetch external URLs",
            "Verify user-supplied URLs (if any) are validated against an allowlist",
            "Check that AI API calls (OpenAI, Anthropic) don't proxy user-controlled URLs",
            "Confirm webhook targets are validated and cannot be pointed at internal services",
        ],
    },
]


# Automated network checks

def check_security_headers(url: str) -> dict:
    """Check for critical security headers."""
    results = {}
    required_headers = {
        "x-content-type-options": "nosniff",
        "x-frame-options": None,  # Any value is good
        "strict-transport-security": None,
        "content-security-policy": None,
        "referrer-policy": None,
    }

    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "SecurityAudit/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            for header, expected_value in required_headers.items():
                present = header in headers
                if expected_value:
                    ok = present and expected_value.lower() in headers.get(header, "").lower()
                else:
                    ok = present
                results[header] = {
                    "present": present,
                    "value": headers.get(header, "MISSING"),
                    "pass": ok,
                }
    except Exception as e:
        results["error"] = str(e)

    return results


def check_cors_policy(url: str) -> dict:
    """Check CORS policy on API endpoints."""
    results = {}
    api_url = url.rstrip("/") + "/rest/v1/"

    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            api_url,
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "GET",
                "User-Agent": "SecurityAudit/1.0",
            },
            method="OPTIONS",
        )
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            acao = resp.headers.get("Access-Control-Allow-Origin", "")
            results["allows_wildcard"] = acao == "*"
            results["allows_evil_origin"] = "evil.example.com" in acao
            results["acao_value"] = acao
            results["pass"] = not (results["allows_wildcard"] or results["allows_evil_origin"])
    except urllib.error.HTTPError as e:
        results["status"] = e.code
        acao = e.headers.get("Access-Control-Allow-Origin", "")
        results["acao_value"] = acao
        results["allows_wildcard"] = acao == "*"
        results["pass"] = not (acao == "*")
    except Exception as e:
        results["error"] = str(e)

    return results


def check_unauthenticated_api(url: str) -> dict:
    """Probe API endpoints without auth to verify they require authentication."""
    results = {}
    endpoints = [
        "/rest/v1/calls",
        "/rest/v1/profiles",
        "/rest/v1/rpc/get_analytics_summary",
    ]

    for endpoint in endpoints:
        full_url = url.rstrip("/") + endpoint
        try:
            ctx = ssl.create_default_context()
            req = urllib.request.Request(
                full_url,
                headers={"User-Agent": "SecurityAudit/1.0"},
            )
            with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                # If we get 200 without auth, that's a failure
                results[endpoint] = {
                    "status": resp.status,
                    "pass": resp.status in (401, 403),
                    "note": "Returns 200 without auth token — verify RLS is enforced" if resp.status == 200 else "OK",
                }
        except urllib.error.HTTPError as e:
            results[endpoint] = {
                "status": e.code,
                "pass": e.code in (401, 403),
                "note": "OK — requires authentication" if e.code in (401, 403) else f"Unexpected status {e.code}",
            }
        except Exception as e:
            results[endpoint] = {"error": str(e)}

    return results


def run_npm_audit() -> dict:
    """Run npm audit and return summary."""
    import subprocess
    try:
        result = subprocess.run(
            ["npm", "audit", "--json"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        data = json.loads(result.stdout)
        vulns = data.get("metadata", {}).get("vulnerabilities", {})
        return {
            "total": sum(vulns.values()),
            "critical": vulns.get("critical", 0),
            "high": vulns.get("high", 0),
            "moderate": vulns.get("moderate", 0),
            "low": vulns.get("low", 0),
            "pass": vulns.get("critical", 0) == 0 and vulns.get("high", 0) == 0,
        }
    except FileNotFoundError:
        return {"error": "npm not found — run from project root", "pass": None}
    except Exception as e:
        return {"error": str(e), "pass": None}


def run_supabase_lint() -> dict:
    """Run `supabase db lint --linked` and return findings.

    Catches things rls_verifier.py doesn't: dropped-column policies, public-grant
    leaks, schema-level issues. Native Supabase tool — uses the linked project.
    """
    import subprocess
    try:
        result = subprocess.run(
            ["supabase", "db", "lint", "--linked"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = (result.stdout or "") + (result.stderr or "")
        # supabase db lint exits 0 with no findings, or non-zero with findings printed
        # Heuristic: count lines that start with "WARN" or "ERROR"
        warn_count = sum(1 for line in output.splitlines() if line.lstrip().startswith("WARN"))
        error_count = sum(1 for line in output.splitlines() if line.lstrip().startswith("ERROR"))
        return {
            "exit_code": result.returncode,
            "warn_count": warn_count,
            "error_count": error_count,
            "output": output[:2000],  # cap to keep report manageable
            "pass": error_count == 0,
        }
    except FileNotFoundError:
        return {
            "error": "supabase CLI not found. Install: brew install supabase/tap/supabase",
            "pass": None,
        }
    except Exception as e:
        return {"error": str(e), "pass": None}


# Report generation

def print_report(checklist: list, auto_results: dict, output_format: str = "text"):
    """Print the security audit report."""

    if output_format == "json":
        report = {
            "owasp_checklist": checklist,
            "automated_results": auto_results,
        }
        print(json.dumps(report, indent=2))
        return

    total_items = sum(len(item["manual"]) for item in checklist)
    print("\n" + "=" * 70)
    print("  OWASP TOP 10:2025 — SAAS LAUNCH SECURITY CHECKLIST")
    print("=" * 70)

    if auto_results:
        print("\nAUTOMATED CHECKS")
        print("-" * 70)

        if "security_headers" in auto_results:
            print("\nSecurity Headers:")
            for header, result in auto_results["security_headers"].items():
                if header == "error":
                    print(f"   [!] Could not check: {result}")
                    continue
                icon = "[PASS]" if result.get("pass") else "[FAIL]"
                print(f"   {icon} {header}: {result.get('value', 'N/A')}")

        if "cors_policy" in auto_results:
            print("\nCORS Policy:")
            cors = auto_results["cors_policy"]
            if "error" in cors:
                print(f"   [!] Could not check: {cors['error']}")
            else:
                icon = "[PASS]" if cors.get("pass") else "[FAIL]"
                print(f"   {icon} Access-Control-Allow-Origin: {cors.get('acao_value', 'N/A')}")

        if "unauthenticated_api" in auto_results:
            print("\nUnauthenticated API Access:")
            for endpoint, result in auto_results["unauthenticated_api"].items():
                if "error" in result:
                    print(f"   [!] {endpoint}: {result['error']}")
                    continue
                icon = "[PASS]" if result.get("pass") else "[FAIL]"
                print(f"   {icon} {endpoint} -> HTTP {result.get('status')} — {result.get('note', '')}")

        if "npm_audit" in auto_results:
            print("\nnpm Dependency Audit:")
            audit = auto_results["npm_audit"]
            if "error" in audit:
                print(f"   [!] {audit['error']}")
            else:
                icon = "[PASS]" if audit.get("pass") else "[FAIL]"
                print(f"   {icon} Critical: {audit.get('critical', 0)}  High: {audit.get('high', 0)}  "
                      f"Moderate: {audit.get('moderate', 0)}  Low: {audit.get('low', 0)}")

        if "supabase_lint" in auto_results:
            print("\nSupabase DB Lint (supabase db lint --linked):")
            lint = auto_results["supabase_lint"]
            if "error" in lint:
                print(f"   [!] {lint['error']}")
            else:
                icon = "[PASS]" if lint.get("pass") else "[FAIL]"
                print(f"   {icon} Errors: {lint.get('error_count', 0)}  Warnings: {lint.get('warn_count', 0)}")
                if lint.get("error_count", 0) > 0 or lint.get("warn_count", 0) > 0:
                    print(f"   --- Output (first 2KB) ---")
                    for line in lint.get("output", "").splitlines()[:30]:
                        print(f"   {line}")

    print("\n\nMANUAL REVIEW CHECKLIST")
    print(f"   Complete all {total_items} items before launch\n")
    print("-" * 70)

    for item in checklist:
        print(f"\n[{item['id']}] {item['name']}")
        for i, check in enumerate(item["manual"], 1):
            print(f"   [ ] {check}")

    print("\n" + "=" * 70)
    print("  LAUNCH GATE: All manual items must be checked before production deploy")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="OWASP Top 10:2025 security audit checklist for SaaS launch"
    )
    parser.add_argument("--url", default="",
                        help="Application URL to probe (e.g. https://your-app.com)")
    parser.add_argument("--output", choices=["text", "json"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--skip-network", action="store_true",
                        help="Skip network-based automated checks")
    parser.add_argument("--npm-audit", action="store_true",
                        help="Run npm audit (requires npm in PATH)")
    parser.add_argument("--supabase-lint", action="store_true",
                        help="Run `supabase db lint --linked` (requires supabase CLI + linked project)")

    args = parser.parse_args()

    auto_results = {}

    if args.url and not args.skip_network:
        print(f"Running automated checks against: {args.url}")
        auto_results["security_headers"] = check_security_headers(args.url)
        auto_results["cors_policy"] = check_cors_policy(args.url)
        auto_results["unauthenticated_api"] = check_unauthenticated_api(args.url)

    if args.npm_audit:
        print("Running npm audit...")
        auto_results["npm_audit"] = run_npm_audit()

    if args.supabase_lint:
        print("Running supabase db lint --linked...")
        auto_results["supabase_lint"] = run_supabase_lint()

    print_report(OWASP_CHECKLIST, auto_results, output_format=args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
