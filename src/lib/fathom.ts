/**
 * Fathom API Client Utilities
 * 
 * This module provides helper functions for interacting with the Fathom API
 * with built-in error handling and rate limiting.
 */

export interface FathomError {
  statusCode: number;
  message: string;
  body?: any;
}

/**
 * Check if an error is a Fathom API error
 */
export function isFathomError(error: any): error is FathomError {
  return error && typeof error.statusCode === 'number' && typeof error.message === 'string';
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (isFathomError(error) && error.statusCode === 429) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Format error message for user display
 */
export function getErrorMessage(error: any): string {
  if (isFathomError(error)) {
    switch (error.statusCode) {
      case 401:
        return 'Invalid API key. Please check your credentials in Settings.';
      case 403:
        return 'Access forbidden. Please check your API key permissions.';
      case 404:
        return 'Resource not found.';
      case 429:
        return 'Rate limit exceeded. Please wait and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Fathom server error. Please try again later.';
      default:
        return `API error: ${error.message}`;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Rate limiter class to prevent exceeding Fathom's 60 requests/60 seconds limit
 */
export class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 60;
  private readonly windowMs = 60000; // 60 seconds

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window if needed
    if (elapsed >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Check if we're at the limit
    if (this.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - elapsed;
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }
}
