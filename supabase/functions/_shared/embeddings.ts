/**
 * Shared embedding generation for RAG tools.
 * Uses OpenAI text-embedding-3-small via direct API call.
 * (OpenRouter doesn't support embeddings, so we call OpenAI directly.)
 */

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Generate a query embedding vector using OpenAI's text-embedding-3-small model.
 *
 * @param query - The text to embed
 * @param openaiApiKey - OpenAI API key (not OpenRouter — embeddings are OpenAI-only)
 * @returns The embedding vector as a number array
 * @throws {EmbeddingError} If the OpenAI API call fails
 */
export async function generateQueryEmbedding(
  query: string,
  openaiApiKey: string,
): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: query,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new EmbeddingError(
      `Embedding generation failed: ${response.status} - ${errorText}`,
      response.status,
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Typed error for embedding generation failures.
 */
export class EmbeddingError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'EmbeddingError';
    this.statusCode = statusCode;
  }
}
