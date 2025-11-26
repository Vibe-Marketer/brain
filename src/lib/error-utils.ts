/**
 * Centralized Error Handling Utilities
 * Provides consistent error handling across the application
 */

import { logger } from './logger';

// Error type guard
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// API error interface
export interface ApiErrorResponse {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

// Check if error is an API error response
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiErrorResponse).message === 'string'
  );
}

// Extract error message from any error type
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (isError(error)) {
    return error.message;
  }

  if (isApiError(error)) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    // Handle Supabase errors
    if ('message' in error) {
      return String((error as { message: unknown }).message);
    }
    // Handle fetch errors
    if ('statusText' in error) {
      return String((error as { statusText: unknown }).statusText);
    }
  }

  return 'An unexpected error occurred';
}

// Safe async wrapper with error logging
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`${context}: ${message}`, error);
    return { error: message };
  }
}

// Retry wrapper with exponential backoff
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    context?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    context = 'Operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        logger.warn(`${context} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
