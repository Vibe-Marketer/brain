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

    // Send default PII data (IP address, etc.)
    sendDefaultPii: true,

    // Enable logs to be sent to Sentry
    _experiments: {
      enableLogs: true,
    },

    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay for debugging
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      // Console logging integration - capture console.error automatically
      Sentry.consoleIntegration({ levels: ["error"] }),
    ],

    // Tracing - capture 100% in dev, 10% in production
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

    // Control distributed tracing targets
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/transcriptsos\.com/,
      /^https:\/\/.*\.supabase\.co/,
    ],

    // Session Replay
    replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 0.1, // 100% in dev, 10% in prod
    replaysOnErrorSampleRate: 1.0, // Always capture replays when errors occur

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

// Export logger for structured logging
export const logger = Sentry.logger;
