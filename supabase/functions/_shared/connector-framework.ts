/**
 * Connector framework — server-side dispatch types + helpers.
 *
 * This is the backend counterpart to `src/config/source-registry.ts`. The
 * registry of source-app identifiers lives in frontend code; this file
 * defines the discriminated request shape the dispatcher edge function
 * accepts and the canonical adapter interface every new connector
 * implementation must conform to.
 *
 * Wiring contract:
 *   1. New connector defines a `ConnectorAdapter` implementation here.
 *   2. Registers itself in `ADAPTER_REGISTRY` below.
 *   3. The single `connector-dispatcher` edge function routes
 *      `{ source, action }` payloads to the matching adapter.
 *   4. Adapter returns a canonical `AdapterResult` that the dispatcher
 *      forwards to the client.
 *
 * Existing native connectors (Fathom / Fireflies / Zoom / Plaud / YouTube)
 * are NOT migrated here. Their dedicated edge functions remain the
 * production path. This framework is for NEW sources.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Discriminated request shape
// ---------------------------------------------------------------------------

export type ConnectorAction =
  | "connect"
  | "disconnect"
  | "fetch"
  | "sync"
  | "status";

export interface ConnectorRequest {
  source: string;
  action: ConnectorAction;
  /** Per-action payload. The dispatcher does not inspect this. */
  payload?: Record<string, unknown>;
}

export interface AdapterContext {
  supabase: SupabaseClient;
  userId: string;
  /** Optional org override; if omitted, adapters resolve the user's personal org. */
  organizationId?: string;
}

export interface AdapterResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Optional duplicate / no-op marker so the dispatcher can return 200 without a recording id. */
  skipped?: boolean;
}

export interface ConnectorAdapter {
  /** Source-app id; MUST match a registered SourceConfig.id on the frontend. */
  source: string;
  /** Optional per-action handlers. Unimplemented actions return 501. */
  connect?: (
    ctx: AdapterContext,
    request: ConnectorRequest,
  ) => Promise<AdapterResult>;
  disconnect?: (
    ctx: AdapterContext,
    request: ConnectorRequest,
  ) => Promise<AdapterResult>;
  fetch?: (
    ctx: AdapterContext,
    request: ConnectorRequest,
  ) => Promise<AdapterResult>;
  sync?: (
    ctx: AdapterContext,
    request: ConnectorRequest,
  ) => Promise<AdapterResult>;
  status?: (
    ctx: AdapterContext,
    request: ConnectorRequest,
  ) => Promise<AdapterResult>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ADAPTER_REGISTRY = new Map<string, ConnectorAdapter>();

export function registerAdapter(adapter: ConnectorAdapter): void {
  if (ADAPTER_REGISTRY.has(adapter.source)) {
    console.warn(
      `[connector-framework] Adapter already registered for ${adapter.source} — overwriting`,
    );
  }
  ADAPTER_REGISTRY.set(adapter.source, adapter);
}

export function getAdapter(source: string): ConnectorAdapter | undefined {
  return ADAPTER_REGISTRY.get(source);
}

export function listAdapterSources(): string[] {
  return [...ADAPTER_REGISTRY.keys()];
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function dispatchConnectorRequest(
  ctx: AdapterContext,
  request: ConnectorRequest,
): Promise<{ status: number; body: AdapterResult }> {
  const validationError = validateRequest(request);
  if (validationError) {
    return { status: 400, body: { success: false, error: validationError } };
  }

  const adapter = getAdapter(request.source);
  if (!adapter) {
    return {
      status: 404,
      body: {
        success: false,
        error: `No connector adapter registered for source '${request.source}'`,
      },
    };
  }

  const handler = adapter[request.action];
  if (!handler) {
    return {
      status: 501,
      body: {
        success: false,
        error: `Source '${request.source}' does not implement action '${request.action}'`,
      },
    };
  }

  try {
    const result = await handler(ctx, request);
    return {
      status: result.success || result.skipped ? 200 : 500,
      body: result,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown adapter error";
    console.error(
      `[connector-framework] ${request.source}/${request.action} failed:`,
      message,
    );
    return { status: 500, body: { success: false, error: message } };
  }
}

function validateRequest(request: unknown): string | null {
  if (!request || typeof request !== "object")
    return "Request body must be an object";
  const candidate = request as Partial<ConnectorRequest>;
  if (typeof candidate.source !== "string" || !candidate.source.trim()) {
    return "Request.source must be a non-empty string";
  }
  if (
    typeof candidate.action !== "string" ||
    !isConnectorAction(candidate.action)
  ) {
    return "Request.action must be one of: connect, disconnect, fetch, sync, status";
  }
  return null;
}

function isConnectorAction(value: string): value is ConnectorAction {
  return (
    value === "connect" ||
    value === "disconnect" ||
    value === "fetch" ||
    value === "sync" ||
    value === "status"
  );
}
