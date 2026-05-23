# Embedding Recovery System

**Last Updated:** 2026-01-09
**Status:** Production Ready

---

## Overview

The embedding recovery system provides a robust backup mechanism for handling embeddings that fail in the main processing pipeline. It's specifically designed to handle:

- **Database timeout errors** from very large recordings
- **Transient failures** that can succeed on retry
- **Dead letter queue recovery** with optimized batch sizes

## Architecture

### Main Pipeline (`process-embeddings`)

- **Trigger:** Every 5 minutes via GitHub Actions cron
- **Batch Size:** 10 recordings per invocation
- **Insert Batch:** 50 chunks per database insert
- **Target:** Normal recordings (<1000 chunks)
- **Success Rate:** ~98.5%

### Backup Pipeline (`retry-failed-embeddings`)

- **Trigger:** Every 6 hours via GitHub Actions cron (or manual)
- **Batch Size:** 1 recording per invocation (ultra-conservative)
- **Insert Batch:** 5 chunks per database insert (10x smaller)
- **Target:** Failed recordings from dead_letter queue
- **Strategy:** Slow and steady with incremental progress

## Components

### 1. Edge Function: `retry-failed-embeddings`

**Location:** `supabase/functions/retry-failed-embeddings/index.ts`

**Key Features:**
- Ultra-small batch sizes (5 chunks per insert vs 50)
- Single recording processing (no batch claiming)
- Extended timeout tolerance (2 minutes)
- Incremental progress logging

**Usage:**
```bash
# Manual trigger via curl
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/retry-failed-embeddings"

# Retry specific recording
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"recording_id": 21792013, "force_retry": true}' \
  "https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/retry-failed-embeddings"
```

### 2. GitHub Workflow: `retry-failed-embeddings.yml`

**Location:** `.github/workflows/retry-failed-embeddings.yml`

**Schedule:** Every 6 hours (0 */6 * * *)

**Features:**
- Automatic dead_letter queue processing
- Manual trigger with specific recording ID
- Force retry option for recent failures
- Multi-iteration processing (up to 5 per run)

**Manual Triggers:**
```bash
# Trigger automatic recovery
gh workflow run retry-failed-embeddings.yml

# Retry specific recording (force)
gh workflow run retry-failed-embeddings.yml \
  -f recording_id=21792013 \
  -f force_retry=true

# View workflow runs
gh run list --workflow=retry-failed-embeddings.yml --limit=5

# Watch workflow run
gh run watch
```

### 3. Monitoring Script: `monitor-embeddings.sh`

**Location:** `scripts/monitor-embeddings.sh`

**Features:**
- Queue status breakdown (pending, completed, failed, dead_letter)
- Dead letter queue details with error messages
- Recent activity metrics (last hour)
- Retry-ready items count
- Job status summary
- Health summary with actionable alerts

**Usage:**
```bash
# Run health check
./scripts/monitor-embeddings.sh

# Run with watch (updates every 30 seconds)
watch -n 30 ./scripts/monitor-embeddings.sh
```

**Example Output:**
```
=== Embedding Queue Health Monitor ===

📊 Queue Status:
  ✓ completed: 985
  ✗ dead_letter: 15

🔴 Dead Letter Queue (Failed Items):
  Found 15 items in dead letter queue:
  Recording 21792013: Error inserting chunks for 21792013: canceling statement due to... (attempt 3)
  Recording 24393952: Error inserting chunks for 24393952: canceling statement due to... (attempt 3)

📈 Recent Activity (last hour):
  ✓ 17126 embeddings created in last hour

=== Health Summary ===
⚠ WARNING: Dead letter queue has 15 items
   Action: Monitor - automatic recovery will run every 6 hours
✓ Embedding pipeline is active (17126 in last hour)
```

## Failure Patterns

### Pattern 1: Database Statement Timeout

**Symptoms:**
```json
{
  "last_error": "Error inserting chunks for 21792013: canceling statement due to statement timeout",
  "attempts": 3
}
```

