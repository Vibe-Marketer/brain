#!/bin/bash
# =============================================
# HYBRID SEARCH FUNCTION TEST - CURL VERSION
# =============================================
#
# Tests that hybrid_search_transcripts is accessible via Supabase REST API
#
# Usage:
#   ./scripts/test-hybrid-search-curl.sh
#
# Required Environment Variables:
#   SUPABASE_URL - Project URL (e.g., https://vltmrnjsubfzrgrtdqey.supabase.co)
#   SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY - API key
#

set -e

# Default to production project
SUPABASE_URL="${SUPABASE_URL:-https://vltmrnjsubfzrgrtdqey.supabase.co}"
API_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

if [ -z "$API_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required"
  echo ""
  echo "Usage:"
  echo "  SUPABASE_SERVICE_ROLE_KEY='your-key' ./scripts/test-hybrid-search-curl.sh"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║         HYBRID SEARCH FUNCTION TEST (CURL)                                   ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Supabase URL: $SUPABASE_URL"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 1: Basic Function Call (minimal parameters)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Generate a 1536-dimension embedding (all zeros)
DUMMY_EMBEDDING=$(python3 -c "print('[' + ','.join(['0'] * 1536) + ']')" 2>/dev/null || echo "[$(seq -s, 1 1536 | sed 's/[0-9]*/0/g')]")

# Test 1: Basic call with minimal parameters
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"test\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 5
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ TEST 1 PASSED: Function is callable (HTTP 200)"
  echo "   Response: ${BODY:0:200}..."
else
  echo "❌ TEST 1 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"

  # Check for specific error patterns
  if echo "$BODY" | grep -qi "function.*not found"; then
    echo ""
    echo "   DIAGNOSIS: Function not found in schema cache"
    echo "   ACTION REQUIRED:"
    echo "     1. Apply migration 20260108000004_enhance_chat_tools_metadata_filters.sql"
    echo "     2. Run: NOTIFY pgrst, 'reload schema';"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 2: All 16 Parameters"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/hybrid_search_transcripts" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"query_text\": \"test query\",
    \"query_embedding\": ${DUMMY_EMBEDDING},
    \"match_count\": 10,
    \"full_text_weight\": 1.0,
    \"semantic_weight\": 1.0,
    \"rrf_k\": 60,
    \"filter_user_id\": null,
    \"filter_date_start\": null,
    \"filter_date_end\": null,
    \"filter_speakers\": null,
    \"filter_categories\": null,
    \"filter_recording_ids\": null,
    \"filter_topics\": null,
    \"filter_sentiment\": null,
    \"filter_intent_signals\": null,
    \"filter_user_tags\": null
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ TEST 2 PASSED: All 16 parameters accepted (HTTP 200)"
else
  echo "❌ TEST 2 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"

  if echo "$BODY" | grep -qi "filter_intent_signals\|filter_user_tags"; then
    echo ""
    echo "   DIAGNOSIS: New metadata filter parameters not recognized"
    echo "   ACTION: Reapply migration with all 16 parameters"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 3: get_available_metadata Function"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/rest/v1/rpc/get_available_metadata" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"p_user_id\": \"00000000-0000-0000-0000-000000000000\",
    \"p_metadata_type\": \"topics\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ TEST 3 PASSED: Metadata discovery function accessible (HTTP 200)"
else
  echo "❌ TEST 3 FAILED: HTTP $HTTP_CODE"
  echo "   Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Tests completed. Check results above."
echo ""
echo "If all tests passed:"
echo "  ✅ hybrid_search_transcripts function is correctly deployed"
echo "  ✅ PostgREST schema cache is up-to-date"
echo "  ✅ Ready for MCP tool integration"
echo ""
