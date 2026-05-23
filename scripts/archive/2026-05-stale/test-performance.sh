#!/bin/bash

# ===========================================
# Performance Metrics Verification Script
# ===========================================
# QA Criteria:
#   - Streaming: Time to first token < 2 seconds
#   - RAG Search: Completion < 5 seconds
#   - Page Load: < 3 seconds
# ===========================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://xmkigmbpbflwhizpbpyy.supabase.co}"
CHAT_STREAM_URL="${SUPABASE_URL}/functions/v1/chat-stream"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "============================================="
echo "Performance Metrics Verification"
echo "============================================="
echo ""
echo "Targets:"
echo "  - Time to First Token: < 2 seconds"
echo "  - RAG Search Completion: < 5 seconds"
echo "  - Page Load: < 3 seconds"
echo ""

# ---------------------------------------------
# Test 1: API Response Time (Connection Test)
# ---------------------------------------------
echo "---------------------------------------------"
echo "Test 1: API Connection Test (CORS Preflight)"
echo "---------------------------------------------"

START_TIME=$(date +%s%3N)
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS "$CHAT_STREAM_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Origin: http://localhost:3000" \
  2>/dev/null || echo "000")
END_TIME=$(date +%s%3N)
CORS_TIME=$((END_TIME - START_TIME))

if [ "$CORS_RESPONSE" = "200" ] || [ "$CORS_RESPONSE" = "204" ]; then
  if [ $CORS_TIME -lt 500 ]; then
    echo -e "${GREEN}✓ CORS preflight: ${CORS_TIME}ms (< 500ms)${NC}"
  else
    echo -e "${YELLOW}⚠ CORS preflight: ${CORS_TIME}ms (slow, expected < 500ms)${NC}"
  fi
else
  echo -e "${YELLOW}⚠ CORS preflight returned: $CORS_RESPONSE${NC}"
fi

echo ""

# ---------------------------------------------
# Test 2: Frontend Page Load (if server running)
# ---------------------------------------------
echo "---------------------------------------------"
echo "Test 2: Frontend Page Load Test"
echo "---------------------------------------------"

START_TIME=$(date +%s%3N)
PAGE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$FRONTEND_URL/chat" \
  2>/dev/null || echo "000")
END_TIME=$(date +%s%3N)
PAGE_TIME=$((END_TIME - START_TIME))

if [ "$PAGE_RESPONSE" = "200" ]; then
  if [ $PAGE_TIME -lt 3000 ]; then
    echo -e "${GREEN}✓ Page load response: ${PAGE_TIME}ms (< 3000ms)${NC}"
  else
    echo -e "${RED}✗ Page load response: ${PAGE_TIME}ms (exceeds 3000ms target)${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Frontend not running (HTTP $PAGE_RESPONSE) - skipping page load test${NC}"
  echo "   Start with: npm run dev"
fi

echo ""

# ---------------------------------------------
# Test 3: Streaming Response Test
# ---------------------------------------------
echo "---------------------------------------------"
echo "Test 3: Streaming Response Test"
echo "---------------------------------------------"
echo ""

# Check if AUTH_TOKEN is provided
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠ AUTH_TOKEN not set - skipping authenticated tests${NC}"
  echo ""
  echo "To run authenticated tests, export your JWT token:"
  echo "  export AUTH_TOKEN='eyJ...'"
  echo ""
  echo "Or run the test manually with curl and measure time to first 'text-delta' event:"
  echo ""
  echo "  curl -s -X POST \"$CHAT_STREAM_URL\" \\"
  echo "    -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
  echo "    -H \"Content-Type: application/json\" \\"
  echo "    -d '{\"messages\":[{\"id\":\"test\",\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"text\":\"Hello\"}]}],\"model\":\"openai/gpt-4o-mini\"}' | head -20"
  echo ""
