import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

    // Session Replay - captures what user did before crash
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay for debugging
      Sentry.replayIntegration({
        maskAllText: false, // Set to true if you have sensitive data
        blockAllMedia: false,
      }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that aren't actionable
      "Network Error",
      "Failed to fetch",
      "Load failed",
      // User-initiated navigation
      "AbortError",
      // Resize observer (browser bug, not actionable)
      "ResizeObserver loop",
    ],

    // Add context to errors
    beforeSend(event, hint) {
      // Log to console in development
      if (import.meta.env.DEV) {
        console.error("Sentry captured error:", hint.originalException);
      }
      return event;
    },
  });
}

// Re-export Sentry for use in components
export { Sentry };
