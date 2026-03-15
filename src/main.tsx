import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import "@/styles/tour.css";
import { initSentry } from "./lib/sentry";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Initialize Sentry before rendering
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
