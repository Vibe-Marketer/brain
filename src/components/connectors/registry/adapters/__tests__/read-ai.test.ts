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
import { readAiAdapter } from "../read-ai";

const invoke = vi.mocked(supabase.functions.invoke);

describe("readAiAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a Read.ai OAuth URL", async () => {
    invoke.mockResolvedValue({
      data: { authUrl: "https://api.read.ai/oauth/ui", sourceId: "source-1" },
      error: null,
    });

    const result = await readAiAdapter.getOAuthAuthUrl!();

    expect(invoke).toHaveBeenCalledWith("read-ai-oauth-url");
    expect(result).toEqual({
      authUrl: "https://api.read.ai/oauth/ui",
      sourceId: "source-1",
    });
  });

  it("saves pasted bearer tokens through the token fallback function", async () => {
    invoke.mockResolvedValue({
      data: { success: true, sourceId: "source-2" },
      error: null,
    });

    const result = await readAiAdapter.saveApiKeyCredentials!({
      apiKey: "  bearer-token  ",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-connect-token", {
      body: { accessToken: "bearer-token" },
    });
    expect(result).toEqual({ sourceId: "source-2" });
  });

  it("maps Read.ai search results for the import wizard", async () => {
    invoke.mockResolvedValue({
      data: {
        meetings: [
          {
            recording_id: "01READ",
            title: "Read.ai Review",
            recording_start_time: "2026-05-20T10:00:00Z",
            duration: 1800,
            synced: false,
            importable: true,
            calendar_invitees: [{ name: "Ava", email: "ava@example.com" }],
            share_url: "https://app.read.ai/analytics/meetings/01READ",
          },
        ],
        nextCursor: "01NEXT",
      },
      error: null,
    });

    const result = await readAiAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-21T00:00:00Z"),
      limit: 25,
      cursor: "01CURSOR",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-fetch-meetings", {
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
          externalId: "01READ",
          title: "Read.ai Review",
          startTime: "2026-05-20T10:00:00Z",
          durationSeconds: 1800,
          participants: [{ name: "Ava", email: "ava@example.com" }],
          alreadyImported: false,
          externalUrl: "https://app.read.ai/analytics/meetings/01READ",
          metadata: { importable: true },
        },
      ],
    });
  });

  it("starts a Read.ai sync job for selected meetings", async () => {
    invoke.mockResolvedValue({
      data: { jobId: "job-1" },
      error: null,
    });

    const result = await readAiAdapter.importSelected!({
      sourceId: "source-1",
      externalIds: ["01READ"],
      workspaceId: "workspace-1",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-sync-meetings", {
      body: {
        sourceId: "source-1",
        workspaceId: "workspace-1",
        workspace_id: "workspace-1",
        meetingIds: ["01READ"],
      },
    });
    expect(result).toEqual({
      jobId: "job-1",
      total: 1,
      message: "Importing 1 Read.ai call(s)...",
    });
  });
});
