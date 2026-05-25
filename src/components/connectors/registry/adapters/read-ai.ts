import { RiCloudLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { disconnectConnectorSource } from "../../hooks/useConnector";
import type { ConnectorAdapter } from "../types";

interface ReadAiAvailableMeeting {
  recording_id: string;
  title: string;
  recording_start_time: string | null;
  duration: number | null;
  calendar_invitees?: Array<{ name: string | null; email: string | null }>;
  synced: boolean;
  importable?: boolean;
  share_url?: string | null;
  source_url?: string | null;
}

export const readAiAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "read-ai",
    label: "Read.ai",
    description: "Meeting reports and transcripts",
    icon: RiCloudLine,
    brandColor: "#5B7CFA",
    authMethods: ["oauth", "api_key"],
    order: 45,
  },
  setup: {
    kind: "oauth",
    alternateKinds: ["api_key"],
    accountLabelField: "email",
    credentialFields: [
      {
        name: "apiKey",
        label: "Read.ai bearer token",
        required: true,
        secret: true,
        placeholder: "Paste a Read.ai bearer token",
        autoComplete: "off",
      },
    ],
    helperCopy: {
      disconnected:
        "Connect Read.ai with OAuth, or paste a bearer token while the connector is in beta.",
      connected: "Read.ai is connected and ready to import meeting reports.",
      saveSuccess: "Read.ai credentials saved.",
    },
  },

  async getOAuthAuthUrl() {
    const { data, error } = await supabase.functions.invoke("read-ai-oauth-url");
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }
    if (!data?.authUrl) {
      throw new Error("read-ai-oauth-url returned no authUrl");
    }
    return {
      authUrl: data.authUrl as string,
      sourceId: data.sourceId as string | undefined,
      state: data.state as string | undefined,
    };
  },

  async saveApiKeyCredentials({ apiKey }) {
    const { data, error } = await supabase.functions.invoke(
      "read-ai-connect-token",
      {
        body: { accessToken: apiKey.trim() },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }
    if (!data?.sourceId) {
      throw new Error("read-ai-connect-token returned no sourceId");
    }
    return { sourceId: data.sourceId as string };
  },

  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "read-ai", sourceId });
  },

  async searchAvailable({ sourceId, dateStart, dateEnd, limit, cursor }) {
    const { data, error } = await supabase.functions.invoke(
      "read-ai-fetch-meetings",
      {
        body: {
          sourceId,
          createdAfter: dateStart.toISOString(),
          createdBefore: dateEnd.toISOString(),
          cursor: cursor ?? null,
          limit: limit ?? 10,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const response = data as {
      meetings?: ReadAiAvailableMeeting[];
      nextCursor?: string | null;
    } | null;

    return {
      items: (response?.meetings ?? []).map((meeting) => ({
        externalId: meeting.recording_id,
        title: meeting.title,
        startTime: meeting.recording_start_time,
        durationSeconds: meeting.duration,
        participants: meeting.calendar_invitees,
        alreadyImported: meeting.synced || meeting.importable === false,
        externalUrl: meeting.share_url ?? meeting.source_url,
        metadata: { importable: meeting.importable ?? true },
      })),
      nextCursor: response?.nextCursor ?? null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const { data, error } = await supabase.functions.invoke(
      "read-ai-sync-meetings",
      {
        body: {
          sourceId,
          workspaceId,
          workspace_id: workspaceId,
          meetingIds: externalIds,
        },
      },
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }
    if (!(data as { jobId?: string } | null)?.jobId) {
      throw new Error("read-ai-sync-meetings returned no jobId");
    }

    return {
      jobId: (data as { jobId: string }).jobId,
      total: externalIds.length,
      message: `Importing ${externalIds.length} Read.ai call(s)...`,
    };
  },
};