**Root Cause:**
- Very large recordings (3+ hours)
- Generates 500-1000+ chunks
- Batch insert of 50 chunks × 1536-dimension vectors times out

**Solution:**
- Retry worker uses 5 chunk batches (10x smaller)
- Takes longer but completes successfully

### Pattern 2: Transient API Errors

**Symptoms:**
```json
{
  "last_error": "OpenAI API error: 429 - Rate limit exceeded",
  "attempts": 1
}
```

**Root Cause:**
- OpenAI rate limits hit during peak processing
- Temporary network issues

**Solution:**
- Main worker retries with exponential backoff (30s, 90s, 270s)
- Usually succeeds on retry

### Pattern 3: Missing Data

**Symptoms:**
```json
{
  "last_error": "Call 12345 not found: Not found",
  "attempts": 3
}
```

**Root Cause:**
- Recording deleted after being queued
- Data inconsistency

**Solution:**
- Move to dead_letter after 3 attempts
- Manual investigation required

## Workflow Decision Tree

```
Embedding Task Created
  ↓
Main Worker (process-embeddings)
  ↓
Success? → ✓ Complete
  ↓ No
Timeout Error?
  ↓ Yes
Mark as 'pending' with retry delay
  ↓
Retry 1 (after 30s)
  ↓
Success? → ✓ Complete
  ↓ No
Retry 2 (after 90s)
  ↓
Success? → ✓ Complete
  ↓ No
Retry 3 (after 270s)
  ↓
Success? → ✓ Complete
  ↓ No
Move to dead_letter queue
  ↓
Wait for Backup Worker (every 6 hours)
  ↓
Retry Worker (retry-failed-embeddings)
  ↓
Ultra-small batches (5 chunks)
  ↓
Success? → ✓ Complete
  ↓ No
Update error, schedule next attempt (1 hour)
```

## Monitoring & Alerts

### Health Check Intervals

**Automatic:**
- Main worker: Every 5 minutes
- Retry worker: Every 6 hours

**Manual:**
- Monitor script: Run anytime with `./scripts/monitor-embeddings.sh`

### Alert Thresholds

**🟢 Healthy:**
- Dead letter queue: 0 items
- Recent activity: >0 embeddings in last hour
- Retry queue: <100 items

**🟡 Warning:**
- Dead letter queue: 1-20 items
- No activity in last hour
- Retry queue: 100-500 items

**🔴 Critical:**
- Dead letter queue: >20 items
- No activity in last 6 hours
- Retry queue: >500 items

### Response Actions

**Dead letter queue growing:**
```bash
# Trigger manual recovery (processes up to 5 items)
gh workflow run retry-failed-embeddings.yml

# For urgent recovery, run multiple times
for i in {1..5}; do
  gh workflow run retry-failed-embeddings.yml
  sleep 5
done
```

**Specific recording stuck:**
```bash
# Force retry specific recording
gh workflow run retry-failed-embeddings.yml \
  -f recording_id=21792013 \
  -f force_retry=true
```

**No recent activity:**
```bash
# Check main worker status
gh run list --workflow=embedding-worker.yml --limit=5

# Manually trigger main worker
gh workflow run embedding-worker.yml
```

## Performance Metrics

### Main Worker

**Typical Performance:**
- Batch size: 10 recordings
- Duration: 30-60 seconds
- Chunks created: 500-800 per batch
- Success rate: 98.5%

**Failure Rate:**
- Timeouts: ~1.5% (large recordings)
- API errors: <0.1% (transient)
- Data errors: <0.1% (deleted recordings)

### Retry Worker

**Typical Performance:**
- Batch size: 1 recording
- Duration: 60-180 seconds
- Chunks created: 500-1500 per recording
- Success rate: ~95% (on timeout failures)

**When it fails:**
- Usually indicates corrupted data or deleted recordings
- Requires manual investigation

## Database Schema

### `embedding_queue` Table

