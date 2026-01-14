#!/bin/bash
# Convert all PRD markdown files to a single prd.json with all user stories
# Usage: ./convert-prds.sh [--dry-run]

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_DIR="$SCRIPT_DIR/prd"
OUTPUT_FILE="$SCRIPT_DIR/prd.json"

all_stories=""
story_num=0

for md_file in "$PRD_DIR"/PRD-*.md; do
  [ -f "$md_file" ] || continue

  current_story_id=""
  current_story_title=""
  current_story_desc=""
  current_ac=""

  while IFS= read -r line; do
    if [[ "$line" =~ US-([0-9]+\.[0-9]+) ]]; then
      if [[ -n "$current_story_id" ]]; then
        if [[ -n "$current_ac" ]]; then
          ac_list=$(echo "$current_ac" | sed '$ s/,$//')
        else
          ac_list=""
        fi
        all_stories="${all_stories}
    {
      \"id\": \"US-${current_story_id}\",
      \"title\": \"${current_story_title}\",
      \"priority\": ${story_num},
      \"description\": \"${current_story_desc}\",
      \"acceptanceCriteria\": [${ac_list}
      ],
      \"passes\": false
    },"
      fi

      story_num=$((story_num + 1))
      current_story_id="${BASH_REMATCH[1]}"
      clean_title=$(echo "$line" | sed 's/\*\*//g' | sed 's/  */ /g' | xargs)
      current_story_title="$clean_title"
      current_story_desc="$clean_title"
      current_ac=""
      continue
    fi

    if [[ -n "$current_story_id" ]] && [[ "${line:0:1}" == "-" && "$line" =~ \[ ]]; then
      ac_text=$(echo "$line" | sed 's/^- \[ \] //' | tr -d '"')
      current_ac="${current_ac}
        \"${ac_text}\","
      continue
    fi
  done < "$md_file"

  if [[ -n "$current_story_id" ]]; then
    if [[ -n "$current_ac" ]]; then
      ac_list=$(echo "$current_ac" | sed '$ s/,$//')
    else
      ac_list=""
    fi
    all_stories="${all_stories}
    {
      \"id\": \"US-${current_story_id}\",
      \"title\": \"${current_story_title}\",
      \"priority\": ${story_num},
      \"description\": \"${current_story_desc}\",
      \"acceptanceCriteria\": [${ac_list}
      ],
      \"passes\": false
    },"
  fi
done

all_stories=$(echo "$all_stories" | sed '$ s/,$//')

prd_count=$(ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)

json="{
  \"projectName\": \"All PRDs\",
  \"featureName\": \"All User Stories from ${prd_count} PRDs\",
  \"branchName\": \"ralph-all-prds\",
  \"description\": \"Combined user stories from all PRDs in prd/ folder\",
  \"userStories\": [${all_stories}
  ]
}"

if [[ "$DRY_RUN" == true ]]; then
  echo "$json" | head -30
  echo "..."
  echo ""
  echo "Total stories: $story_num"
else
  echo "$json" > "$OUTPUT_FILE"
  echo "Created: $OUTPUT_FILE with $story_num stories from $prd_count PRDs"
fi
