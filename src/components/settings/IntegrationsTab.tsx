/**
 * IntegrationsTab — Settings → Integrations page.
 *
 * Issue #283 — Phase 3 migration. This file now renders ALL connectors
 * via the unified connector setup cluster, ensuring
 * Settings and Import surfaces can never structurally diverge again
 * (see the 2026-05-23 webhook_path_token incident for context).
 *
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiMailLine, RiPlugLine } from "@remixicon/react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { ConnectionsPanel } from "@/components/connectors/ConnectionsPanel";
import { ConnectorSetupCluster } from "@/components/connectors/setup";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";
import ObsidianConnectorSection from "@/components/settings/ObsidianConnectorSection";

export default function IntegrationsTab() {
  const [hasCredentialsLoaded, setHasCredentialsLoaded] = useState(false);
  const [hostEmail, setHostEmail] = useState("");
  const [savingHostEmail, setSavingHostEmail] = useState(false);

  useEffect(() => {
    void loadCredentialSettings();
  }, []);

  const loadCredentialSettings = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.host_email) setHostEmail(settings.host_email);
      setHasCredentialsLoaded(true);
    } catch (error) {
      logger.error("Error loading credential settings", error);
      setHasCredentialsLoaded(true);
    }
  };

  const handleSaveHostEmail = async () => {
    try {
      setSavingHostEmail(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        toast.error("Not authenticated");
        return;
      }
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: user.id, host_email: hostEmail.trim() },
          { onConflict: "user_id" },
        );
      if (error) {
        logger.error("Failed to save Fathom email", error);
        toast.error("Failed to save Fathom email: " + error.message);
        return;
      }
      toast.success("Fathom email saved");
      await loadCredentialSettings();
    } catch (error) {
      logger.error("Error saving Fathom email", error);
      toast.error("Failed to save Fathom email");
    } finally {
      setSavingHostEmail(false);
    }
  };

  const adapters = listConnectorAdapters();

  return (
    <div>
      <Separator className="mb-12" />

      {/* ── 1. Section header ── */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3 mb-12">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            <RiPlugLine className="h-4 w-4 shrink-0" />
            Integrations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your meeting platforms to sync recordings and transcripts.
            Every connector renders through the same panel so behavior, status,
            and actions stay identical across the app.
          </p>
        </div>
        <div className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            {adapters.length} connector{adapters.length === 1 ? "" : "s"}{" "}
            available — connect any you use.
          </p>
        </div>
      </div>

      {/* ── 2. Global Connections management ── */}
      <div className="mb-12 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-montserrat text-sm font-extrabold uppercase tracking-wide text-foreground">
            Connections
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage connected accounts, future landing workspaces, reconnects,
            syncs, and disconnects.
          </p>
        </div>
        <div className="lg:col-span-2">
          <ConnectionsPanel scope="global" />
        </div>
      </div>

      {/* ── 3. ConnectorPanel per source (unified primitive) ── */}
      <div className="space-y-6">
        {adapters.map((adapter) => (
          <ConnectorSetupCluster
            key={adapter.metadata.sourceApp}
            sourceApp={adapter.metadata.sourceApp}
            mode="settings"
          />
        ))}
      </div>

      {/* ── 4. Obsidian Integration ── */}
      <ObsidianConnectorSection />

      {/* ── 5. Fathom Host Email (per-source extra setting) ── */}
      {hasCredentialsLoaded && (
        <>
          <Separator className="my-16" />
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
            <div>
              <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
                <RiMailLine className="h-4 w-4 shrink-0" />
                Fathom Email
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The email Fathom uses when routing your meeting recordings.
                Required for webhook event matching.
              </p>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host-email">Fathom Email</Label>
                <Input
                  id="host-email"
                  type="email"
                  value={hostEmail}
                  onChange={(e) => setHostEmail(e.target.value)}
                  placeholder="your-fathom-email@example.com"
                />
              </div>
              <Button
                onClick={handleSaveHostEmail}
                disabled={savingHostEmail || !hostEmail.trim()}
              >
                {savingHostEmail ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
