#!/usr/bin/env bash
#
# smoke_test.sh
#
# 60-second post-deploy health check. Designed as a CI canary that runs
# after every production deployment to catch immediate regressions.
#
# Checks:
#   1. Homepage returns 200
#   2. Auth health endpoint returns 200 (Supabase /auth/v1/health)
#   3. Authenticated API call returns 200 (uses TEST_JWT)
#   4. (Optional) Custom endpoint via EXTRA_ENDPOINT env var
#
# Exit code:
#   0 — all checks passed
#   1 — one or more checks failed
#   2 — configuration error
#
# Usage:
#   BASE_URL=https://your-app.com bash smoke_test.sh
#   BASE_URL=https://your-app.com TEST_JWT=eyJhb... bash smoke_test.sh
#   BASE_URL=... EXTRA_ENDPOINT=/api/health bash smoke_test.sh
#
# In a GitHub Actions deploy workflow:
#   - name: Post-deploy smoke test
#     run: BASE_URL=${{ secrets.PROD_URL }} TEST_JWT=${{ secrets.SMOKE_JWT }} bash smoke_test.sh
#
set -uo pipefail   # NB: not -e — we want to capture failures, not abort

BASE_URL="${BASE_URL:-}"
TEST_JWT="${TEST_JWT:-}"
EXTRA_ENDPOINT="${EXTRA_ENDPOINT:-}"
TIMEOUT="${TIMEOUT:-10}"   # per-request timeout in seconds

if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: BASE_URL environment variable not set." >&2
  echo "Usage: BASE_URL=https://your-app.com bash smoke_test.sh" >&2
  exit 2
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

PASS_COUNT=0
FAIL_COUNT=0
START_TIME=$(date +%s)

echo "================================================================"
echo "  Post-Deploy Smoke Test"
echo "================================================================"
echo "  Target: $BASE_URL"
echo "  Time:   $(date)"
echo "================================================================"

# Helper: hit a URL, expect a 2xx, print pass/fail line
check_endpoint() {
  local label="$1"
  local url="$2"
  local auth_header="${3:-}"

  local curl_args=(-s -o /dev/null -w "%{http_code}|%{time_total}" --max-time "$TIMEOUT")
  if [[ -n "$auth_header" ]]; then
    curl_args+=(-H "$auth_header")
  fi

  local response
  response=$(curl "${curl_args[@]}" "$url" 2>/dev/null) || response="000|0"

  local status="${response%%|*}"
  local elapsed="${response##*|}"

  # Pretty-format elapsed time to milliseconds
  local elapsed_ms
  elapsed_ms=$(awk "BEGIN { printf \"%.0f\", $elapsed * 1000 }")

  if [[ "$status" =~ ^2[0-9]{2}$ ]]; then
    printf "  [PASS]  %-32s HTTP %s (%sms)\n" "$label" "$status" "$elapsed_ms"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    printf "  [FAIL]  %-32s HTTP %s (%sms) — expected 2xx\n" "$label" "$status" "$elapsed_ms"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo ""
echo "Running checks..."
echo ""

# 1. Homepage
check_endpoint "Homepage" "$BASE_URL/"

# 2. Supabase auth health (most SaaS apps using Supabase have this)
check_endpoint "Auth health" "$BASE_URL/auth/v1/health"

# 3. Authenticated API call — only if a JWT is provided
if [[ -n "$TEST_JWT" ]]; then
  check_endpoint "Authed API (calls list)" \
    "$BASE_URL/rest/v1/calls?limit=1" \
    "Authorization: Bearer $TEST_JWT"
else
  echo "  [SKIP]  Authed API check                — set TEST_JWT to enable"
fi

# 4. Optional custom endpoint
if [[ -n "$EXTRA_ENDPOINT" ]]; then
  check_endpoint "Custom: $EXTRA_ENDPOINT" "$BASE_URL$EXTRA_ENDPOINT"
fi

END_TIME=$(date +%s)
TOTAL_ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "================================================================"
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "  RESULT: All $PASS_COUNT smoke checks passed in ${TOTAL_ELAPSED}s"
  echo "================================================================"
  exit 0
else
  echo "  RESULT: $FAIL_COUNT failed, $PASS_COUNT passed in ${TOTAL_ELAPSED}s"
  echo "  ACTION: Trigger rollback — production is degraded"
  echo "================================================================"
  exit 1
fi
