import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
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

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Send to Sentry with full context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 md:p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-4xl mx-auto my-4">
          <h2 className="text-base md:text-lg font-bold text-red-900 dark:text-red-100 mb-4">
            ⚠️ Something went wrong
          </h2>
          <details className="text-sm md:text-base">
            <summary className="cursor-pointer text-red-800 dark:text-red-200 mb-2 font-semibold">
              📋 Error details (tap to expand)
            </summary>
            <div className="bg-white dark:bg-gray-900 p-3 md:p-4 rounded border border-red-200 dark:border-red-700 mt-2 overflow-x-auto">
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
            onClick={() => window.location.reload()}
            className="mt-4 w-full md:w-auto px-6 py-3 bg-red-600 text-white text-base font-semibold rounded hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
