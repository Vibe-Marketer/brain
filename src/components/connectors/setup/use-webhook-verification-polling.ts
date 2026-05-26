import * as React from "react";
import type { WebhookVerificationResult } from "../registry/types";

export type WebhookVerificationPollState =
  | "idle"
  | "polling"
  | "verified"
  | "expired"
  | "not_configured";

export interface UseWebhookVerificationPollingArgs {
  /** Source row id to poll for. `null` makes `start` a no-op. */
  sourceId: string | null;
  /** Adapter call that fetches the current verification snapshot. */
  getVerification?: (sourceId: string) => Promise<WebhookVerificationResult>;
  /** Polling cadence in ms. Default 2000. */
  intervalMs?: number;
  /** Total time before the hook gives up and transitions to `expired`. Default 60000. */
  timeoutMs?: number;
  /** Fires once when polling transitions to `verified`. */
  onVerified?: (verification: WebhookVerificationResult) => void;
  /** Fires when the poll times out with a thrown error from the adapter. */
  onError?: (error: unknown) => void;
}

export interface UseWebhookVerificationPollingReturn {
  state: WebhookVerificationPollState;
  /**
   * Begin polling. Accepts an optional sourceId override for callers that
   * have a freshly-minted id (e.g. the value returned from
   * `saveApiKeyCredentials`) that hasn't propagated through props yet.
   */
  start: (overrideSourceId?: string) => void;
  /** Stop polling. Safe to call when idle. */
  stop: () => void;
  /** Most recent verification snapshot, or null if none has been observed yet. */
  lastVerification: WebhookVerificationResult | null;
}

/**
 * Polls `adapter.getWebhookVerification` until the provider sends a verifying
 * webhook (state -> verified, polling stops, onVerified fires) or `timeoutMs`
 * elapses (state -> expired, polling stops, onError may fire).
 *
 * Hand-rolls the interval (vs. TanStack Query) because the polling lifecycle
 * is event-driven (start after Save, stop after success), not query-cache
 * driven, and because we need a hard wall-clock timeout that survives slow
 * network ticks.
 *
 * Cleanup contract:
 *  - The interval is cleared on every `stop()` call.
 *  - The interval is cleared on component unmount — without this guard the
 *    hook would keep firing ticks against a torn-down component and the
 *    adapter would log spurious aborts. (Bug-family with W1-C.)
 *  - In-flight ticks set `tickInFlight` so a slow adapter call doesn't pile
 *    up overlapping requests when the interval fires faster than the network.
 */
export function useWebhookVerificationPolling(
  args: UseWebhookVerificationPollingArgs,
): UseWebhookVerificationPollingReturn {
  const {
    sourceId,
    getVerification,
    intervalMs = 2_000,
    timeoutMs = 60_000,
    onVerified,
    onError,
  } = args;

  const [state, setState] = React.useState<WebhookVerificationPollState>("idle");
  const [lastVerification, setLastVerification] =
    React.useState<WebhookVerificationResult | null>(null);

  // Keep refs to the latest closure inputs so consumers can pass inline
  // callbacks / changing sourceIds without resetting the polling interval.
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const getVerificationRef = React.useRef(getVerification);
  const onVerifiedRef = React.useRef(onVerified);
  const onErrorRef = React.useRef(onError);
  const sourceIdRef = React.useRef(sourceId);

  React.useEffect(() => {
    getVerificationRef.current = getVerification;
  }, [getVerification]);
  React.useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  React.useEffect(() => {
    sourceIdRef.current = sourceId;
  }, [sourceId]);

  const stop = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = React.useCallback(
    (overrideSourceId?: string) => {
      const targetSourceId = overrideSourceId ?? sourceIdRef.current;
      const fetcher = getVerificationRef.current;
      if (!fetcher || !targetSourceId) {
        setState("not_configured");
        return;
      }

      stop();
      setState("polling");
      const startedAt = Date.now();
      let tickInFlight = false;

      const tick = async () => {
        if (tickInFlight) return;
        tickInFlight = true;
        try {
          const verification = await fetcher(targetSourceId);
          setLastVerification(verification);
          if (verification?.verified) {
            setState("verified");
            stop();
            onVerifiedRef.current?.(verification);
            return;
          }
          if (Date.now() - startedAt > timeoutMs) {
            setState("expired");
            stop();
          }
        } catch (error) {
          if (Date.now() - startedAt > timeoutMs) {
            setState("expired");
            stop();
            onErrorRef.current?.(error);
          }
        } finally {
          tickInFlight = false;
        }
      };

      void tick();
      intervalRef.current = setInterval(() => void tick(), intervalMs);
    },
    [intervalMs, stop, timeoutMs],
  );

  // Unmount cleanup so we never schedule ticks into a torn-down component.
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return React.useMemo(
    () => ({ state, start, stop, lastVerification }),
    [state, start, stop, lastVerification],
  );
}
