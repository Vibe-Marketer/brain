#!/bin/bash
# =============================================
# CHAT-STREAM EDGE FUNCTION TEST
# =============================================
#
# Tests the chat-stream edge function to verify the RAG pipeline works
# with streaming SSE responses following the AI SDK v5 Data Stream Protocol.
#
# Usage:
#   ./scripts/test-chat-stream.sh
#
# Required Environment Variables:
#   SUPABASE_URL - Project URL (defaults to production)
#   AUTH_TOKEN - A valid Supabase JWT token (from browser devtools or supabase.auth.getSession())
#
# How to get AUTH_TOKEN:
#   1. Open browser devtools on app.callvaultai.com (or localhost:3000)
#   2. Go to Application > Local Storage > supabase.auth.token
#   3. Copy the access_token value
#   4. Or run in console: (await supabase.auth.getSession()).data.session?.access_token
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to production project
SUPABASE_URL="${SUPABASE_URL:-https://vltmrnjsubfzrgrtdqey.supabase.co}"
CHAT_STREAM_URL="${SUPABASE_URL}/functions/v1/chat-stream"

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║         CHAT-STREAM EDGE FUNCTION TEST                                        ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}Supabase URL:${NC} $SUPABASE_URL"
echo -e "${BLUE}Endpoint:${NC} $CHAT_STREAM_URL"
echo -e "${BLUE}Timestamp:${NC} $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Check for AUTH_TOKEN
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}ERROR: AUTH_TOKEN not set${NC}"
  echo ""
  echo "The chat-stream function requires authentication. To get a token:"
  echo ""
  echo "  1. Open your browser's developer tools on the running app"
  echo "  2. Go to Application > Local Storage > [your-supabase-url]"
  echo "  3. Find the 'sb-[project-id]-auth-token' key"
  echo "  4. Copy the 'access_token' value from the JSON"
  echo ""
  echo "Or run in the browser console:"
  echo "  (await supabase.auth.getSession()).data.session?.access_token"
  echo ""
  echo "Then run:"
  echo "  AUTH_TOKEN='your-token' ./scripts/test-chat-stream.sh"
  echo ""
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 1: OPTIONS Request (CORS Preflight)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X OPTIONS \
  "$CHAT_STREAM_URL" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "204" ]; then
  echo -e "${GREEN}✅ TEST 1 PASSED: CORS preflight successful (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}❌ TEST 1 FAILED: CORS preflight failed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 2: Unauthenticated Request (Should Return 401)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$CHAT_STREAM_URL" \
  -H "Content-Type: application/json" \
  -d '{"messages": []}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "401" ]; then
  echo -e "${GREEN}✅ TEST 2 PASSED: Unauthenticated request rejected (HTTP 401)${NC}"
else
  echo -e "${YELLOW}⚠️  TEST 2: Unexpected response (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 3: Missing Messages Array (Should Return 400)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$CHAT_STREAM_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "400" ]; then
  echo -e "${GREEN}✅ TEST 3 PASSED: Missing messages rejected (HTTP 400)${NC}"
else
  echo -e "${YELLOW}⚠️  TEST 3: Unexpected response (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 4: Simple Query (Streaming SSE Response)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Sending query: 'What calls do I have?'"
echo ""

# Create a unique message ID
MESSAGE_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-$(date +%s)")

# Send request and capture streaming response
# Using --no-buffer to get real-time streaming output
RESPONSE=$(curl -s -w "\n\n__HTTP_CODE__%{http_code}" -X POST \
  "$CHAT_STREAM_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -N \
  --max-time 60 \
  -d "{
    \"messages\": [
      {
        \"id\": \"${MESSAGE_ID}\",
        \"role\": \"user\",
        \"parts\": [{\"type\": \"text\", \"text\": \"What calls do I have?\"}]
      }
    ],
    \"model\": \"openai/gpt-4o-mini\"
  }" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
