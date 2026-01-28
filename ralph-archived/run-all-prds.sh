#!/bin/bash
# Run all PRDs sequentially
# Usage: ./run-all-prds.sh [max_iterations_per_prd]

MAX_ITERATIONS=${1:-20}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_DIR="$SCRIPT_DIR/prd"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
RALPH_SCRIPT="$SCRIPT_DIR/ralph.sh"
CONVERT_SCRIPT="$SCRIPT_DIR/convert-prds.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
log_done() { echo -e "${GREEN}[DONE]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

get_completed_prds() {
  grep -o 'PRD-[0-9]*-[^ ]*' "$PROGRESS_FILE" 2>/dev/null | sed 's/-Completed.*//' | sort -u || echo ""
}

get_next_prd() {
  local completed=$(get_completed_prds)

  for md_file in "$PRD_DIR"/PRD-*.md; do
    if [ -f "$md_file" ]; then
      local basename=$(basename "$md_file" .md)
      if ! echo "$completed" | grep -q "^${basename}$"; then
        echo "$basename"
        return 0
      fi
    fi
  done
  return 1
}

run_prd() {
  local prd_file="$1"
  local basename=$(basename "$prd_file" .md)

  echo ""
  log_info "═══════════════════════════════════════════════════════"
  log_info "  Running: $basename"
  log_info "═══════════════════════════════════════════════════════"
  echo ""

  "$CONVERT_SCRIPT" "$basename"

  echo ""

  "$RALPH_SCRIPT" "$MAX_ITERATIONS"

  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Completed: $basename" >> "$PROGRESS_FILE"
    log_done "$basename completed successfully"
    return 0
  else
    log_error "$basename failed with exit code: $exit_code"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Failed: $basename (exit $exit_code)" >> "$PROGRESS_FILE"
    return $exit_code
  fi
}

log_info "Ralph PRD Runner - Sequential PRD execution"
echo ""

COMPLETED=$(get_completed_prds)
if [ -n "$COMPLETED" ]; then
  log_info "Already completed:"
  echo "$COMPLETED" | tr ' ' '\n' | sed 's/^/  - /'
  echo ""
fi

TOTAL_PRD_COUNT=$(ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)
log_info "Total PRDs: $TOTAL_PRD_COUNT"
echo ""

while true; do
  NEXT_PRD=$(get_next_prd)

  if [ -z "$NEXT_PRD" ]; then
    log_done "All PRDs completed!"
    break
  fi

  log_info "Next: $NEXT_PRD"

  if ! run_prd "$PRD_DIR/${NEXT_PRD}.md"; then
    log_error "Stopped at: $NEXT_PRD"
    exit 1
  fi

  echo ""
done

log_done "All PRDs processed successfully!"