else
  echo "Testing streaming endpoint..."

  # Simple hello test (should respond quickly, no tool calls)
  START_TIME=$(date +%s%3N)

  # Send request and capture first 20 lines (should contain first text-delta)
  STREAM_OUTPUT=$(timeout 10 curl -s -X POST "$CHAT_STREAM_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"id":"test","role":"user","parts":[{"type":"text","text":"Say hello in one word"}]}],"model":"openai/gpt-4o-mini"}' 2>/dev/null | head -20)

  END_TIME=$(date +%s%3N)
  STREAM_TIME=$((END_TIME - START_TIME))

  # Check if we got a text-delta event (first token)
  if echo "$STREAM_OUTPUT" | grep -q "text-delta"; then
    if [ $STREAM_TIME -lt 2000 ]; then
      echo -e "${GREEN}✓ Time to first token: ${STREAM_TIME}ms (< 2000ms)${NC}"
    else
      echo -e "${YELLOW}⚠ Time to first token: ${STREAM_TIME}ms (target < 2000ms)${NC}"
    fi
  elif echo "$STREAM_OUTPUT" | grep -q "error"; then
    echo -e "${RED}✗ Streaming error detected${NC}"
    echo "$STREAM_OUTPUT" | head -5
  else
    echo -e "${YELLOW}⚠ No text-delta event in first 20 lines${NC}"
    echo "First few lines of response:"
    echo "$STREAM_OUTPUT" | head -5
  fi
fi

echo ""

# ---------------------------------------------
# Test 4: RAG Search Performance
# ---------------------------------------------
echo "---------------------------------------------"
echo "Test 4: RAG Search Performance Test"
echo "---------------------------------------------"
echo ""

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠ Skipping RAG test (requires AUTH_TOKEN)${NC}"
  echo ""
  echo "To test RAG performance manually:"
  echo "  1. Open browser DevTools → Network tab"
  echo "  2. Send query: 'What topics were discussed in recent calls?'"
  echo "  3. Measure time between tool-input-start and tool-output-available events"
  echo "  4. Target: < 5 seconds"
else
  echo "Testing RAG search (this triggers tool calls)..."

  START_TIME=$(date +%s%3N)

  # Query that triggers searchByDateRange tool
  RAG_OUTPUT=$(timeout 30 curl -s -X POST "$CHAT_STREAM_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"id":"test","role":"user","parts":[{"type":"text","text":"What were the main topics discussed in my recent calls?"}]}],"model":"openai/gpt-4o-mini"}' 2>/dev/null)

  END_TIME=$(date +%s%3N)
  TOTAL_TIME=$((END_TIME - START_TIME))

  # Check for tool output
  if echo "$RAG_OUTPUT" | grep -q "tool-output-available"; then
    # Extract time to tool output (rough estimate based on total time)
    if [ $TOTAL_TIME -lt 5000 ]; then
      echo -e "${GREEN}✓ RAG search complete: ${TOTAL_TIME}ms (< 5000ms)${NC}"
    else
      echo -e "${YELLOW}⚠ RAG search took: ${TOTAL_TIME}ms (target < 5000ms)${NC}"
    fi

    # Check if results were found
    if echo "$RAG_OUTPUT" | grep -q '"results"'; then
      RESULT_COUNT=$(echo "$RAG_OUTPUT" | grep -o '"results":\s*\[' | wc -l)
      echo "   Found results in response"
    else
      echo "   No results (possibly empty database)"
    fi
  elif echo "$RAG_OUTPUT" | grep -q "error"; then
    echo -e "${RED}✗ RAG search error${NC}"
  else
    echo -e "${YELLOW}⚠ No tool-output-available event found${NC}"
  fi
fi

echo ""

# ---------------------------------------------
# Summary
# ---------------------------------------------
echo "============================================="
echo "Performance Verification Summary"
echo "============================================="
echo ""
echo "For complete verification, use Chrome DevTools:"
echo "  1. Open Network tab"
echo "  2. Filter by 'EventStream' or 'chat-stream'"
echo "  3. Send messages and observe timing of:"
echo "     - 'text-delta' events (first token)"
echo "     - 'tool-output-available' events (RAG complete)"
echo ""
echo "For page load metrics, use Chrome Lighthouse:"
echo "  1. Open Lighthouse tab in DevTools"
echo "  2. Run 'Performance' audit"
echo "  3. Verify FCP < 1.8s, LCP < 2.5s, TTI < 3.0s"
echo ""
