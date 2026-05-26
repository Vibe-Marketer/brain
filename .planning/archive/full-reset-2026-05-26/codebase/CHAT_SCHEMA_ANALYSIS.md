# CallVault Chat Database Schema Analysis

**Analysis Date:** 2026-02-09
**Focus:** Chat RAG Pipeline, Transcript Chunks, Hybrid Search
**Analyst:** Claude

---

## Executive Summary

The CallVault chat database schema demonstrates a sophisticated approach to RAG (Retrieval-Augmented Generation) with hybrid search capabilities. The system uses a **Bank/Vault architecture** for multi-tenant isolation and implements **Reciprocal Rank Fusion (RRF)** for combining semantic and keyword search. However, several critical issues exist around **data consistency**, **migration fragility**, **index coverage gaps**, and **scalability concerns** that need immediate attention.

**Overall Grade: B (Good foundation, needs improvements)**

---

## 1. Schema Design Analysis

### 1.1 Core Tables

#### `transcript_chunks` - Knowledge Base Foundation

**Location:** Created in `20251125000001_ai_chat_infrastructure.sql`

**Schema:**
```sql
CREATE TABLE public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small
  speaker_name TEXT,
  speaker_email TEXT,
  timestamp_start TEXT,
  timestamp_end TEXT,
  call_date TIMESTAMPTZ,
  call_title TEXT,
  call_category TEXT,
  topics TEXT[] DEFAULT '{}',
  sentiment TEXT,
  entities JSONB DEFAULT '{}',
  intent_signals TEXT[] DEFAULT '{}',
  user_tags TEXT[] DEFAULT '{}',
  fts tsvector GENERATED ALWAYS AS (...),
  source_platform TEXT DEFAULT 'fathom',
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  embedded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recording_id, chunk_index)
);
```

**Strengths:**
- Comprehensive denormalization for fast filtering (call_date, call_title, call_category stored in chunk)
- Proper use of generated tsvector for full-text search with weighted components
- Composite unique constraint on `(recording_id, chunk_index)` ensures idempotent upserts
- Support for rich metadata: topics, sentiment, intent_signals, entities

**Issues Found:**

| Issue | Severity | Description |
|-------|----------|-------------|
| **FK to deprecated table** | **HIGH** | Foreign key references `fathom_calls(recording_id)` but system is migrating to `recordings` table with `legacy_recording_id` |
| **No vault-aware FK** | **HIGH** | Chunks reference recordings only by recording_id, not vault membership - creates data isolation risks |
| **Missing NOT NULL constraints** | MEDIUM | `chunk_text`, `call_date` should be NOT NULL but aren't |
| **TEXT timestamps** | LOW | `timestamp_start` and `timestamp_end` use TEXT instead of INTERVAL or INTEGER (seconds) |

#### `chat_sessions` - Conversation Container

**Location:** `20251125000001_ai_chat_infrastructure.sql`

**Schema:**
```sql
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  description TEXT,
  filter_date_start TIMESTAMPTZ,
  filter_date_end TIMESTAMPTZ,
  filter_speakers TEXT[] DEFAULT '{}',
  filter_categories TEXT[] DEFAULT '{}',
  filter_recording_ids BIGINT[] DEFAULT '{}',
  filter_folder_ids UUID[],  -- Added 2026-01-31
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues Found:**

| Issue | Severity | Description |
|-------|----------|-------------|
| **Missing vault_id** | **HIGH** | Chat sessions don't track which vault they're scoped to - filters use legacy recording_ids |
| **No bank_id reference** | **HIGH** | No explicit bank scoping in chat_sessions table |
| **filter_recording_ids type** | MEDIUM | Uses BIGINT[] for recording_ids but recordings table uses UUID primary keys |
| **No session expiration** | LOW | No TTL or expiration for chat sessions (unlimited retention) |

#### `chat_messages` - UIMessage Storage

**Location:** `20251125000001_ai_chat_infrastructure.sql`

**Schema:**
```sql
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,                    -- Simple text content
  parts JSONB,                     -- UIMessage parts array
  model TEXT,                      -- Model used (gpt-4o, etc.)
  finish_reason TEXT,              -- 'stop', 'length', 'tool-calls'
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Message Parts Storage (UIMessage Format):**
```sql
-- UIMessage parts stored in `parts` column as JSONB
-- Examples:
-- Text: [{"type": "text", "text": "Hello"}]
-- Tool Call: [{"type": "tool-call", "toolCallId": "...", "toolName": "search", "args": {...}}]
-- Tool Result: [{"type": "tool-result", "toolCallId": "...", "toolName": "search", "result": {...}}]
```

