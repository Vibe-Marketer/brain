/**
 * Zoom connector adapter. Issue #283 — Phase 1.
 */

import { RiVideoLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { disconnectConnectorSource } from "../../hooks/useConnector";
import type { ConnectorAdapter } from "../types";

interface ZoomAvailableMeeting {
  recording_id: string;
  meeting_id?: number | null;
  title: string;
  host_email?: string | null;
  created_at?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  duration?: number | null;
  has_transcript?: boolean;
  synced: boolean;
  calendar_invitees?: Array<{ name: string | null; email: string | null }>;
}

export const zoomAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "zoom",
    label: "Zoom",
    description: "Cloud recordings",
    icon: RiVideoLine,
    brandColor: "#2D8CFF",
    authMethods: ["oauth"],
    order: 20,
  },
  setup: {
    kind: "oauth",
    accountLabelField: "email",
    helperCopy: {
      disconnected:
        "Connect Zoom to import cloud recordings and transcripts from your account.",
      connected: "Zoom is connected and ready to import cloud recordings.",
    },
  },

  async getOAuthAuthUrl() {
    const { data, error } = await supabase.functions.invoke("zoom-oauth-url");
    if (error) throw new Error(error.message);
    if (!data?.authUrl)
      throw new Error("No authUrl returned from zoom-oauth-url");
    return {
      authUrl: data.authUrl as string,
      sourceId: data.sourceId as string | undefined,
      state: data.state as string | undefined,
    };
  },

  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "zoom", sourceId });
  },

  async searchAvailable({ sourceId, dateStart, dateEnd }) {
    const createdAfter = dateStart.toISOString();
    const createdBefore = dateEnd.toISOString();

    const { data, error } = await supabase.functions.invoke(
      "zoom-fetch-meetings",
      {
        body: {
          sourceId,
          createdAfter,
          createdBefore,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const response = data as { meetings?: unknown } | null;
    if (!response || !Array.isArray(response.meetings)) {
      throw new Error(
        "zoom-fetch-meetings returned an invalid meetings payload",
      );
    }

    return {
      items: response.meetings.map((meeting) => {
        const zoomMeeting = meeting as ZoomAvailableMeeting;
        const startTime =
          zoomMeeting.recording_start_time ?? zoomMeeting.created_at ?? null;
        const endTime = zoomMeeting.recording_end_time;
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
            : typeof zoomMeeting.duration === "number"
              ? zoomMeeting.duration * 60
              : null;

        return {
          externalId: zoomMeeting.recording_id,
          title: zoomMeeting.title,
          startTime,
          durationSeconds,
          participants: zoomMeeting.calendar_invitees,
          alreadyImported: zoomMeeting.synced,
          externalUrl: null,
          metadata: {
            meetingId: zoomMeeting.meeting_id ?? null,
            hostEmail: zoomMeeting.host_email ?? null,
            hasTranscript: zoomMeeting.has_transcript ?? false,
          },
        };
      }),
      nextCursor: null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const recordingIds = externalIds.map((id) => id.trim());
    const invalidId = recordingIds.find((id) => id.length === 0);

    if (invalidId !== undefined) {
      throw new Error("Invalid Zoom recording id");
    }

    const { data, error } = await supabase.functions.invoke(
      "zoom-sync-meetings",
      {
        body: {
          sourceId,
          workspaceId,
          workspace_id: workspaceId,
          recordingIds,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const payload = data as { jobId?: string; job_id?: string } | null;
    const jobId = payload?.jobId ?? payload?.job_id;
    if (!jobId) {
      throw new Error("zoom-sync-meetings returned no jobId");
    }

    return {
      jobId,
      total: externalIds.length,
      message: `Importing ${externalIds.length} Zoom recording(s)…`,
    };
  },
};
