import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import "driver.js/dist/driver.css";
import "@/styles/tour.css";
import { initSentry } from "./lib/sentry";
import { captureParticipationClaimBeforeTelemetry } from "./lib/pending-participation-claim";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Claim credentials must be scrubbed before any telemetry observes the URL.
captureParticipationClaimBeforeTelemetry();
initSentry();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in DOM. Check index.html.");
}

createRoot(rootElement).render(
  <Sentry.ErrorBoundary fallback={<div style={{padding: '2rem', textAlign: 'center'}}>Something went wrong. Please refresh the page.</div>}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Sentry.ErrorBoundary>
);