BODY=$(echo "$RESPONSE" | sed 's/__HTTP_CODE__[0-9]*//')

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ TEST 4 PASSED: Received streaming response (HTTP 200)${NC}"
  echo ""

  # Count SSE events
  EVENT_COUNT=$(echo "$BODY" | grep -c "^data:" 2>/dev/null || echo "0")
  echo -e "${BLUE}📊 SSE Events Received:${NC} $EVENT_COUNT"

  # Check for AI SDK v5 protocol markers
  HAS_START=$(echo "$BODY" | grep -c '"type":"start"' 2>/dev/null || echo "0")
  HAS_FINISH=$(echo "$BODY" | grep -c '"type":"finish"' 2>/dev/null || echo "0")
  HAS_TEXT=$(echo "$BODY" | grep -c '"type":"text' 2>/dev/null || echo "0")
  HAS_TOOL=$(echo "$BODY" | grep -c '"type":"tool' 2>/dev/null || echo "0")
  HAS_DONE=$(echo "$BODY" | grep -c '\[DONE\]' 2>/dev/null || echo "0")

  echo ""
  echo -e "${BLUE}AI SDK v5 Protocol Events:${NC}"
  if [ "$HAS_START" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} start event"
  else
    echo -e "  ${YELLOW}○${NC} start event (not found)"
  fi

  if [ "$HAS_TEXT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} text events ($HAS_TEXT)"
  else
    echo -e "  ${YELLOW}○${NC} text events (not found)"
  fi

  if [ "$HAS_TOOL" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} tool events ($HAS_TOOL)"
  else
    echo -e "  ${YELLOW}○${NC} tool events (not found - may be normal if no tools invoked)"
  fi

  if [ "$HAS_FINISH" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} finish event"
  else
    echo -e "  ${YELLOW}○${NC} finish event (not found)"
  fi

  if [ "$HAS_DONE" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} [DONE] terminator"
  else
    echo -e "  ${YELLOW}○${NC} [DONE] terminator (not found)"
  fi

  echo ""
  echo -e "${BLUE}First 10 SSE events:${NC}"
  echo "$BODY" | grep "^data:" | head -10 | while read line; do
    # Truncate long lines for readability
    if [ ${#line} -gt 100 ]; then
      echo "  ${line:0:97}..."
    else
      echo "  $line"
    fi
  done

else
  echo -e "${RED}❌ TEST 4 FAILED: Request failed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "TEST 5: Query with Search Tool Invocation"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Sending query: 'Search for objections in my calls'"
echo "(This should trigger the searchTranscriptsByQuery tool)"
echo ""

MESSAGE_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-$(date +%s)")

RESPONSE=$(curl -s -w "\n\n__HTTP_CODE__%{http_code}" -X POST \
  "$CHAT_STREAM_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -N \
  --max-time 90 \
  -d "{
    \"messages\": [
      {
        \"id\": \"${MESSAGE_ID}\",
        \"role\": \"user\",
        \"parts\": [{\"type\": \"text\", \"text\": \"Search for objections in my calls\"}]
      }
    ],
    \"model\": \"openai/gpt-4o-mini\"
  }" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | grep '__HTTP_CODE__' | sed 's/__HTTP_CODE__//')
BODY=$(echo "$RESPONSE" | sed 's/__HTTP_CODE__[0-9]*//')

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ TEST 5 PASSED: Received streaming response (HTTP 200)${NC}"
  echo ""

  # Check for tool invocations
  HAS_TOOL_INPUT=$(echo "$BODY" | grep -c '"type":"tool-input' 2>/dev/null || echo "0")
  HAS_TOOL_OUTPUT=$(echo "$BODY" | grep -c '"type":"tool-output' 2>/dev/null || echo "0")
  HAS_SEARCH=$(echo "$BODY" | grep -c 'searchTranscripts\|searchByQuery' 2>/dev/null || echo "0")

  echo -e "${BLUE}Tool Invocation Analysis:${NC}"
  if [ "$HAS_TOOL_INPUT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} tool-input events ($HAS_TOOL_INPUT)"
  else
    echo -e "  ${YELLOW}○${NC} tool-input events (not found)"
  fi

  if [ "$HAS_TOOL_OUTPUT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} tool-output events ($HAS_TOOL_OUTPUT)"
  else
    echo -e "  ${YELLOW}○${NC} tool-output events (not found)"
  fi

  if [ "$HAS_SEARCH" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Search tool invoked"
  else
    echo -e "  ${YELLOW}○${NC} Search tool not detected in response"
  fi

  echo ""
  echo -e "${BLUE}Tool-related events (first 5):${NC}"
  echo "$BODY" | grep -E "tool-input|tool-output|tool-call" | head -5 | while read line; do
    if [ ${#line} -gt 100 ]; then
      echo "  ${line:0:97}..."
    else
      echo "  $line"
    fi
  done

else
  echo -e "${RED}❌ TEST 5 FAILED: Request failed (HTTP $HTTP_CODE)${NC}"
  echo "   Response: ${BODY:0:500}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Tests completed. Check results above."
echo ""
echo "If all tests passed:"
echo -e "  ${GREEN}✅${NC} chat-stream edge function is correctly deployed"
echo -e "  ${GREEN}✅${NC} Authentication and CORS are working"
echo -e "  ${GREEN}✅${NC} AI SDK v5 Data Stream Protocol is being used"
echo -e "  ${GREEN}✅${NC} RAG pipeline is operational (if tool calls succeeded)"
echo ""
echo "If tests failed:"
echo -e "  ${YELLOW}⚠️${NC}  Check that the edge function is deployed: supabase functions deploy chat-stream"
echo -e "  ${YELLOW}⚠️${NC}  Verify environment variables are set (OPENROUTER_API_KEY, OPENAI_API_KEY)"
echo -e "  ${YELLOW}⚠️${NC}  Check Supabase logs: supabase functions logs chat-stream"
echo ""
