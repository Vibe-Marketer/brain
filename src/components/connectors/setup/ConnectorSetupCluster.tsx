import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DefaultDestinationBar } from "@/components/import/DefaultDestinationBar";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ConnectorAccountHeader } from "../ConnectorAccountHeader";
import { useConnector } from "../hooks/useConnector";
import { getConnectorAdapter } from "../registry/connectorRegistry";
import type {
  ConnectorAdapter,
  ConnectorSetupConfig,
  ConnectorSourceApp,
  ConnectorStatus,
} from "../registry/types";
import { ConnectorBrowserBridgeNotice } from "./ConnectorBrowserBridgeNotice";
import { ConnectorCredentialForm } from "./ConnectorCredentialForm";
import { ConnectorSetupStateRow } from "./ConnectorSetupStateRow";
import { ConnectorWebhookStatusPanel } from "./ConnectorWebhookStatusPanel";
import type { ConnectorWebhookVerificationState } from "./ConnectorWebhookStatusPanel";
import {
  buildInitialCredentialValues,
  buildSaveCredentialsParams,
  emptyWebhookDetails,
  getClusterState,
  getCredentialSetupKind,
  mapCredentialField,
  type CredentialValues,
  type WebhookDetailsState,
} from "./cluster-helpers";
import { storeOAuthReturnTo } from "./oauth-return-to";
import { useExclusiveMutation } from "./use-exclusive-mutation";
import { useWebhookVerificationPolling } from "./use-webhook-verification-polling";
import {
  generateWebhookPathToken,
  generateWebhookSigningSecret,
} from "./webhook-secrets";
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

const PLAUD_BRIDGE_LATEST_VERSION = "0.1.2";

