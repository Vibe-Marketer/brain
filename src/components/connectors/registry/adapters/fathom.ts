/** Fathom connector adapter. Issue #283 — Phase 1. */
import { RiMicLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { disconnectConnectorSource } from "../../hooks/useConnector";
import {
  createDateRangeSearch,
  createOAuthUrlGetter,
  createSelectedImporter,
  wasAlreadySynced,
} from "./adapter-helpers";
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
    sourceApp: "fathom", label: "Fathom", description: "AI meeting recorder",
    icon: RiMicLine, brandColor: "#0A84FF", authMethods: ["oauth", "api_key"], order: 10,
  },
  setup: {
    kind: "oauth", alternateKinds: ["api_key"], supportsMultipleAccounts: true,
    accountLabelField: "hostEmail",
    credentialFields: [
      { name: "apiKey", label: "Fathom API key", required: true, secret: true, placeholder: "Your Fathom API key", autoComplete: "off" },
      { name: "webhookSecret", label: "Legacy webhook secret", required: true, secret: true, placeholder: "whsec_xxxxxxxxxxxxxxxxxx", autoComplete: "off" },
    ],
    helperCopy: {
      disconnected: "Connect with OAuth. Legacy API key credentials are only for existing fallback setups.",
      connected: "Fathom is connected and ready to import meeting recordings.",
      saveSuccess: "Fathom credentials saved.",
    },
  },
  getOAuthAuthUrl: createOAuthUrlGetter("fathom-oauth-url"),
  // INTENTIONAL: Fathom is the only adapter writing directly to `user_settings`
  // as a legacy fallback path. Kept inline as migration debt.
  async saveApiKeyCredentials({ apiKey, webhookSecret }) {
    if (!webhookSecret?.startsWith("whsec_")) throw new Error("Webhook secret must start with whsec_");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");
    const { error } = await supabase.from("user_settings").upsert(
      { user_id: user.id, fathom_api_key: apiKey.trim(), webhook_secret: webhookSecret.trim() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { sourceId: user.id };
  },
  async getWebhookDetails() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("user_settings").select("webhook_secret").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error(error.message);
    return { webhookSigningSecret: data?.webhook_secret ?? null };
  },
  async disconnect(sourceId) {
    await disconnectConnectorSource({ sourceApp: "fathom", sourceId });
  },
  searchAvailable: createDateRangeSearch<FathomAvailableMeeting>({
    functionName: "fetch-meetings",
    resultKey: "meetings",
    buildBody: (p) => ({
      sourceId: p.sourceId,
      createdAfter: p.dateStart.toISOString(),
      createdBefore: p.dateEnd.toISOString(),
      cursor: p.cursor ?? undefined,
      pageMode: true,
    }),
    nextCursor: (response) => (response.next_cursor as string | null | undefined) ?? null,
    mapItem: (m) => {
      const startTime = m.recording_start_time ?? m.created_at ?? null;
      const durationSeconds = startTime && m.recording_end_time
        ? Math.max(0, Math.floor((Date.parse(m.recording_end_time) - Date.parse(startTime)) / 1000))
        : null;
      return {
        externalId: String(m.recording_id), title: m.title, startTime, durationSeconds,
        participants: m.calendar_invitees, alreadyImported: wasAlreadySynced(m),
        externalUrl: m.share_url ?? m.url ?? null,
      };
    },
  }),
  importSelected: createSelectedImporter({
    functionName: "sync-meetings",
    idsField: "recordingIds", messageLabel: "Fathom", messageNoun: "call",
    // Fathom-specific: recording IDs are BIGINTs. Validate Number.isSafeInteger
    // BEFORE invoking the edge function.
    normalizeIds: (externalIds) => {
      const ids = externalIds.map((id) => Number(id));
      const bad = ids.findIndex((n) => !Number.isSafeInteger(n) || n <= 0);
      if (bad !== -1) throw new Error(`Invalid Fathom recording id: ${externalIds[bad]}`);
      return ids;
    },
    buildMessage: ({ count }) => `Importing ${count} Fathom call(s)…`,
  }),
};
