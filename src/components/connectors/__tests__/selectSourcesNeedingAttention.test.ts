/**
 * Unit tests for selectSourcesNeedingAttention — the pure selector behind the
 * login-time connection-health popup. No Supabase, no React.
 */

import { describe, expect, it } from "vitest";
import { selectSourcesNeedingAttention } from "../hooks/useConnector";
import type { ConnectorRow } from "../registry/types";

const NOW = Date.now();

function row(overrides: Partial<ConnectorRow> = {}): ConnectorRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    source_app: "fathom",
    is_active: true,
    account_email: "user@example.com",
    last_sync_at: null,
    error_message: null,
    oauth_token_expires: NOW + 60 * 60 * 1000,
    workspace_id: null,
    workspaceName: null,
    connection_metadata: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-23T00:00:00Z",
    ...overrides,
  };
}

function bundle(rowsBySourceApp: Record<string, ConnectorRow[]>) {
  return { userId: "22222222-2222-2222-2222-222222222222", rowsBySourceApp, userSettings: null };
}

describe("selectSourcesNeedingAttention", () => {
  it("returns nothing when all connections are healthy", () => {
    const result = selectSourcesNeedingAttention(
      bundle({ fathom: [row()] }),
    );
    expect(result).toEqual([]);
  });

  it("flags a source with a revoked/expired token (reconnect_required)", () => {
    const result = selectSourcesNeedingAttention(
      bundle({
        fathom: [
          row({
            oauth_token_expires: NOW - 60_000,
            error_message: "Reconcile failed: Token refresh failed: 400 invalid_grant",
          }),
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].sourceApp).toBe("fathom");
    expect(result[0].lifecycleStatus).toBe("reconnect_required");
  });

  it("flags a source with a generic persisted error", () => {
    const result = selectSourcesNeedingAttention(
      bundle({ fathom: [row({ error_message: "Reconcile failed: boom" })] }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].lifecycleStatus).toBe("error");
  });

  it("does NOT flag an intentionally disconnected source", () => {
    const result = selectSourcesNeedingAttention(
      bundle({ fathom: [row({ is_active: false, oauth_token_expires: null })] }),
    );
    expect(result).toEqual([]);
  });

  it("flags only the broken source when others are healthy", () => {
    const result = selectSourcesNeedingAttention(
      bundle({
        fathom: [row()],
        zoom: [
          row({
            source_app: "zoom",
            account_email: "z@example.com",
            oauth_token_expires: NOW - 60_000,
            error_message: "unauthorized",
          }),
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].sourceApp).toBe("zoom");
  });
});
