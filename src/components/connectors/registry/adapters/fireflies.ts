/**
 * Fireflies connector adapter. Issue #283 — Phase 1.
 *
 * Fireflies is API-key + webhook only (no OAuth). The save flow calls the
 * `fireflies-save-source` edge function which writes an encrypted row via
 * `store_encrypted_fireflies_credentials`.
 */

import { RiFireLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectorAdapter } from "../types";

interface FirefliesAvailableMeeting {
  recording_id: string;
  title: string;
  recording_start_time: string | null;
  duration: number | null;
  calendar_invitees?: Array<{ name: string | null; email: string | null }>;
  synced: boolean;
  share_url?: string | null;
  source_url?: string | null;
}

export const firefliesAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "fireflies",
    label: "Fireflies",
    description: "Transcript API import",
    icon: RiFireLine,
    brandColor: "#F25C54",
    authMethods: ["api_key", "webhook_only"],
    order: 30,
  },

  async saveApiKeyCredentials({ apiKey, webhookSecret, accountEmail }) {
    const { data, error } = await supabase.functions.invoke(
      "fireflies-save-source",
      {
        body: {
          apiKey: apiKey.trim(),
          webhookSigningSecret: webhookSecret?.trim() ?? null,
          accountEmail: accountEmail?.trim() ?? null,
        },
      },
    );
    if (error) throw new Error(error.message);
    if (!data?.sourceId) {
      throw new Error("fireflies-save-source returned no sourceId");
    }
    return { sourceId: data.sourceId as string };
  },

  async disconnect(sourceId) {
    const { error } = await supabase
      .from("import_sources")
      .update({ is_active: false })
      .eq("id", sourceId)
      .eq("source_app", "fireflies");
    if (error) throw new Error(error.message);
  },

  async searchAvailable({ sourceId, dateStart, dateEnd, limit, cursor }) {
    const dateStartIso = dateStart.toISOString();
    const dateEndIso = dateEnd.toISOString();
    const { data, error } = await supabase.functions.invoke(
      "fireflies-fetch-meetings",
      {
        body: {
          sourceId,
          dateStart: dateStartIso,
          dateEnd: dateEndIso,
          createdAfter: dateStartIso,
          createdBefore: dateEndIso,
          limit: limit ?? 50,
          skip: cursor ? Number(cursor) : 0,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const response = data as {
      meetings?: FirefliesAvailableMeeting[];
      nextCursor?: string | null;
      nextSkip?: number | null;
    } | null;

    return {
      items: (response?.meetings ?? []).map((meeting) => ({
        externalId: meeting.recording_id,
        title: meeting.title,
        startTime: meeting.recording_start_time,
        durationSeconds: meeting.duration,
        participants: meeting.calendar_invitees,
        alreadyImported: meeting.synced,
        externalUrl: meeting.share_url ?? meeting.source_url,
      })),
      nextCursor:
        response?.nextCursor ?? response?.nextSkip?.toString() ?? null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const { data, error } = await supabase.functions.invoke(
      "fireflies-sync-meetings",
      {
        body: {
          sourceId,
          workspaceId,
          workspace_id: workspaceId,
          recordingIds: externalIds,
          transcriptIds: externalIds,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    return {
      jobId: (data as { jobId: string }).jobId,
      total: externalIds.length,
      message: `Importing ${externalIds.length} Fireflies call(s)…`,
    };
  },
};
