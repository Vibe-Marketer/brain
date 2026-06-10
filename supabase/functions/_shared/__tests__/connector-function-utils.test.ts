import { describe, it, expect } from 'vitest';
import {
  ConnectorRequestValidationError,
  getConnectorDateWindow,
  getConnectorDateWindowMs,
  markConnectorPartialSync,
  markConnectorRateLimited,
  markConnectorReconnectRequired,
  resolveConnectorWorkspaceBinding,
  resolveConnectorSyncIds,
} from "../connector-function-utils.ts";

describe("connector-function-utils sync id resolution", () => {
  it("prefers singleCallId over array ids", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: { singleCallId: "one", recordingIds: ["two"] },
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => ["fallback"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["one"]);
  });

  it("uses the first configured non-empty array id field", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: { meetingIds: ["m1"], recordingIds: ["r1"] },
        idFields: ["meetingIds", "recordingIds"],
        fetchFallbackIds: async () => ["fallback"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["m1"]);
  });

  it("falls back to date-window discovery when no explicit ids are provided", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: {},
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => ["recent"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["recent"]);
  });

  it("raises validation errors for empty and oversized batches", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: {},
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => [],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).rejects.toBeInstanceOf(ConnectorRequestValidationError);

    await expect(
      resolveConnectorSyncIds({
        body: { recordingIds: ["1", "2"] },
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => [],
        maxBatchSize: 1,
        emptyError: "empty",
        tooManyError: (count: number, max: number) => `too many: ${count}/${max}`,
      }),
    ).rejects.toThrow("too many: 2/1");
  });
});

describe("connector-function-utils date window normalization", () => {
  it("prefers provider-neutral createdAfter/createdBefore aliases", () => {
    expect(
      getConnectorDateWindow({
        createdAfter: "2026-05-01T00:00:00Z",
        createdBefore: "2026-05-02T00:00:00Z",
        dateStart: "2026-04-01T00:00:00Z",
        dateEnd: "2026-04-02T00:00:00Z",
      }),
    ).toEqual({
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-02T00:00:00Z",
    });
  });

  it("falls back to UI dateStart/dateEnd aliases and trims blanks", () => {
    expect(
      getConnectorDateWindow({
        createdAfter: " ",
        createdBefore: "",
        dateStart: "2026-05-03T00:00:00Z",
        dateEnd: "2026-05-04T00:00:00Z",
      }),
    ).toEqual({
      start: "2026-05-03T00:00:00Z",
      end: "2026-05-04T00:00:00Z",
    });
  });

  it("returns millisecond timestamps for providers that require numeric bounds", () => {
    expect(
      getConnectorDateWindowMs({
        dateStart: "2026-05-03T00:00:00Z",
        dateEnd: "2026-05-04T00:00:00Z",
      }),
    ).toEqual({
      startMs: Date.parse("2026-05-03T00:00:00Z"),
      endMs: Date.parse("2026-05-04T00:00:00Z"),
    });
  });
});

