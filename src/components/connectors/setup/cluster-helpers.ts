import type {
  ConnectorCredentialField as ConnectorSetupFieldConfig,
  ConnectorSetupConfig,
  WebhookVerificationResult,
} from "../registry/types";
import type { ConnectorClusterState } from "./ConnectorSetupStateRow";
import type { ConnectorWebhookVerificationState } from "./ConnectorWebhookStatusPanel";

export type ConnectorSetupClusterMode = "settings" | "import" | "onboarding";

export type CredentialValues = Record<string, string>;

export interface WebhookDetailsState {
  webhookUrl: string;
  webhookPathToken: string;
  webhookSigningSecret: string;
  verification: WebhookVerificationResult | null;
}

export const emptyWebhookDetails: WebhookDetailsState = {
  webhookUrl: "",
  webhookPathToken: "",
  webhookSigningSecret: "",
  verification: null,
};

/**
 * Strips invisible bidi control characters and trims surrounding whitespace
 * before sending a credential value to the adapter. NFKC normalization makes
 * fullwidth Latin / zenkaku pastes (common when copying from terminal apps)
 * match the canonical ASCII form the backend expects.
 */
export function normalizeCredentialValue(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .trim();
}

/**
 * Returns the credential-setup kind active for this connector. Falls back to
 * the first compatible `alternateKinds` entry when the primary kind is OAuth
 * but the connector also supports an API key escape hatch (Read.ai today).
 * Returns `null` when no credential-form path is appropriate.
 */
export function getCredentialSetupKind(
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

/**
 * Maps a registry credential-field config into the props shape expected by
 * `ConnectorCredentialForm`. Keeps the field-rendering decisions
 * (secret vs email vs plain text) centralized here.
 */
export function mapCredentialField({
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
    type: field.secret
      ? ("secret" as const)
      : field.name === "accountEmail"
        ? ("email" as const)
        : ("text" as const),
    placeholder: field.placeholder,
    required: field.required,
    autoComplete: field.autoComplete,
    options: field.options,
  };
}

/**
 * Assembles the params object passed to `adapter.saveApiKeyCredentials`. The
 * browser-bridge path uses a different param shape (no webhook fields) than
 * the API-key / API-key+webhook path, which is why this lives in one place.
 */
export function buildSaveCredentialsParams({
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
    accountEmail:
      normalizeCredentialValue(credentialValues.accountEmail) || undefined,
    ...(webhookDetails.webhookPathToken
      ? { webhookPathToken: webhookDetails.webhookPathToken }
      : {}),
  };
}

/**
 * Reduces the disparate cluster flags (loading, saving, editing, errors,
 * verification state) into a single discriminated state value used to drive
 * the visible UI and the `data-connector-setup-state` attribute. Order is
 * important: terminal states (loading/saving/disconnecting/error) win over
 * transient ones (waiting/verified/editing).
 */
export function getClusterState({
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
  verificationState: ConnectorWebhookVerificationState;
}): ConnectorClusterState {
  if (isLoading) return "loading";
  if (saving) return "saving";
  if (disconnecting) return "disconnecting";
  if (lastError || verificationState === "error") return "error";
  if (verificationState === "verified") return "webhook_verified";
  if (verificationState === "waiting") return "waiting_for_webhook";
  if (editing) return "editing";
  return connected ? "connected" : "disconnected";
}

/**
 * Builds the initial empty credential-value map keyed by field name. Returns
 * an empty object when the connector has no credential fields.
 */
export function buildInitialCredentialValues(
  fields?: readonly ConnectorSetupFieldConfig[],
): CredentialValues {
  return Object.fromEntries((fields ?? []).map((field) => [field.name, ""]));
}
