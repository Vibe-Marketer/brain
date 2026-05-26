import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
    },
    rpc: vi.fn(async () => ({ data: { disconnected: true }, error: null })),
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

  it("passes source id when replacing a pasted bearer token", async () => {
    invoke.mockResolvedValue({
      data: { success: true, sourceId: "source-existing" },
      error: null,
    });

    const result = await readAiAdapter.saveApiKeyCredentials!({
      sourceId: "source-existing",
      apiKey: "  bearer-token  ",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-connect-token", {
      body: {
        accessToken: "bearer-token",
        sourceId: "source-existing",
      },
    });
    expect(result).toEqual({ sourceId: "source-existing" });
  });

  it("loads and saves manual Read.ai webhook settings", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        sourceId: "source-1",
        webhookUrl: "https://project.supabase.co/functions/v1/read-ai-webhook/rwh_123",
        webhookPathToken: "rwh_123",
        webhookSigningSecret: "read-signing-key",
        verification: { verified: false, lastVerifiedAt: null },
      },
      error: null,
    });

    const details = await readAiAdapter.getWebhookDetails!({
      sourceId: "source-1",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-webhook-settings", {
      body: { sourceId: "source-1" },
    });
    expect(details.webhookPathToken).toBe("rwh_123");

    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        sourceId: "source-1",
        webhookUrl: "https://project.supabase.co/functions/v1/read-ai-webhook/rwh_123",
        webhookPathToken: "rwh_123",
        webhookSigningSecret: "updated-signing-key",
        verification: { verified: false, lastVerifiedAt: null },
      },
      error: null,
    });

    const saved = await readAiAdapter.saveWebhookConfig!({
      sourceId: "source-1",
      webhookSigningSecret: "updated-signing-key",
    });

    expect(invoke).toHaveBeenCalledWith("read-ai-webhook-settings", {
      body: {
        sourceId: "source-1",
        webhookSigningSecret: "updated-signing-key",
      },
    });
    expect(saved).toMatchObject({
      sourceId: "source-1",
      webhookSigningSecret: "updated-signing-key",
    });
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

  it("does not label unavailable Read.ai list rows as already imported", async () => {
    invoke.mockResolvedValue({
      data: {
        meetings: [
          {
            recording_id: "01READ",
            title: "Read.ai Review",
            recording_start_time: "2026-05-20T10:00:00Z",
            duration: 1800,
            synced: false,
            importable: false,
          },
        ],
      },
      error: null,
    });

    const result = await readAiAdapter.searchAvailable!({
      sourceId: "source-1",
      dateStart: new Date("2026-05-20T00:00:00Z"),
      dateEnd: new Date("2026-05-21T00:00:00Z"),
    });

    expect(result.items[0]).toMatchObject({
      externalId: "01READ",
      alreadyImported: false,
      metadata: { importable: false },
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
