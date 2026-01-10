#!/bin/bash

# Embedding Queue Monitor
# Checks the health of the embedding queue and reports on failures

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -E '^(VITE_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=' | xargs)
fi

SUPABASE_ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_URL="https://vltmrnjsubfzrgrtdqey.supabase.co"

if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE keys not found in environment${NC}"
  exit 1
fi

echo -e "${BLUE}=== Embedding Queue Health Monitor ===${NC}\n"

# Function to make API call
api_call() {
  local endpoint="$1"
  curl -sS "$SUPABASE_URL/rest/v1/$endpoint" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
}

# 1. Queue Status Breakdown
echo -e "${BLUE}📊 Queue Status:${NC}"
queue_status=$(api_call "embedding_queue?select=status")
echo "$queue_status" | jq -r '.[].status' | sort | uniq -c | while read -r count status; do
  case $status in
    completed)
      echo -e "  ${GREEN}✓ $status: $count${NC}"
      ;;
    pending)
      echo -e "  ${YELLOW}⏳ $status: $count${NC}"
      ;;
    failed)
      echo -e "  ${YELLOW}⚠ $status: $count${NC}"
      ;;
    dead_letter)
      echo -e "  ${RED}✗ $status: $count${NC}"
      ;;
    processing)
      echo -e "  ${BLUE}⏵ $status: $count${NC}"
      ;;
    *)
      echo -e "  ○ $status: $count"
      ;;
  esac
done

# 2. Dead Letter Queue Details
echo -e "\n${BLUE}🔴 Dead Letter Queue (Failed Items):${NC}"
dead_letter=$(api_call "embedding_queue?select=recording_id,last_error,attempts&status=eq.dead_letter&limit=10")
dead_letter_count=$(echo "$dead_letter" | jq '. | length')

if [ "$dead_letter_count" -eq 0 ]; then
  echo -e "  ${GREEN}✓ No items in dead letter queue${NC}"
else
  echo -e "  ${RED}Found $dead_letter_count items in dead letter queue:${NC}"
  echo "$dead_letter" | jq -r '.[] | "  Recording \(.recording_id): \(.last_error | .[0:80])... (attempt \(.attempts))"'
fi

# 3. Recent Embeddings (last hour)
echo -e "\n${BLUE}📈 Recent Activity (last hour):${NC}"
one_hour_ago=$(date -u -v-1H '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S')
recent_count=$(api_call "transcript_chunks?select=count&embedded_at=gte.${one_hour_ago}Z" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
echo -e "  ${GREEN}✓ $recent_count embeddings created in last hour${NC}"

# 4. Pending/Failed Items Ready for Retry
echo -e "\n${BLUE}⏳ Items Ready for Retry:${NC}"
now=$(date -u '+%Y-%m-%dT%H:%M:%S')
retry_ready=$(api_call "embedding_queue?select=count&status=in.(pending,failed)&or=(next_retry_at.is.null,next_retry_at.lte.$now)" -H "Prefer: count=exact")
retry_count=$(echo "$retry_ready" | jq -r '.[0].count // 0')

if [ "$retry_count" -eq 0 ]; then
  echo -e "  ${GREEN}✓ No items currently ready for retry${NC}"
else
  echo -e "  ${YELLOW}⚠ $retry_count items ready for retry${NC}"
fi

# 5. Processing Jobs Status
echo -e "\n${BLUE}💼 Embedding Jobs:${NC}"
jobs=$(api_call "embedding_jobs?select=id,status,total_tasks,tasks_completed,tasks_failed,created_at&order=created_at.desc&limit=5")
jobs_count=$(echo "$jobs" | jq '. | length')

if [ "$jobs_count" -eq 0 ]; then
  echo -e "  ${YELLOW}No recent jobs found${NC}"
else
  echo "$jobs" | jq -r '.[] | "  Job \(.id | .[0:8]): \(.status) - \(.tasks_completed)/\(.total_tasks) completed, \(.tasks_failed) failed"' | while read -r line; do
    if echo "$line" | grep -q "completed"; then
      echo -e "${GREEN}$line${NC}"
    elif echo "$line" | grep -q "failed.*[1-9]"; then
      echo -e "${YELLOW}$line${NC}"
    else
      echo "$line"
    fi
  done
fi

# 6. Health Summary
echo -e "\n${BLUE}=== Health Summary ===${NC}"

# Check if dead letter queue is growing
if [ "$dead_letter_count" -gt 20 ]; then
  echo -e "${RED}❌ CRITICAL: Dead letter queue has $dead_letter_count items (threshold: 20)${NC}"
  echo -e "   Action: Run 'gh workflow run retry-failed-embeddings.yml' to trigger recovery"
elif [ "$dead_letter_count" -gt 0 ]; then
  echo -e "${YELLOW}⚠ WARNING: Dead letter queue has $dead_letter_count items${NC}"
  echo -e "   Action: Monitor - automatic recovery will run every 6 hours"
else
  echo -e "${GREEN}✓ Dead letter queue is empty${NC}"
fi

# Check if recent activity exists
if [ "$recent_count" -gt 0 ]; then
  echo -e "${GREEN}✓ Embedding pipeline is active (${recent_count} in last hour)${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: No embeddings created in last hour${NC}"
  echo -e "   Action: Check if main workflow is running"
fi

# Check retry queue
if [ "$retry_count" -gt 100 ]; then
  echo -e "${RED}❌ CRITICAL: $retry_count items waiting for retry${NC}"
  echo -e "   Action: Check worker health and trigger manual run"
elif [ "$retry_count" -gt 0 ]; then
  echo -e "${YELLOW}⚠ INFO: $retry_count items waiting for retry (will process automatically)${NC}"
fi

echo -e "\n${BLUE}=== Quick Actions ===${NC}"
echo -e "  Manual retry:     ${GREEN}gh workflow run retry-failed-embeddings.yml${NC}"
echo -e "  Force retry one:  ${GREEN}gh workflow run retry-failed-embeddings.yml -f recording_id=<ID> -f force_retry=true${NC}"
echo -e "  Main worker:      ${GREEN}gh workflow run embedding-worker.yml${NC}"
echo -e "  View workflows:   ${GREEN}gh run list --workflow=embedding-worker.yml --limit=5${NC}"
