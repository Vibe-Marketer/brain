import { RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectorReadonlyUrlField } from "./ConnectorReadonlyUrlField";
import { ConnectorSecretField } from "./ConnectorSecretField";
import { ConnectorSetupInstructions } from "./ConnectorSetupInstructions";
import { cn } from "@/lib/utils";

export type ConnectorCredentialFieldType =
  | "text"
  | "email"
  | "password"
  | "secret";

export interface ConnectorCredentialField {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: ConnectorCredentialFieldType;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  options?: readonly Array<{ label: string; value: string }>;
  className?: string;
}

export interface ConnectorCredentialWebhookFields {
  webhookUrl: string;
  signingSecret: string;
  onSigningSecretChange: (value: string) => void;
  onRegenerateSigningSecret?: () => void;
  loadingSecret?: boolean;
  urlLabel?: string;
  secretInputId?: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  secretCopyable?: boolean;
}

export interface ConnectorCredentialFormProps {
  title?: string;
  description?: string;
  fields: ConnectorCredentialField[];
  webhook?: ConnectorCredentialWebhookFields;
  submitLabel?: string;
  submittingLabel?: string;
  onSubmit: () => void | Promise<void>;
  canSubmit?: boolean;
  saving?: boolean;
  disabled?: boolean;
  instructions?: string;
  className?: string;
}

export function ConnectorCredentialForm({
  title,
  description,
  fields,
  webhook,
  submitLabel = "Save connection",
  submittingLabel = "Saving",
  onSubmit,
  canSubmit,
  saving = false,
  disabled = false,
  instructions,
  className,
}: ConnectorCredentialFormProps) {
  const isDisabled = disabled || saving;
  const resolvedCanSubmit =
    canSubmit ??
    fields.every((field) => !field.required || field.value.trim().length > 0);

  return (
    <form
      className={cn("rounded-lg border border-border bg-muted/20 p-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (isDisabled || !resolvedCanSubmit) return;
        void onSubmit();
      }}
    >
      <ConnectorSetupInstructions title={title} description={description} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <CredentialField
            key={field.id}
            field={field}
            disabled={isDisabled || field.disabled}
          />
        ))}
      </div>

      {webhook ? (
        <div className="mt-4 space-y-4">
          <ConnectorReadonlyUrlField
            value={webhook.webhookUrl}
            label={webhook.urlLabel}
            disabled={isDisabled}
          />
          <ConnectorSecretField
            id={webhook.secretInputId ?? "connector-webhook-secret"}
            label={webhook.secretLabel ?? "Webhook signing secret"}
            value={webhook.signingSecret}
            onChange={webhook.onSigningSecretChange}
            placeholder={webhook.secretPlaceholder ?? "Webhook signing secret"}
            loading={webhook.loadingSecret}
            disabled={isDisabled}
            showCopyButton={webhook.secretCopyable ?? true}
            copySuccessMessage="Webhook signing secret copied"
            emptyCopyMessage="Generate a webhook signing secret first"
            onRegenerate={webhook.onRegenerateSigningSecret}
          />
        </div>
      ) : null}

      {instructions ? (
        <p className="mt-3 text-[11px] text-muted-foreground">{instructions}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={isDisabled || !resolvedCanSubmit}>
          {saving ? (
            <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {saving ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CredentialField({
  field,
  disabled,
}: {
  field: ConnectorCredentialField;
  disabled?: boolean;
}) {
  if (field.type === "secret" || field.type === "password") {
    return (
      <ConnectorSecretField
        id={field.id}
        label={field.label}
        value={field.value}
        onChange={field.onChange}
        placeholder={field.placeholder}
        disabled={disabled}
        autoComplete={field.autoComplete}
        showCopyButton={false}
        className={field.className}
      />
    );
  }

  if (field.options?.length) {
    return (
      <div className={cn("space-y-2", field.className)}>
        <Label htmlFor={field.id} className="text-xs">
          {field.label}
        </Label>
        <select
          id={field.id}
          value={field.value}
          onChange={(event) => field.onChange(event.target.value)}
          disabled={disabled}
          autoComplete={field.autoComplete}
          className="h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", field.className)}>
      <Label htmlFor={field.id} className="text-xs">
        {field.label}
      </Label>
      <Input
        id={field.id}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        placeholder={field.placeholder}
        type={field.type ?? "text"}
        disabled={disabled}
        autoComplete={field.autoComplete}
      />
    </div>
  );
}