/**
 * Orchestrates the full credential setup flow for one connector: OAuth start,
 * API-key credential form, webhook signing-secret form, post-save webhook
 * verification poll, browser-bridge handshake, and disconnect.
 *
 * The visual building blocks (account header, state row, bridge notice,
 * credential form, webhook status panel) and the non-visual primitives
 * (polling, single-flight mutex, helpers, OAuth return-to storage, semver)
 * are all extracted; this component holds only the orchestration state and
 * wires the handlers together.
 */
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
  const { activeOrgId, activeWorkspaceId } = useOrgContext();
  const { workspaces, isLoading: loadingWorkspaces } =
    useWorkspaces(activeOrgId);

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
  const [verificationState, setVerificationState] =
    React.useState<ConnectorWebhookVerificationState>("not_configured");
  const [bridgeMessage, setBridgeMessage] = React.useState<string | null>(null);
  const [bridgeVersion, setBridgeVersion] = React.useState<string | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState(
    () => status?.workspaceId ?? activeWorkspaceId ?? "",
  );
  const defaultWorkspaceId = React.useMemo(() => {
    const defaultWorkspace = workspaces.find((workspace) => workspace.is_default);
    return defaultWorkspace?.id ?? (workspaces.length === 1 ? workspaces[0]?.id : null);
  }, [workspaces]);

  const mutation = useExclusiveMutation();
  const verificationPolling = useWebhookVerificationPolling({
    sourceId: status?.sourceId ?? null,
    getVerification: adapter.getWebhookVerification
      ? (sourceId) => adapter.getWebhookVerification!({ sourceId })
      : undefined,
    onVerified: React.useCallback(
      (verification) => {
        setWebhookDetails((current) => ({ ...current, verification }));
        setVerificationState("verified");
        toast.success(`${adapter.metadata.label} webhook verified`);
      },
      [adapter.metadata.label],
    ),
    onError: React.useCallback((error: unknown) => {
      setLastError(
        error instanceof Error ? error.message : "Webhook verification failed",
      );
      setVerificationState("error");
    }, []),
  });
  const stopWebhookPolling = verificationPolling.stop;

  // Reflect the polling lifecycle onto our 4-value verificationState. The
  // hook owns `polling` and `expired`; we surface them as `waiting` and
  // `error` so the existing UI states keep working unchanged.
  React.useEffect(() => {
    if (verificationPolling.state === "polling") {
      setVerificationState("waiting");
    } else if (verificationPolling.state === "expired") {
      setVerificationState("error");
    }
  }, [verificationPolling.state]);

  const connected = Boolean(status?.connected);
  const credentialSetupKind = getCredentialSetupKind(setup);
  const requiresWorkspace = setup.kind !== "none";
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

  React.useEffect(() => {
    if (selectedWorkspaceId) return;
    const nextWorkspaceId =
      status?.workspaceId ?? activeWorkspaceId ?? defaultWorkspaceId ?? "";
    if (nextWorkspaceId) setSelectedWorkspaceId(nextWorkspaceId);
  }, [activeWorkspaceId, defaultWorkspaceId, selectedWorkspaceId, status?.workspaceId]);

  const requireWorkspaceSelection = React.useCallback(
    (action: string) => {
      if (!requiresWorkspace || selectedWorkspaceId) return true;
      const message = `Choose a future landing workspace before ${action}.`;
      setLastError(message);
      toast.error(message);
      return false;
    },
    [requiresWorkspace, selectedWorkspaceId],
  );

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
  }, [adapter.getWebhookDetails, connected, loadWebhookDetails, setup.webhook]);

  // Plaud browser-bridge: watch for the extension's announce event so the
  // installed-version badge updates without a manual refresh.
  React.useEffect(() => {
    if (setup.kind !== "browser_bridge") return;
    const updateBridgeStatus = () => {
      const bridge =
        window.__callvaultPlaudConnector ?? window.__openplaudConnector;
      const version = bridge?.version ?? null;
      setBridgeVersion(version);
      setBridgeMessage(
        bridge?.connect
          ? `Plaud connector ready${version ? ` (v${version})` : ""}`
          : "Plaud connector not detected",
      );
    };
    updateBridgeStatus();
    window.addEventListener(
      "callvault-plaud-connector-ready",
      updateBridgeStatus,
    );
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

  const startOAuth = React.useCallback(
    async (sourceId?: string | null) => {
      if (!adapter.getOAuthAuthUrl) return;
      if (!requireWorkspaceSelection("connecting this source")) return;
      const token = mutation.tryStart();
      if (!token) return;
      setSaving(true);
      setLastError(null);
      try {
        const { authUrl, state } = await adapter.getOAuthAuthUrl({
          sourceId,
          workspaceId: selectedWorkspaceId,
        });
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
        if (mutation.finish(token)) setSaving(false);
      }
    },
    [adapter, mode, mutation, requireWorkspaceSelection, returnTo, selectedWorkspaceId],
  );

  const handleConnectOAuth = React.useCallback(() => startOAuth(), [startOAuth]);
  const handleReconnectOAuth = React.useCallback(
    () => startOAuth(status?.sourceId ?? null),
    [startOAuth, status?.sourceId],
  );

  const handleSaveCredentials = React.useCallback(async () => {
    if (!adapter.saveApiKeyCredentials) return;
    if (!requireWorkspaceSelection("saving this connection")) return;
    const token = mutation.tryStart();
    if (!token) return;

    setSaving(true);
    setLastError(null);
    stopWebhookPolling();
    try {
      const result = await adapter.saveApiKeyCredentials(
        buildSaveCredentialsParams({
          setup,
          sourceId: status?.sourceId ?? null,
          workspaceId: selectedWorkspaceId,
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
        verificationPolling.start(result.sourceId);
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
      if (mutation.finish(token)) setSaving(false);
    }
  }, [
    adapter,
    credentialValues,
    mutation,
    onConnected,
    onSaved,
    requireWorkspaceSelection,
    refresh,
    selectedWorkspaceId,
    setup,
    status?.sourceId,
    stopWebhookPolling,
    verificationPolling,
    webhookDetails,
  ]);

  const handleSaveWebhookConfig = React.useCallback(async () => {
    if (!adapter.saveWebhookConfig || !setup.webhook || !status?.sourceId) return;
    const token = mutation.tryStart();
    if (!token) return;

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
        verificationPolling.start(result.sourceId);
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
      if (mutation.finish(token)) setSaving(false);
    }
  }, [
    adapter,
    credentialValues.webhookSecret,
    mutation,
    onSaved,
    refresh,
    setup.webhook,
    status?.sourceId,
    stopWebhookPolling,
    verificationPolling,
    webhookDetails.webhookPathToken,
    webhookDetails.webhookSigningSecret,
  ]);

  const handleBrowserBridgeConnect = React.useCallback(async () => {
    if (!adapter.saveApiKeyCredentials) return;
    if (!requireWorkspaceSelection("connecting Plaud")) return;
    const token = mutation.tryStart();
    if (!token) return;
    const bridge =
      window.__callvaultPlaudConnector ?? window.__openplaudConnector;
    if (!bridge?.connect) {
      const message =
        "CallVault Plaud Connector extension was not detected. Reload the extension and refresh this page, or paste the token manually.";
      setBridgeMessage(message);
      toast.error(message);
      mutation.finish(token);
      return;
    }

    setSaving(true);
    setLastError(null);
    setBridgeMessage("Opening Plaud and waiting for a valid session token.");
    try {
      const result = await bridge.connect();
      if (!result.accessToken) {
        throw new Error("Plaud connector returned no access token");
      }
      setBridgeMessage("Saving Plaud connection");
      const credentialParams = {
        apiKey: result.accessToken,
        apiBase: result.apiBase,
        workspaceId: selectedWorkspaceId,
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
        error instanceof Error ? error.message : "Plaud browser bridge failed";
      setLastError(message);
      setBridgeMessage(message);
      toast.error(`Plaud connection failed: ${message}`);
    } finally {
      if (mutation.finish(token)) setSaving(false);
    }
  }, [
    adapter,
    mutation,
    onConnected,
    onSaved,
    requireWorkspaceSelection,
    refresh,
    selectedWorkspaceId,
    setup.helperCopy?.saveSuccess,
    status?.sourceId,
  ]);

  const handleDisconnect = React.useCallback(async () => {
    if (!adapter.disconnect || !status?.connected) return;
    const token = mutation.tryStart();
    if (!token) return;
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
      if (mutation.finish(token)) setDisconnecting(false);
    }
  }, [adapter, mutation, onDisconnected, refresh, status, stopWebhookPolling]);

  const handleStartWebhookVerification = React.useCallback(() => {
    setLastError(null);
    verificationPolling.start();
  }, [verificationPolling]);

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

      {requiresWorkspace && (!connected || editing) ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <label
            htmlFor={`${sourceApp}-workspace`}
            className="text-xs font-semibold uppercase text-muted-foreground"
          >
            Future landing workspace
          </label>
          <select
            id={`${sourceApp}-workspace`}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedWorkspaceId}
            disabled={saving || disconnecting || loadingWorkspaces}
            onChange={(event) => {
              setSelectedWorkspaceId(event.target.value);
              if (event.target.value) setLastError(null);
            }}
          >
            <option value="">Choose workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Future imports land here. Existing imported calls are not moved.
          </p>
        </div>
      ) : null}

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
                  secretCopyable: setup.webhook.signingSecretCopyable,
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
            secretCopyable: setup.webhook.signingSecretCopyable,
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

function buildInitialWebhookDetails(
  setup: ConnectorSetupConfig,
): WebhookDetailsState {
  if (!setup.webhook?.pathTokenField) return emptyWebhookDetails;

  return {
    webhookUrl: "",
    webhookPathToken: generateWebhookPathToken(),
    webhookSigningSecret: generateWebhookSigningSecret(),
    verification: null,
  };
}
