# Hybrid RAG Implementation Plan for Conversion Brain Meeting Transcripts

**Created:** 2025-11-25
**Source:** AI Automators research + Current codebase analysis
**Goal:** Optimize RAG for 2-10 person meeting transcripts with practical hybrid approach

---

## Executive Summary

Your RAG system has **excellent infrastructure** but **underutilized metadata**. The quickest wins are:

1. **Populate existing metadata fields** (topics, sentiment, entities, intent) - HUGE impact, medium effort
2. **Add 20% chunk overlap** - Small change, prevents context splitting
3. **Implement re-ranking** - Dramatic accuracy improvement
4. **Fix token counting** - Use tiktoken instead of 4-char heuristic

**Current State:** Hybrid search (vector + full-text + RRF) ✅, but metadata fields are NULL ❌

---

## AI Automators Top 10 Videos (Learning Path)

### Must-Watch (Start Here)
1. **[n8n RAG Masterclass - 2h 21m](https://www.youtube.com/watch?v=75lwkzFxyLs)** - Complete foundation
2. **[This Hybrid RAG Trick - 30m](https://www.youtube.com/watch?v=2-6ckhW3Hmo)** - Dense + sparse fusion
3. **[Contextual Retrieval & Late Chunking - 25m](https://www.youtube.com/watch?v=61dvzowuIlA)** - Advanced chunking

### Deep Dives
4. **[GraphRAG - 35m](https://www.youtube.com/watch?v=EUG65dIY-2k)** - Graph-based retrieval
5. **[Metadata-Enhanced RAG - 23m](https://www.youtube.com/watch?v=WcdBSOigrT8)** - Exact use case
6. **[Context Expansion - 34m](https://www.youtube.com/watch?v=y72TrpffdSk)** - Better retrieval

### Advanced
7. **[Hybrid Search Engine - 28m](https://www.youtube.com/watch?v=FgUJ2kzhmKQ)** - Engine architecture
8. **[RAG + DeepEval - 29m](https://www.youtube.com/watch?v=eNkEA7Lqm_s)** - Testing & evaluation
9. **[800+ Hours Condensed - 42m](https://www.youtube.com/watch?v=HAFqyN7RExc)** - Design patterns
10. **[Import Everything - 31m](https://www.youtube.com/watch?v=eHw_6jhK8AM)** - Document parsing

**Total:** ~8h 20m of expert training (all from Daniel & Alan Walsh - AI Automators)

---

## Current Implementation Analysis

### What's Working ✅
- **Hybrid search:** Vector (pgvector) + Full-text (tsvector) + RRF fusion
- **Proper indexes:** HNSW for vectors, GIN for full-text
- **Metadata schema:** Fields defined for topics, sentiment, entities, intent
- **Speaker-aware chunking:** Preserves speaker names in chunks
- **Vercel AI SDK:** Streaming chat with tool calling

### Critical Gaps ❌
1. **Metadata fields are EMPTY** - topics, sentiment, entities, intent_signals all NULL
2. **No chunk overlap** - Hard 500-token boundaries, risks splitting context
3. **No re-ranking** - RRF fusion → LLM directly (no refinement)
4. **Inaccurate token counting** - Uses 4 chars/token heuristic (should be 2-6)
5. **No conversation structure** - Doesn't capture Q&A pairs or topic boundaries

### Schema Details (from `20251125000001_ai_chat_infrastructure.sql`)

**`transcript_chunks` table:**
```sql
-- POPULATED FIELDS:
chunk_text TEXT                -- ✅ The transcript chunk
chunk_index INTEGER            -- ✅ Order in recording
embedding vector(1536)         -- ✅ OpenAI text-embedding-3-small
fts tsvector                   -- ✅ Full-text search (generated)
speaker_name TEXT              -- ✅ Primary speaker
speaker_email TEXT             -- ✅ Speaker identifier
timestamp_start NUMERIC        -- ✅ Start time in seconds
timestamp_end NUMERIC          -- ✅ End time in seconds
call_date DATE                 -- ✅ Call date (denormalized)
call_title TEXT                -- ✅ Call title (denormalized)
call_category TEXT             -- ✅ Call category (denormalized)

-- EMPTY FIELDS (SCHEMA DEFINED BUT NOT POPULATED):
topics TEXT[]                  -- ❌ Auto-extracted topics
sentiment TEXT                 -- ❌ positive, negative, neutral, mixed
entities JSONB                 -- ❌ {companies: [], people: [], products: []}
intent_signals TEXT[]          -- ❌ buying_signal, objection, question, concern
user_tags TEXT[]               -- ❌ User-defined tags

-- INDEXES EXIST BUT UNDERUTILIZED:
CREATE INDEX idx_transcript_chunks_topics ON transcript_chunks USING GIN (topics);
CREATE INDEX idx_transcript_chunks_intent ON transcript_chunks USING GIN (intent_signals);
```

**Hybrid search function:**
```sql
hybrid_search_transcripts(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 10,
  semantic_weight NUMERIC DEFAULT 1.0,
  full_text_weight NUMERIC DEFAULT 1.0,
  rrf_k INTEGER DEFAULT 60,
  -- Filters:
  filter_user_id UUID,
  filter_date_start DATE,
  filter_date_end DATE,
  filter_speakers TEXT[],
  filter_categories TEXT[],
  filter_recording_ids INTEGER[]
)
```

---

## Recommended Approach for Meeting Transcripts

### Chunk Size for Conversations
**Recommendation: 5-7 conversation turns or 200-400 tokens with 20-30% overlap**

**Rationale:**
- Conversations have natural turn-taking boundaries
- Preserves Q&A context (question + answer together)
- Overlap ensures related context isn't split
- Smaller than documents (500-1000 tokens) due to conversational nature

**Current:** 500 tokens, no overlap ❌
**Target:** 300-400 tokens, 100-token overlap ✅

### Metadata Strategy for Your Use Case

#### Priority 1: Topics (populate `topics` field)
**Extract:** 1-5 topics per chunk
**Method:** GPT-4o-mini with structured output
**Use case:** "Find all chunks about pricing"

```typescript
// Example output
topics: ["pricing", "enterprise_features", "onboarding"]
```

#### Priority 2: Intent Signals (populate `intent_signals` field)
**Extract:** Conversation intent markers
**Method:** Pattern matching + LLM classification
**Use case:** "Find buying signals" or "Find objections"

```typescript
// Example output
intent_signals: ["buying_signal", "pricing_question"]
```

#### Priority 3: Sentiment (populate `sentiment` field)
**Extract:** Speaker emotion
**Method:** Simple sentiment classifier
**Use case:** Filter positive testimonials vs. negative feedback

```typescript
// Example output
sentiment: "positive" | "negative" | "neutral" | "mixed"
```

#### Priority 4: Named Entities (populate `entities` field)
**Extract:** Companies, people, products mentioned
**Method:** spaCy or Hugging Face NER
**Use case:** "All mentions of Stripe" or "Conversations with John"

```jsonc
// Example output
{
  "companies": ["Acme Corp", "CompetitorX"],
  "people": ["John Smith"],
  "products": ["Enterprise Plan", "API v2"],
  "technologies": ["Stripe", "AWS"]
}
```

#### Optional (Future): Additional Fields
```sql
ALTER TABLE transcript_chunks ADD COLUMN:
- speaker_role TEXT                -- 'host', 'customer', 'prospect'
- conversation_turn_index INT      -- Position in conversation
- is_question BOOLEAN               -- Contains question?
- is_action_item BOOLEAN            -- Contains actionable item?
- chunk_type TEXT                   -- 'question', 'answer', 'objection', 'decision'
```

---

## Implementation Plan (4-Week Roadmap)

### Week 1: Quick Wins

#### Task 1.1: Fix Token Counting (2 hours)
```typescript
// Current (embed-chunks/index.ts)
const estimatedTokens = chunk.length / 4; // ❌ Inaccurate

// New
import { encoding_for_model } from 'tiktoken';
const enc = encoding_for_model('gpt-4o');
const tokens = enc.encode(chunk);
const tokenCount = tokens.length; // ✅ Accurate
```

**File:** `supabase/functions/embed-chunks/index.ts`
**Impact:** Accurate chunking, prevents token overflow
**Effort:** 2 hours

#### Task 1.2: Add Chunk Overlap (3 hours)
```typescript
// Current: Hard boundaries
chunks = chunkAtBoundaries(segments, 500);

// New: 20% overlap
const CHUNK_TOKENS = 400;
const OVERLAP_TOKENS = 100;

function chunksWithOverlap(segments, maxTokens = 400, overlap = 100) {
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;
  let overlapSegments = [];

  for (const segment of segments) {
    // ... chunking logic with overlap
  }

  return chunks;
}
```

**File:** `supabase/functions/embed-chunks/index.ts`
**Impact:** Prevents context splitting, improves retrieval continuity
**Effort:** 3 hours

#### Task 1.3: Expose Metadata Filters (2 hours)
```sql
-- Add to hybrid_search_transcripts function
filter_topics TEXT[],
filter_sentiment TEXT,
filter_intent TEXT[]

-- Filter logic (only if fields are populated)
AND (filter_topics IS NULL OR topics && filter_topics)
AND (filter_sentiment IS NULL OR sentiment = filter_sentiment)
AND (filter_intent IS NULL OR intent_signals && filter_intent)
```

**File:** `supabase/migrations/[new]_add_metadata_filters.sql`
**Impact:** Enable filtered searches once metadata is populated
**Effort:** 2 hours

**Week 1 Total:** 7 hours

---

### Week 2: Metadata Extraction Infrastructure

#### Task 2.1: Create Metadata Extraction Edge Function (8 hours)

Create `supabase/functions/enrich-chunk-metadata/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Metadata schema
const ChunkMetadataSchema = z.object({
  topics: z.array(z.string()).min(1).max(5),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  intent_signals: z.array(z.enum([
    'buying_signal',
    'objection',
    'question',
    'feature_request',
    'concern',
    'testimonial',
    'decision'
  ])),
  entities: z.object({
    companies: z.array(z.string()),
    people: z.array(z.string()),
    products: z.array(z.string()),
    technologies: z.array(z.string())
  })
});

serve(async (req) => {
  const { chunk_ids } = await req.json();

  // Fetch chunks
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, speaker_name')
    .in('id', chunk_ids);

  // Extract metadata for each chunk (batch)
  const enrichedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const metadata = await extractMetadata(chunk.chunk_text);
      return { chunk_id: chunk.id, metadata };
    })
  );

  // Update database
  for (const { chunk_id, metadata } of enrichedChunks) {
    await supabase
      .from('transcript_chunks')
      .update({
        topics: metadata.topics,
        sentiment: metadata.sentiment,
        intent_signals: metadata.intent_signals,
        entities: metadata.entities
      })
      .eq('id', chunk_id);
  }

  return new Response(JSON.stringify({ success: true }));
});

async function extractMetadata(chunkText: string) {
  const prompt = `Analyze this meeting excerpt and extract structured metadata:

${chunkText}

Extract:
1. **Topics** (1-5 main topics): e.g., ["pricing", "feature_request"]
2. **Sentiment** (positive, negative, neutral, mixed)
3. **Intent signals**: buying_signal, objection, question, concern, etc.
4. **Entities**: {companies: [], people: [], products: [], technologies: []}

Return JSON matching this schema.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_schema', json_schema: ChunkMetadataSchema }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Impact:** Populates all metadata fields
**Effort:** 8 hours (includes testing)

#### Task 2.2: Backfill Existing Chunks (4 hours)

Create migration to backfill metadata for existing chunks:

```sql
-- Create batch processing job
CREATE OR REPLACE FUNCTION backfill_chunk_metadata()
RETURNS void AS $$
DECLARE
  chunk_batch UUID[];
  batch_size INT := 100;
BEGIN
  -- Process in batches
  FOR chunk_batch IN
    SELECT array_agg(id)
    FROM transcript_chunks
    WHERE topics IS NULL  -- Not yet enriched
    GROUP BY (row_number() OVER ()) / batch_size
  LOOP
    -- Call Edge Function to enrich batch
    PERFORM net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/enrich-chunk-metadata',
      headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY'),
      body := jsonb_build_object('chunk_ids', chunk_batch)
    );

    -- Rate limiting (avoid OpenAI limits)
    PERFORM pg_sleep(1);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute backfill
SELECT backfill_chunk_metadata();
```

**Impact:** Enriches all existing chunks
**Effort:** 4 hours (monitoring + debugging)

#### Task 2.3: Integrate into Embed Pipeline (2 hours)

Update `embed-chunks/index.ts` to call metadata enrichment:

```typescript
// After embedding chunks
const chunkIds = insertedChunks.map(c => c.id);

// Enrich metadata asynchronously
await supabase.functions.invoke('enrich-chunk-metadata', {
  body: { chunk_ids: chunkIds }
});
```

**Impact:** All future chunks auto-enriched
**Effort:** 2 hours

**Week 2 Total:** 14 hours

---

### Week 3: Retrieval Enhancements

#### Task 3.1: Add Cross-Encoder Re-Ranking (6 hours)

Create `supabase/functions/rerank-results/index.ts`:

```typescript
import { HfInference } from 'https://esm.sh/@huggingface/inference@2';

const hf = new HfInference(Deno.env.get('HUGGINGFACE_API_KEY'));

serve(async (req) => {
  const { query, chunks } = await req.json();

  // Re-rank using cross-encoder
  const scores = await Promise.all(
    chunks.map(async (chunk) => {
      const result = await hf.featureExtraction({
        model: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
        inputs: {
          source_sentence: query,
          sentences: [chunk.chunk_text]
        }
      });

      return {
        ...chunk,
        rerank_score: result[0]
      };
    })
  );

  // Sort by rerank score
  return scores.sort((a, b) => b.rerank_score - a.rerank_score);
});
```

**Impact:** Dramatically improves top-5 accuracy
**Effort:** 6 hours

#### Task 3.2: Diversity Filtering (3 hours)

Prevent redundant chunks from same call:

```typescript
function diversityFilter(chunks, options = {}) {
  const { maxPerRecording = 2, minSemanticDistance = 0.3 } = options;

  const diverse = [];
  const recordingCounts = new Map();

  for (const chunk of chunks) {
    const recordingCount = recordingCounts.get(chunk.recording_id) || 0;

    // Skip if too many from same recording
    if (recordingCount >= maxPerRecording) continue;

    // Check semantic distance from already-selected chunks
    const tooSimilar = diverse.some(selected =>
      cosineSimilarity(chunk.embedding, selected.embedding) > (1 - minSemanticDistance)
    );

    if (!tooSimilar) {
      diverse.push(chunk);
      recordingCounts.set(chunk.recording_id, recordingCount + 1);
    }
  }

  return diverse;
}
```

**Impact:** More diverse, informative results
**Effort:** 3 hours

#### Task 3.3: Query Understanding (5 hours)

Analyze query before retrieval:

```typescript
async function analyzeQuery(query: string) {
  const analysis = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Analyze this query and extract search parameters.'
    }, {
      role: 'user',
      content: query
    }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        intent: 'factual' | 'analytical' | 'exploratory',
        topics: string[],
        entities: string[],
        sentiment_filter: 'positive' | 'negative' | null,
        temporal: 'recent' | 'all_time'
      }
    }
  });

  // Use analysis to boost retrieval
  return JSON.parse(analysis.choices[0].message.content);
}
```

**Impact:** Smarter retrieval strategy
**Effort:** 5 hours

**Week 3 Total:** 14 hours

---

### Week 4: Advanced Features

#### Task 4.1: Named Entity Recognition (8 hours)

Add spaCy for entity extraction:

```python
# Deno doesn't support spaCy natively, use Python subprocess or API
import spacy

nlp = spacy.load("en_core_web_sm")

def extract_entities(text: str):
    doc = nlp(text)
    return {
        "people": [ent.text for ent in doc.ents if ent.label_ == "PERSON"],
        "companies": [ent.text for ent in doc.ents if ent.label_ == "ORG"],
        "products": [ent.text for ent in doc.ents if ent.label_ == "PRODUCT"],
        "locations": [ent.text for ent in doc.ents if ent.label_ == "GPE"],
        "technologies": []  # Custom extraction
    }
```

**Alternative:** Use Hugging Face Inference API (zero-setup)

**Impact:** Entity-based search
**Effort:** 8 hours

#### Task 4.2: Conversation Structure Detection (6 hours)

Detect Q&A pairs and topic boundaries:

```typescript
function detectConversationStructure(segments) {
  const turns = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Detect questions
    const isQuestion = /\?$/.test(segment.text) ||
                       /^(what|how|why|when|where|who|can|could|would|should)/i.test(segment.text);

    // Look ahead for answer
    const nextSegment = segments[i + 1];
    const isAnswer = nextSegment && nextSegment.speaker !== segment.speaker;

    turns.push({
      ...segment,
      turn_type: isQuestion ? 'question' : (isAnswer ? 'answer' : 'statement'),
      references_previous: isAnswer
    });
  }

  return turns;
}
```

**Impact:** Better Q&A retrieval
**Effort:** 6 hours

**Week 4 Total:** 14 hours

---

## Cost Analysis

### One-Time Costs (Metadata Extraction)

**Backfill existing chunks:**
- Assumption: 1,000 calls × 10 chunks = 10,000 chunks
- GPT-4o-mini: 10,000 chunks × 500 tokens = 5M tokens
- Cost: $0.15/1M input tokens = **$0.75**

**Ongoing costs per 100 new calls:**
- 100 calls × 10 chunks = 1,000 chunks
- GPT-4o-mini: 1,000 chunks × 500 tokens = 500K tokens
- Cost: **$0.075 per 100 calls**

### Re-Ranking Costs

**Cross-encoder (Hugging Face Inference API):**
- Free tier: 1,000 requests/month
- Paid: $0.00006 per request
- Cost: 100 queries × 20 chunks = **$0.12 per 100 queries**

**Alternative:** Self-hosted cross-encoder (free, requires compute)

### Total Incremental Cost

**Initial:** $0.75 (one-time backfill)
**Ongoing:** ~$0.15 per 100 calls + 100 queries (negligible)

---

## Testing & Validation

### Retrieval Quality Metrics

**Before enhancements:**
- Baseline MRR (Mean Reciprocal Rank)
- Baseline Precision@5
- User satisfaction (thumbs up/down)

**After each enhancement:**
- Track MRR improvement
- Track Precision@5 improvement
- Monitor user feedback

### Test Queries

Create test set of 20-30 queries:
- "What pricing objections did customers mention?"
- "Find positive feedback about onboarding"
- "What questions did John ask about integrations?"
- "Find all buying signals from last month"
- "What did the customer say about Stripe?"

### Evaluation Script

```typescript
async function evaluateRetrieval(testQueries: Array<{ query: string, expectedChunks: string[] }>) {
  const results = [];

  for (const { query, expectedChunks } of testQueries) {
    const retrieved = await hybridSearch(query, { limit: 10 });
    const retrievedIds = retrieved.map(r => r.id);

    // Calculate MRR
    const firstRelevantRank = expectedChunks.findIndex(id => retrievedIds.includes(id)) + 1;
    const mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0;

    // Calculate Precision@5
    const top5 = retrievedIds.slice(0, 5);
    const relevant = top5.filter(id => expectedChunks.includes(id)).length;
    const precision = relevant / 5;

    results.push({ query, mrr, precision });
  }

  return results;
}
```

---

## Key Takeaways

### What Makes This Practical

1. **Incremental approach** - Week-by-week improvements, testable at each stage
2. **Low cost** - ~$0.75 total for metadata enrichment
3. **High ROI** - Metadata fields already exist, just need to populate
4. **Proven patterns** - Based on AI Automators' battle-tested approaches
5. **Conversation-optimized** - Designed for 2-10 person calls, not generic documents

### Avoid Over-Engineering

**Don't implement (unless needed):**
- GraphRAG - Overkill for meeting transcripts
- Multi-vector embeddings - Diminishing returns
- Semantic chunking - Fixed-size with overlap works well enough
- LLM re-ranking - Cross-encoder is cheaper and faster

**Do implement:**
- ✅ Metadata enrichment (huge ROI)
- ✅ Chunk overlap (prevents context splits)
- ✅ Re-ranking (accuracy boost)
- ✅ Query understanding (smarter retrieval)

### Success Criteria

**After 4 weeks:**
- All metadata fields populated (topics, sentiment, entities, intent)
- 20% chunk overlap implemented
- Re-ranking pipeline active
- MRR improved by 15-25%
- User satisfaction increased (fewer "not helpful" responses)
- Cost remains under $0.20 per 100 calls

---

## Resources

### AI Automators Videos (Transcripts Available)
- Use `/youtube` to fetch transcripts
- Use `fabric -p youtube_extract_wisdom` to extract insights
- Save key patterns to `PRPs/ai_docs/`

### Implementation References
- Pinecone hybrid search docs
- Vercel AI SDK RAG guide
- LangChain conversational retrieval
- Haystack metadata enrichment cookbook

### Tools
- tiktoken - Accurate token counting
- spaCy - Named entity recognition
- Hugging Face Inference API - Cross-encoder re-ranking
- OpenAI Structured Outputs - Metadata extraction

---

**Next Steps:**
1. Review this plan with stakeholders
2. Start Week 1 quick wins (token counting + overlap)
3. Build metadata extraction Edge Function (Week 2)
4. Test and iterate on retrieval quality

**Estimated Total Effort:** 49 hours over 4 weeks (~12 hours/week)
**Expected ROI:** 20-30% improvement in retrieval accuracy, minimal cost increase