**Strengths:**
- Proper implementation of Vercel AI SDK UIMessage format with `parts` JSONB
- Token usage tracking for cost analysis
- Cascading delete ensures message cleanup when session deleted

**Issues Found:**

| Issue | Severity | Description |
|-------|----------|-------------|
| **No message limit** | MEDIUM | No constraints on message count per session - could grow unbounded |
| **content OR parts** | LOW | Both columns nullable - could have messages with neither |
| **No message versioning** | LOW | If message edited, no history preserved |

#### `chat_tool_calls` - Tool Invocation Analytics

**Schema:**
```sql
CREATE TABLE public.chat_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_call_id TEXT NOT NULL,      -- From AI SDK
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Strengths:**
- Comprehensive tracking for debugging and analytics
- Status machine for tool execution lifecycle

---

## 2. RAG Pipeline Database Layer

### 2.1 Hybrid Search Function - RRF Implementation

**Primary Function:** `hybrid_search_transcripts()`
**Files:**
- `20260209082100_fix_hybrid_search_v3.sql` (current)
- `20260209082000_fix_hybrid_search_v2.sql`
- `20260209081900_fix_hybrid_search_transcripts.sql`
- `20260131300001_chat_vault_search_function.sql` (scoped wrapper)

**Current Implementation (v3):**
```sql
CREATE OR REPLACE FUNCTION hybrid_search_transcripts(
    query_text text,
    query_embedding vector,
    match_count integer DEFAULT 10,
    full_text_weight double precision DEFAULT 1.0,
    semantic_weight double precision DEFAULT 1.0,
    rrf_k integer DEFAULT 60,
    filter_user_id uuid DEFAULT NULL,
    filter_date_start timestamptz DEFAULT NULL,
    filter_date_end timestamptz DEFAULT NULL,
    filter_speakers text[] DEFAULT NULL,
    filter_categories text[] DEFAULT NULL,
    filter_recording_ids bigint[] DEFAULT NULL,
    filter_topics text[] DEFAULT NULL,
    filter_sentiment text DEFAULT NULL,
    filter_intent_signals text[] DEFAULT NULL,
    filter_user_tags text[] DEFAULT NULL,
    filter_source_platforms text[] DEFAULT NULL,
    filter_bank_id uuid DEFAULT NULL
)
```

### 2.2 Architecture Review

**RRF Formula Used:**
```sql
rrf_score = (
    (1.0 / (rrf_k + semantic_rank)) * semantic_weight +
    (1.0 / (rrf_k + fts_rank)) * full_text_weight
)
```

Where `rrf_k = 60` (standard value that minimizes rank bias)

**Query Flow:**
1. **Semantic Search CTE** - Vector similarity using `<=>` (cosine distance)
2. **Full-Text Search CTE** - tsvector matching with `ts_rank_cd`
3. **Combined CTE** - FULL OUTER JOIN with RRF scoring
4. **Final SELECT** - Join back to transcript_chunks, order by rrf_score

### 2.3 Critical Issues in Hybrid Search

#### Issue 1: Join Complexity & Performance

**File:** `20260209082100_fix_hybrid_search_v3.sql`

The function performs **3 JOINs per CTE** (6 total):
```sql
FROM transcript_chunks tc
JOIN fathom_calls fc ON tc.recording_id = fc.recording_id
LEFT JOIN recordings r ON r.legacy_recording_id = fc.recording_id
```

**Impact:** With 100k+ chunks per user, each search executes complex joins

**Recommendation:** 
- Denormalize `bank_id` and `source_platform` into `transcript_chunks`
- Create materialized view for frequently accessed chunk + call data

#### Issue 2: Array Overlap Operator (&&) Performance

**Current filters using array overlap:**
```sql
AND (filter_topics IS NULL OR tc.topics && filter_topics)
AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
AND (filter_user_tags IS NULL OR tc.user_tags && filter_user_tags)
```

**Problem:** The `&&` operator with GIN indexes can be slow with large arrays and high cardinality data.

**Evidence:** No dedicated indexes for combined array filters.

#### Issue 3: Limit Clause Inconsistency

**Version Confusion:**
- Original: `LIMIT LEAST(match_count * 3, 100)`
- V3: `LIMIT match_count * 2`

This means v3 returns fewer candidates for RRF, potentially reducing result quality.

### 2.4 pgvector Configuration

**HNSW Index (Good):**
```sql
CREATE INDEX idx_transcript_chunks_embedding
  ON transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Settings Analysis:**
