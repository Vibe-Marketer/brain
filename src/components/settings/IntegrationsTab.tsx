import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RiVideoLine, RiFlashlightLine, RiErrorWarningLine, RiBrainLine, RiLoader4Line, RiCheckLine } from "@remixicon/react";
import { RiEyeLine, RiEyeOffLine, RiExternalLinkLine } from "@remixicon/react";
import IntegrationStatusCard from "./IntegrationStatusCard";
import FathomSetupWizard from "./FathomSetupWizard";
import ConfirmWebhookDialog from "./ConfirmWebhookDialog";
import WebhookDeliveryViewer from "../WebhookDeliveryViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { logger } from "@/lib/logger";
import { getFathomOAuthUrl, embedAllUnindexedTranscripts } from "@/lib/api-client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function IntegrationsTab() {
  const [fathomConnected, setFathomConnected] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit credentials state
  const [showEditCredentials, setShowEditCredentials] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);

  // AI Knowledge Base state
  const [totalCalls, setTotalCalls] = useState(0);
  const [indexedCalls, setIndexedCalls] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadIntegrationStatus();
    loadKnowledgeBaseStatus();
  }, []);

  const loadKnowledgeBaseStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get total calls with transcripts
      const { count: callsCount } = await supabase
        .from('fathom_calls')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('full_transcript', 'is', null);

      setTotalCalls(callsCount || 0);

      // Get indexed calls (distinct recording_ids in chunks)
      const { data: indexedData } = await supabase
        .from('transcript_chunks')
        .select('recording_id')
        .eq('user_id', user.id);

      const uniqueIndexed = new Set(indexedData?.map(c => c.recording_id) || []);
      setIndexedCalls(uniqueIndexed.size);

      // Get total chunks
      const { count: chunksCount } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setTotalChunks(chunksCount || 0);
    } catch (error) {
      logger.error("Error loading knowledge base status", error);
    }
  };

  const handleEmbedAllTranscripts = async () => {
    try {
      setIsEmbedding(true);
      setEmbeddingProgress({ current: 0, total: totalCalls - indexedCalls });

      toast.info(`Starting to embed ${totalCalls - indexedCalls} transcripts...`);

      const response = await embedAllUnindexedTranscripts();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        toast.success(
          `Embedded ${response.data.recordings_processed} transcripts (${response.data.chunks_created} chunks created)`
        );
        await loadKnowledgeBaseStatus();
      }
    } catch (error) {
      logger.error("Error embedding transcripts", error);
      toast.error("Failed to embed transcripts: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsEmbedding(false);
    }
  };

  const loadIntegrationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

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

  const handleWebhookDiagnostics = () => {
    setShowWebhookDialog(true);
  };

  const handleWebhookConfirm = () => {
    setShowWebhookDialog(false);
    setShowDiagnostics(true);
    logger.info("Opening webhook diagnostics");
  };

  const handleSaveCredentials = async () => {
    try {
      setSavingCredentials(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      // Basic validation
      if (!apiKey.startsWith('fth_')) {
        toast.error("Invalid API key format. Should start with 'fth_'");
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
                        placeholder="fth_xxxxxxxxxxxxxxxxxx"
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

      {/* Webhook Diagnostics Section */}
      {fathomConnected && (
        <>
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                Webhook Diagnostics
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Advanced troubleshooting for webhook sync issues
              </p>
            </div>
            <div className="lg:col-span-2">
              <div className="flex items-start gap-4">
                <RiErrorWarningLine className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0" />
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-gray-900 dark:text-gray-50">
                    <strong>Only enable if support requested.</strong> Webhook diagnostics are for troubleshooting sync issues with our support team.
                  </p>
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={handleWebhookDiagnostics}
                  >
                    Enable Diagnostics
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-16" />
        </>
      )}

      {/* AI Knowledge Base Section */}
      {fathomConnected && (
        <>
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                AI Knowledge Base
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Index your transcripts for AI-powered chat and search
              </p>
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-cb-border-primary bg-card p-6 space-y-6">
                {/* Status */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vibe-orange/10">
                    <RiBrainLine className="h-5 w-5 text-cb-ink-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-50">
                      Transcript Indexing Status
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {indexedCalls === totalCalls && totalCalls > 0
                        ? "All transcripts are indexed and ready for AI chat"
                        : indexedCalls === 0
                        ? "No transcripts indexed yet - click below to start"
                        : `${indexedCalls} of ${totalCalls} transcripts indexed`}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-md bg-cb-ink-subtle/5">
                    <p className="text-2xl font-bold text-cb-ink-primary tabular-nums">{totalCalls}</p>
                    <p className="text-xs text-muted-foreground">Total Calls</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-cb-ink-subtle/5">
                    <p className="text-2xl font-bold text-cb-ink-primary tabular-nums">{indexedCalls}</p>
                    <p className="text-xs text-muted-foreground">Indexed</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-cb-ink-subtle/5">
                    <p className="text-2xl font-bold text-cb-ink-primary tabular-nums">{totalChunks}</p>
                    <p className="text-xs text-muted-foreground">Chunks</p>
                  </div>
                </div>

                {/* Progress bar when indexing */}
                {isEmbedding && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Indexing transcripts...</span>
                      <span className="font-medium">
                        {embeddingProgress.current} / {embeddingProgress.total}
                      </span>
                    </div>
                    <Progress
                      value={embeddingProgress.total > 0 ? (embeddingProgress.current / embeddingProgress.total) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Action button */}
                <div className="flex items-center gap-3">
                  {indexedCalls < totalCalls ? (
                    <Button
                      onClick={handleEmbedAllTranscripts}
                      disabled={isEmbedding || totalCalls === 0}
                    >
                      {isEmbedding ? (
                        <>
                          <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                          Indexing...
                        </>
                      ) : (
                        <>
                          <RiBrainLine className="mr-2 h-4 w-4" />
                          Index {totalCalls - indexedCalls} Transcript{totalCalls - indexedCalls !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  ) : totalCalls > 0 ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <RiCheckLine className="h-5 w-5" />
                      <span className="text-sm font-medium">All transcripts indexed</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sync some calls first to enable AI chat
                    </p>
                  )}

                  {totalCalls > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadKnowledgeBaseStatus}
                    >
                      Refresh Status
                    </Button>
                  )}
                </div>
              </div>
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

      <ConfirmWebhookDialog
        open={showWebhookDialog}
        onOpenChange={setShowWebhookDialog}
        onConfirm={handleWebhookConfirm}
      />

      {/* Webhook Diagnostics Dialog */}
      <Dialog open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Diagnostics</DialogTitle>
            <DialogDescription>
              Monitor webhook delivery status, view real-time notifications, and troubleshoot sync issues
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <WebhookDeliveryViewer />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
