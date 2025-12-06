# ADR-004: pgvector + RRF Hybrid Search for Knowledge Base

**Status:** Accepted

**Date:** 2025-01-23

**Context:** AI Chat Agent System Implementation

## Context

The AI Chat Agent System needs to search across meeting transcripts using natural language queries. Users should be able to:

- Ask semantic questions ("What pain points did customers mention?")
- Search for exact keywords ("What did they say about 'pricing'?")
- Filter by temporal context ("What changed in Q4?")
- Filter by speaker, category, date range
- Get results in < 200ms

The knowledge base will contain:

- 10,000+ transcript chunks per user (typical)
- 100,000+ chunks for power users
- 1536-dimension vector embeddings
- Full-text content
- Rich metadata (speaker, date, category, etc.)

We need a solution that:

- Combines semantic and keyword search
- Runs entirely in our existing Supabase PostgreSQL database
- Doesn't require external services
- Scales to 100K+ vectors per user
- Supports complex filtering

## Decision

We will use **pgvector with HNSW index** for semantic search combined with **tsvector with GIN index** for keyword search, merged using **Reciprocal Rank Fusion (RRF)**.

### Architecture

```sql
-- Semantic search: pgvector with HNSW index
embedding vector(1536)
CREATE INDEX ON transcript_chunks USING hnsw (embedding vector_cosine_ops);

-- Keyword search: tsvector with GIN index
fts tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED
CREATE INDEX ON transcript_chunks USING gin(fts);

-- Hybrid function using RRF
CREATE FUNCTION hybrid_search_transcripts(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT,
  full_text_weight DECIMAL,
  semantic_weight DECIMAL
) RETURNS TABLE (...);
```

### RRF Scoring

For a result ranked 3rd in semantic search and 9th in keyword search:

```
RRF score = (semantic_weight / 3) + (full_text_weight / 9)
          = (1.0 / 3) + (1.0 / 9)
          = 0.333 + 0.111
          = 0.444
```

Results are sorted by RRF score descending.

## Alternatives Considered

### 1. Pinecone / Weaviate (Managed Vector DBs)

**Pros:**

- Purpose-built for vector search
- Advanced features (metadata filtering, hybrid search)
- Managed service

**Cons:**

- **Cost:** ~$70/month for 100K vectors + $0.40/1M queries
- External service dependency
- Data duplication (need to sync with PostgreSQL)
- Network latency for every query
- Vendor lock-in

### 2. Elasticsearch

**Pros:**

- Excellent full-text search
- Hybrid search capabilities
- Mature ecosystem

**Cons:**

- Separate infrastructure to manage
- Additional cost (~$50-200/month)
- Data duplication and sync complexity
- Learning curve for team

### 3. Pure Vector Search (pgvector only)

**Pros:**

- Simple implementation
- No additional indexes

**Cons:**

- **Misses exact keyword matches** (e.g., "pricing" in "What did they say about pricing?")
- Poor for acronyms, names, specific terms
- Users would complain about missing results

### 4. Pure Keyword Search (tsvector only)

**Pros:**

- Fast, reliable
- Works for exact terms

**Cons:**

- **No semantic understanding** (e.g., "cost" wouldn't match "pricing")
- Doesn't handle synonyms, paraphrases
- Fails for conceptual queries

## Consequences

### Positive

1. **Best of Both Worlds** - Catches exact matches AND semantic similarities
2. **All in PostgreSQL** - No external services, simpler architecture
3. **Cost Effective** - Only database storage costs (~$0.05/GB/month)
4. **Low Latency** - No network calls to external services
5. **RLS Support** - Automatic multi-tenant isolation
6. **Flexible Filtering** - Native SQL for complex conditions
7. **Transaction Safety** - ACID guarantees for data consistency

### Negative

1. **Storage Overhead** - Each 1536-dim vector = ~6KB
   - 100K chunks = ~600MB per user
   - Acceptable with modern storage costs
2. **Embedding Generation** - Must call OpenAI API
   - Mitigated by batch processing and caching
   - Only regenerate when content changes
3. **Index Maintenance** - HNSW index updates on inserts
   - Acceptable for our write pattern (mostly reads)

### Neutral

1. **Query Tuning** - Need to balance `full_text_weight` vs `semantic_weight`
   - Default: 1.0 each (equal weight)
   - Can adjust based on usage analytics
2. **Chunk Size** - Using 500 tokens per chunk
   - Good balance: context vs. granularity

## Implementation Details

### Chunking Strategy

```typescript
// 500 tokens per chunk, ~1-2 minutes of conversation
// 50-token overlap for context preservation
function chunkTranscript(segments: Segment[], chunkSize = 500): Chunk[] {
  // Speaker-aware chunking: don't split mid-sentence
  // Preserve temporal relationships
  // Track chunk_index for ordering
}
```

### Embedding Generation

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embeddings } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(c => c.text),
});
```

**Cost:** ~$0.02 per 1M tokens

**Typical transcript:** 10,000 tokens = $0.0002

**100 transcripts:** $0.02/month

### Query Pattern

```typescript
// Frontend
const results = await supabase.rpc('hybrid_search_transcripts', {
  query_text: userQuery,
  query_embedding: await generateEmbedding(userQuery),
  match_count: 10,
  full_text_weight: 1.0,
  semantic_weight: 1.0,
  filter_user_id: session.user.id,
  filter_date_range: '[2024-10-01,2024-12-31]',
  filter_categories: ['sales', 'support'],
});
```

### Performance Targets

- **Query latency:** < 200ms for 10 results
- **Index size:** ~1.5x raw data size (HNSW + GIN)
- **Accuracy:** > 90% relevant results in top 10

## Migration Path

### Phase 1: Backfill Existing Transcripts

```sql
-- Create Edge Function to chunk and embed
-- Process in batches of 10 recordings
-- Track progress in migration_status table
```

### Phase 2: Automatic Indexing

```sql
-- Trigger on fathom_calls insert
-- Queue for async processing
-- Generate chunks + embeddings
```

### Phase 3: Optimization

```sql
-- Monitor query performance
-- Tune HNSW parameters (m, ef_construction)
-- Adjust RRF weights based on usage
```

## Related Decisions

- ADR-001: Vercel AI SDK (provides embedding generation via AI SDK)
- Future ADR: Re-ranking models for improved relevance

## Monitoring

Track these metrics:

- Query latency (p50, p95, p99)
- Result relevance (user feedback)
- Embedding generation cost
- Storage growth rate

## References

- [Supabase Hybrid Search Documentation](https://supabase.com/docs/guides/ai/hybrid-search)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [RRF Research Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)

**Approved by:** Claude

**Review Date:** 2025-01-23