- `m = 16` - Number of bi-directional links (default: 16) ✓
- `ef_construction = 64` - Size of dynamic candidate list (default: 64) ✓
- Missing: `ef_search` setting for query-time accuracy/speed tradeoff

**Dimension Match:**
- Chunks: `vector(1536)` ✓
- Embeddings: text-embedding-3-small (1536 dimensions) ✓

### 2.5 Full-Text Search Configuration

**Generated tsvector:**
```sql
fts tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(chunk_text, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(speaker_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(call_title, '')), 'C')
) STORED
```

**Weights:**
- A (1.0): chunk_text - Highest priority
- B (0.4): speaker_name - Medium priority  
- C (0.2): call_title - Lower priority

**Index:**
```sql
CREATE INDEX idx_transcript_chunks_fts ON transcript_chunks USING gin(fts);
```

**Issues:**
1. Only English language support (`'english'`)
2. No support for phrase queries (plainto_tsquery vs websearch_to_tsquery inconsistency)
3. Inconsistent: Original uses `websearch_to_tsquery`, v3 uses `plainto_tsquery`

---

## 3. RLS Policies Security Review

### 3.1 Policy Overview

**Tables with RLS Enabled:**
- `transcript_chunks` ✓
- `chat_sessions` ✓
- `chat_messages` ✓
- `chat_tool_calls` ✓
- `embedding_jobs` ✓

### 3.2 Current RLS Policies (Basic)

```sql
-- transcript_chunks: User owns their data
CREATE POLICY "Users can read own chunks"
  ON transcript_chunks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- chat_sessions: User owns their sessions  
CREATE POLICY "Users can read own sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- chat_messages: User owns their messages
CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### 3.3 Security Vulnerabilities

#### Vulnerability 1: Chat Session Filter Bypass

**Risk:** HIGH

**Location:** `chat_sessions.filter_recording_ids`

**Issue:** A user can set `filter_recording_ids` to ANY recording IDs, including recordings they don't own. The application layer is expected to validate this, but there's no database-level constraint.

**Exploit Scenario:**
```sql
-- Attacker creates session with victim's recording_ids
UPDATE chat_sessions 
SET filter_recording_ids = ARRAY[12345, 12346]  -- victim's recordings
WHERE id = 'attacker-session-id';
```

**Mitigation Needed:**
```sql
-- Add trigger to validate recording ownership
CREATE OR REPLACE FUNCTION validate_session_filters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.filter_recording_ids IS NOT NULL AND array_length(NEW.filter_recording_ids, 1) > 0 THEN
    -- Verify all recording_ids belong to user
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.filter_recording_ids) AS rid
      LEFT JOIN fathom_calls fc ON fc.recording_id = rid AND fc.user_id = NEW.user_id
      WHERE fc.recording_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid recording_ids in filter: user does not own all recordings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Vulnerability 2: Cross-Bank Data Access via Search

**Risk:** HIGH

**Location:** `hybrid_search_transcripts_scoped()`

