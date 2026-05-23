/**
 * Plaud connector adapter. Issue #283 — Phase 1.
 *
 * Plaud uses a durable access token (web-scraped from the user's session).
 * See plaud-connect-token + plaud-sync-recordings edge functions.
 */

import { RiVoiceprintLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectorAdapter } from "../types";

export const plaudAdapter: ConnectorAdapter = {
  metadata: {
    sourceApp: "plaud",
    label: "Plaud",
    description: "AI voice recorder",
    icon: RiVoiceprintLine,
    brandColor: "#7C3AED",
    authMethods: ["api_key"],
    order: 40,
  },

  async saveApiKeyCredentials({ apiKey, accountEmail }) {
    const { data, error } = await supabase.functions.invoke(
      "plaud-connect-token",
      {
        body: {
          accessToken: apiKey.trim(),
          accountEmail: accountEmail?.trim() ?? null,
        },
      },
    );
    if (error) throw new Error(error.message);
    if (!data?.sourceId) {
      throw new Error("plaud-connect-token returned no sourceId");
    }
    return { sourceId: data.sourceId as string };
  },

  async disconnect(sourceId) {
    const { error } = await supabase
      .from("import_sources")
      .update({ is_active: false })
      .eq("id", sourceId)
      .eq("source_app", "plaud");
    if (error) throw new Error(error.message);
  },
};
