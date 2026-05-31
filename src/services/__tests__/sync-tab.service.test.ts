import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncedCalls } from "../sync-tab.service";

const fromSpy = vi.fn();
const resolveShareUrlSpy = vi.fn((input: { source_metadata?: Record<string, unknown> | null }) => {
  const meta = input.source_metadata ?? {};
  return (meta.share_url as string | undefined) ?? null;
});
const toRecordingUuidBatchSpy = vi.fn(async (ids: string[]) => ({
  resolved: ids.map((id) => ({ uuid: id, legacyId: null, sourceApp: null })),
  uuids: ids,
  legacyIds: [],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromSpy(...args),
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  getSafeUser: vi.fn(async () => ({
    user: { id: "user_1" },
    error: null,
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/recording-source-url", () => ({
  resolveShareUrl: (...args: Parameters<typeof resolveShareUrlSpy>) =>
    resolveShareUrlSpy(...args),
}));

vi.mock("@/lib/recording-ids", () => ({
  toRecordingUuidBatch: (...args: Parameters<typeof toRecordingUuidBatchSpy>) =>
    toRecordingUuidBatchSpy(...args),
}));

describe("fetchSyncedCalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    QueryMock.instances = [];
    fromSpy.mockImplementation((table: string) => {
      if (table === "recordings") {
        return new QueryMock(recordingRows, recordingRows.length);
      }
      if (table === "workspace_entries") {
        return new QueryMock(
          recordingRows.map((recording) => ({ recording })),
          recordingRows.length,
        );
      }
      if (table === "call_tag_assignments") {
        return new QueryMock([
          { recording_id: "rec_fathom", tag_id: "tag_sales" },
          { recording_id: "rec_zoom", tag_id: "tag_cs" },
        ]);
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("maps canonical recordings from all connector sources plus paste/manual imports", async () => {
    const result = await fetchSyncedCalls({
      dateRange: undefined,
      page: 1,
      pageSize: 20,
      organizationId: "org_1",
    });

    expect(fromSpy).not.toHaveBeenCalledWith("fathom_calls");
    expect(fromSpy).toHaveBeenCalledWith("recordings");
    expect(result.rows.map((row) => row.source_platform)).toEqual([
      "fathom",
      "zoom",
      "fireflies",
      "grain",
      "read-ai",
      "plaud",
      "youtube",
      "fathom-paste",
      "manual",
    ]);
    expect(result.rows[0]).toMatchObject({
      recording_id: "rec_fathom",
      title: "Fathom call",
      share_url: "https://share.example/fathom",
      synced: true,
    });
    expect(result.totalCount).toBe(9);
  });

  it("filters by organization, date range, and canonical recording UUID tags", async () => {
    const dateRange = {
      from: new Date("2026-05-01T12:00:00Z"),
      to: new Date("2026-05-31T12:00:00Z"),
    };

    await fetchSyncedCalls({
      dateRange,
      page: 2,
      pageSize: 3,
      organizationId: "org_1",
    });

    const recordingsQuery = QueryMock.instances.find((query) => query.tableData === recordingRows);
    expect(recordingsQuery?.operations).toEqual(
      expect.arrayContaining([
        ["eq", "owner_user_id", "user_1"],
        ["eq", "organization_id", "org_1"],
        ["gte", "recording_start_time", "2026-05-01T00:00:00.000Z"],
        ["lte", "recording_start_time", "2026-05-31T23:59:59.999Z"],
        ["range", 3, 5],
      ]),
    );
    expect(toRecordingUuidBatchSpy).toHaveBeenCalledWith(
      recordingRows.map((row) => row.id),
    );
  });

  it("scopes workspace results through workspace_entries and never selects recordings.share_url", async () => {
    await fetchSyncedCalls({
      dateRange: undefined,
      page: 1,
      pageSize: 10,
      organizationId: "org_1",
      workspaceId: "ws_sales",
    });

    expect(fromSpy).toHaveBeenCalledWith("workspace_entries");
    const workspaceQuery = QueryMock.instances.find((query) =>
      query.operations.some((operation) => operation[0] === "eq" && operation[1] === "workspace_id"),
    );
    expect(workspaceQuery?.operations).toContainEqual(["eq", "workspace_id", "ws_sales"]);
    const selectOperation = workspaceQuery?.operations.find((operation) => operation[0] === "select");
    expect(String(selectOperation?.[1])).not.toContain("share_url");
    expect(resolveShareUrlSpy).toHaveBeenCalled();
  });
});

class QueryMock {
  static instances: QueryMock[] = [];
  operations: unknown[][] = [];

  constructor(
    public tableData: Array<Record<string, unknown>>,
    private count = tableData.length,
  ) {
    QueryMock.instances.push(this);
  }

  select(...args: unknown[]) {
    this.operations.push(["select", ...args]);
    return this;
  }

  eq(...args: unknown[]) {
    this.operations.push(["eq", ...args]);
    return this;
  }

  gte(...args: unknown[]) {
    this.operations.push(["gte", ...args]);
    return this;
  }

  lte(...args: unknown[]) {
    this.operations.push(["lte", ...args]);
    return this;
  }

  order(...args: unknown[]) {
    this.operations.push(["order", ...args]);
    return this;
  }

  range(...args: unknown[]) {
    this.operations.push(["range", ...args]);
    return this;
  }

  in(...args: unknown[]) {
    this.operations.push(["in", ...args]);
    return this;
  }

  then(
    resolve: (value: {
      data: Array<Record<string, unknown>>;
      error: null;
      count: number;
    }) => void,
  ) {
    resolve({ data: this.tableData, error: null, count: this.count });
  }
}

const sourceApps = [
  ["rec_fathom", "fathom", "Fathom call"],
  ["rec_zoom", "zoom", "Zoom call"],
  ["rec_fireflies", "fireflies", "Fireflies call"],
  ["rec_grain", "grain", "Grain call"],
  ["rec_read", "read-ai", "Read.ai call"],
  ["rec_plaud", "plaud", "PLAUD call"],
  ["rec_youtube", "youtube", "YouTube import"],
  ["rec_paste", "fathom-paste", "Paste transcript"],
  ["rec_manual", "manual", "Manual import"],
] as const;

const recordingRows = sourceApps.map(([id, source_app, title]) => ({
  id,
  legacy_recording_id: null,
  title,
  created_at: "2026-05-10T12:00:00Z",
  recording_start_time: "2026-05-10T12:00:00Z",
  recording_end_time: "2026-05-10T12:30:00Z",
  full_transcript: `${title} transcript`,
  summary: `${title} summary`,
  source_app,
  source_call_id: `${id}_external`,
  source_metadata: {
    share_url: `https://share.example/${source_app}`,
    recorded_by_name: "Host",
    recorded_by_email: "host@example.com",
    calendar_invitees: [{ email: "guest@example.com", name: "Guest" }],
  },
  owner_user_id: "user_1",
  organization_id: "org_1",
}));
