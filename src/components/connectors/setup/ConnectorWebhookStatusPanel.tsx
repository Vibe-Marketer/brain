import * as React from "react";
import type {
  ConnectorWebhookConfig,
  WebhookVerificationResult,
} from "../registry/types";
import { ConnectorReadonlyUrlField } from "./ConnectorReadonlyUrlField";
import { ConnectorSecretField } from "./ConnectorSecretField";
import { ConnectorSetupInstructions } from "./ConnectorSetupInstructions";
import { ConnectorWebhookVerification } from "./ConnectorWebhookVerification";

export type ConnectorWebhookVerificationState =
  | "not_configured"
  | "waiting"
  | "verified"
  | "error";

export interface ConnectorWebhookStatusPanelProps {
  webhook: ConnectorWebhookConfig;
  webhookUrl: string;
  signingSecret: string;
  verification: WebhookVerificationResult | null;
  verificationState: ConnectorWebhookVerificationState;
  loading: boolean;
  disabled: boolean;
  onStartVerification: () => void;
}

/**
 * Read-only webhook status panel. Renders the configured webhook URL,
 * the signing secret (copyable, not editable), and a verification widget
 * that the cluster can drive via the polling hook.
 */
export function ConnectorWebhookStatusPanel({
  webhook,
  webhookUrl,
  signingSecret,
  verification,
  verificationState,
  loading,
  disabled,
  onStartVerification,
}: ConnectorWebhookStatusPanelProps) {
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
            loading
              ? "Loading saved signing secret..."
              : webhook.signingSecretPlaceholder
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
