import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    })),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { grainAdapter } from "../grain";

const invoke = vi.mocked(supabase.functions.invoke);

describe("grainAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a Grain OAuth URL", async () => {
    invoke.mockResolvedValue({
      data: { authUrl: "https://grain.com/_/public-api/oauth2/authorize", sourceId: "source-1" },
      error: null,
    });

    const result = await grainAdapter.getOAuthAuthUrl!();

    expect(invoke).toHaveBeenCalledWith("grain-oauth-url");
    expect(result).toEqual({
      authUrl: "https://grain.com/_/public-api/oauth2/authorize",
      sourceId: "source-1",
    });
  });

  it("saves pasted bearer tokens through the token fallback function", async () => {
    invoke.mockResolvedValue({
      data: { success: true, sourceId: "source-2" },
      error: null,
    });

    const result = await grainAdapter.saveApiKeyCredentials!({
      apiKey: "  bearer-token  ",
    });

    expect(invoke).toHaveBeenCalledWith("grain-connect-token", {
      body: { accessToken: "bearer-token" },
    });
    expect(result).toEqual({ sourceId: "source-2" });
  });

  it("maps Grain search results for the import wizard", async () => {
    invoke.mockResolvedValue({
      data: {
        meetings: [
          {
            recording_id: "grain-1",
            title: "Grain Review",
            recording_start_time: "2026-05-20T10:00:00Z",
            duration: 1800,
            synced: false,
            importable: true,
            calendar_invitees: [{ name: "Ava", email: "ava@example.com" }],
            share_url: "https://grain.com/share/recording/grain-1",
          },
        ],
        nextCursor: "01NEXT",
      },
      error: null,
    });

    const result = await grainAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-21T00:00:00Z"),
      limit: 25,
      cursor: "01CURSOR",
    });

    expect(invoke).toHaveBeenCalledWith("grain-fetch-recordings", {
      body: {
        sourceId: "source-1",
        createdAfter: "2026-05-20T00:00:00.000Z",
        createdBefore: "2026-05-21T00:00:00.000Z",
        cursor: "01CURSOR",
        limit: 25,
      },
    });
    expect(result).toEqual({
      nextCursor: "01NEXT",
      items: [
        {
          externalId: "grain-1",
          title: "Grain Review",
          startTime: "2026-05-20T10:00:00Z",
          durationSeconds: 1800,
          participants: [{ name: "Ava", email: "ava@example.com" }],
          alreadyImported: false,
          externalUrl: "https://grain.com/share/recording/grain-1",
          metadata: { importable: true },
        },
      ],
    });
  });

  it("starts a Grain sync job for selected recordings", async () => {
    invoke.mockResolvedValue({
      data: { jobId: "job-1" },
      error: null,
    });

    const result = await grainAdapter.importSelected!({
      sourceId: "source-1",
      externalIds: ["grain-1"],
      workspaceId: "workspace-1",
    });

    expect(invoke).toHaveBeenCalledWith("grain-sync-recordings", {
      body: {
        sourceId: "source-1",
        workspaceId: "workspace-1",
        workspace_id: "workspace-1",
        recordingIds: ["grain-1"],
      },
    });
    expect(result).toEqual({
      jobId: "job-1",
      total: 1,
      message: "Importing 1 Grain call(s)...",
    });
  });
});
