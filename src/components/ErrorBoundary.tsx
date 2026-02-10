import React from 'react';
import * as Sentry from '@sentry/react';
import { debugLog } from '@/components/debug-panel';
import { logger } from '@/lib/logger';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

// Check if error is a chunk loading error (code splitting failure)
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed')
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  private maxRetries = 3;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console with full details
    console.error('🔥 ERROR BOUNDARY CAUGHT ERROR:');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);

    // Send to DebugPanel for visibility
    debugLog('error', `🔥 React Error: ${error.message}`, {
      source: 'ErrorBoundary',
      category: 'react',
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        isChunkLoadError: isChunkLoadError(error),
      },
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // For chunk load errors, attempt automatic retry (stale chunks after deployment)
    if (isChunkLoadError(error) && this.state.retryCount < this.maxRetries) {
      logger.info(`ChunkLoadError detected, attempting retry ${this.state.retryCount + 1}/${this.maxRetries}`);
      this.setState({ isRetrying: true });

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, this.state.retryCount) * 1000;

      this.retryTimeoutId = setTimeout(() => {
        this.setState(
          (prev) => ({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: prev.retryCount + 1,
            isRetrying: false,
          }),
          () => {
            // Force re-render of children
            this.forceUpdate();
          }
        );
      }, delay);

      return; // Don't report to Sentry yet, might recover
    }

    // Send to Sentry with full context (only after retries exhausted for chunk errors)
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorType: isChunkLoadError(error) ? 'ChunkLoadError' : 'RuntimeError',
        retryCount: this.state.retryCount.toString(),
      },
    });
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleManualRetry = () => {
    // Clear cache and hard reload for chunk errors
    if (this.state.error && isChunkLoadError(this.state.error)) {
      // Clear service worker cache if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
      }
      // Hard reload to get fresh chunks
      window.location.reload();
    } else {
      // For other errors, just reset and try again
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: 0,
        isRetrying: false,
      });
    }
  };

  render() {
    // Show retrying state for chunk load errors
    if (this.state.isRetrying) {
      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vibe-orange mx-auto mb-4" />
            <p className="text-ink-muted">
              Reloading updated content... (attempt {this.state.retryCount + 1}/{this.maxRetries})
            </p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunk = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="p-4 md:p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-4xl mx-auto my-4">
          <h2 className="text-base md:text-lg font-bold text-red-900 dark:text-red-100 mb-4">
            {isChunk ? '📦 App Update Required' : '⚠️ Something went wrong'}
          </h2>

          {isChunk && (
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">
              A new version of the app is available. Please reload to get the latest updates.
            </p>
          )}

          <details className="text-sm md:text-base">
            <summary className="cursor-pointer text-red-800 dark:text-red-200 mb-2 font-semibold">
              📋 Error details (tap to expand)
            </summary>
            <div className="bg-card p-3 md:p-4 rounded border border-danger-border mt-2 overflow-x-auto">
              <p className="font-mono text-xs md:text-sm mb-3 text-red-900 dark:text-red-100 break-words">
                <strong>Error:</strong> {this.state.error?.message}
              </p>
              <p className="font-mono text-xs md:text-sm whitespace-pre-wrap text-red-800 dark:text-red-200 break-words overflow-x-auto">
                <strong>Stack:</strong>
                {'\n'}
                {this.state.error?.stack}
              </p>
              {this.state.errorInfo && (
                <p className="font-mono text-xs md:text-sm whitespace-pre-wrap mt-4 text-red-800 dark:text-red-200 break-words overflow-x-auto">
                  <strong>Component Stack:</strong>
                  {'\n'}
                  {this.state.errorInfo.componentStack}
                </p>
              )}
            </div>
          </details>
          <button
            onClick={this.handleManualRetry}
            className="mt-4 w-full md:w-auto px-6 py-3 bg-red-600 text-white text-base font-semibold rounded hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            🔄 {isChunk ? 'Reload App' : 'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
