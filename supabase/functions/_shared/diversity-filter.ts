/**
 * Diversity filtering utility for search results
 * Ensures diverse results across recordings and semantic topics
 *
 * Usage in typical RAG flow:
 * hybrid_search_transcripts (20 results)
 *   → rerank-results (top 10 by relevance)
 *   → diversity_filter (top 5 diverse results)
 *   → LLM context
 */

interface ChunkWithEmbedding {
  chunk_id: string;
  chunk_text: string;
  recording_id: number;
  embedding?: number[];
  rrf_score?: number;
  rerank_score?: number;
}

interface DiversityOptions {
  maxPerRecording?: number;  // Max chunks from same recording (default: 2)
  minSemanticDistance?: number;  // Minimum cosine distance between selected chunks (default: 0.3)
  targetCount?: number;  // Target number of diverse results (default: 5)
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Filter chunks for diversity - limit per recording and avoid semantic duplicates
 */
export function diversityFilter<T extends ChunkWithEmbedding>(
  chunks: T[],
  options: DiversityOptions = {}
): T[] {
  const {
    maxPerRecording = 2,
    minSemanticDistance = 0.3,
    targetCount = 5,
  } = options;

  const diverse: T[] = [];
  const recordingCounts = new Map<number, number>();

  for (const chunk of chunks) {
    // Check if we've hit target count
    if (diverse.length >= targetCount) break;

    // Check recording limit
    const recordingCount = recordingCounts.get(chunk.recording_id) || 0;
    if (recordingCount >= maxPerRecording) {
      console.log(`Skipping chunk from recording ${chunk.recording_id} (limit reached)`);
      continue;
    }

    // Check semantic similarity with already-selected chunks
    if (chunk.embedding) {
      const tooSimilar = diverse.some(selected => {
        if (!selected.embedding) return false;
        const similarity = cosineSimilarity(chunk.embedding!, selected.embedding!);
        return similarity > (1 - minSemanticDistance);
      });

      if (tooSimilar) {
        console.log(`Skipping chunk ${chunk.chunk_id} (too similar to existing selection)`);
        continue;
      }
    }

    // Add to diverse results
    diverse.push(chunk);
    recordingCounts.set(chunk.recording_id, recordingCount + 1);
  }

  console.log(`Diversity filter: ${chunks.length} input → ${diverse.length} diverse results`);
  return diverse;
}

/**
 * Simple diversity filter without embeddings - just limits per recording
 */
export function simpleDiversityFilter<T extends { recording_id: number }>(
  chunks: T[],
  maxPerRecording: number = 2,
  targetCount: number = 5
): T[] {
  const diverse: T[] = [];
  const recordingCounts = new Map<number, number>();

  for (const chunk of chunks) {
    if (diverse.length >= targetCount) break;

    const count = recordingCounts.get(chunk.recording_id) || 0;
    if (count >= maxPerRecording) continue;

    diverse.push(chunk);
    recordingCounts.set(chunk.recording_id, count + 1);
  }

  return diverse;
}
