/**
 * Plaud connector adapter. Issue #283 — Phase 1.
 *
 * Plaud's working connection path uses the user's Plaud Web/OpenPlaud browser
 * token. Plaud OAuth scaffolding exists server-side, but is not presented as
 * the normal user flow until it works end to end.
 * See plaud-connect-token / plaud-sync-recordings.
 */

import { RiVoiceprintLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage, disconnectConnectorSource } from "./adapter-helpers";
import type { ConnectorAdapter } from "../types";

interface PlaudAvailableRecording {
  recording_id: string;
  title: string;
  recording_start_time: string | null;
  duration: number | null;
  synced: boolean;
  source_url?: string | null;
  metadata?: Record<string, unknown>;
}

export const plaudAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "plaud",
    label: "Plaud",
    description: "AI voice recorder",
    icon: RiVoiceprintLine,
    brandColor: "#7C3AED",
    authMethods: ["api_key"],
    order: 40,
    badge: "beta",
  },
  setup: {
    kind: "browser_bridge",
    beta: true,
    accountLabelField: "email",
    credentialFields: [
      {
        name: "apiKey",
        label: "Plaud Web token",
        required: true,
        secret: true,
        placeholder: "Paste the Plaud Bearer token from Plaud Web",
        helperText:
          "Use manual token paste only when the CallVault Plaud Connector browser bridge is unavailable.",
        autoComplete: "off",
      },
      {
        name: "apiBase",
        label: "Plaud region",
        required: true,
        placeholder: "https://api.plaud.ai",
        helperText: "Choose the Plaud API region that matches your account.",
        autoComplete: "off",
        options: [
          { label: "Global", value: "https://api.plaud.ai" },
          { label: "Europe", value: "https://api-euc1.plaud.ai" },
          { label: "Asia Pacific", value: "https://api-apse1.plaud.ai" },
        ],
      },
    ],
    helperCopy: {
      disconnected:
        "Use the CallVault Plaud Connector browser bridge to open Plaud Web and capture a valid session token.",
      connected: "Plaud is connected and ready to search recordings by date.",
      saveSuccess: "Plaud token captured and saved.",
      verificationWaiting:
        "Finish signing in on Plaud Web. The browser bridge is waiting for a valid token.",
    },
  },

  async saveApiKeyCredentials({ sourceId, apiKey, accountEmail, apiBase }) {
    const { data, error } = await supabase.functions.invoke(
      "plaud-connect-token",
      {
        body: {
          sourceId,
          accessToken: apiKey.trim(),
          accountEmail: accountEmail?.trim() ?? null,
          apiBase,
        },
      },
    );
    if (error) throw new Error(await getFunctionErrorMessage(error));
    if (!data?.sourceId) {
      throw new Error("plaud-connect-token returned no sourceId");
    }
    return { sourceId: data.sourceId as string };
  },

  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "plaud", sourceId });
  },

  async searchAvailable({ sourceId, dateStart, dateEnd, limit, cursor }) {
    const { data, error } = await supabase.functions.invoke(
      "plaud-sync-recordings",
      {
        body: {
          mode: "search",
          sourceId,
          dateStart: dateStart.toISOString(),
          dateEnd: dateEnd.toISOString(),
          limit: limit ?? 50,
          cursor: cursor ?? undefined,
        },
      },
    );
    if (error) throw new Error(await getFunctionErrorMessage(error));
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const response = data as {
      recordings?: PlaudAvailableRecording[];
      nextCursor?: string | null;
    } | null;

    return {
      items: (response?.recordings ?? []).map((recording) => ({
        externalId: recording.recording_id,
        title: recording.title,
        startTime: recording.recording_start_time,
        durationSeconds: recording.duration,
        alreadyImported: recording.synced,
        externalUrl: recording.source_url ?? null,
        metadata: recording.metadata,
      })),
      nextCursor: response?.nextCursor ?? null,
    };
  },

  async importSelected({ sourceId, externalIds, workspaceId }) {
    const fileIds = externalIds.map((id) => id.trim()).filter(Boolean);
    if (fileIds.length !== externalIds.length) {
      throw new Error("Plaud recording IDs must be non-empty strings");
    }

    const { data, error } = await supabase.functions.invoke(
      "plaud-sync-recordings",
      {
        body: {
          sourceId,
          workspace_id: workspaceId,
          workspaceId,
          fileIds,
        },
      },
    );
    if (error) throw new Error(await getFunctionErrorMessage(error));
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const jobId = (data as { jobId?: string; job_id?: string } | null)?.jobId
      ?? (data as { jobId?: string; job_id?: string } | null)?.job_id;
    if (!jobId) {
      throw new Error("plaud-sync-recordings returned no jobId");
    }

    return {
      jobId,
      total: fileIds.length,
      message: `Importing ${fileIds.length} Plaud recording(s)…`,
    };
  },
};
