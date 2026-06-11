import { RiCloudLine } from "@remixicon/react";
import {
  createDateRangeSearch,
  createOAuthUrlGetter,
  createSelectedImporter,
  createTokenCredentialSaver,
  invokeConnectorFunction,
  wasAlreadySynced,
  disconnectConnectorSource,
} from "./adapter-helpers";
import type { ConnectorAdapter } from "../types";

interface GrainAvailableMeeting {
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

export const grainAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "grain",
    label: "Grain",
    description: "AI meeting recordings and transcripts",
    icon: RiCloudLine,
    brandColor: "#E1572A",
    authMethods: ["oauth", "api_key"],
    order: 46,
    badge: "beta",
    serverSideOAuthRefresh: true,
  },
  setup: {
    kind: "oauth",
    alternateKinds: ["api_key"],
    accountLabelField: "email",
    credentialFields: [
      {
        name: "apiKey",
        label: "Grain bearer token",
        required: true,
        secret: true,
        placeholder: "Paste a Grain bearer token",
        autoComplete: "off",
      },
    ],
    helperCopy: {
      disconnected:
        "Connect Grain with OAuth, or paste a bearer token while the connector is in beta.",
      connected: "Grain is connected and ready to import recordings.",
      saveSuccess: "Grain credentials saved.",
    },
  },

  getOAuthAuthUrl: createOAuthUrlGetter("grain-oauth-url"),

  saveApiKeyCredentials: createTokenCredentialSaver("grain-connect-token"),

  async disconnect(sourceId) {
    if (!sourceId) {
      await disconnectConnectorSource({ sourceApp: "grain", sourceId });
      return;
    }

    await invokeConnectorFunction("grain-disconnect", {
      body: { sourceId },
    });
  },

  searchAvailable: createDateRangeSearch<GrainAvailableMeeting>({
    functionName: "grain-fetch-recordings",
    resultKey: "meetings",
    defaultLimit: 10,
    mapItem: (meeting) => ({
      externalId: meeting.recording_id,
      title: meeting.title,
      startTime: meeting.recording_start_time,
      durationSeconds: meeting.duration,
      participants: meeting.calendar_invitees,
      alreadyImported: wasAlreadySynced(meeting),
      externalUrl: meeting.share_url ?? meeting.source_url,
      metadata: { importable: meeting.importable ?? true },
    }),
  }),

  importSelected: createSelectedImporter({
    functionName: "grain-sync-recordings",
    idsField: "recordingIds",
    messageLabel: "Grain",
    messageNoun: "call",
  }),
};
