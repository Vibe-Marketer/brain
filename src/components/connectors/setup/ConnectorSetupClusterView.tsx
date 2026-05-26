import * as React from "react";
import { cn } from "@/lib/utils";
import { DefaultDestinationBar } from "@/components/import/DefaultDestinationBar";
import { ConnectorAccountHeader } from "../ConnectorAccountHeader";
import type {
  ConnectorAdapter,
  ConnectorSetupConfig,
  ConnectorSourceApp,
  ConnectorStatus,
} from "../registry/types";
import { ConnectorBrowserBridgeNotice } from "./ConnectorBrowserBridgeNotice";
import { ConnectorCredentialForm } from "./ConnectorCredentialForm";
import {
  ConnectorSetupStateRow,
  type ConnectorClusterState,
} from "./ConnectorSetupStateRow";
import {
  ConnectorWebhookStatusPanel,
  type ConnectorWebhookVerificationState,
} from "./ConnectorWebhookStatusPanel";
import {
  mapCredentialField,
  type CredentialValues,
  type WebhookDetailsState,
} from "./cluster-helpers";
import type { ConnectorSetupClusterMode } from "./ConnectorSetupClusterMode";
import { generateWebhookSigningSecret } from "./webhook-secrets";

export interface ConnectorSetupClusterViewProps {
  // identity
  sourceApp: ConnectorSourceApp;
  mode: ConnectorSetupClusterMode;
  adapter: ConnectorAdapter;
  setup: ConnectorSetupConfig;
  status: ConnectorStatus;
  // shell
  compact: boolean;
  className?: string;
  bridgeLatestVersion: string;
  // derived flags
  connected: boolean;
  clusterState: ConnectorClusterState;
  canShowForm: boolean;
  canShowWebhookConfigForm: boolean;
  credentialSetupKind: ConnectorSetupConfig["kind"] | null;
  showCredentialForm: boolean;
  // working state
  credentialValues: CredentialValues;
  webhookDetails: WebhookDetailsState;
  webhookUrl: string;
  editing: boolean;
  saving: boolean;
  disconnecting: boolean;
  loadingWebhookDetails: boolean;
  verificationState: ConnectorWebhookVerificationState;
  bridgeMessage: string | null;
  bridgeVersion: string | null;
  lastError: string | null;
  // mutators
  setEditing: (next: boolean) => void;
  setCredentialValue: (name: string, value: string) => void;
  setWebhookDetails: React.Dispatch<React.SetStateAction<WebhookDetailsState>>;
  // handlers
  onConnectOAuth: () => void;
  onReconnectOAuth: () => void;
  onSaveCredentials: () => void;
  onSaveWebhookConfig: () => void;
  onBrowserBridgeConnect: () => void;
  onDisconnect: () => void;
  onStartWebhookVerification: () => void;
}

/**
 * Pure render layer for ConnectorSetupCluster. All state, side effects, and
 * handler wiring live in the cluster; this component composes the visual
 * pieces (account header, state row, bridge notice, credential form, webhook
 * status panel, default destination bar) and renders the inline error line.
 */
export function ConnectorSetupClusterView({
  sourceApp,
  mode,
  adapter,
  setup,
  status,
  compact,
  className,
  bridgeLatestVersion,
  connected,
  clusterState,
  canShowForm,
  canShowWebhookConfigForm,
  credentialSetupKind,
  showCredentialForm,
  credentialValues,
  webhookDetails,
  webhookUrl,
  editing,
  saving,
  disconnecting,
  loadingWebhookDetails,
  verificationState,
  bridgeMessage,
  bridgeVersion,
  lastError,
  setEditing,
  setCredentialValue,
  setWebhookDetails,
  onConnectOAuth,
  onReconnectOAuth,
  onSaveCredentials,
  onSaveWebhookConfig,
  onBrowserBridgeConnect,
  onDisconnect,
  onStartWebhookVerification,
}: ConnectorSetupClusterViewProps) {
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
            ? onBrowserBridgeConnect
            : connected && adapter.getOAuthAuthUrl
              ? onReconnectOAuth
              : undefined
        }
        reconnectLabel="Reconnect"
        onAddAccount={
          connected && setup.supportsMultipleAccounts && adapter.getOAuthAuthUrl
            ? onConnectOAuth
            : undefined
        }
        addAccountLabel={`Add ${adapter.metadata.label} account`}
        onDisconnect={
          connected && adapter.disconnect ? onDisconnect : undefined
        }
      />

      <ConnectorSetupStateRow
        state={clusterState}
        adapter={adapter}
        onConnectOAuth={
          !connected && setup.kind === "oauth" ? onConnectOAuth : undefined
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
          latestVersion={bridgeLatestVersion}
          saving={saving}
          onConnect={!connected ? onBrowserBridgeConnect : undefined}
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
          onSubmit={onSaveCredentials}
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
          onSubmit={onSaveWebhookConfig}
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
          onStartVerification={onStartWebhookVerification}
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
