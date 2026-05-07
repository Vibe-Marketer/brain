#!/usr/bin/env bash
#
# rls_adversarial_test.sh
#
# The OTHER half of RLS verification: rls_verifier.py confirms RLS is ENABLED
# with policies. This script confirms the policies ACTUALLY WORK by trying to
# read User B's data with User A's JWT.
#
# Tests three attacks against a Supabase REST endpoint:
#   1. Anon-key only (no JWT) — should return [] or 401
#   2. User A JWT reading own rows — should return rows (sanity check)
#   3. User A JWT reading User B's rows — should return [] (THE TEST)
#
# If attack #3 returns User B's rows, your RLS policy is broken — even if
# rls_verifier.py says PASS, because the policy exists but doesn't enforce
# ownership correctly.
#
# Exit code:
#   0 — all attacks blocked correctly
#   1 — RLS leak detected (attack succeeded)
#   2 — configuration error
#
# Usage:
#   export SUPABASE_URL='https://xxx.supabase.co'
#   export SUPABASE_ANON_KEY='eyJhbG...'
#   export USER_A_JWT='eyJhbG...'         # JWT from a logged-in test user
#   export USER_B_ID='uuid-of-different-user'
#   bash rls_adversarial_test.sh calls           # Test the 'calls' table
#   bash rls_adversarial_test.sh calls user_id   # Specify the ownership column (default: user_id)
#
# How to get the values:
#   SUPABASE_URL + SUPABASE_ANON_KEY: Supabase dashboard -> Project Settings -> API
#   USER_A_JWT: Sign in as User A, copy access_token from network tab or response
#   USER_B_ID: id of a different user (auth.users.id) — pick someone with rows in the table

set -uo pipefail

TABLE="${1:-}"
OWNER_COL="${2:-user_id}"

if [[ -z "$TABLE" ]]; then
  echo "Usage: bash rls_adversarial_test.sh <table_name> [owner_column]" >&2
  echo "Example: bash rls_adversarial_test.sh calls user_id" >&2
  exit 2
fi

# Validate inputs
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
USER_A_JWT="${USER_A_JWT:-}"
USER_B_ID="${USER_B_ID:-}"

missing=()
[[ -z "$SUPABASE_URL" ]]     && missing+=("SUPABASE_URL")
[[ -z "$SUPABASE_ANON_KEY" ]] && missing+=("SUPABASE_ANON_KEY")
[[ -z "$USER_A_JWT" ]]       && missing+=("USER_A_JWT")
[[ -z "$USER_B_ID" ]]        && missing+=("USER_B_ID")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing environment variables: ${missing[*]}" >&2
  echo "" >&2
  echo "Required:" >&2
  echo "  SUPABASE_URL       — https://xxx.supabase.co" >&2
  echo "  SUPABASE_ANON_KEY  — your anon/publishable key" >&2
  echo "  USER_A_JWT         — access_token from a logged-in test user" >&2
  echo "  USER_B_ID          — uuid of a different user (auth.users.id)" >&2
  exit 2
fi

# Strip trailing slash
SUPABASE_URL="${SUPABASE_URL%/}"

API="$SUPABASE_URL/rest/v1/$TABLE"

PASS=0
FAIL=0

echo "================================================================"
echo "  RLS Adversarial Test — $TABLE"
echo "================================================================"
echo "  Target: $API"
echo "  Ownership column: $OWNER_COL"
echo "================================================================"
echo ""

# Attack 1: anon key only
echo "[1/3] Anon key only (no JWT) — should return [] or 401"
RESP=$(curl -sS -w "\n__STATUS__%{http_code}" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$API?select=$OWNER_COL&limit=5" 2>/dev/null) || RESP=""

STATUS="${RESP##*__STATUS__}"
BODY="${RESP%__STATUS__*}"

if [[ "$STATUS" == "401" || "$BODY" == "[]" ]]; then
  echo "      [PASS] Status $STATUS, body: $(echo "$BODY" | head -c 80)"
  PASS=$((PASS+1))
else
  ROW_COUNT=$(echo "$BODY" | grep -c "$OWNER_COL" 2>/dev/null || echo "0")
  echo "      [FAIL] Status $STATUS — anon key returned data"
  echo "             Body sample: $(echo "$BODY" | head -c 200)"
  FAIL=$((FAIL+1))
fi
echo ""

# Attack 2: User A reading own rows (sanity check — should succeed)
echo "[2/3] User A JWT reading own rows — should return User A's rows (sanity)"
RESP=$(curl -sS -w "\n__STATUS__%{http_code}" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_A_JWT" \
  "$API?select=*&limit=5" 2>/dev/null) || RESP=""

STATUS="${RESP##*__STATUS__}"
BODY="${RESP%__STATUS__*}"

if [[ "$STATUS" == "200" ]]; then
  echo "      [PASS] Status 200 — User A authenticated and got response"
  PASS=$((PASS+1))
else
  echo "      [WARN] Status $STATUS — User A couldn't read own rows"
  echo "             This may mean the JWT is expired or RLS policy is wrong"
  echo "             Body: $(echo "$BODY" | head -c 200)"
fi
echo ""

# Attack 3: User A trying to read User B's rows (THE TEST)
echo "[3/3] User A JWT trying to read User B's rows — should return []"
RESP=$(curl -sS -w "\n__STATUS__%{http_code}" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_A_JWT" \
  "$API?select=*&$OWNER_COL=eq.$USER_B_ID&limit=5" 2>/dev/null) || RESP=""

STATUS="${RESP##*__STATUS__}"
BODY="${RESP%__STATUS__*}"

if [[ "$STATUS" == "200" && "$BODY" == "[]" ]]; then
  echo "      [PASS] Empty result — RLS correctly blocks cross-user read"
  PASS=$((PASS+1))
elif [[ "$STATUS" == "401" || "$STATUS" == "403" ]]; then
  echo "      [PASS] Status $STATUS — RLS blocks access entirely"
  PASS=$((PASS+1))
else
  echo "      [FAIL] CRITICAL — Status $STATUS, User A read User B's data"
  echo "             Body: $(echo "$BODY" | head -c 400)"
  echo ""
  echo "             This means your RLS policy on '$TABLE' is BROKEN."
  echo "             Common causes:"
  echo "               - Policy uses 'using (true)' instead of ownership check"
  echo "               - Missing 'auth.uid() = $OWNER_COL' in the policy"
  echo "               - Policy applies to wrong role"
  FAIL=$((FAIL+1))
fi
echo ""

echo "================================================================"
if [[ $FAIL -eq 0 ]]; then
  echo "  RESULT: All adversarial tests PASSED — RLS on '$TABLE' is enforcing"
  echo "================================================================"
  exit 0
else
  echo "  RESULT: $FAIL adversarial test(s) FAILED — RLS LEAK on '$TABLE'"
  echo "  ACTION: Block launch. Fix the RLS policy before shipping."
  echo "================================================================"
  exit 1
fi
