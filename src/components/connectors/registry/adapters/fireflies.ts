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
};
