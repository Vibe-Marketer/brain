/**
 * Conditional logging utility for security-conscious applications
 * 
 * Logs detailed errors only in development mode to prevent
 * information leakage in production environments.
 */

type LogLevel = 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

class Logger {
  private log(level: LogLevel, message: string, data?: unknown) {
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      
      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'info':
          console.log(prefix, message, data || '');
          break;
      }
    }
    // In production, you could send to error tracking service (Sentry, LogRocket, etc.)
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
