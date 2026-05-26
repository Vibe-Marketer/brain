import * as React from "react";
import { toast } from "sonner";
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
  ConnectorStatus,
  WebhookVerificationResult,
} from "../registry/types";
import { ConnectorBrowserBridgeNotice } from "./ConnectorBrowserBridgeNotice";
import { ConnectorCredentialForm } from "./ConnectorCredentialForm";
import {
  ConnectorSetupStateRow,
  type ConnectorClusterState,
} from "./ConnectorSetupStateRow";
import { ConnectorWebhookStatusPanel } from "./ConnectorWebhookStatusPanel";
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
  statusOverride?: ConnectorStatus;
}

type CredentialValues = Record<string, string>;
type ClusterState = ConnectorClusterState;

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

const PLAUD_BRIDGE_LATEST_VERSION = "0.1.2";

export function ConnectorSetupCluster({
  sourceApp,
  mode,
  returnTo,
  compact = false,
  className,
  onConnected,
  onDisconnected,
  onSaved,
  statusOverride,
}: ConnectorSetupClusterProps) {
  const adapter = getConnectorAdapter(sourceApp);
  const setup = adapter.setup;
  const connector = useConnector(sourceApp);
  const status = statusOverride ?? connector.status;
  const isLoading = statusOverride ? false : connector.isLoading;
  const refresh = connector.refresh;
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
  const credentialSetupKind = getCredentialSetupKind(setup);
  const showCredentialForm =
    Boolean(credentialSetupKind) &&
    Boolean(adapter.saveApiKeyCredentials) &&
    (mode !== "onboarding" || setup.kind !== "oauth");
  const canShowForm = showCredentialForm && (!connected || editing);
  const canShowWebhookConfigForm =
    connected &&
    Boolean(setup.webhook) &&
    Boolean(adapter.saveWebhookConfig) &&
    (verificationState !== "verified" || editing);
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

  const startOAuth = React.useCallback(async (sourceId?: string | null) => {
    if (!adapter.getOAuthAuthUrl) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;
    setSaving(true);
    setLastError(null);
    try {
      const { authUrl, state } = await adapter.getOAuthAuthUrl({ sourceId });
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

  const handleConnectOAuth = React.useCallback(
    () => startOAuth(),
    [startOAuth],
  );

  const handleReconnectOAuth = React.useCallback(
    () => startOAuth(status?.sourceId ?? null),
    [startOAuth, status?.sourceId],
  );

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
          sourceId: status?.sourceId ?? null,
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
    status?.sourceId,
    stopWebhookPolling,
    webhookDetails,
  ]);

  const handleSaveWebhookConfig = React.useCallback(async () => {
    if (!adapter.saveWebhookConfig || !setup.webhook || !status?.sourceId) return;
    const mutation = beginMutation(mutationRef);
    if (!mutation) return;

    setSaving(true);
    setLastError(null);
    stopWebhookPolling();
    try {
      const result = await adapter.saveWebhookConfig({
        sourceId: status.sourceId,
        webhookSigningSecret:
          credentialValues.webhookSecret ||
          webhookDetails.webhookSigningSecret ||
          null,
        webhookPathToken: webhookDetails.webhookPathToken || null,
      });
      setWebhookDetails((current) => ({
        webhookUrl: result.webhookUrl ?? current.webhookUrl,
        webhookPathToken:
          result.webhookPathToken ?? current.webhookPathToken ?? "",
        webhookSigningSecret:
          result.webhookSigningSecret ?? current.webhookSigningSecret ?? "",
        verification: result.verification ?? current.verification,
      }));
      if (setup.webhook.verification) {
        startWebhookVerification(result.sourceId);
      }
      toast.success(`${adapter.metadata.label} webhook settings saved`);
      await refresh();
      onSaved?.(result.sourceId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to save ${adapter.metadata.label} webhook settings`;
      setLastError(message);
      setVerificationState("error");
      toast.error(message);
    } finally {
      if (endMutation(mutationRef, mutation)) setSaving(false);
    }
  }, [
    adapter,
    credentialValues.webhookSecret,
    onSaved,
    refresh,
    setup.webhook,
    startWebhookVerification,
    status?.sourceId,
    stopWebhookPolling,
    webhookDetails.webhookPathToken,
    webhookDetails.webhookSigningSecret,
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
        description={getConnectorSetupDescription({
          adapter,
          setup,
          connected,
          mode,
        })}
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
              ? handleReconnectOAuth
              : undefined
        }
        reconnectLabel="Reconnect"
        onAddAccount={
          connected && setup.supportsMultipleAccounts && adapter.getOAuthAuthUrl
            ? handleConnectOAuth
            : undefined
        }
        addAccountLabel={`Add ${adapter.metadata.label} account`}
        onDisconnect={
          connected && adapter.disconnect ? handleDisconnect : undefined
        }
      />

      <ConnectorSetupStateRow
        state={clusterState}
        adapter={adapter}
        onConnectOAuth={
          !connected && setup.kind === "oauth" ? handleConnectOAuth : undefined
        }
        onEditCredentials={
          connected && showCredentialForm && mode !== "onboarding"
            ? () => setEditing(true)
            : undefined
        }
        onCancelEdit={editing ? () => setEditing(false) : undefined}
        saving={saving}
        disconnecting={disconnecting}
      />

      {setup.kind === "browser_bridge" ? (
        <ConnectorBrowserBridgeNotice
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
            credentialSetupKind === "browser_bridge"
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

      {canShowWebhookConfigForm && setup.webhook ? (
        <ConnectorCredentialForm
          title={`${adapter.metadata.label} webhook`}
          description={setup.helperCopy?.verificationWaiting}
          fields={[]}
          webhook={{
            webhookUrl,
            signingSecret:
              credentialValues.webhookSecret ||
              webhookDetails.webhookSigningSecret ||
              "",
            onSigningSecretChange: (value) => {
              setWebhookDetails((current) => ({
                ...current,
                webhookSigningSecret: value,
              }));
              setCredentialValue("webhookSecret", value);
            },
            urlLabel: setup.webhook.urlLabel,
            secretInputId: `${sourceApp}-webhook-secret`,
            secretLabel: setup.webhook.signingSecretLabel,
            secretPlaceholder: setup.webhook.signingSecretPlaceholder,
            loadingSecret: loadingWebhookDetails,
          }}
          submitLabel="Save webhook settings"
          submittingLabel="Saving"
          saving={saving}
          disabled={disconnecting}
          canSubmit={Boolean(
            (
              credentialValues.webhookSecret ||
              webhookDetails.webhookSigningSecret
            ).trim(),
          )}
          instructions={setup.webhook.helperText}
          onSubmit={handleSaveWebhookConfig}
        />
      ) : null}

      {setup.webhook &&
      connected &&
      !canShowWebhookConfigForm &&
      (verificationState === "waiting" || verificationState === "error") ? (
        <ConnectorWebhookStatusPanel
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

function getConnectorSetupDescription({
  adapter,
  setup,
  connected,
  mode,
}: {
  adapter: ConnectorAdapter;
  setup: ConnectorSetupConfig;
  connected: boolean;
  mode: ConnectorSetupClusterMode;
}): string {
  if (mode === "onboarding" && !connected && setup.kind === "oauth") {
    return `Connect ${adapter.metadata.label} with OAuth to start importing calls from this source.`;
  }

  return (
    setup.helperCopy?.[connected ? "connected" : "disconnected"] ??
    adapter.metadata.description
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
  sourceId,
  credentialValues,
  webhookDetails,
}: {
  setup: ConnectorSetupConfig;
  sourceId?: string | null;
  credentialValues: CredentialValues;
  webhookDetails: WebhookDetailsState;
}) {
  if (getCredentialSetupKind(setup) === "browser_bridge") {
    return {
      sourceId: normalizeCredentialValue(credentialValues.sourceId) || undefined,
      apiKey: normalizeCredentialValue(credentialValues.apiKey),
      apiBase: normalizeCredentialValue(credentialValues.apiBase) || undefined,
    };
  }

  return {
    sourceId: sourceId ?? undefined,
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

function getCredentialSetupKind(
  setup: ConnectorSetupConfig,
): ConnectorSetupConfig["kind"] | null {
  if (
    setup.kind === "api_key" ||
    setup.kind === "api_key_webhook" ||
    setup.kind === "browser_bridge"
  ) {
    return setup.kind;
  }

  return (
    setup.alternateKinds?.find(
      (kind) => kind === "api_key" || kind === "api_key_webhook",
    ) ?? null
  );
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