**Issue:** The scoped search function properly filters by vault membership, BUT the underlying `hybrid_search_transcripts()` function can be called directly if not properly restricted.

**Evidence:**
```sql
-- In hybrid_search_transcripts_scoped:
-- When no vault/bank specified, falls back to unscoped search
IF filter_vault_id IS NULL AND filter_bank_id IS NULL THEN
  -- Calls hybrid_search_transcripts directly - returns all user's chunks
```

**Attack Vector:**
1. User belongs to Bank A and Bank B
2. User calls `hybrid_search_transcripts()` directly (not the scoped version)
3. Gets results from ALL their chunks across ALL banks

**Mitigation:**
- Make `hybrid_search_transcripts()` SECURITY DEFINER with explicit bank checks
- Or revoke direct access, force use of scoped function only

#### Vulnerability 3: Tool Call Injection

**Risk:** MEDIUM

**Location:** `chat_tool_calls.tool_input`

**Issue:** `tool_input` JSONB is inserted without validation. Malicious JSON could exploit edge cases in tool execution.

**Current RLS:**
```sql
CREATE POLICY "Users can insert own tool calls"
  ON chat_tool_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**Problem:** User can insert tool calls with ANY tool_name and tool_input, potentially spoofing tool execution history.

---

## 4. Data Integrity Analysis

### 4.1 Foreign Key Constraints

**Current FKs on transcript_chunks:**
```sql
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL
```

**Issues:**

| Constraint | Issue | Impact |
|------------|-------|--------|
| `recording_id -> fathom_calls` | References deprecated table | Migration fragility |
| `NO composite FK` | `transcript_chunks` has no reference to `recordings` table | Data inconsistency risk |
| `NO vault FK` | No direct link to vault membership | Access control bypass risk |

### 4.2 Orphaned Data Risks

#### Risk 1: Chunks Without Recordings

**Scenario:**
1. Recording deleted from `fathom_calls`
2. CASCADE deletes chunks ✓
3. BUT if using new `recordings` table, chunks reference `fathom_calls` still
4. Chunks become orphaned or point to wrong data

#### Risk 2: Sessions With Invalid Recording Filters

```sql
-- No FK constraint on filter_recording_ids array
filter_recording_ids BIGINT[] DEFAULT '{}'
```

**Orphan Scenario:**
1. User creates session with recording_ids [1, 2, 3]
2. Recordings 1 and 2 are deleted
3. Session still references deleted recordings
4. Search returns empty results with no error

#### Risk 3: Chat Messages Without Valid Session

**Current:** `ON DELETE CASCADE` on session_id
**Safe:** Messages auto-deleted when session deleted ✓

**Missing:** No constraint preventing messages with non-existent session_id on INSERT

### 4.3 Cascading Delete Analysis

| Table | Cascade Behavior | Risk Level |
|-------|-----------------|------------|
| `transcript_chunks` | CASCADE on user_id, recording_id | MEDIUM |
| `chat_sessions` | CASCADE on user_id | LOW |
| `chat_messages` | CASCADE on session_id, user_id | LOW |
| `chat_tool_calls` | CASCADE on message_id, session_id, user_id | LOW |
| `embedding_jobs` | CASCADE on user_id | LOW |

**Concern:** When `fathom_calls` recording deleted:
- Chunks deleted ✓
- But if user has sessions with that recording_id in filter_recording_ids, no cleanup

---

## 5. Migration Quality Assessment

### 5.1 Migration History Analysis

**Chat-Related Migrations:**
| File | Date | Purpose |
|------|------|---------|
| `20251125000001_ai_chat_infrastructure.sql` | 2025-11-25 | Initial schema |
| `20260108000004_enhance_chat_tools_metadata_filters.sql` | 2026-01-08 | Add metadata filters |
| `20260131000002_add_folder_filter_to_chat_sessions.sql` | 2026-01-31 | Add folder filters |
| `20260131300001_chat_vault_search_function.sql` | 2026-02-09 | Vault-scoped search |
| `20260209081900_fix_hybrid_search_transcripts.sql` | 2026-02-09 | Bug fixes |
| `20260209082000_fix_hybrid_search_v2.sql` | 2026-02-09 | Column fixes |
| `20260209082100_fix_hybrid_search_v3.sql` | 2026-02-09 | Type casts |

### 5.2 Migration Issues

#### Issue 1: Multiple Fix Migrations (Code Smell)

**Pattern:** 3 fix migrations in 2 days (Feb 9):
- `fix_hybrid_search_transcripts.sql`
- `fix_hybrid_search_v2.sql`  
- `fix_hybrid_search_v3.sql`

**Problems:**
1. Indicates insufficient testing before deployment
2. Migration files don't specify DOWN/rollback procedures
3. Creates confusion about which version is authoritative

#### Issue 2: No Rollback Procedures

**Example:** All migrations use `CREATE OR REPLACE` without rollback:
```sql
-- Good for idempotency, but no DOWN migration provided
DROP FUNCTION IF EXISTS hybrid_search_transcripts(...);
CREATE OR REPLACE FUNCTION hybrid_search_transcripts(...)
```

**Missing:**
```sql
-- Down migration (not present)
DROP FUNCTION IF EXISTS hybrid_search_transcripts(...);
CREATE OR REPLACE FUNCTION hybrid_search_transcripts(...) -- previous version
```

#### Issue 3: Destructive Migrations Without Backups

**File:** `20260209082100_fix_hybrid_search_v3.sql`
```sql
DROP FUNCTION IF EXISTS hybrid_search_transcripts(text, vector, integer, ...);
```

**Risk:** If migration fails partway through, function is dropped but new version may not be created successfully.

**Better Pattern:**
```sql
-- Use transaction-safe approach
BEGIN;
  CREATE OR REPLACE FUNCTION hybrid_search_transcripts_new(...);
  -- Test new function
  -- If success: DROP old, RENAME new
  -- If fail: ROLLBACK
