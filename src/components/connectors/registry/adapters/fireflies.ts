/**
 * Fireflies connector adapter. Issue #283 — Phase 1.
 *
 * Fireflies is API-key + webhook only (no OAuth). The save flow calls the
 * `fireflies-save-source` edge function which writes an encrypted row via
 * `store_encrypted_fireflies_credentials`.
 */

import { RiFireLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage, disconnectConnectorSource } from "./adapter-helpers";
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
  setup: {
    kind: "api_key_webhook",
    accountLabelField: "email",
    credentialFields: [
      {
        name: "apiKey",
        label: "Fireflies API key",
        required: true,
        secret: true,
        placeholder: "Your Fireflies API key",
        autoComplete: "off",
      },
    ],
    webhook: {
      required: true,
      providerLabel: "Fireflies",
      urlLabel: "Webhook URL for Fireflies",
      signingSecretLabel: "Webhook signing secret",
      signingSecretPlaceholder: "Generated webhook secret",
      signingSecretHelperText:
        "Use the same signing secret in Fireflies so CallVault can verify webhook deliveries.",
      signingSecretField: "webhookSecret",
      destinationPath: "fireflies-webhook",
      pathTokenField: "webhookPathToken",
      verification: {
        required: true,
        lastVerifiedAtField: "lastVerifiedAt",
        lastMessageField: "lastMessage",
      },
      eventTypes: ["meeting.transcribed", "meeting.summarized"],
      helperText:
        "Save the Fireflies connection first, then send a test event from Fireflies to verify delivery.",
    },
    helperCopy: {
      disconnected:
        "Paste a Fireflies API key, then copy the webhook URL and signing secret into Fireflies.",
      connected:
        "Fireflies is connected. Reconnect only if the API key changed or stopped working.",
      saveSuccess:
        "Fireflies settings saved. Send a test event from Fireflies to verify the webhook.",
      verificationWaiting:
        "Waiting for a signed Fireflies test event. Return here after clicking Send test event in Fireflies.",
    },
  },

  async saveApiKeyCredentials({
    apiKey,
    webhookSecret,
    webhookPathToken,
    accountEmail,
    workspaceId,
  }) {
    const { data, error } = await supabase.functions.invoke(
      "fireflies-save-source",
      {
        body: {
          apiKey: apiKey.trim() || null,
          webhookSigningSecret: webhookSecret?.trim() ?? null,
          webhookPathToken: webhookPathToken?.trim() ?? null,
          accountEmail: accountEmail?.trim() ?? null,
          workspaceId: workspaceId ?? null,
          workspace_id: workspaceId ?? null,
        },
      },
    );
    if (error) throw new Error(await getFunctionErrorMessage(error));
    const sourceId =
      (data as { sourceId?: string; source?: { id?: string } } | null)
        ?.sourceId ??
      (data as { sourceId?: string; source?: { id?: string } } | null)?.source
        ?.id;
    if (!sourceId) {
      throw new Error("fireflies-save-source returned no sourceId");
    }
    return {
      sourceId,
      webhookSigningSecret:
        (data as { webhookSigningSecret?: string | null } | null)
          ?.webhookSigningSecret ?? null,
      webhookPathToken:
        (data as { webhookPathToken?: string | null } | null)
          ?.webhookPathToken ?? null,
    };
  },

  async getWebhookDetails() {
    const { data, error } = await supabase.functions.invoke(
      "fireflies-connection-details",
    );
    if (error) throw new Error(error.message);
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }

    const details = data as {
      webhookSigningSecret?: string | null;
      webhookPathToken?: string | null;
      webhookVerification?: {
        lastVerifiedAt?: string | null;
        lastMessage?: string | null;
      } | null;
    } | null;

    return {
      webhookPathToken: details?.webhookPathToken ?? null,
      webhookSigningSecret: details?.webhookSigningSecret ?? null,
      verification: details?.webhookVerification
        ? {
            verified: Boolean(details.webhookVerification.lastVerifiedAt),
            lastVerifiedAt:
              details.webhookVerification.lastVerifiedAt ?? null,
            lastMessage: details.webhookVerification.lastMessage ?? null,
          }
        : null,
    };
  },

  async saveWebhookConfig({ webhookSigningSecret, webhookPathToken }) {
    return this.saveApiKeyCredentials({
      apiKey: "",
      webhookSecret: webhookSigningSecret ?? undefined,
      webhookPathToken: webhookPathToken ?? undefined,
    });
  },

  async getWebhookVerification() {
    const details = await this.getWebhookDetails?.({ sourceId: "" });
    return (
      details?.verification ?? {
        verified: false,
        lastVerifiedAt: null,
      }
    );
  },

  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "fireflies", sourceId });
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
