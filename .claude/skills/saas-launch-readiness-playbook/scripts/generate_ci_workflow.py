#!/usr/bin/env python3
"""
generate_ci_workflow.py

Generates a complete GitHub Actions CI workflow YAML for a SaaS product.
Covers: lint, typecheck, unit tests (Vitest), E2E tests (Playwright), and deploy gate.

Usage:
    python3 generate_ci_workflow.py --app-url https://staging.example.com --node-version 20
    python3 generate_ci_workflow.py --help
"""

import argparse
import sys

def generate_workflow(app_url: str, node_version: str = "20", has_e2e: bool = True,
                      has_unit_tests: bool = True, deploy_env: str = "staging") -> str:
    """Generate a GitHub Actions CI/CD workflow YAML string."""

    e2e_job = ""
    if has_e2e:
        e2e_job = f"""
  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 60
    needs: [lint-typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{node_version}'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: npx playwright test
        env:
          VITE_SUPABASE_URL: ${{{{ secrets.VITE_SUPABASE_URL }}}}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{{{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}}}
          CALLVAULTAI_LOGIN: ${{{{ secrets.E2E_TEST_USER }}}}
          CALLVAULTAI_LOGIN_PASSWORD: ${{{{ secrets.E2E_TEST_PASSWORD }}}}
          BASE_URL: {app_url}
      - name: Upload Playwright report
        if: ${{{{ !cancelled() }}}}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
"""

    unit_job = ""
    if has_unit_tests:
        unit_job = f"""
  unit-tests:
    name: Unit Tests (Vitest)
    runs-on: ubuntu-latest
    needs: [lint-typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{node_version}'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests with coverage
        run: npm run test:coverage
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14
"""

    workflow = f"""name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

concurrency:
  group: ${{{{ github.workflow }}}}-${{{{ github.ref }}}}
  cancel-in-progress: true

jobs:
  lint-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{node_version}'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run ESLint
        run: npm run lint
      - name: Run TypeScript type check
        run: npm run type-check
{unit_job}{e2e_job}
  # All checks must pass before this job runs
  all-checks:
    name: All Checks Passed
    runs-on: ubuntu-latest
    needs: [lint-typecheck{',' + 'unit-tests' if has_unit_tests else ''}{',' + 'e2e' if has_e2e else ''}]
    steps:
      - run: echo "All CI checks passed"
"""
    return workflow.strip()


def generate_security_workflow() -> str:
    """Generate a security scanning GitHub Actions workflow."""
    return """name: Security Scan

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  schedule:
    # Run daily at 2am UTC
    - cron: '0 2 * * *'

jobs:
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Audit npm dependencies
        run: npm audit --audit-level=high
        continue-on-error: false

  secret-scan:
    name: Secret Scanning (TruffleHog)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: TruffleHog OSS Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --debug --only-verified

  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript
      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
""".strip()


def main():
    parser = argparse.ArgumentParser(
        description="Generate GitHub Actions CI workflow for SaaS launch readiness"
    )
    parser.add_argument("--app-url", default="http://localhost:3000",
                        help="Application URL for E2E tests (default: http://localhost:3000)")
    parser.add_argument("--node-version", default="20",
                        help="Node.js version (default: 20)")
    parser.add_argument("--no-e2e", action="store_true",
                        help="Skip E2E test job")
    parser.add_argument("--no-unit", action="store_true",
                        help="Skip unit test job")
    parser.add_argument("--output", choices=["ci", "security", "both"], default="both",
                        help="Which workflow(s) to output (default: both)")

    args = parser.parse_args()

    if args.output in ("ci", "both"):
        ci_workflow = generate_workflow(
            app_url=args.app_url,
            node_version=args.node_version,
            has_e2e=not args.no_e2e,
            has_unit_tests=not args.no_unit,
        )
        print("=" * 60)
        print("# .github/workflows/ci.yml")
        print("=" * 60)
        print(ci_workflow)
        print()

    if args.output in ("security", "both"):
        sec_workflow = generate_security_workflow()
        print("=" * 60)
        print("# .github/workflows/security-scan.yml")
        print("=" * 60)
        print(sec_workflow)

    return 0


if __name__ == "__main__":
    sys.exit(main())
