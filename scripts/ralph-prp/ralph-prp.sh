#!/bin/bash
# Ralph-PRP: Enhanced Ralph loop with PRP validation gates
# Based on snarktank/ralph + PRP validation system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=${1:-10}
ITERATION=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Ralph-PRP: Enhanced Autonomous Loop with Validation Gates${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for prp.json
if [ ! -f "$SCRIPT_DIR/prp.json" ]; then
    echo -e "${RED}❌ Error: prp.json not found${NC}"
    echo "Run: Load the prp-create skill to create a PRP first"
    echo "Then: Load the ralph-prp skill to convert it to prp.json"
    exit 1
fi

# Get branch name from prp.json
BRANCH_NAME=$(jq -r '.branchName // empty' "$SCRIPT_DIR/prp.json")
if [ -z "$BRANCH_NAME" ]; then
    echo -e "${RED}❌ Error: No branchName in prp.json${NC}"
    exit 1
fi

# Check if we need to switch branches
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    echo -e "${YELLOW}📌 Switching to branch: $BRANCH_NAME${NC}"
    git checkout "$BRANCH_NAME" 2>/dev/null || git checkout -b "$BRANCH_NAME"
fi

echo -e "${GREEN}🚀 Starting Ralph-PRP loop (max $MAX_ITERATIONS iterations)${NC}"
echo -e "${GREEN}📋 Branch: $BRANCH_NAME${NC}"
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Iteration $ITERATION of $MAX_ITERATIONS${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check if all tasks are complete
    REMAINING=$(jq '[.tasks[] | select(.passes == false)] | length' "$SCRIPT_DIR/prp.json")
    if [ "$REMAINING" -eq 0 ]; then
        echo -e "${GREEN}✅ All tasks complete!${NC}"
        break
    fi
    
    echo -e "${YELLOW}📝 $REMAINING tasks remaining${NC}"
    echo ""
    
    # Run amp with the enhanced prompt
    OUTPUT=$(amp --print "$SCRIPT_DIR/prompt.md" 2>&1)
    
    # Check for completion signal
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  🎉 COMPLETE - All tasks passed validation!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        break
    fi
    
    # Brief pause between iterations
    sleep 2
done

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo -e "${YELLOW}⚠️  Max iterations ($MAX_ITERATIONS) reached${NC}"
    REMAINING=$(jq '[.tasks[] | select(.passes == false)] | length' "$SCRIPT_DIR/prp.json")
    echo -e "${YELLOW}📝 $REMAINING tasks still remaining${NC}"
fi

echo ""
echo -e "${BLUE}📊 Final Status:${NC}"
jq '.tasks[] | {id, title, passes}' "$SCRIPT_DIR/prp.json"
