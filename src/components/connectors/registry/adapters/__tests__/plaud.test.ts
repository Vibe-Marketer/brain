import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { plaudAdapter } from "../plaud";

const invoke = vi.mocked(supabase.functions.invoke);

describe("plaudAdapter.searchAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks Plaud as beta in connector metadata", () => {
    expect(plaudAdapter.metadata.badge).toBe("beta");
  });

  it("requests searchable Plaud recordings and normalizes them for the import wizard", async () => {
    invoke.mockResolvedValue({
      data: {
        recordings: [
          {
            recording_id: "file-1",
            title: "Field Notes",
            recording_start_time: "2026-05-20T10:00:00.000Z",
            duration: 125,
            synced: true,
            metadata: { plaud_serial_number: "PLAUD123" },
          },
        ],
        nextCursor: "50",
      },
      error: null,
    });

    const result = await plaudAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-21T00:00:00Z"),
      limit: 50,
      cursor: "0",
    });

    expect(invoke).toHaveBeenCalledWith("plaud-sync-recordings", {
      body: {
        mode: "search",
        sourceId: "source-1",
        dateStart: "2026-05-20T00:00:00.000Z",
        dateEnd: "2026-05-21T00:00:00.000Z",
        limit: 50,
        cursor: "0",
      },
    });
    expect(result).toEqual({
      nextCursor: "50",
      items: [
        {
          externalId: "file-1",
          title: "Field Notes",
          startTime: "2026-05-20T10:00:00.000Z",
          durationSeconds: 125,
          alreadyImported: true,
          externalUrl: null,
          metadata: { plaud_serial_number: "PLAUD123" },
        },
      ],
    });
  });

  it("throws provider payload errors from searchAvailable", async () => {
    invoke.mockResolvedValue({
      data: { error: "Plaud access token is missing. Reconnect Plaud." },
      error: null,
    });

    await expect(
      plaudAdapter.searchAvailable!({
        sourceId: "source-1",
        dateStart: new Date("2026-05-20T00:00:00Z"),
        dateEnd: new Date("2026-05-21T00:00:00Z"),
      }),
    ).rejects.toThrow("Plaud access token is missing");
  });
});

describe("plaudAdapter.importSelected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a Plaud sync job for selected file IDs", async () => {
    invoke.mockResolvedValue({
      data: { jobId: "job-123" },
      error: null,
    });

    const result = await plaudAdapter.importSelected!({
      sourceId: "source-1",
      externalIds: ["file-1", "file-2"],
      workspaceId: "workspace-1",
    });

    expect(invoke).toHaveBeenCalledWith("plaud-sync-recordings", {
      body: {
        sourceId: "source-1",
        workspace_id: "workspace-1",
        workspaceId: "workspace-1",
        fileIds: ["file-1", "file-2"],
      },
    });
    expect(result).toEqual({
      jobId: "job-123",
      total: 2,
      message: "Importing 2 Plaud recording(s)…",
    });
  });

  it("throws when plaud-sync-recordings returns no job id", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });

    await expect(
      plaudAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["file-1"],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("plaud-sync-recordings returned no jobId");
  });

  it("throws before invoking for blank Plaud recording IDs", async () => {
    await expect(
      plaudAdapter.importSelected!({
        sourceId: "source-1",
        externalIds: ["file-1", "  "],
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Plaud recording IDs must be non-empty strings");

    expect(invoke).not.toHaveBeenCalled();
  });
});