COMMIT;
```

#### Issue 4: Data Migration Gap

**Issue:** transcript_chunks still reference `fathom_calls` but system is migrating to `recordings` table.

**No Migration For:**
- Updating transcript_chunks.recording_id to reference recordings.legacy_recording_id consistently
- Adding recordings.id reference to transcript_chunks
- Syncing source_platform between fathom_calls and transcript_chunks

---

## 6. Scalability Analysis

### 6.1 Query Performance Projections

#### Scenario: User with 100k Transcript Chunks

**Hybrid Search Performance:**

| Component | Estimated Time | Notes |
|-----------|---------------|-------|
| Semantic CTE | 50-150ms | HNSW index, ef_search ~100 |
| Full-Text CTE | 30-100ms | GIN index on tsvector |
| Combined CTE | 10-30ms | In-memory join |
| Final Join | 20-50ms | Join back to chunks |
| **Total** | **110-330ms** | Acceptable for interactive |

**Issues at Scale:**

1. **Array Filter Performance**
   ```sql
   AND (filter_topics IS NULL OR tc.topics && filter_topics)
   ```
   With 100k chunks and complex topic arrays, this could add 100-500ms

2. **Join Overhead**
   ```sql
   JOIN fathom_calls fc ON tc.recording_id = fc.recording_id
   LEFT JOIN recordings r ON r.legacy_recording_id = fc.recording_id
   ```
   Double join on every search will degrade with table growth

3. **No Query Result Caching**
   - Identical searches within session re-execute full pipeline
   - No materialized view for common filter combinations

### 6.2 Index Coverage Analysis

**Current Indexes on transcript_chunks:**

| Index | Type | Purpose | Assessment |
|-------|------|---------|------------|
| `idx_transcript_chunks_user_id` | B-tree | User filtering | ✓ Good |
| `idx_transcript_chunks_recording_id` | B-tree | Recording lookup | ✓ Good |
| `idx_transcript_chunks_call_date` | B-tree | Date filtering | ✓ Good |
| `idx_transcript_chunks_speaker` | B-tree | Speaker lookup | ✓ Good |
| `idx_transcript_chunks_category` | B-tree | Category filtering | ⚠️ Medium cardinality |
| `idx_transcript_chunks_embedding` | HNSW | Vector search | ✓ Good (m=16, ef_construction=64) |
| `idx_transcript_chunks_fts` | GIN | Full-text search | ✓ Good |
| `idx_transcript_chunks_topics` | GIN | Array overlap | ⚠️ Could be large |
| `idx_transcript_chunks_user_tags` | GIN | Array overlap | ⚠️ Could be large |
| `idx_transcript_chunks_intent_signals` | GIN | Array overlap | ✓ Small cardinality |
| `idx_transcript_chunks_source_platform` | B-tree | Platform filter | ✓ Small cardinality |

**Missing Indexes:**

| Missing Index | Impact | Recommendation |
|---------------|--------|----------------|
| Composite (user_id, call_date) | HIGH | Most queries filter by both |
| Partial (user_id) WHERE embedding IS NOT NULL | MEDIUM | Skip unembedded chunks |
| Composite (user_id, recording_id, chunk_index) | MEDIUM | Optimize chunk lookup |

### 6.3 Connection Pooling Considerations

**Supabase Default Pool Size:** 10-30 connections (depends on plan)

**Chat Query Characteristics:**
- Hybrid search: 110-330ms per query
- Message loading: 10-50ms per query  
- Concurrent chat users per session: 1 (typically)

**Connection Math:**
```
Concurrent Users = 100
Avg Query Time = 200ms
Queries per User per Second = 0.2 (chat is low-frequency)
Connections Needed = 100 * 0.2 * 0.2 = 4 connections
```

**Verdict:** Connection pooling unlikely to be a bottleneck for chat.

### 6.4 Storage Growth Projections

**transcript_chunks Storage:**

| Component | Size/Row | Notes |
|-----------|----------|-------|
| Base row | ~200 bytes | IDs, timestamps, metadata |
| chunk_text | Variable | Avg 500 chars = 500 bytes |
| embedding | 6,144 bytes | 1536 dimensions * 4 bytes |
| fts vector | ~200 bytes | Depends on text length |
| **Total Avg** | **~7KB/row** | |

**At 100k chunks per user:**
- 100,000 * 7KB = 700MB per user
- 1,000 users = 700GB
- 10,000 users = 7TB

**HNSW Index Overhead:**
- HNSW indexes typically add 50-100% overhead
- 7TB * 1.5 = 10.5TB with indexes

**Conclusion:** Storage will become significant cost factor at scale. Consider:
- Embedding compression (quantization to 768 dims)
- Chunk archival after 1 year
- Separate cold storage for old chunks

---

## 7. Specific Recommendations

### 7.1 Critical (Fix Immediately)

#### 1. Fix Recording Reference Migration
```sql
-- Add recordings_id column to transcript_chunks
ALTER TABLE transcript_chunks 
ADD COLUMN recordings_id UUID REFERENCES recordings(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_transcript_chunks_recordings_id ON transcript_chunks(recordings_id);

-- Migrate data
UPDATE transcript_chunks tc
SET recordings_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = tc.recording_id;

-- Make NOT NULL after migration
ALTER TABLE transcript_chunks ALTER COLUMN recordings_id SET NOT NULL;
```

#### 2. Add Session Filter Validation Trigger
```sql
CREATE OR REPLACE FUNCTION validate_session_recording_filters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.filter_recording_ids IS NOT NULL AND array_length(NEW.filter_recording_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.filter_recording_ids) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM vault_entries ve
        JOIN recordings rec ON rec.id = ve.recording_id
        WHERE rec.legacy_recording_id = rid
        AND EXISTS (
          SELECT 1 FROM vault_memberships vm
          WHERE vm.vault_id = ve.vault_id
          AND vm.user_id = NEW.user_id
        )
      )
    ) THEN
      RAISE EXCEPTION 'User does not have access to all recordings in filter';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_session_filters_trigger
  BEFORE INSERT OR UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_session_recording_filters();
