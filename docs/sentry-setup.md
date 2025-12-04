# Sentry Setup Guide

This document explains how to set up Sentry error monitoring for the Conversion Brain web application based on their onboarding recommendation. 



## Install
Add the Sentry SDK as a dependency using npm, yarn, or pnpm: 

```bash
npm install --save @sentry/react
```

## Configure SDK

Initialize Sentry as early as possible in your application's lifecycle.

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN, // Set in .env.local
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
  // Enable logs to be sent to Sentry
  enableLogs: true
});

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App />);
```

## Upload Source Maps (Optional)

Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow this guide.

```bash
npx @sentry/wizard@latest -i sourcemaps --saas --org $SENTRY_ORG --project $SENTRY_PROJECT
```

## AI Rules for Code Editors (Optional)

Sentry provides a set of rules you can use to help your LLM use Sentry correctly. Copy this file and add it to your projects rules configuration. When created as a rules file this should be placed alongside other editor specific rule files. For example, if you are using Cursor, place this file in the .cursorrules directory or in your IDE's equivalent configuration directory for something like "Claude Code" add to the Claude.md file.

[START AI Rules]
These examples should be used as guidance when configuring Sentry functionality within a project.

# Error / Exception Tracking

Use `Sentry.captureException(error)` to capture an exception and log the error in Sentry.
Use this in try catch blocks or areas where exceptions are expected

# Tracing Examples

Spans should be created for meaningful actions within an applications like button clicks, API calls, and function calls
Ensure you are creating custom spans with meaningful names and operations
Use the `Sentry.startSpan` function to create a span
Child spans can exist within a parent span

## Custom Span instrumentation in component actions

```javascript
function TestComponent() {
  const handleTestButtonClick = () => {
    // Create a transaction/span to measure performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "some config";
        const metric = "some metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        doSomething();
      },
    );
  };

  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
```

## Custom span instrumentation in API calls

```javascript
async function fetchUserData(userId) {
  return Sentry.startSpan(
    {
      op: "http.client",
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    },
  );
}
```

# Logs

Where logs are used, ensure Sentry is imported using `import * as Sentry from "@sentry/react"`
Enable logging in Sentry using `Sentry.init({ enableLogs: true })`
Reference the logger using `const { logger } = Sentry`
Sentry offers a consoleLoggingIntegration that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

### Baseline

```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN, // Set in .env.local

  enableLogs: true,
});
```

### Logger Integration

```javascript
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN, // Set in .env.local
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
});
```

## Logger Examples

`logger.fmt` is a template literal function that should be used to bring variables into the structured logs.

```javascript
logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```
[END AI Rules]

## Verify Sentry Setup

This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected.

```javascript
import * as Sentry from '@sentry/react';
// Add this button component to your app to test Sentry's error tracking
function ErrorButton() {
  return (
    <button
      onClick={() => {
        // Send a log before throwing the error
        Sentry.logger.info('User triggered test error', {
          action: 'test_error_button_click',
        });
        // Send a test metric before throwing the error
        Sentry.metrics.count('test_counter', 1);
        throw new Error('This is your first error!');
      }}
    >
      Break the world
    </button>
  );
}
```

## Additional Information

- **React Features**: Learn about our first class integration with the React framework. [https://docs.sentry.io/platforms/javascript/guides/react/features/](https://docs.sentry.io/platforms/javascript/guides/react/features/)
- **React Router**: Configure routing, so Sentry can generate parameterized route names for better grouping of tracing data. [https://docs.sentry.io/platforms/javascript/guides/react/router/](https://docs.sentry.io/platforms/javascript/guides/react/router/)
- **Logging Integrations**: Add logging integrations to automatically capture logs from your application. [https://docs.sentry.io/platforms/javascript/guides/react/logging/](https://docs.sentry.io/platforms/javascript/guides/react/logging/)
- **Metrics**: Learn how to track custom metrics to monitor your application performance and business KPIs. [https://docs.sentry.io/platforms/javascript/guides/react/metrics/](https://docs.sentry.io/platforms/javascript/guides/react/metrics/)


## Next Steps

After setting up Sentry, make sure to:

1. Test the error tracking by clicking the "Break the world" button
2. Check the Sentry dashboard to verify that the error is being captured
3. Review the logs and metrics that were sent
4. Adjust the configuration as needed for your specific use case