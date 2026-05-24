import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { zoomAdapter } from "../zoom";

const invoke = vi.mocked(supabase.functions.invoke);

describe("zoomAdapter.searchAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests Zoom recordings and normalizes them for the import wizard", async () => {
    invoke.mockResolvedValue({
      data: {
        meetings: [
          {
            recording_id: "zoom-uuid-1",
            meeting_id: 987654321,
            title: "Product Review",
            host_email: "host@example.com",
            created_at: "2026-05-20T09:00:00Z",
            recording_start_time: "2026-05-20T10:00:00Z",
            recording_end_time: "2026-05-20T10:45:00Z",
            duration: 45,
            has_transcript: true,
            synced: true,
            calendar_invitees: [{ name: "Ava", email: "ava@example.com" }],
          },
          {
            recording_id: "zoom-uuid-2",
            title: "Fallback Duration",
            created_at: "2026-05-21T09:00:00Z",
            recording_start_time: null,
            recording_end_time: null,
            duration: 25,
            synced: false,
          },
        ],
      },
      error: null,
    });

    const result = await zoomAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-22T00:00:00Z"),
    });

    expect(invoke).toHaveBeenCalledWith("zoom-fetch-meetings", {
      body: {
        sourceId: "source-1",
        createdAfter: "2026-05-20T00:00:00.000Z",
        createdBefore: "2026-05-22T00:00:00.000Z",
      },
    });
    expect(result).toEqual({
      nextCursor: null,
      items: [
        {
          externalId: "zoom-uuid-1",
          title: "Product Review",
          startTime: "2026-05-20T10:00:00Z",
          durationSeconds: 2700,
          participants: [{ name: "Ava", email: "ava@example.com" }],
          alreadyImported: true,
          externalUrl: null,
          metadata: {
            meetingId: 987654321,
            hostEmail: "host@example.com",
            hasTranscript: true,
          },
        },
        {
          externalId: "zoom-uuid-2",
          title: "Fallback Duration",
          startTime: "2026-05-21T09:00:00Z",
          durationSeconds: 1500,
          participants: undefined,
          alreadyImported: false,
          externalUrl: null,
          metadata: {
            meetingId: null,
            hostEmail: null,
            hasTranscript: false,
          },
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
      zoomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("Function returned 401");
  });

  it("throws provider payload errors from searchAvailable", async () => {
    invoke.mockResolvedValue({
      data: { error: "Zoom token expired" },
      error: null,
    });

    await expect(
      zoomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("Zoom token expired");
  });

  it("throws when zoom-fetch-meetings returns a malformed meetings payload", async () => {
    invoke.mockResolvedValue({
      data: { calls: [] },
      error: null,
    });

    await expect(
      zoomAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow(
      "zoom-fetch-meetings returned an invalid meetings payload",
    );
  });
});

describe("zoomAdapter.importSelected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a Zoom sync job for the selected recording UUIDs", async () => {
    invoke.mockResolvedValue({
      data: { job_id: "job-123" },
      error: null,
    });

    const result = await zoomAdapter.importSelected!({
      sourceId: "source-1",
      externalIds: [" zoom-uuid-1 ", "zoom-uuid-2"],
      workspaceId: "workspace-1",
    });

    expect(invoke).toHaveBeenCalledWith("zoom-sync-meetings", {
      body: {
        sourceId: "source-1",
        workspaceId: "workspace-1",
        workspace_id: "workspace-1",
        recordingIds: ["zoom-uuid-1", "zoom-uuid-2"],
      },
    });
    expect(result).toEqual({
      jobId: "job-123",
      total: 2,
      message: "Importing 2 Zoom recording(s)…",
    });
  });

  it("throws provider payload errors from importSelected", async () => {
    invoke.mockResolvedValue({
      data: { error: "Zoom token expired" },
      error: null,
    });

    await expect(
      zoomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["zoom-uuid-1"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Zoom token expired");
  });

  it("throws when zoom-sync-meetings returns no job id", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });

    await expect(
      zoomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["zoom-uuid-1"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("zoom-sync-meetings returned no jobId");
  });

  it("throws before invoking zoom-sync-meetings for blank recording IDs", async () => {
    await expect(
      zoomAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["   "],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Invalid Zoom recording id");

    expect(invoke).not.toHaveBeenCalled();
  });
});