```sql
CREATE TABLE embedding_queue (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id UUID NOT NULL,
  recording_id BIGINT NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  worker_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status Flow:**
- `pending` → Worker picks up
- `processing` → Worker is processing
- `completed` → ✓ Success
- `failed` → Waiting for retry
- `dead_letter` → Max retries exceeded, needs backup worker

## Troubleshooting

### Problem: Dead letter queue not clearing

**Check:**
```bash
# Verify retry workflow is enabled
gh workflow list | grep retry-failed

# Check recent runs
gh run list --workflow=retry-failed-embeddings.yml --limit=5

# View latest run logs
gh run view --log
```

**Solution:**
```bash
# Enable workflow if disabled
gh workflow enable retry-failed-embeddings.yml

# Trigger manual run
gh workflow run retry-failed-embeddings.yml
```

### Problem: Retry worker failing on same recordings

**Check:**
```bash
# Get dead letter details
./scripts/monitor-embeddings.sh | grep -A 20 "Dead Letter"
```

**Investigate in database:**
```sql
-- Check failed recording details
SELECT
  eq.recording_id,
  eq.last_error,
  eq.attempts,
  fc.title,
  COUNT(ft.id) as segment_count
FROM embedding_queue eq
LEFT JOIN fathom_calls fc ON fc.recording_id = eq.recording_id
LEFT JOIN fathom_transcripts ft ON ft.recording_id = eq.recording_id
WHERE eq.status = 'dead_letter'
GROUP BY eq.recording_id, eq.last_error, eq.attempts, fc.title
ORDER BY eq.recording_id;
```

**Common issues:**
- Recording was deleted → Remove from queue manually
- Transcript segments corrupted → Skip and log for review
- Persistent timeout → May need database optimization

### Problem: Main worker stopped processing

**Check:**
```bash
# Check GitHub Actions secrets
gh secret list

# Verify cron is enabled
gh workflow view embedding-worker.yml

# Check recent failures
gh run list --workflow=embedding-worker.yml --status failure --limit=5
```

**Solution:**
```bash
# Re-add secrets if missing
echo "https://vltmrnjsubfzrgrtdqey.supabase.co" | gh secret set SUPABASE_URL
echo "$SUPABASE_SERVICE_ROLE_KEY" | gh secret set SUPABASE_SERVICE_ROLE_KEY

# Enable workflow
gh workflow enable embedding-worker.yml

# Manual trigger to verify
gh workflow run embedding-worker.yml
```

## Future Improvements

### Potential Enhancements

1. **Adaptive Batch Sizing**
   - Detect large recordings upfront
   - Automatically route to small-batch worker

2. **Priority Queue**
   - Process recent recordings first
   - Age-based prioritization

3. **Parallel Dead Letter Processing**
   - Process multiple dead_letter items concurrently
   - Requires worker coordination

4. **Alerting Integration**
   - Slack/Discord notifications on critical failures
   - Email alerts for dead_letter queue growth

5. **Metrics Dashboard**
   - Real-time queue status
   - Success/failure rates over time
   - Processing time distributions

---

## Quick Reference

### Commands

```bash
# Monitor health
./scripts/monitor-embeddings.sh

# Trigger main worker
gh workflow run embedding-worker.yml

# Trigger retry worker
gh workflow run retry-failed-embeddings.yml

# Force retry specific recording
gh workflow run retry-failed-embeddings.yml -f recording_id=12345 -f force_retry=true

# View workflow runs
gh run list --workflow=embedding-worker.yml --limit=10
gh run list --workflow=retry-failed-embeddings.yml --limit=10

# Watch latest run
gh run watch
```

### Files

- **Main Worker:** `supabase/functions/process-embeddings/index.ts`
- **Retry Worker:** `supabase/functions/retry-failed-embeddings/index.ts`
- **Main Workflow:** `.github/workflows/embedding-worker.yml`
- **Retry Workflow:** `.github/workflows/retry-failed-embeddings.yml`
- **Monitor Script:** `scripts/monitor-embeddings.sh`
- **This Guide:** `docs/embedding-recovery-system.md`

---

**END OF EMBEDDING RECOVERY SYSTEM DOCUMENTATION**
