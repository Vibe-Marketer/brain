import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { fathomAdapter } from "../fathom";

const invoke = vi.mocked(supabase.functions.invoke);

describe("fathomAdapter.searchAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests paged Fathom meetings and normalizes them for the import wizard", async () => {
    invoke.mockResolvedValue({
      data: {
        meetings: [
          {
            recording_id: 123,
            title: "Pipeline Review",
            created_at: "2026-05-20T09:00:00Z",
            recording_start_time: "2026-05-20T10:00:00Z",
            recording_end_time: "2026-05-20T10:30:30Z",
            synced: true,
            calendar_invitees: [{ name: "Ava", email: "ava@example.com" }],
            share_url: "https://fathom.video/share/123",
          },
          {
            recording_id: 456,
            title: "Fallback Start",
            created_at: "2026-05-21T09:00:00Z",
            recording_start_time: null,
            recording_end_time: null,
            synced: false,
            url: "https://fathom.video/calls/456",
          },
        ],
        next_cursor: "cursor-2",
      },
      error: null,
    });

    const result = await fathomAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-22T00:00:00Z"),
      cursor: "cursor-1",
    });

    expect(invoke).toHaveBeenCalledWith("fetch-meetings", {
      body: {
        sourceId: "source-1",
        createdAfter: "2026-05-20T00:00:00.000Z",
        createdBefore: "2026-05-22T00:00:00.000Z",
        cursor: "cursor-1",
        pageMode: true,
      },
    });
    expect(result).toEqual({
      nextCursor: "cursor-2",
      items: [
        {
          externalId: "123",
          title: "Pipeline Review",
          startTime: "2026-05-20T10:00:00Z",
          durationSeconds: 1830,
          participants: [{ name: "Ava", email: "ava@example.com" }],
          alreadyImported: true,
          externalUrl: "https://fathom.video/share/123",
        },
        {
          externalId: "456",
          title: "Fallback Start",
          startTime: "2026-05-21T09:00:00Z",
          durationSeconds: null,
          participants: undefined,
          alreadyImported: false,
          externalUrl: "https://fathom.video/calls/456",
        },
      ],
    });
  });

  it("throws Supabase invoke errors from searchAvailable", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: "Function returned 401" },
    });

    await expect(
      fathomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("Function returned 401");
  });

  it("throws provider payload errors from searchAvailable", async () => {
    invoke.mockResolvedValue({
      data: { error: "Fathom token expired" },
      error: null,
    });

    await expect(
      fathomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("Fathom token expired");
  });

  it("throws when fetch-meetings returns a malformed meetings payload", async () => {
    invoke.mockResolvedValue({
      data: { calls: [] },
      error: null,
    });

    await expect(
      fathomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("fetch-meetings returned an invalid meetings payload");
  });
});

describe("fathomAdapter.importSelected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a Fathom sync job for the selected recording IDs", async () => {
    invoke.mockResolvedValue({
      data: { job_id: "job-123" },
      error: null,
    });

    const result = await fathomAdapter.importSelected!({
      sourceId: "source-1",
      externalIds: ["123", "456"],
      workspaceId: "workspace-1",
    });

    expect(invoke).toHaveBeenCalledWith("sync-meetings", {
      body: {
        sourceId: "source-1",
        workspaceId: "workspace-1",
        workspace_id: "workspace-1",
        recordingIds: [123, 456],
      },
    });
    expect(result).toEqual({
      jobId: "job-123",
      total: 2,
      message: "Importing 2 Fathom call(s)…",
    });
  });

  it("throws provider payload errors from importSelected", async () => {
    invoke.mockResolvedValue({
      data: { error: "Fathom token expired" },
      error: null,
    });

    await expect(
      fathomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["123"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Fathom token expired");
  });

  it("throws when sync-meetings returns no job id", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });

    await expect(
      fathomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["123"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("sync-meetings returned no jobId");
  });

  it("throws before invoking sync-meetings for invalid recording IDs", async () => {
    await expect(
      fathomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["not-a-number"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Invalid Fathom recording id: not-a-number");

    expect(invoke).not.toHaveBeenCalled();
  });
});
