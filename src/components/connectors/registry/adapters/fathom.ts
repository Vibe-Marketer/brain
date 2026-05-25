/**
 * Fathom connector adapter.
 *
 * Issue #283 — Phase 1. This file is the SINGLE place future per-source
 * additions are made. UI shells (ConnectorPanel) read from the registry,
 * so adding a new source means writing one of these files.
 */

import { RiMicLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { disconnectConnectorSource } from "../../hooks/useConnector";
import type { ConnectorAdapter } from "../types";

interface FathomAvailableMeeting {
  recording_id: number;
  title: string;
  created_at?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  synced: boolean;
  calendar_invitees?: Array<{ name: string | null; email: string | null }>;
  share_url?: string | null;
  url?: string | null;
}

export const fathomAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "fathom",
    label: "Fathom",
    description: "AI meeting recorder",
    icon: RiMicLine,
    brandColor: "#0A84FF",
    authMethods: ["oauth", "api_key"],
    order: 10,
  },
  setup: {
    kind: "oauth",
    alternateKinds: ["api_key_webhook"],
    accountLabelField: "hostEmail",
    credentialFields: [
      {
        name: "apiKey",
        label: "Fathom API key",
        required: true,
        secret: true,
        placeholder: "Your Fathom API key",
        autoComplete: "off",
      },
    ],
    webhook: {
      required: true,
      providerLabel: "Fathom",
      urlLabel: "Webhook URL for Fathom",
      signingSecretLabel: "Webhook secret",
      signingSecretPlaceholder: "whsec_xxxxxxxxxxxxxxxxxx",
      signingSecretHelperText:
        "Required for legacy Fathom webhook event matching.",
      signingSecretField: "webhookSecret",
      destinationPath: "webhook",
      helperText:
        "Paste the CallVault webhook URL in Fathom and use the matching webhook secret.",
    },
    helperCopy: {
      disconnected:
        "Connect with OAuth, or use the legacy API key and webhook secret flow if your workspace still depends on it.",
      connected: "Fathom is connected and ready to import meeting recordings.",
      saveSuccess: "Fathom credentials saved.",
    },
  },

  async getOAuthAuthUrl() {
    const { data, error } = await supabase.functions.invoke("fathom-oauth-url", {
      body: {},
    });
    if (error) throw new Error(await getFunctionErrorMessage(error));
    if (!data?.authUrl)
      throw new Error("No authUrl returned from fathom-oauth-url");
    return {
      authUrl: data.authUrl as string,
      sourceId: data.sourceId as string | undefined,
      state: data.state as string | undefined,
    };
  },

  async saveApiKeyCredentials({ apiKey, webhookSecret }) {
    if (!webhookSecret?.startsWith("whsec_")) {
      throw new Error("Webhook secret must start with whsec_");
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        fathom_api_key: apiKey.trim(),
        webhook_secret: webhookSecret.trim(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    return { sourceId: user.id };
  },

  async getWebhookDetails() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("user_settings")
      .select("webhook_secret")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      webhookSigningSecret: data?.webhook_secret ?? null,
    };
  },

  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "fathom", sourceId });
  },

  async searchAvailable({ sourceId, dateStart, dateEnd, cursor }) {
    const createdAfter = dateStart.toISOString();
    const createdBefore = dateEnd.toISOString();

    const { data, error } = await supabase.functions.invoke("fetch-meetings", {
      body: {
        sourceId,
        createdAfter,
        createdBefore,
        cursor: cursor ?? undefined,
        pageMode: true,
      },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const response = data as {
      meetings?: unknown;
      next_cursor?: string | null;
    } | null;

    if (!response || !Array.isArray(response.meetings)) {
      throw new Error("fetch-meetings returned an invalid meetings payload");
    }

    return {
      items: response.meetings.map((meeting) => {
        const fathomMeeting = meeting as FathomAvailableMeeting;
        const startTime =
          fathomMeeting.recording_start_time ??
          fathomMeeting.created_at ??
          null;
        const endTime = fathomMeeting.recording_end_time;
        const durationSeconds =
          startTime && endTime
            ? Math.max(
                0,
                Math.floor(
                  (new Date(endTime).getTime() -
                    new Date(startTime).getTime()) /
                    1000,
                ),
              )
            : null;
        return {
          externalId: String(fathomMeeting.recording_id),
          title: fathomMeeting.title,
          startTime,
          durationSeconds,
          participants: fathomMeeting.calendar_invitees,
          alreadyImported: fathomMeeting.synced,
          externalUrl: fathomMeeting.share_url ?? fathomMeeting.url ?? null,
        };
      }),
      nextCursor: response?.next_cursor ?? null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const recordingIds = externalIds.map((id) => Number(id));
    const invalidId = externalIds.find((_, index) => {
      const recordingId = recordingIds[index];
      return !Number.isSafeInteger(recordingId) || recordingId <= 0;
    });

    if (invalidId) {
      throw new Error(`Invalid Fathom recording id: ${invalidId}`);
    }

    const { data, error } = await supabase.functions.invoke("sync-meetings", {
      body: {
        sourceId,
        workspaceId,
        workspace_id: workspaceId,
        recordingIds,
      },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const payload = data as { jobId?: string; job_id?: string } | null;
    const jobId = payload?.jobId ?? payload?.job_id;
    if (!jobId) {
      throw new Error("sync-meetings returned no jobId");
    }

    return {
      jobId,
      total: externalIds.length,
      message: `Importing ${externalIds.length} Fathom call(s)…`,
    };
  },
};

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "Edge Function request failed";
  const response = (error as { context?: unknown } | null)?.context;

  if (!(response instanceof Response)) return fallback;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.clone().json()) as {
        error?: unknown;
        message?: unknown;
      };
      const message = body.error ?? body.message;
      return typeof message === "string" && message.trim()
        ? message
        : fallback;
    }

    const text = await response.clone().text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}
