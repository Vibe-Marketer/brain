/**
 * Fathom connector adapter.
 *
 * Issue #283 — Phase 1. This file is the SINGLE place future per-source
 * additions are made. UI shells (ConnectorPanel) read from the registry,
 * so adding a new source means writing one of these files.
 */

import { RiMicLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
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

  async getOAuthAuthUrl() {
    const { data, error } = await supabase.functions.invoke("fathom-oauth-url");
    if (error) throw new Error(error.message);
    if (!data?.authUrl)
      throw new Error("No authUrl returned from fathom-oauth-url");
    return {
      authUrl: data.authUrl as string,
      sourceId: data.sourceId as string | undefined,
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

  async disconnect(sourceId) {
    const { error } = await supabase
      .from("import_sources")
      .update({ is_active: false })
      .eq("id", sourceId)
      .eq("source_app", "fathom");
    if (error) throw new Error(error.message);
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
      meetings?: FathomAvailableMeeting[];
      next_cursor?: string | null;
    } | null;

    return {
      items: (response?.meetings ?? []).map((meeting) => {
        const startTime =
          meeting.recording_start_time ?? meeting.created_at ?? null;
        const endTime = meeting.recording_end_time;
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
          externalId: String(meeting.recording_id),
          title: meeting.title,
          startTime,
          durationSeconds,
          participants: meeting.calendar_invitees,
          alreadyImported: meeting.synced,
          externalUrl: meeting.share_url ?? meeting.url ?? null,
        };
      }),
      nextCursor: response?.next_cursor ?? null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const recordingIds = externalIds.map((id) => Number(id));

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
