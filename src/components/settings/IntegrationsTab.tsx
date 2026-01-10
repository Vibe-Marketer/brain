import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiVideoLine, RiFlashlightLine } from "@remixicon/react";
import { RiEyeLine, RiEyeOffLine, RiExternalLinkLine } from "@remixicon/react";
import IntegrationStatusCard from "./IntegrationStatusCard";
import FathomSetupWizard from "./FathomSetupWizard";
import { logger } from "@/lib/logger";
import { getFathomOAuthUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

export default function IntegrationsTab() {
  const [fathomConnected, setFathomConnected] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit credentials state
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("fathom_api_key, webhook_secret, oauth_access_token")
        .eq("user_id", user.id)
        .maybeSingle();

      // Consider connected if either API key or OAuth token exists
      const isConnected = !!(settings?.fathom_api_key || settings?.oauth_access_token);
      setFathomConnected(isConnected);
      setHasOAuth(!!settings?.oauth_access_token);

      // Load current credentials (masked for display)
      if (settings?.fathom_api_key) {
        setApiKey(settings.fathom_api_key);
      }
      if (settings?.webhook_secret) {
        setWebhookSecret(settings.webhook_secret);
      }
    } catch (error) {
      logger.error("Error loading integration status", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFathomConnect = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = async () => {
    setShowWizard(false);
    await loadIntegrationStatus(); // Refresh status after wizard completion
  };

  const handleSaveCredentials = async () => {
    try {
      setSavingCredentials(true);
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        toast.error("Not authenticated");
        return;
      }

      // Basic validation - only validate webhook secret format
      // Note: Fathom API keys don't have a consistent prefix requirement
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
      await loadIntegrationStatus();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading integrations...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Fathom Integration Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Fathom Integration
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Connect your Fathom account to sync meetings and transcripts
          </p>
        </div>
        <div className="lg:col-span-2">
          <IntegrationStatusCard
            name="Fathom"
            icon={RiVideoLine}
            status={fathomConnected ? "connected" : "disconnected"}
            onConnect={handleFathomConnect}
            description="Automatic meeting sync and AI-powered insights"
          />
        </div>
      </div>

      <Separator className="my-16" />

      {/* Manage Credentials Section */}
      {fathomConnected && (
        <>
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
                        loadIntegrationStatus(); // Reset to original values
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-16" />
        </>
      )}

      {/* Coming Soon Integrations Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            More Integrations
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Additional integrations coming soon
          </p>
        </div>
        <div className="lg:col-span-2 space-y-0">
          <IntegrationStatusCard
            name="Zoom"
            icon={RiVideoLine}
            status="coming-soon"
            description="Direct Zoom meeting integration"
          />
          <IntegrationStatusCard
            name="GoHighLevel"
            icon={RiFlashlightLine}
            status="coming-soon"
            description="CRM and workflow automation"
          />
        </div>
      </div>

      {/* Modals */}
      {showWizard && (
        <FathomSetupWizard
          open={showWizard}
          onComplete={handleWizardComplete}
          onDismiss={() => setShowWizard(false)}
        />
      )}

      {/* Modals */}
      {showWizard && (
        <FathomSetupWizard
          open={showWizard}
          onComplete={handleWizardComplete}
          onDismiss={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
