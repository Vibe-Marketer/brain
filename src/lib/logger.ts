/**
 * Conditional logging utility for security-conscious applications
 *
 * Logs detailed errors only in development mode to prevent
 * information leakage in production environments.
 *
 * Integrates with centralized error capture for comprehensive error tracking.
 */

import { captureError, originalConsoleError, originalConsoleWarn } from './error-capture';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

class Logger {
  private log(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (isDevelopment) {
      switch (level) {
        case 'error':
          // Use original console.error to avoid double-capture
          originalConsoleError(prefix, message, data || '');
          break;
        case 'warn':
          originalConsoleWarn(prefix, message, data || '');
          break;
        case 'info':
          console.log(prefix, message, data || '');
          break;
        case 'debug':
          console.log(prefix, message, data || '');
          break;
      }
    }

    // For errors, always send to centralized error capture (which handles Sentry)
    if (level === 'error') {
      const errorObj = data instanceof Error ? data : new Error(message);
      captureError(errorObj, 'manual', {
        metadata: {
          loggerMessage: message,
          additionalData: data instanceof Error ? undefined : data,
        },
        sendToSentry: true,
      });
    }
  }

  /**
   * Debug level logging - only shown in development mode
   * Use for verbose information that helps during debugging
   */
  debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  error(message: string, error?: unknown) {
    this.log('error', message, error);
  }

  /**
   * Get a user-friendly error message
   * Returns detailed message in dev, generic message in production
   */
  getUserMessage(error: unknown): string {
    if (isDevelopment && error instanceof Error) {
      return error.message;
    }
    return 'An error occurred. Please try again.';
  }
}

export const logger = new Logger();
