import {
  ConnectorReadonlyUrlField,
  ConnectorSecretField,
  ConnectorSetupInstructions,
} from "@/components/connectors/setup";

export interface WebhookSetupCardProps {
  providerName: string;
  webhookUrl: string;
  signingSecret: string;
  onSigningSecretChange: (value: string) => void;
  onRegenerateSigningSecret: () => void;
  loadingSecret?: boolean;
  disabled?: boolean;
  secretInputId?: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  urlLabel?: string;
  description?: string;
  instructions?: string;
}

export function WebhookSetupCard({
  providerName,
  webhookUrl,
  signingSecret,
  onSigningSecretChange,
  onRegenerateSigningSecret,
  loadingSecret = false,
  disabled = false,
  secretInputId = "provider-webhook-secret",
  secretLabel = "Webhook signing secret",
  secretPlaceholder = "Generated webhook secret",
  urlLabel = "Webhook URL",
  description,
  instructions,
}: WebhookSetupCardProps) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3 space-y-4">
      <ConnectorSetupInstructions
        title={`${providerName} webhook setup`}
        description={
          description ??
          `Use the URL and signing secret below in ${providerName} so CallVault can securely receive future recordings.`
        }
      />

      <div className="space-y-4">
        <ConnectorReadonlyUrlField
          value={webhookUrl}
          label={urlLabel}
          disabled={disabled}
        />
        <ConnectorSecretField
          id={secretInputId}
          label={secretLabel}
          value={signingSecret}
          onChange={onSigningSecretChange}
          placeholder={
            loadingSecret ? "Loading saved signing secret..." : secretPlaceholder
          }
          loading={loadingSecret}
          disabled={disabled}
          showCopyButton
          showRevealButton={false}
          copySuccessMessage="Webhook signing secret copied"
          emptyCopyMessage="Generate a webhook signing secret first"
          onRegenerate={onRegenerateSigningSecret}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {instructions ??
          `In ${providerName}, paste this URL as the webhook destination and use the same signing secret so CallVault can verify the request.`}
      </p>
    </div>
  );
}