```

#### 3. Restrict Hybrid Search Access
```sql
-- Revoke direct access to unscoped function
REVOKE EXECUTE ON FUNCTION hybrid_search_transcripts FROM authenticated;

-- Only allow scoped function
GRANT EXECUTE ON FUNCTION hybrid_search_transcripts_scoped TO authenticated;
```

### 7.2 High Priority (Fix This Sprint)

#### 4. Add Composite Indexes
```sql
-- Most common query pattern
CREATE INDEX idx_chunks_user_date 
ON transcript_chunks(user_id, call_date DESC);

-- Optimize filtered vector search
CREATE INDEX idx_chunks_user_embedded 
ON transcript_chunks(user_id) 
WHERE embedding IS NOT NULL;

-- Optimize recording lookup
CREATE INDEX idx_chunks_user_recording_index 
ON transcript_chunks(user_id, recording_id, chunk_index);
```

#### 5. Add Missing NOT NULL Constraints
```sql
ALTER TABLE transcript_chunks 
  ALTER COLUMN chunk_text SET NOT NULL,
  ALTER COLUMN call_date SET NOT NULL;

ALTER TABLE chat_messages
  ADD CONSTRAINT check_content_or_parts 
  CHECK (content IS NOT NULL OR parts IS NOT NULL);
