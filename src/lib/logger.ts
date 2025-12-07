/**
 * Simple Logger Utility
 *
 * Provides structured logging with environment awareness.
 * Integrates with the DebugPanel for visibility.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

class Logger {
  private log(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (isDevelopment) {
      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'info':
        case 'debug':
          console.log(prefix, message, data || '');
          break;
      }
    } else {
      // In production, only log errors and warnings to console
      if (level === 'error') {
        console.error(prefix, message, data || '');
      } else if (level === 'warn') {
        console.warn(prefix, message, data || '');
      }
    }
  }

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
   */
  getUserMessage(error: unknown): string {
    if (isDevelopment && error instanceof Error) {
      return error.message;
    }
    return 'An error occurred. Please try again.';
  }
}

export const logger = new Logger();
