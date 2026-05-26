/** Zoom connector adapter. Issue #283 — Phase 1. */
import { RiVideoLine } from "@remixicon/react";
import {
  createDateRangeSearch,
  createOAuthUrlGetter,
  createSelectedImporter,
  wasAlreadySynced,
  disconnectConnectorSource,
} from "./adapter-helpers";
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
    sourceApp: "zoom", label: "Zoom", description: "Cloud recordings",
    icon: RiVideoLine, brandColor: "#2D8CFF", authMethods: ["oauth"], order: 20,
  },
  setup: {
    kind: "oauth", accountLabelField: "email",
    helperCopy: {
      disconnected: "Connect Zoom to import cloud recordings and transcripts from your account.",
      connected: "Zoom is connected and ready to import cloud recordings.",
    },
  },
  getOAuthAuthUrl: createOAuthUrlGetter("zoom-oauth-url"),
  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "zoom", sourceId });
  },
  searchAvailable: createDateRangeSearch<ZoomAvailableMeeting>({
    functionName: "zoom-fetch-meetings",
    resultKey: "meetings",
    buildBody: (p) => ({
      sourceId: p.sourceId,
      createdAfter: p.dateStart.toISOString(),
      createdBefore: p.dateEnd.toISOString(),
    }),
    nextCursor: () => null,
    mapItem: (m) => {
      const startTime = m.recording_start_time ?? m.created_at ?? null;
      const durationSeconds = startTime && m.recording_end_time
        ? Math.max(0, Math.floor((Date.parse(m.recording_end_time) - Date.parse(startTime)) / 1000))
        : typeof m.duration === "number" ? m.duration * 60 : null;
      return {
        externalId: m.recording_id, title: m.title, startTime, durationSeconds,
        participants: m.calendar_invitees, alreadyImported: wasAlreadySynced(m),
        externalUrl: null,
        metadata: {
          meetingId: m.meeting_id ?? null,
          hostEmail: m.host_email ?? null,
          hasTranscript: m.has_transcript ?? false,
        },
      };
    },
  }),
  importSelected: createSelectedImporter({
    functionName: "zoom-sync-meetings",
    idsField: "recordingIds", messageLabel: "Zoom", messageNoun: "recording",
    normalizeIds: (externalIds) => {
      const ids = externalIds.map((id) => id.trim());
      if (ids.some((id) => id.length === 0)) throw new Error("Invalid Zoom recording id");
      return ids;
    },
    buildMessage: ({ count }) => `Importing ${count} Zoom recording(s)…`,
  }),
};