```

#### 6. Add Vault Context to Chat Sessions
```sql
ALTER TABLE chat_sessions
ADD COLUMN vault_id UUID REFERENCES vaults(id),
ADD COLUMN bank_id UUID REFERENCES banks(id);

CREATE INDEX idx_chat_sessions_vault ON chat_sessions(vault_id);
CREATE INDEX idx_chat_sessions_bank ON chat_sessions(bank_id);
```

### 7.3 Medium Priority (Next Quarter)

#### 7. Implement Query Result Caching
```sql
-- Materialized view for common filter combinations
CREATE MATERIALIZED VIEW chat_search_cache AS
SELECT 
  user_id,
  call_date::date as date_bucket,
  call_category,
  source_platform,
  COUNT(*) as chunk_count
FROM transcript_chunks
GROUP BY user_id, call_date::date, call_category, source_platform;

-- Refresh strategy: Incremental or scheduled
CREATE INDEX idx_search_cache_user ON chat_search_cache(user_id, date_bucket);
```

#### 8. Add Search Performance Monitoring
```sql
-- Table to track search performance
CREATE TABLE search_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query_text TEXT,
  filters_used JSONB,
  execution_time_ms INTEGER,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analysis
CREATE INDEX idx_search_perf_user_time 
ON search_performance_log(user_id, created_at);
```

#### 9. Archive Old Chunks
```sql
-- Move chunks older than 1 year to archive table
CREATE TABLE transcript_chunks_archive (LIKE transcript_chunks INCLUDING ALL);

-- Function to archive old data
CREATE OR REPLACE FUNCTION archive_old_chunks()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  INSERT INTO transcript_chunks_archive
  SELECT * FROM transcript_chunks
  WHERE call_date < NOW() - INTERVAL '1 year';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  DELETE FROM transcript_chunks
  WHERE call_date < NOW() - INTERVAL '1 year';
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Conclusion

The CallVault chat database schema shows sophisticated understanding of RAG patterns with hybrid search, but has accumulated technical debt through rapid iteration. The three fix migrations in two days indicate testing gaps.

**Priority Actions:**
1. **Fix the recording reference migration** - Currently using deprecated table
2. **Add RLS validation triggers** - Prevent filter bypass attacks  
3. **Restrict search function access** - Force use of vault-scoped function
4. **Add composite indexes** - Optimize common query patterns

**Long-term:**
- Plan embedding compression strategy for storage costs
- Implement query result caching for performance
- Create data archival policy for old chunks

The schema is production-viable with the recommended fixes implemented.

---

*Analysis completed: 2026-02-09*
*Files analyzed: 15+ migration files*
*Tables reviewed: transcript_chunks, chat_sessions, chat_messages, chat_tool_calls, hybrid_search functions*