describe("connector-function-utils workspace binding and status helpers", () => {
  it("returns the bound import_sources workspace before routing defaults", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_bound",
          user_id: "user_1",
          source_app: "grain",
          workspace_id: "ws_bound",
          connection_metadata: null,
        },
      ],
      workspace_memberships: [{ id: "mem_1", user_id: "user_1", workspace_id: "ws_bound" }],
    });

    await expect(
      resolveConnectorWorkspaceBinding({
        supabase,
        userId: "user_1",
        sourceId: "src_bound",
        sourceApp: "grain",
      }),
    ).resolves.toMatchObject({
      workspaceId: "ws_bound",
      usedDefaultFallback: false,
    });
  });

  it("falls back to the user's default workspace when a legacy source is unbound", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_legacy",
          user_id: "user_1",
          source_app: "read-ai",
          workspace_id: null,
          connection_metadata: null,
        },
      ],
      workspace_memberships: [
        {
          id: "mem_1",
          user_id: "user_1",
          workspace_id: "ws_default",
          workspaces: { id: "ws_default", is_default: true },
        },
      ],
    });

    await expect(
      resolveConnectorWorkspaceBinding({
        supabase,
        userId: "user_1",
        sourceId: "src_legacy",
        sourceApp: "read-ai",
      }),
    ).resolves.toMatchObject({
      workspaceId: "ws_default",
      usedDefaultFallback: true,
    });
  });

  it("does not treat PLAUD provider metadata workspace_id as CallVault destination", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_plaud",
          user_id: "user_1",
          source_app: "plaud",
          workspace_id: null,
          connection_metadata: {
            workspace_id: "plaud_provider_workspace",
          },
        },
      ],
      workspace_memberships: [
        {
          id: "mem_1",
          user_id: "user_1",
          workspace_id: "ws_default",
          workspaces: { id: "ws_default", is_default: true },
        },
      ],
    });

    await expect(
      resolveConnectorWorkspaceBinding({
        supabase,
        userId: "user_1",
        sourceId: "src_plaud",
        sourceApp: "plaud",
      }),
    ).resolves.toMatchObject({
      workspaceId: "ws_default",
      usedDefaultFallback: true,
    });
  });

  it("writes reconnect-required status without clearing provider metadata", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_read",
          user_id: "user_1",
          source_app: "read-ai",
          workspace_id: "ws_bound",
          connection_metadata: { auth_type: "oauth" },
        },
      ],
    });

    await markConnectorReconnectRequired({
      supabase,
      sourceId: "src_read",
      userId: "user_1",
      errorMessage: "Refresh failed",
    });

    expect(supabase.table("import_sources")[0]).toMatchObject({
      error_message: "Refresh failed",
      connection_metadata: {
        auth_type: "oauth",
        status: "reconnect_required",
      },
    });
  });

  it("writes passive rate-limit retry metadata without marking disconnected", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_rate",
          user_id: "user_1",
          source_app: "grain",
          is_active: true,
          connection_metadata: { auth_type: "oauth" },
        },
      ],
    });

    await markConnectorRateLimited({
      supabase,
      sourceId: "src_rate",
      userId: "user_1",
      nextRetryAt: "2026-05-31T12:00:00Z",
    });

    expect(supabase.table("import_sources")[0]).toMatchObject({
      is_active: true,
      error_message: null,
      connection_metadata: {
        status: "rate_limited",
        next_retry_at: "2026-05-31T12:00:00Z",
      },
    });
  });

  it("records partial-sync warning state and failed external IDs", async () => {
    const supabase = createMockSupabase({
      import_sources: [
        {
          id: "src_partial",
          user_id: "user_1",
          source_app: "zoom",
          connection_metadata: null,
        },
      ],
    });

    await markConnectorPartialSync({
      supabase,
      sourceId: "src_partial",
      userId: "user_1",
      failedExternalIds: ["m_1", "m_2"],
    });

    expect(supabase.table("import_sources")[0]).toMatchObject({
      connection_metadata: {
        status: "partial_sync",
        failed_external_ids: ["m_1", "m_2"],
      },
    });
  });
});

function createMockSupabase(initialTables: Record<string, Array<Record<string, unknown>>>) {
  const tables = new Map(
    Object.entries(initialTables).map(([name, rows]) => [
      name,
      rows.map((row) => ({ ...row })),
    ]),
  );

  return {
    table(name: string) {
      return tables.get(name) ?? [];
    },
    from(name: string) {
      if (!tables.has(name)) tables.set(name, []);
      return new MockQuery(tables.get(name)!);
    },
  };
}

class MockQuery {
  private filters: Array<[string, unknown]> = [];
  private updatePayload: Record<string, unknown> | null = null;

  constructor(private rows: Array<Record<string, unknown>>) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push([field, value]);
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  async maybeSingle() {
    const row = this.matchingRows()[0] ?? null;
    return { data: row, error: null };
  }

  then(
    resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void,
  ) {
    if (this.updatePayload) {
      for (const row of this.matchingRows()) {
        Object.assign(row, this.updatePayload);
      }
    }
    resolve({ data: this.matchingRows(), error: null });
  }

  private matchingRows() {
    return this.rows.filter((row) =>
      this.filters.every(([field, value]) => row[field] === value),
    );
  }
}
