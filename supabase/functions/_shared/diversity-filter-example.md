# Diversity Filter Integration Example

## Overview
The diversity filter ensures search results come from different recordings and cover different semantic topics, preventing redundant chunks from dominating the LLM context.

## Integration in Edge Functions

### Example: Chat/RAG Flow

```typescript
import { diversityFilter } from '../_shared/diversity-filter.ts';

// Step 1: Get hybrid search results (20 results)
const searchResults = await hybridSearchTranscripts(query, { limit: 20 });

// Step 2: Rerank for relevance (top 10)
const rerankedResults = await rerankResults(searchResults, query, { limit: 10 });

// Step 3: Apply diversity filter (top 5 diverse results)
const diverseResults = diversityFilter(rerankedResults, {
  maxPerRecording: 2,      // Max 2 chunks from same recording
  minSemanticDistance: 0.3, // Chunks must be semantically different
  targetCount: 5,           // Return 5 diverse results
});

// Step 4: Send to LLM
const context = diverseResults.map(r => r.chunk_text).join('\n\n');
const llmResponse = await generateText({
  model: openai('gpt-4o'),
  messages: [
    { role: 'system', content: 'Use the following context...' },
    { role: 'user', content: query },
  ],
  system: context,
});
```

### Example: Simple Diversity (No Embeddings)

```typescript
import { simpleDiversityFilter } from '../_shared/diversity-filter.ts';

// If you don't have embeddings available, use the simple version
// It only limits chunks per recording (no semantic similarity check)
const diverseResults = simpleDiversityFilter(searchResults, 2, 5);
// maxPerRecording: 2, targetCount: 5
```

## When to Use

### Use `diversityFilter()` when:
- You have embeddings available in your results
- You want both recording diversity AND semantic diversity
- You're building a chat/RAG system where repetition is problematic
- Results come from hybrid search with embeddings

### Use `simpleDiversityFilter()` when:
- Embeddings aren't available in results
- You only care about recording diversity (not semantic similarity)
- Performance is critical (semantic similarity is more expensive)
- You're dealing with non-embedded search results

## Configuration Options

### `maxPerRecording` (default: 2)
- Controls how many chunks can come from the same recording
- Lower = more diverse across calls
- Higher = allows deeper exploration of relevant calls

### `minSemanticDistance` (default: 0.3)
- Cosine distance threshold for semantic similarity
- 0.0 = identical chunks
- 1.0 = completely different chunks
- 0.3 = moderately different (recommended)

### `targetCount` (default: 5)
- How many diverse results to return
- Should match your LLM context window needs
- Typical range: 3-10 chunks

## Performance Considerations

1. **Order matters**: Pass pre-sorted results (by relevance score)
2. **Semantic checking**: O(n²) complexity - use sparingly
3. **Early termination**: Stops at targetCount for efficiency
4. **Logging**: Check console for debug info on filtering decisions

## Expected Behavior

### Input: 20 search results
```
Recording 123: chunk A, chunk B, chunk C (all similar)
Recording 456: chunk D, chunk E
Recording 789: chunk F (very similar to chunk A)
```

### Output: 5 diverse results
```
Recording 123: chunk A, chunk B (limited to 2 per recording)
Recording 456: chunk D, chunk E
Recording 789: (skipped - chunk F too similar to chunk A)
→ Returns chunk A, B, D, E + next available diverse chunk
```

## Integration Checklist

- [ ] Import diversity filter from `_shared/diversity-filter.ts`
- [ ] Ensure input chunks have `recording_id` field
- [ ] Include embeddings if using `diversityFilter()` (not `simpleDiversityFilter()`)
- [ ] Configure options based on your use case
- [ ] Call AFTER reranking but BEFORE sending to LLM
- [ ] Test with various query types to validate diversity
- [ ] Monitor console logs for filtering decisions

## Future Enhancements

Potential improvements:
- Add time-based diversity (limit chunks from same time period)
- Add speaker diversity (ensure multiple speakers represented)
- Add topic diversity (using enriched metadata)
- Make parameters dynamic based on query complexity
