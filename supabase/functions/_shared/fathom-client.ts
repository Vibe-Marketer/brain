export interface FathomFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
}

export class FathomClient {
  private static async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async fetchWithRetry(url: string, options: FathomFetchOptions = {}): Promise<Response> {
    const {
      maxRetries = 5,
      baseDelay = 1000,
      ...fetchOptions
    } = options;

    let lastError: unknown;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, fetchOptions);

        if (response.status !== 429) {
          return response;
        }

        // Handle 429
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        
        console.warn(`[FathomClient] Rate limited (429) on ${url}. Retrying in ${delayTime.toFixed(0)}ms (Attempt ${attempt + 1}/${maxRetries})`);
        
        await this.delay(delayTime);
      } catch (error) {
        console.warn(`[FathomClient] Network error on ${url}: ${error}. Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
        lastError = error;
        
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        await this.delay(delayTime);
      }
    }

    if (response) {
      return response; // Return the last 429 response if we exhausted retries
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }
}
