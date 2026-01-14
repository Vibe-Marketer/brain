import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiEyeLine, RiEyeOffLine, RiExternalLinkLine } from "@remixicon/react";
import { IntegrationManager } from "@/components/shared/IntegrationManager";
import SourcePriorityModal from "./SourcePriorityModal";
import { logger } from "@/lib/logger";
import { getFathomOAuthUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { useIntegrationSync } from "@/hooks/useIntegrationSync";

export default function IntegrationsTab() {
  // Use shared hook for integration status
  const { integrations, refreshIntegrations } = useIntegrationSync();

  // Source Priority Modal state (shown when 2nd integration connected)
  const [showSourcePriorityModal, setShowSourcePriorityModal] = useState(false);

  // Edit credentials state (Fathom-specific settings feature)
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);
  const [hasCredentialsLoaded, setHasCredentialsLoaded] = useState(false);

  // Derived connection states from shared hook
  const fathomConnected = integrations.find((i) => i.platform === "fathom")?.connected ?? false;
  const googleMeetConnected = integrations.find((i) => i.platform === "google_meet")?.connected ?? false;
  const zoomConnected = integrations.find((i) => i.platform === "zoom")?.connected ?? false;

  // Get connected platforms for modal
  const connectedPlatforms = [
    ...(fathomConnected ? ["fathom"] : []),
    ...(googleMeetConnected ? ["google_meet"] : []),
    ...(zoomConnected ? ["zoom"] : []),
  ];

  // Load credential settings (for Fathom credential management UI)
  useEffect(() => {
    loadCredentialSettings();
  }, []);

  const loadCredentialSettings = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("fathom_api_key, webhook_secret, oauth_access_token")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasOAuth(!!settings?.oauth_access_token);

      if (settings?.fathom_api_key) {
        setApiKey(settings.fathom_api_key);
      }
      if (settings?.webhook_secret) {
        setWebhookSecret(settings.webhook_secret);
      }
      setHasCredentialsLoaded(true);
    } catch (error) {
      logger.error("Error loading credential settings", error);
      setHasCredentialsLoaded(true);
    }
  };

  // Handle integration change - check for source priority modal
  const handleIntegrationChange = async () => {
    await refreshIntegrations();
    await checkSourcePriorityModal();
  };

  const checkSourcePriorityModal = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("dedup_platform_order")
        .eq("user_id", user.id)
        .maybeSingle();

      // Count currently connected integrations
      const connectedCount = connectedPlatforms.length;

      // Show modal if 2+ integrations and no preferences set
      const hasNoPreferences = !settings?.dedup_platform_order || settings.dedup_platform_order.length === 0;
      if (connectedCount >= 2 && hasNoPreferences) {
        setShowSourcePriorityModal(true);
      }
    } catch (error) {
      logger.error("Error checking source priority", error);
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

      if (!webhookSecret.startsWith('whsec_')) {
        toast.error("Invalid webhook secret format. Should start with 'whsec_'");
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          fathom_api_key: apiKey.trim(),
          webhook_secret: webhookSecret.trim(),
        }, {
          onConflict: "user_id"
        });

      if (error) {
        logger.error("Failed to save credentials", error);
        toast.error("Failed to save credentials: " + error.message);
        return;
      }

      toast.success("Credentials updated successfully");
      setShowEditCredentials(false);
      await refreshIntegrations();
    } catch (error) {
      logger.error("Error saving credentials", error);
      toast.error("Failed to save credentials");
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleOAuthReconnect = async () => {
    try {
      setOauthConnecting(true);
      const response = await getFathomOAuthUrl();
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      logger.error("Failed to get OAuth URL", error);
      toast.error("Failed to connect to Fathom");
      setOauthConnecting(false);
    }
  };

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* All Integrations Section - Uses shared component */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Integrations
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Connect your meeting platforms to sync recordings and transcripts
          </p>
        </div>
        <div className="lg:col-span-2">
          <IntegrationManager
            onIntegrationChange={handleIntegrationChange}
            variant="full"
            title="Connected Platforms"
          />
        </div>
      </div>

      {/* Manage Fathom Credentials Section - Settings-specific feature */}
      {fathomConnected && hasCredentialsLoaded && (
        <>
          <Separator className="my-16" />

          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                Manage Fathom Connection
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Update your API credentials or reconnect via OAuth
              </p>
            </div>
            <div className="lg:col-span-2 space-y-6">
              {!showEditCredentials ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-50">API Credentials</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {apiKey ? "API key and webhook secret configured" : "Not configured"}
                      </p>
                    </div>
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => setShowEditCredentials(true)}
                    >
                      Edit Credentials
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-50">OAuth Connection</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hasOAuth ? "Connected - auto-sync enabled" : "Not connected"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleOAuthReconnect}
                      disabled={oauthConnecting}
                    >
                      <RiExternalLinkLine className="mr-2 h-4 w-4" />
                      {hasOAuth ? "Reconnect" : "Connect"} OAuth
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-api-key">API Key *</Label>
                      <Input
                        id="edit-api-key"
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Your Fathom API key"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-webhook-secret">Webhook Secret *</Label>
                      <div className="relative mt-2">
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
                        >
                          {showWebhookSecret ? (
                            <RiEyeOffLine className="h-4 w-4" />
                          ) : (
                            <RiEyeLine className="h-4 w-4" />
                          )}
                        </button>
                      </div>
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
                        loadCredentialSettings(); // Reset to original values
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Source Priority Modal */}
      {showSourcePriorityModal && (
        <SourcePriorityModal
          open={showSourcePriorityModal}
          onComplete={() => setShowSourcePriorityModal(false)}
          onDismiss={() => setShowSourcePriorityModal(false)}
          connectedPlatforms={connectedPlatforms}
        />
      )}
    </div>
  );
}
