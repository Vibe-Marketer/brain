# Troubleshooting Session - 2025-12-03

## Session Summary
Comprehensive troubleshooting session addressing multiple critical issues in the Conversion Brain application.

## Issues Diagnosed & Fixed

### 1. White Screen on Call Selection ✅
- **Location**: `src/components/call-detail/CallDetailHeader.tsx:36-38`
- **Root Cause**: Null pointer exception when accessing `call.share_url` without null checks
- **Fix**: Added early return `if (!call) { return null; }`
- **Status**: Fixed and tested - dialog opens correctly

### 2. AI Chat Tool Calls Not Displaying ✅
- **Location**: `src/pages/Chat.tsx:112-167`
- **Root Cause**: `getToolInvocations()` was checking wrong AI SDK v5 states
- **Wrong states**: `'output'`, `'result'`, `'streaming'`
- **Correct AI SDK v5 states**:
  - `'input-streaming'` → running
  - `'input-available'` → running
  - `'output-available'` → success
  - `'output-error'` → error
- **Status**: Fixed, needs manual testing after login

### 3. Stuck Embedding Job ✅
- **Problem**: Job `7cc2c8eb-5ab2-47bf-b2eb-72a81d7eaf5a` stuck in 'running' for 2+ days
- **Fix**: Updated to 'completed_with_errors', moved failed queue item to 'dead_letter'
- **Status**: Resolved

### 4. Recent Calls Missing Embeddings ✅
- **Problem**: 8 calls from last 5 days had 0 transcript chunks
- **Fix**: Created new embedding jobs and triggered process-embeddings worker
- **Result**: All 12 recent calls now have chunks (1-69 chunks each)

## Key Technical Learnings

### AI SDK v5 Tool Part States
The correct states for AI SDK v5 tool parts are:
```typescript
// AI SDK v5 states
'input-streaming'   // Tool is receiving input
'input-available'   // Input ready, waiting for output
'output-available'  // Tool completed successfully
'output-error'      // Tool failed with error
```

### Embedding System Architecture
- `embed-chunks` function: Job creator, queues recordings
- `process-embeddings` function: Worker that processes queue items
- Tables: `embedding_jobs`, `embedding_queue`, `transcript_chunks`
- Queue statuses: 'pending', 'processing', 'completed', 'failed', 'dead_letter'

### Database Connection
- Correct pooler URL: `aws-1-us-east-1.pooler.supabase.com:5432`
- Old/wrong URL: `aws-0-us-west-1.pooler.supabase.com:6543`

## Environment Variables Verified
All required for chat-stream function:
- OPENROUTER_API_KEY ✓
- OPENAI_API_KEY ✓
- ANTHROPIC_API_KEY ✓

## Files Modified
1. `src/components/call-detail/CallDetailHeader.tsx` - Null check fix
2. `src/pages/Chat.tsx` - Tool part state parsing fix

## Pending Manual Testing
1. Sign in to application
2. Navigate to `/chat`
3. Test tool calls (e.g., "Search for recent calls about pricing")
4. Verify tool states display correctly (running → success)
5. Verify tool results extracted for source display

## Additional Fixes (2025-12-04)

### 5. Extra Row Visual Issue in Transcripts Table ✅
- **Location**: `src/components/transcripts/TranscriptsTab.tsx`
- **Root Cause**: Separator components had `my-12` class (48px margins) creating visual appearance of extra row above table header
- **Fix**: Changed margins from `my-12` to `my-6` (24px) on lines 511, 523, 554
- **Status**: Fixed and deployed

### 6. Git Divergence Resolution ✅
- Local branch had 1 commit, remote had 15 commits (from another machine)
- Resolved via rebase: `git rebase origin/main`
- Minor conflict in CallDetailHeader.tsx (comment difference) - resolved
- Successfully pushed rebased branch

## Session Metadata
- Date: 2025-12-03 (continued 2025-12-04)
- Duration: ~60 minutes total
- Parallel agents used: 4 (AI chat, white screen, embeddings, sync jobs)
- Dev server: Port 8081
