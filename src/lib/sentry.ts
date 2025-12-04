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

    // Enable experimental features
    _experiments: {
      enableLogs: true,
      metricsAggregator: true, // Enable metrics aggregation
    },

    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay for debugging
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Capture 100% of transactions for full visibility
    tracesSampleRate: 1.0,

    // Control distributed tracing targets
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/transcriptsos\.com/,
      /^https:\/\/.*\.supabase\.co/,
    ],

    // Session Replay - capture 100% for full debugging
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Only filter browser extension errors (not actionable)
    ignoreErrors: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
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

// Export metrics helpers for easy usage
export const metrics = {
  count: (name: string, value: number = 1, tags?: Record<string, string>) => {
    Sentry.metrics.increment(name, value, { tags });
  },
  gauge: (name: string, value: number, tags?: Record<string, string>) => {
    Sentry.metrics.gauge(name, value, { tags });
  },
  distribution: (name: string, value: number, tags?: Record<string, string>) => {
    Sentry.metrics.distribution(name, value, { tags });
  },
  set: (name: string, value: string | number, tags?: Record<string, string>) => {
    Sentry.metrics.set(name, value, { tags });
  },
};
