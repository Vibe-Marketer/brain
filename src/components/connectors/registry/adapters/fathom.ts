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
};
