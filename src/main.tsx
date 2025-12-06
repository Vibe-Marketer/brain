import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { initErrorCapture } from "./lib/error-capture";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Initialize Sentry before rendering
initSentry();

// Initialize comprehensive error capture (global handlers, console intercept, etc.)
initErrorCapture();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<ErrorBoundary><div /></ErrorBoundary>}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Sentry.ErrorBoundary>
);
