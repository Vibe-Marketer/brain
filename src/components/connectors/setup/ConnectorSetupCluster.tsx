import * as React from "react";
import {
  RiDownloadLine,
  RiExternalLinkLine,
  RiLoader4Line,
  RiPlugLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { DefaultDestinationBar } from "@/components/import/DefaultDestinationBar";
import { ConnectorAccountHeader } from "../ConnectorAccountHeader";
import { useConnector } from "../hooks/useConnector";
import { getConnectorAdapter } from "../registry/connectorRegistry";
import type {
  ConnectorAdapter,
  ConnectorCredentialField as ConnectorSetupFieldConfig,
  ConnectorSetupConfig,
  ConnectorSourceApp,
  ConnectorWebhookConfig,
  WebhookVerificationResult,
} from "../registry/types";
import { ConnectorCredentialForm } from "./ConnectorCredentialForm";
import { ConnectorReadonlyUrlField } from "./ConnectorReadonlyUrlField";
import { ConnectorSecretField } from "./ConnectorSecretField";
import { ConnectorSetupInstructions } from "./ConnectorSetupInstructions";
import { ConnectorWebhookVerification } from "./ConnectorWebhookVerification";
import { buildWebhookUrl } from "./webhook-url";

export type ConnectorSetupClusterMode = "settings" | "import" | "onboarding";

export interface ConnectorSetupClusterProps {
  sourceApp: ConnectorSourceApp;
  mode: ConnectorSetupClusterMode;
  returnTo?: string;
  compact?: boolean;
  className?: string;
  onConnected?: (sourceId: string) => void;
  onDisconnected?: () => void;
  onSaved?: (sourceId: string) => void;
}

type CredentialValues = Record<string, string>;
type ClusterState =
  | "loading"
  | "disconnected"
  | "connected"
  | "editing"
  | "saving"
  | "waiting_for_webhook"
  | "webhook_verified"
  | "disconnecting"
  | "error";

interface WebhookDetailsState {
  webhookUrl: string;
  webhookPathToken: string;
  webhookSigningSecret: string;
  verification: WebhookVerificationResult | null;
}

declare global {
  interface Window {
    __callvaultPlaudConnector?: {
      version?: string;
      connect: () => Promise<{ accessToken: string; apiBase?: string; accountEmail?: string | null }>;
    };
    __openplaudConnector?: {
      version?: string;
      connect: () => Promise<{ accessToken: string; apiBase?: string; accountEmail?: string | null }>;
    };
  }
}

const emptyWebhookDetails: WebhookDetailsState = {
  webhookUrl: "",
  webhookPathToken: "",
  webhookSigningSecret: "",
  verification: null,
};

const PLAUD_BRIDGE_LATEST_VERSION = "0.1.1";

export function ConnectorSetupCluster({
  sourceApp,
  mode,
  returnTo,
  compact = false,
  className,
  onConnected,
  onDisconnected,
  onSaved,
}: ConnectorSetupClusterProps) {
  const adapter = getConnectorAdapter(sourceApp);
  const setup = adapter.setup ?? getFallbackSetupConfig(adapter);
  const { status, isLoading, refresh } = useConnector(sourceApp);
  const [credentialValues, setCredentialValues] =
    React.useState<CredentialValues>(() =>
      buildInitialCredentialValues(setup.credentialFields),
    );
  const [webhookDetails, setWebhookDetails] =
    React.useState<WebhookDetailsState>(() => buildInitialWebhookDetails(setup));
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [loadingWebhookDetails, setLoadingWebhookDetails] =
    React.useState(false);
  const [verificationState, setVerificationState] = React.useState<
    "not_configured" | "waiting" | "verified" | "error"
  >("not_configured");
  const [bridgeMessage, setBridgeMessage] = React.useState<string | null>(null);
  const [bridgeVersion, setBridgeVersion] = React.useState<string | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const webhookPollRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const mutationRef = React.useRef<symbol | null>(null);

  const connected = Boolean(status?.connected);
  const showCredentialForm =
    setup.kind === "api_key" ||
    setup.kind === "api_key_webhook" ||
    (setup.kind === "browser_bridge" && Boolean(adapter.saveApiKeyCredentials));
  const canShowForm = showCredentialForm && (!connected || editing);
  const clusterState = getClusterState({
    isLoading,
    connected,
    editing,
    saving,
    disconnecting,
    lastError,
    verificationState,
  });

  const webhookUrl = React.useMemo(() => {
    if (!setup.webhook) return "";
    return (
      webhookDetails.webhookUrl ||
      buildWebhookUrl({
        destinationPath: setup.webhook.destinationPath,
        pathToken: webhookDetails.webhookPathToken,
      })
    );
  }, [setup.webhook, webhookDetails.webhookPathToken, webhookDetails.webhookUrl]);

  const stopWebhookPolling = React.useCallback(() => {
    if (webhookPollRef.current) {
      clearInterval(webhookPollRef.current);
      webhookPollRef.current = null;
    }
  }, []);

  const loadWebhookDetails = React.useCallback(async () => {
    if (!adapter.getWebhookDetails) return null;
    const details = await adapter.getWebhookDetails({
      sourceId: status?.sourceId ?? "",
    });
    const nextDetails = {
      webhookUrl: details.webhookUrl ?? "",
      webhookPathToken: details.webhookPathToken ?? "",
      webhookSigningSecret: details.webhookSigningSecret ?? "",
      verification: details.verification ?? null,
    };
    setWebhookDetails(nextDetails);
    if (details.verification?.verified) {
      setVerificationState("verified");
    } else if (connected && setup.webhook?.verification) {
      setVerificationState("waiting");
    }
    return nextDetails;
  }, [adapter, connected, setup.webhook?.verification, status?.sourceId]);

  React.useEffect(() => {
    return () => stopWebhookPolling();
  }, [stopWebhookPolling]);

  React.useEffect(() => {
    if (!setup.webhook || !connected) return;
    if (!adapter.getWebhookDetails) return;

    let cancelled = false;
    setLoadingWebhookDetails(true);
    loadWebhookDetails()
      .catch((error) => {
        if (cancelled) return;
        setLastError(
          error instanceof Error
            ? error.message
            : "Failed to load webhook details",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingWebhookDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    adapter.getWebhookDetails,
    connected,
    loadWebhookDetails,
    setup.webhook,
  ]);

  React.useEffect(() => {
    if (setup.kind !== "browser_bridge") return;
    const updateBridgeStatus = () => {
      const connector =
        window.__callvaultPlaudConnector ?? window.__openplaudConnector;
      const version = connector?.version ?? null;
      setBridgeVersion(version);
      setBridgeMessage(
        connector?.connect
          ? `Plaud connector ready${version ? ` (v${version})` : ""}`
          : "Plaud connector not detected",
      );
    };
    updateBridgeStatus();
    window.addEventListener("callvault-plaud-connector-ready", updateBridgeStatus);
    return () => {
      window.removeEventListener(
        "callvault-plaud-connector-ready",
        updateBridgeStatus,
      );
    };
  }, [setup.kind]);

  const setCredentialValue = React.useCallback((name: string, value: string) => {
    setCredentialValues((current) => ({ ...current, [name]: value }));
  }, []);

  const handleConnectOAuth = React.useCallback(async () => {
    if (!adapter.getOAuthAuthUrl) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;
    setSaving(true);
    setLastError(null);
    try {
      const { authUrl, state } = await adapter.getOAuthAuthUrl();
      storeOAuthReturnTo(state, returnTo ?? window.location.pathname);
      if (mode === "onboarding") {
        window.location.href = authUrl;
      } else {
        window.open(authUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start connection";
      setLastError(message);
      toast.error(message);
    } finally {
      if (endMutation(mutationRef, mutation)) setSaving(false);
    }
  }, [adapter, mode, returnTo]);

  const pollWebhookVerification = React.useCallback(async (sourceId?: string) => {
    const targetSourceId = sourceId ?? status?.sourceId;
    if (!adapter.getWebhookVerification || !targetSourceId) return null;
    const verification = await adapter.getWebhookVerification({
      sourceId: targetSourceId,
    });
    setWebhookDetails((current) => ({ ...current, verification }));
    return verification;
  }, [adapter, status?.sourceId]);

  const startWebhookVerification = React.useCallback((sourceId?: string) => {
    const targetSourceId = sourceId ?? status?.sourceId;
    if (!adapter.getWebhookVerification || !targetSourceId) {
      setVerificationState("not_configured");
      return;
    }

    stopWebhookPolling();
    setLastError(null);
    setVerificationState("waiting");
    const startedAt = Date.now();
    let tickInFlight = false;

    const tick = async () => {
      if (tickInFlight) return;
      tickInFlight = true;
      try {
        const verification = await pollWebhookVerification(targetSourceId);
        if (verification?.verified) {
          setVerificationState("verified");
          stopWebhookPolling();
          toast.success(`${adapter.metadata.label} webhook verified`);
        } else if (Date.now() - startedAt > 60_000) {
          setVerificationState("error");
          stopWebhookPolling();
        }
      } catch (error) {
        if (Date.now() - startedAt > 60_000) {
          setLastError(
            error instanceof Error
              ? error.message
              : "Webhook verification failed",
          );
          setVerificationState("error");
          stopWebhookPolling();
        }
      } finally {
        tickInFlight = false;
      }
    };

    void tick();
    webhookPollRef.current = setInterval(() => void tick(), 2_000);
  }, [
    adapter,
    pollWebhookVerification,
    status?.sourceId,
    stopWebhookPolling,
  ]);

  const handleSaveCredentials = React.useCallback(async () => {
    if (!adapter.saveApiKeyCredentials) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;

    setSaving(true);
    setLastError(null);
    stopWebhookPolling();
    try {
      const result = await adapter.saveApiKeyCredentials(
        buildSaveCredentialsParams({
          setup,
          credentialValues,
          webhookDetails,
        }),
      );

      setWebhookDetails((current) => ({
        webhookUrl: result.webhookUrl ?? current.webhookUrl,
        webhookPathToken:
          result.webhookPathToken ?? current.webhookPathToken ?? "",
        webhookSigningSecret:
          result.webhookSigningSecret ?? current.webhookSigningSecret ?? "",
        verification: result.verification ?? current.verification,
      }));
      setCredentialValues((current) => ({ ...current, apiKey: "" }));
      setEditing(false);
      if (setup.webhook?.verification) {
        startWebhookVerification(result.sourceId);
      }
      toast.success(
        setup.helperCopy?.saveSuccess ??
          `${adapter.metadata.label} connection saved`,
      );
      await refresh();
      onSaved?.(result.sourceId);
      onConnected?.(result.sourceId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to save ${adapter.metadata.label}`;
      setLastError(message);
      setVerificationState("error");
      toast.error(message);
    } finally {
      if (endMutation(mutationRef, mutation)) setSaving(false);
    }
  }, [
    adapter,
    credentialValues,
    onConnected,
    onSaved,
    refresh,
    setup,
    startWebhookVerification,
    stopWebhookPolling,
    webhookDetails,
  ]);

  const handleBrowserBridgeConnect = React.useCallback(async () => {
    if (!adapter.saveApiKeyCredentials) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;
    const connector =
      window.__callvaultPlaudConnector ?? window.__openplaudConnector;
    if (!connector?.connect) {
      const message =
        "CallVault Plaud Connector extension was not detected. Reload the extension and refresh this page, or paste the token manually.";
      setBridgeMessage(message);
      toast.error(message);
      endMutation(mutationRef, mutation);
      return;
    }

    setSaving(true);
    setLastError(null);
    setBridgeMessage("Opening Plaud and waiting for a valid session token.");
    try {
      const result = await connector.connect();
      if (!result.accessToken) {
        throw new Error("Plaud connector returned no access token");
      }
      setBridgeMessage("Saving Plaud connection");
      const credentialParams = {
        apiKey: result.accessToken,
        apiBase: result.apiBase,
        ...(status?.sourceId ? { sourceId: status.sourceId } : {}),
        ...(result.accountEmail ? { accountEmail: result.accountEmail } : {}),
      };
      const saved = await adapter.saveApiKeyCredentials(credentialParams);
      setEditing(false);
      toast.success(setup.helperCopy?.saveSuccess ?? "Plaud connected");
      await refresh();
      onSaved?.(saved.sourceId);
      onConnected?.(saved.sourceId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Plaud browser bridge failed";
      setLastError(message);
      setBridgeMessage(message);
      toast.error(`Plaud connection failed: ${message}`);
    } finally {
      if (endMutation(mutationRef, mutation)) setSaving(false);
    }
  }, [adapter, onConnected, onSaved, refresh, setup.helperCopy?.saveSuccess, status?.sourceId]);

  const handleDisconnect = React.useCallback(async () => {
    if (!adapter.disconnect || !status?.connected) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;
    setDisconnecting(true);
    setLastError(null);
    stopWebhookPolling();
    try {
      await adapter.disconnect(status.sourceId);
      setEditing(false);
      setWebhookDetails(emptyWebhookDetails);
      setVerificationState("not_configured");
      toast.success(`${adapter.metadata.label} disconnected`);
      await refresh();
      onDisconnected?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Disconnect failed";
      setLastError(message);
      toast.error(message);
    } finally {
      if (endMutation(mutationRef, mutation)) setDisconnecting(false);
    }
  }, [adapter, onDisconnected, refresh, status, stopWebhookPolling]);

  const handleStartWebhookVerification = React.useCallback(
    () => startWebhookVerification(),
    [startWebhookVerification],
  );

  if (isLoading || !status) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-4 opacity-60",
          compact ? "space-y-3" : "space-y-4",
          className,
        )}
      >
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded bg-muted/70" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        compact ? "space-y-3" : "space-y-4",
        className,
      )}
      data-connector-setup-state={clusterState}
      data-connector-setup-mode={mode}
    >
      <ConnectorAccountHeader
        label={adapter.metadata.label}
        description={
          setup.helperCopy?.[connected ? "connected" : "disconnected"] ??
          adapter.metadata.description
        }
        icon={adapter.metadata.icon}
        connected={connected}
        accountEmail={status.accountEmail}
        errorMessage={status.errorMessage ?? lastError}
        lastSyncAt={status.lastSyncAt}
        badge={adapter.metadata.badge}
        isActing={saving || disconnecting}
        onReconnect={
          connected && setup.kind === "browser_bridge"
            ? handleBrowserBridgeConnect
            : connected && adapter.getOAuthAuthUrl
              ? handleConnectOAuth
              : undefined
        }
        onDisconnect={
          connected && adapter.disconnect ? handleDisconnect : undefined
        }
      />

      <ConnectorSetupStateRow
        state={clusterState}
        adapter={adapter}
        onConnectOAuth={!connected ? handleConnectOAuth : undefined}
        onEditCredentials={
          connected && showCredentialForm ? () => setEditing(true) : undefined
        }
        onCancelEdit={editing ? () => setEditing(false) : undefined}
        saving={saving}
        disconnecting={disconnecting}
      />

      {setup.kind === "browser_bridge" ? (
        <BrowserBridgeNotice
          connected={connected}
          helperText={
            setup.helperCopy?.[connected ? "connected" : "disconnected"]
          }
          bridgeMessage={bridgeMessage}
          installedVersion={bridgeVersion}
          latestVersion={PLAUD_BRIDGE_LATEST_VERSION}
          saving={saving}
          onConnect={!connected ? handleBrowserBridgeConnect : undefined}
        />
      ) : null}

      {canShowForm ? (
        <ConnectorCredentialForm
          title={connected ? "Reconnect credentials" : "Connect account"}
          description={setup.helperCopy?.disconnected}
          fields={(setup.credentialFields ?? []).map((field) =>
            mapCredentialField({
              field,
              value: credentialValues[field.name] ?? "",
              onChange: (value) => setCredentialValue(field.name, value),
            }),
          )}
          webhook={
            setup.webhook
              ? {
                  webhookUrl,
                  signingSecret:
                    webhookDetails.webhookSigningSecret ||
                    credentialValues.webhookSecret ||
                    "",
                  onSigningSecretChange: (value) => {
                    setWebhookDetails((current) => ({
                      ...current,
                      webhookSigningSecret: value,
                    }));
                    setCredentialValue("webhookSecret", value);
                  },
                  onRegenerateSigningSecret: () => {
                    const nextSecret = generateWebhookSigningSecret();
                    setWebhookDetails((current) => ({
                      ...current,
                      webhookSigningSecret: nextSecret,
                    }));
                    setCredentialValue("webhookSecret", nextSecret);
                  },
                  urlLabel: setup.webhook.urlLabel,
                  secretInputId: `${sourceApp}-webhook-secret`,
                  secretLabel: setup.webhook.signingSecretLabel,
                  secretPlaceholder: setup.webhook.signingSecretPlaceholder,
                  loadingSecret: loadingWebhookDetails,
                }
              : undefined
          }
          submitLabel={
            setup.kind === "browser_bridge"
              ? "Save Plaud connection"
              : connected
                ? "Save changes"
                : "Save connection"
          }
          submittingLabel="Saving"
          saving={saving}
          disabled={disconnecting}
          instructions={setup.webhook?.helperText}
          onSubmit={handleSaveCredentials}
        />
      ) : null}

      {setup.webhook &&
      connected &&
      (verificationState === "waiting" || verificationState === "error") ? (
        <WebhookStatusPanel
          webhook={setup.webhook}
          webhookUrl={webhookUrl}
          signingSecret={webhookDetails.webhookSigningSecret}
          verification={webhookDetails.verification}
          verificationState={verificationState}
          loading={loadingWebhookDetails}
          disabled={saving || disconnecting}
          onStartVerification={handleStartWebhookVerification}
        />
      ) : null}

      {connected && mode !== "onboarding" ? (
        <DefaultDestinationBar
          sourceApp={sourceApp}
          providerName={adapter.metadata.label}
        />
      ) : null}

      {lastError ? (
        <p className="text-xs text-rose-600 dark:text-rose-300">{lastError}</p>
      ) : null}
    </div>
  );
}

function ConnectorSetupStateRow({
  state,
  adapter,
  onConnectOAuth,
  onEditCredentials,
  onCancelEdit,
  saving,
  disconnecting,
}: {
  state: ClusterState;
  adapter: ConnectorAdapter;
  onConnectOAuth?: () => void;
  onEditCredentials?: () => void;
  onCancelEdit?: () => void;
  saving: boolean;
  disconnecting: boolean;
}) {
  const hasActions = Boolean(onConnectOAuth || onEditCredentials || onCancelEdit || disconnecting);

  if (!hasActions && state !== "waiting_for_webhook" && state !== "webhook_verified") {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {state === "webhook_verified" ? (
          <StatusBadge variant="success" label="Verified" />
        ) : state === "waiting_for_webhook" ? (
          <StatusBadge variant="warning" label="Waiting" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onConnectOAuth ? (
          <Button type="button" onClick={onConnectOAuth} disabled={saving}>
            {saving ? (
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RiExternalLinkLine className="mr-2 h-4 w-4" />
            )}
            Connect {adapter.metadata.label}
          </Button>
        ) : null}
        {onEditCredentials ? (
          <Button type="button" variant="hollow" onClick={onEditCredentials}>
            Reconnect
          </Button>
        ) : null}
        {onCancelEdit ? (
          <Button type="button" variant="hollow" onClick={onCancelEdit}>
            Cancel
          </Button>
        ) : null}
        {disconnecting ? (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <RiLoader4Line className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Disconnecting
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BrowserBridgeNotice({
  connected,
  helperText,
  bridgeMessage,
  installedVersion,
  latestVersion,
  saving,
  onConnect,
}: {
  connected: boolean;
  helperText?: string;
  bridgeMessage?: string | null;
  installedVersion?: string | null;
  latestVersion: string;
  saving: boolean;
  onConnect?: () => void;
}) {
  const hasBridge = Boolean(installedVersion);
  const bridgeOutdated = hasBridge && compareSemver(installedVersion, latestVersion) < 0;
  const bridgeCurrent = hasBridge && !bridgeOutdated;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
          <RiPlugLine className="h-4 w-4 text-muted-foreground" />
        </div>
        <ConnectorSetupInstructions
          title={
            connected ? "Browser bridge connected" : "Connect with Plaud Web token"
          }
          description={
            helperText ??
            "Plaud does not currently provide CallVault with a durable production OAuth connection, so this beta uses a temporary browser bridge to capture your Plaud Web session token."
          }
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="beta" label="Bridge Beta" />
              {bridgeCurrent ? (
                <StatusBadge variant="success" label={`Installed v${installedVersion}`} />
              ) : hasBridge ? (
                <StatusBadge variant="warning" label={`Installed v${installedVersion}`} />
              ) : (
                <StatusBadge variant="setupNeeded" label="Not installed" />
              )}
              <StatusBadge variant="info" label={`Latest v${latestVersion}`} />
            </div>
            {bridgeMessage ? (
              <p className="text-xs text-muted-foreground">{bridgeMessage}</p>
            ) : null}
            {bridgeOutdated ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                A newer CallVault Plaud Bridge is available. Remove the old extension, download the latest bridge, then load the new folder in Chrome.
              </p>
            ) : null}
          </div>
        </ConnectorSetupInstructions>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onConnect ? (
            <Button type="button" size="sm" onClick={onConnect} disabled={saving}>
              {saving ? (
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RiExternalLinkLine className="mr-2 h-4 w-4" />
              )}
              {connected ? "Reconnect Plaud" : "Continue with Plaud"}
            </Button>
          ) : null}
          {!connected ? (
            <>
            <Button type="button" variant="hollow" size="sm" asChild>
              <a href="https://web.plaud.ai" target="_blank" rel="noreferrer">
                <RiExternalLinkLine className="mr-2 h-4 w-4" />
                Open Plaud Web
              </a>
            </Button>
            </>
          ) : null}
          <Button type="button" variant="hollow" size="sm" asChild>
            <a href="/downloads/callvault-plaud-connector.zip" download>
              <RiDownloadLine className="mr-2 h-4 w-4" />
              Download bridge
            </a>
          </Button>
        </div>
        </div>
        <div className="rounded-md border border-border/60 bg-card p-3">
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li><span className="font-semibold text-foreground">1. Download Bridge.</span> Unzip it, open Chrome extensions, enable Developer mode, and load the bridge folder.</li>
            <li><span className="font-semibold text-foreground">2. Refresh CallVault.</span> This panel should show the installed bridge version before you continue.</li>
            <li><span className="font-semibold text-foreground">3. Connect.</span> Click Continue with Plaud, sign in to Plaud Web, then open or refresh a recording if Plaud does not make an authenticated request automatically.</li>
            <li><span className="font-semibold text-foreground">4. Sync while connected.</span> This beta connection may expire when Plaud rotates your web session, so reconnect when CallVault asks.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function compareSemver(left: string | null | undefined, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function parseSemver(value: string | null | undefined): [number, number, number] {
  const parts = (value ?? "").split(".").map((part) => Number.parseInt(part, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

function WebhookStatusPanel({
  webhook,
  webhookUrl,
  signingSecret,
  verification,
  verificationState,
  loading,
  disabled,
  onStartVerification,
}: {
  webhook: ConnectorWebhookConfig;
  webhookUrl: string;
  signingSecret: string;
  verification: WebhookVerificationResult | null;
  verificationState: "not_configured" | "waiting" | "verified" | "error";
  loading: boolean;
  disabled: boolean;
  onStartVerification: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <ConnectorSetupInstructions
        title={`${webhook.providerLabel} webhook`}
        description={webhook.helperText}
      />

      <div className="mt-4 space-y-4">
        <ConnectorReadonlyUrlField
          value={webhookUrl}
          label={webhook.urlLabel}
          disabled={disabled}
        />
        <ConnectorSecretField
          id={`${webhook.providerLabel.toLowerCase()}-webhook-signing-secret`}
          label={webhook.signingSecretLabel}
          value={signingSecret}
          onChange={() => undefined}
          placeholder={
            loading ? "Loading saved signing secret..." : webhook.signingSecretPlaceholder
          }
          loading={loading}
          disabled={disabled}
          showCopyButton
          showRevealButton={false}
          copySuccessMessage="Webhook signing secret copied"
          emptyCopyMessage="No webhook signing secret is available yet"
        />
      </div>

      {webhook.verification ? (
        <ConnectorWebhookVerification
          className="mt-4"
          status={verificationState}
          description={
            verificationState === "waiting"
              ? "Send a test event from the provider. CallVault will update here when it receives a signed webhook."
              : undefined
          }
          lastReceivedAt={verification?.lastVerifiedAt}
          onRefresh={onStartVerification}
          refreshLabel={
            verificationState === "waiting"
              ? "Listening"
              : "Listen for test event"
          }
          refreshing={verificationState === "waiting"}
          disabled={disabled || verificationState === "waiting"}
        />
      ) : null}
    </div>
  );
}

function buildInitialCredentialValues(
  fields?: readonly ConnectorSetupFieldConfig[],
): CredentialValues {
  return Object.fromEntries((fields ?? []).map((field) => [field.name, ""]));
}

function buildInitialWebhookDetails(
  setup: ConnectorSetupConfig,
): WebhookDetailsState {
  if (!setup.webhook?.pathTokenField) return emptyWebhookDetails;

  const webhookPathToken = generateWebhookPathToken();
  return {
    webhookUrl: "",
    webhookPathToken,
    webhookSigningSecret: generateWebhookSigningSecret(),
    verification: null,
  };
}

function buildSaveCredentialsParams({
  setup,
  credentialValues,
  webhookDetails,
}: {
  setup: ConnectorSetupConfig;
  credentialValues: CredentialValues;
  webhookDetails: WebhookDetailsState;
}) {
  if (setup.kind === "browser_bridge") {
    return {
      sourceId: normalizeCredentialValue(credentialValues.sourceId) || undefined,
      apiKey: normalizeCredentialValue(credentialValues.apiKey),
      apiBase: normalizeCredentialValue(credentialValues.apiBase) || undefined,
    };
  }

  return {
    apiKey: normalizeCredentialValue(credentialValues.apiKey),
    webhookSecret:
      normalizeCredentialValue(credentialValues.webhookSecret) ||
      webhookDetails.webhookSigningSecret ||
      undefined,
    accountEmail: normalizeCredentialValue(credentialValues.accountEmail) || undefined,
    ...(webhookDetails.webhookPathToken
      ? { webhookPathToken: webhookDetails.webhookPathToken }
      : {}),
  };
}

function getFallbackSetupConfig(adapter: ConnectorAdapter): ConnectorSetupConfig {
  if (adapter.metadata.authMethods.includes("oauth")) {
    return { kind: "oauth" };
  }
  if (adapter.metadata.sourceApp === "plaud") {
    return {
      kind: "browser_bridge",
      beta: adapter.metadata.badge === "beta",
      credentialFields: [
        {
          name: "apiKey",
          label: "Plaud Web token",
          required: true,
          secret: true,
          placeholder: "Paste the Plaud Bearer token from Plaud Web",
        },
	    {
	      name: "apiBase",
	      label: "Plaud region",
	      required: true,
	      placeholder: "https://api.plaud.ai",
	      options: [
	        { label: "Global", value: "https://api.plaud.ai" },
	        { label: "Europe", value: "https://api-euc1.plaud.ai" },
	        { label: "Asia Pacific", value: "https://api-apse1.plaud.ai" },
	      ],
	    },
      ],
    };
  }
  if (adapter.metadata.authMethods.includes("api_key")) {
    return {
      kind: adapter.metadata.authMethods.includes("webhook_only")
        ? "api_key_webhook"
        : "api_key",
      credentialFields: [
        {
          name: "apiKey",
          label: `${adapter.metadata.label} API key`,
          required: true,
          secret: true,
          placeholder: `${adapter.metadata.label} API key`,
        },
      ],
      webhook: adapter.metadata.authMethods.includes("webhook_only")
        ? {
            providerLabel: adapter.metadata.label,
            urlLabel: `Webhook URL for ${adapter.metadata.label}`,
            signingSecretLabel: "Webhook signing secret",
            signingSecretPlaceholder: "Optional webhook signing secret",
            signingSecretField: "webhookSecret",
            destinationPath: `${adapter.metadata.sourceApp}-webhook`,
          }
        : undefined,
    };
  }
  return { kind: "none" };
}

function mapCredentialField({
  field,
  value,
  onChange,
}: {
  field: ConnectorSetupFieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return {
    id: `connector-${field.name}`,
    label: field.label,
    value,
    onChange,
    type: field.secret ? ("secret" as const) : field.name === "accountEmail" ? ("email" as const) : ("text" as const),
    placeholder: field.placeholder,
    required: field.required,
    autoComplete: field.autoComplete,
    options: field.options,
  };
}

function beginMutation(ref: React.MutableRefObject<symbol | null>): symbol | null {
  if (ref.current) return null;
  const mutation = Symbol("connector-mutation");
  ref.current = mutation;
  return mutation;
}

function endMutation(
  ref: React.MutableRefObject<symbol | null>,
  mutation: symbol,
): boolean {
  if (ref.current !== mutation) return false;
  ref.current = null;
  return true;
}

function normalizeCredentialValue(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
}

function getClusterState({
  isLoading,
  connected,
  editing,
  saving,
  disconnecting,
  lastError,
  verificationState,
}: {
  isLoading: boolean;
  connected: boolean;
  editing: boolean;
  saving: boolean;
  disconnecting: boolean;
  lastError: string | null;
  verificationState: "not_configured" | "waiting" | "verified" | "error";
}): ClusterState {
  if (isLoading) return "loading";
  if (saving) return "saving";
  if (disconnecting) return "disconnecting";
  if (lastError || verificationState === "error") return "error";
  if (verificationState === "verified") return "webhook_verified";
  if (verificationState === "waiting") return "waiting_for_webhook";
  if (editing) return "editing";
  return connected ? "connected" : "disconnected";
}

function storeOAuthReturnTo(state: string | undefined, returnTo: string) {
  const safeReturnTo = normalizeLocalReturnTo(returnTo);
  if (!safeReturnTo) return;
  if (state) {
    localStorage.setItem(`oauthReturnTo:${state}`, safeReturnTo);
    return;
  }
  localStorage.setItem("oauthReturnTo", safeReturnTo);
}

function normalizeLocalReturnTo(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const allowedRoute = ["/import", "/settings", "/setup"].some(
      (route) => url.pathname === route || url.pathname.startsWith(`${route}/`),
    );
    if (!allowedRoute) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function generateWebhookSigningSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateWebhookPathToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `ffwh_${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
