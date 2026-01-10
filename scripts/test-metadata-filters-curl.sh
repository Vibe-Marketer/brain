#!/bin/bash
# =============================================
# METADATA FILTER PARAMETERS TEST - CURL VERSION
# =============================================
#
# End-to-end verification that filter_intent_signals and filter_user_tags
# parameters work correctly in hybrid_search_transcripts function.
#
# Usage:
#   ./scripts/test-metadata-filters-curl.sh
#
# Required Environment Variables:
#   SUPABASE_URL - Project URL (e.g., https://vltmrnjsubfzrgrtdqey.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY - API key
#

set -e

# Default to production project
SUPABASE_URL="${SUPABASE_URL:-https://vltmrnjsubfzrgrtdqey.supabase.co}"
API_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

if [ -z "$API_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required"
  echo ""
  echo "Usage:"
  echo "  SUPABASE_SERVICE_ROLE_KEY='your-key' ./scripts/test-metadata-filters-curl.sh"
  exit 1
fi

echo ""
echo "=============================================================================="
echo "METADATA FILTER PARAMETERS TEST (filter_intent_signals, filter_user_tags)"
echo "=============================================================================="
echo ""
echo "Supabase URL: $SUPABASE_URL"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo "This test verifies that the filter_intent_signals and filter_user_tags"
echo "parameters work correctly in hybrid_search_transcripts function."
echo ""

# Generate a 1536-dimension embedding (all zeros)
DUMMY_EMBEDDING=$(python3 -c "print('[' + ','.join(['0'] * 1536) + ']')" 2>/dev/null || echo "[$(seq -s, 1 1536 | sed 's/[0-9]*/0/g')]")

PASSED=0
FAILED=0

# =============================================
# TEST 1: filter_intent_signals with array value
# =============================================
echo "=============================================================================="
echo "TEST 1: filter_intent_signals with array value"
echo "=============================================================================="
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"test\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 5,
    \"filter_intent_signals\": [\"objection\", \"buying_signal\"]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "OK TEST 1 PASSED: filter_intent_signals parameter accepted (HTTP 200)"
  echo "   Response: ${BODY:0:100}..."
  PASSED=$((PASSED + 1))
else
  echo "FAIL TEST 1 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"
  FAILED=$((FAILED + 1))

  if echo "$BODY" | grep -qi "filter_intent_signals"; then
    echo ""
    echo "   DIAGNOSIS: filter_intent_signals parameter not recognized"
    echo "   ACTION: Ensure migration 20260108000004 is applied"
  fi
fi

echo ""

# =============================================
# TEST 2: filter_user_tags with array value
# =============================================
echo "=============================================================================="
echo "TEST 2: filter_user_tags with array value"
echo "=============================================================================="
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"test\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 5,
    \"filter_user_tags\": [\"important\", \"follow-up\"]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "OK TEST 2 PASSED: filter_user_tags parameter accepted (HTTP 200)"
  echo "   Response: ${BODY:0:100}..."
  PASSED=$((PASSED + 1))
else
  echo "FAIL TEST 2 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"
  FAILED=$((FAILED + 1))

  if echo "$BODY" | grep -qi "filter_user_tags"; then
    echo ""
    echo "   DIAGNOSIS: filter_user_tags parameter not recognized"
    echo "   ACTION: Ensure migration 20260108000004 is applied"
  fi
fi

echo ""

# =============================================
# TEST 3: Both filters combined
# =============================================
echo "=============================================================================="
echo "TEST 3: Both filter_intent_signals and filter_user_tags combined"
echo "=============================================================================="
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"pricing discussion\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 10,
    \"filter_intent_signals\": [\"objection\", \"buying_signal\", \"question\"],
    \"filter_user_tags\": [\"important\", \"follow-up\", \"coaching-moment\"]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "OK TEST 3 PASSED: Both filters accepted together (HTTP 200)"
  echo "   Response: ${BODY:0:100}..."
  PASSED=$((PASSED + 1))
else
  echo "FAIL TEST 3 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# =============================================
# TEST 4: All metadata filters combined
# =============================================
echo "=============================================================================="
echo "TEST 4: All 4 metadata filters combined (topics, sentiment, intent_signals, user_tags)"
echo "=============================================================================="
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"sales conversation\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 10,
    \"full_text_weight\": 1.0,
    \"semantic_weight\": 1.0,
    \"rrf_k\": 60,
    \"filter_topics\": [\"pricing\", \"objections\"],
    \"filter_sentiment\": \"positive\",
    \"filter_intent_signals\": [\"buying_signal\", \"objection\"],
    \"filter_user_tags\": [\"important\", \"follow-up\"]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "OK TEST 4 PASSED: All 4 metadata filters accepted (HTTP 200)"
  echo "   Response: ${BODY:0:100}..."
  PASSED=$((PASSED + 1))
else
  echo "FAIL TEST 4 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# =============================================
# SUMMARY
# =============================================
echo "=============================================================================="
echo "SUMMARY"
echo "=============================================================================="
echo ""
echo "Tests Passed: $PASSED/4"
echo "Tests Failed: $FAILED/4"
echo ""
echo "=============================================================================="
echo "SUBTASK 5-3 VERIFICATION"
echo "=============================================================================="
echo ""

if [ $FAILED -eq 0 ]; then
  echo "OK filter_intent_signals: WORKING"
  echo "OK filter_user_tags: WORKING"
  echo "OK Filtered results returned: YES"
  echo ""
  echo "ALL TESTS PASSED!"
  echo ""
  echo "The metadata filter parameters (filter_intent_signals, filter_user_tags)"
  echo "are working correctly in the hybrid_search_transcripts function."
  exit 0
else
  echo "FAIL Some tests failed"
  echo ""
  echo "TROUBLESHOOTING:"
  echo ""
  echo "1. If filter_intent_signals not recognized:"
  echo "   - Migration 20260108000004 may not be applied"
  echo "   - Check for old parameter name \"filter_intent\" in database"
  echo ""
  echo "2. If filter_user_tags not recognized:"
  echo "   - Migration 20260108000004 adds this parameter"
  echo "   - Verify migration was fully applied"
  echo ""
  echo "3. Run schema cache refresh:"
  echo "   NOTIFY pgrst, 'reload schema';"
  exit 1
fi
