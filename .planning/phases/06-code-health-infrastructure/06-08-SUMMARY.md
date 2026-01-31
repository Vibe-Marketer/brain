---
phase: 06-code-health-infrastructure
plan: 08
subsystem: infra
tags: [cost-tracking, openrouter, ai-sdk, dashboard, react, supabase]

# Dependency graph
requires:
  - phase: 06-code-health-infrastructure
    provides: existing usage-tracker infrastructure
provides:
  - Extended model pricing (26 models covering OpenAI, Anthropic, Google, DeepSeek)
  - Per-request logging in chat-stream-v2
  - Cost dashboard with breakdowns by model and feature
  - useAICosts hook for cost data fetching
affects: [billing, analytics, monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onFinish callback for AI SDK stream usage logging"
    - "Period-based cost filtering (today/week/month/all)"
    - "Fire-and-forget logging pattern for non-blocking usage tracking"

key-files:
  created:
    - src/hooks/useAICosts.ts
    - src/components/settings/CostDashboard.tsx
  modified:
    - supabase/functions/_shared/usage-tracker.ts
    - supabase/functions/chat-stream-v2/index.ts
    - src/components/settings/AITab.tsx

key-decisions:
  - "Use Record type instead of const assertion for extensible pricing table"
  - "Log warning for unknown models instead of failing silently"
  - "Use AI SDK onFinish callback with fallback to estimateTokenCount"
  - "Period-based filtering with today/week/month/all options"

patterns-established:
  - "onFinish callback pattern for streaming usage logging"
  - "Fire-and-forget database logging with .catch() error handling"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 6 Plan 08: Cost Tracking Summary

**Extended model pricing (26 models) with per-request logging and real-time cost dashboard**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T13:38:50Z
- **Completed:** 2026-01-31T13:42:53Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended usage-tracker with 26 model pricing entries (OpenAI, Anthropic, Google, DeepSeek, GLM)
- Added per-request usage logging to chat-stream-v2 using AI SDK onFinish callback
- Created comprehensive cost dashboard with period filtering and breakdowns

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend usage-tracker with all OpenRouter models** - `624f4fc` (feat)
2. **Task 2: Add per-request logging to chat-stream-v2** - `7c5117e` (feat)
3. **Task 3: Create cost dashboard component** - `1420c80` (feat)

## Files Created/Modified

- `supabase/functions/_shared/usage-tracker.ts` - Extended PRICING object with 26 models, added normalizeModelName helper, warning for unknown models
- `supabase/functions/chat-stream-v2/index.ts` - Added usage logging via onFinish callback with token estimation fallback
- `src/hooks/useAICosts.ts` - New hook for fetching and aggregating cost data by period
- `src/components/settings/CostDashboard.tsx` - Dashboard component with summary cards, model breakdown, feature breakdown, recent activity
- `src/components/settings/AITab.tsx` - Integrated CostDashboard into AI settings page

## Decisions Made

1. **Record type for pricing** - Used `Record<string, {...}>` instead of `const` assertion to allow dynamic model lookups without type narrowing issues
2. **Warning for unknown models** - Log console warning instead of returning 0 silently to help identify missing pricing entries
3. **AI SDK usage integration** - Used onFinish callback which provides actual token counts when available, with fallback to character-based estimation
4. **Period filtering** - Implemented client-side aggregation with server-side date filtering for flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cost tracking infrastructure complete for all production models
- Dashboard ready for use in Settings > AI tab
- Per-request logging active for chat-stream-v2

---
*Phase: 06-code-health-infrastructure*
*Completed: 2026-01-31*
