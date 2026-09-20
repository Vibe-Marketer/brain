import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const CLAIM_TOKEN_QUERY = /([?&]token(?:=|%3D))[A-Za-z0-9_-]{43}/giu;

function redactClaimCredentials<T>(value: T): T {
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => (
    typeof nestedValue === "string"
      ? nestedValue.replace(CLAIM_TOKEN_QUERY, "$1[Filtered]")
      : nestedValue
  ));
  return serialized === undefined ? value : JSON.parse(serialized) as T;
}

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Send default PII data (IP address, etc.)
    sendDefaultPii: false,

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
        maskAllText: true,
        blockAllMedia: true,
        beforeAddRecordingEvent: redactClaimCredentials,
      }),
    ],

    // Capture 100% of transactions for full visibility
    tracesSampleRate: 0.1,

    // Control distributed tracing targets
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/.*callvaultai\.com/,
      /^https:\/\/.*\.supabase\.co/,
    ],

    // Session Replay - capture 100% for full debugging
    replaysSessionSampleRate: 0.1,
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
      return redactClaimCredentials(event);
    },

    beforeSendTransaction: redactClaimCredentials,
    beforeBreadcrumb: redactClaimCredentials,
  });
}

// Re-export Sentry for use in components
export { Sentry };

// Export logger for structured logging
export const logger = Sentry.logger;

// Export metrics helpers for easy usage
// Uses new Sentry SDK v10.25+ metrics API with 'attributes' instead of 'tags'
export const metrics = {
  count: (name: string, value: number = 1, attributes?: Record<string, string>) => {
    Sentry.metrics.count(name, value, { attributes });
  },
  gauge: (name: string, value: number, attributes?: Record<string, string>) => {
    Sentry.metrics.gauge(name, value, { attributes });
  },
  distribution: (name: string, value: number, attributes?: Record<string, string>) => {
    Sentry.metrics.distribution(name, value, { attributes });
  },
};
