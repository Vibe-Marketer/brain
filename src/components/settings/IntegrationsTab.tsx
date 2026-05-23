/**
 * IntegrationsTab — Settings → Integrations page.
 *
 * Issue #283 — Phase 3 migration. This file now renders ALL connectors
 * via the unified <ConnectorPanel layout="settings" /> primitive, ensuring
 * Settings and Import surfaces can never structurally diverge again
 * (see the 2026-05-23 webhook_path_token incident for context).
 *
 * Per-source quirks (Fathom credential editing, Fathom host email) live in
 * the extraActions / extraContent slots of ConnectorPanel — no source-
 * specific layout code remains in this file. Future Phase 3.5 may extract
 * the Fathom credential editor into a per-source adapter "extra panel"
 * if more connectors gain similar features.
 *
 * Imports removed in this phase:
 *   - IntegrationManager (legacy top section, replaced by panel list)
 *   - useIntegrationSync (legacy status hook, replaced by useConnector)
 *   - getFathomOAuthUrl (now invoked through the fathom adapter)
 *   - RiExternalLinkLine + RiSettings3Line (no longer used at this layer)
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RiEyeLine,
  RiEyeOffLine,
  RiMailLine,
  RiPlugLine,
} from "@remixicon/react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { ConnectorPanel } from "@/components/connectors/ConnectorPanel";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";

export default function IntegrationsTab() {
  // Fathom-specific credential management (per-source extra UI)
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
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
        // SEC-03D (Phase 38): select expires-truthiness signal, not raw token.
        .select(
          "fathom_api_key, webhook_secret, oauth_token_expires, host_email",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.fathom_api_key) setApiKey(settings.fathom_api_key);
      if (settings?.webhook_secret) setWebhookSecret(settings.webhook_secret);
      if (settings?.host_email) setHostEmail(settings.host_email);
      setHasCredentialsLoaded(true);
    } catch (error) {
      logger.error("Error loading credential settings", error);
      setHasCredentialsLoaded(true);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      setSavingCredentials(true);
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        toast.error("Not authenticated");
        return;
      }
      if (!apiKey.trim()) {
        toast.error("API key is required");
        return;
      }
      if (!webhookSecret.startsWith("whsec_")) {
        toast.error(
          "Invalid webhook secret format. Should start with 'whsec_'",
        );
        return;
      }

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          fathom_api_key: apiKey.trim(),
          webhook_secret: webhookSecret.trim(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        logger.error("Failed to save credentials", error);
        toast.error("Failed to save credentials: " + error.message);
        return;
      }

      toast.success("Credentials updated successfully");
      setShowEditCredentials(false);
    } catch (error) {
      logger.error("Error saving credentials", error);
      toast.error("Failed to save credentials");
    } finally {
      setSavingCredentials(false);
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

  // Fathom-specific extras passed to ConnectorPanel slots
  const fathomExtraActions = hasCredentialsLoaded ? (
    <Button
      variant="hollow"
      size="default"
      onClick={() => setShowEditCredentials(!showEditCredentials)}
    >
      {showEditCredentials ? "Cancel" : "Edit Credentials"}
    </Button>
  ) : null;

  const fathomExtraContent =
    showEditCredentials && hasCredentialsLoaded ? (
      <div className="space-y-4 pt-4 mt-2 border-t border-border">
        <div className="space-y-2">
          <Label htmlFor="edit-api-key">API Key *</Label>
          <Input
            id="edit-api-key"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your Fathom API key"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-webhook-secret">Webhook Secret *</Label>
          <div className="relative">
            <Input
              id="edit-webhook-secret"
              type={showWebhookSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_xxxxxxxxxxxxxxxxxx"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={
                showWebhookSecret
                  ? "Hide webhook secret"
                  : "Show webhook secret"
              }
            >
              {showWebhookSecret ? (
                <RiEyeOffLine className="h-4 w-4" />
              ) : (
                <RiEyeLine className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSaveCredentials}
            disabled={savingCredentials || !apiKey || !webhookSecret}
          >
            {savingCredentials ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="hollow"
            onClick={() => {
              setShowEditCredentials(false);
              void loadCredentialSettings();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    ) : null;

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

      {/* ── 2. ConnectorPanel per source (unified primitive) ── */}
      <div className="space-y-16">
        {adapters.map((adapter) => {
          const isFathom = adapter.metadata.sourceApp === "fathom";
          return (
            <ConnectorPanel
              key={adapter.metadata.sourceApp}
              sourceApp={adapter.metadata.sourceApp}
              layout="settings"
              extraActions={isFathom ? fathomExtraActions : undefined}
              extraContent={isFathom ? fathomExtraContent : undefined}
            />
          );
        })}
      </div>

      {/* ── 3. Fathom Host Email (per-source extra setting) ── */}
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
