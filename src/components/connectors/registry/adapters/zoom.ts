/**
 * Zoom connector adapter. Issue #283 — Phase 1.
 */

import { RiVideoLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectorAdapter } from "../types";

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

  async getOAuthAuthUrl() {
    const { data, error } = await supabase.functions.invoke("zoom-oauth-url");
    if (error) throw new Error(error.message);
    if (!data?.authUrl)
      throw new Error("No authUrl returned from zoom-oauth-url");
    return {
      authUrl: data.authUrl as string,
      sourceId: data.sourceId as string | undefined,
    };
  },

  async disconnect(sourceId) {
    const { error } = await supabase
      .from("import_sources")
      .update({ is_active: false })
      .eq("id", sourceId)
      .eq("source_app", "zoom");
    if (error) throw new Error(error.message);
  },
};
