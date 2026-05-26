import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { SOURCE_REGISTRY } from "../src/config/source-registry.ts";

type CheckStatus = "pass" | "fail" | "skip";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const supabaseUrl = normalizeUrl(
  process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "",
);
const userJwt = process.env.CALLVAULT_USER_JWT?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const userEmail = process.env.CALLVAULT_USER_EMAIL?.trim() || "";
const mutateLive = process.env.LIVE_CONNECTOR_MUTATE === "1";

if (!supabaseUrl) {
  console.error(
    "Missing SUPABASE_URL or VITE_SUPABASE_URL. Refusing to run live connector verification.",
  );
  process.exit(1);
}

const functionBaseUrl = `${supabaseUrl}/functions/v1`;
const results: CheckResult[] = [];

for (const functionName of collectRegistryFunctionNames()) {
  results.push(
    await checkFunctionReachable(functionName),
  );
}

for (const webhookName of ["read-ai-webhook", "grain-webhook"]) {
  results.push(await checkPublicWebhookReady(webhookName));
}

if (userJwt) {
  results.push(
    await checkAuthenticatedSearch("read-ai-fetch-meetings", {
      createdAfter: yesterdayIso(),
      createdBefore: new Date().toISOString(),
      limit: 1,
      ...(process.env.REDAI_SOURCE_ID ? { sourceId: process.env.REDAI_SOURCE_ID } : {}),
    }),
  );
  results.push(
    await checkAuthenticatedSearch("grain-fetch-recordings", {
      createdAfter: yesterdayIso(),
      createdBefore: new Date().toISOString(),
      limit: 1,
      ...(process.env.GRAIN_SOURCE_ID ? { sourceId: process.env.GRAIN_SOURCE_ID } : {}),
    }),
  );

  if (process.env.REDAI_SOURCE_ID) {
    results.push(
      await checkAuthenticatedPost("read-ai-webhook-settings", {
        sourceId: process.env.REDAI_SOURCE_ID,
      }),
    );
  }

  if (mutateLive && process.env.GRAIN_SOURCE_ID) {
    results.push(
      await checkAuthenticatedPost("grain-create-webhooks", {
        sourceId: process.env.GRAIN_SOURCE_ID,
      }),
    );
  } else {
    results.push({
      name: "grain-create-webhooks live registration",
      status: "skip",
      detail:
        "Set CALLVAULT_USER_JWT, GRAIN_SOURCE_ID, and LIVE_CONNECTOR_MUTATE=1 to register/verify Grain hooks against a real account.",
    });
  }
} else {
  results.push({
    name: "authenticated Read.ai/Grain live account checks",
    status: "skip",
    detail:
      "Set CALLVAULT_USER_JWT plus optional REDAI_SOURCE_ID/GRAIN_SOURCE_ID to run connected-account checks.",
  });
}

if (serviceRoleKey && userEmail) {
  results.push(...await checkServiceRoleAccountState(userEmail));
} else {
  results.push({
    name: "service-role Read.ai/Grain account state",
    status: "skip",
    detail:
      "Set SUPABASE_SERVICE_ROLE_KEY and CALLVAULT_USER_EMAIL to inspect active source rows and imported recordings.",
  });
}

printResults(results);

if (results.some((result) => result.status === "fail")) {
  process.exit(1);
}

function collectRegistryFunctionNames(): string[] {
  const functionNames = new Set<string>();

  for (const source of SOURCE_REGISTRY) {
    for (const functionName of [
      source.oauthUrlFunctionName,
      source.oauthCallbackFunctionName,
      source.searchFunctionName,
      source.credentialFunctionName,
      source.webhookSettingsFunctionName,
      source.syncFunctionName,
      source.webhookFunctionName,
      source.webhookRegistrationFunctionName,
      source.disconnectFunctionName,
    ]) {
      if (functionName) functionNames.add(functionName);
    }
  }

  return [...functionNames].sort();
}

async function checkServiceRoleAccountState(email: string): Promise<CheckResult[]> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await findUserByEmail(supabase, email);
  if (!user) {
    return [{
      name: `account ${email}`,
      status: "fail",
      detail: "No Supabase Auth user found for email.",
    }];
  }

  const checks: CheckResult[] = [{
    name: `account ${email}`,
    status: "pass",
    detail: `Found user ${user.id}`,
  }];

  for (const sourceApp of ["read-ai", "grain"] as const) {
    checks.push(...await checkSourceRows(supabase, user.id, sourceApp));
  }

  return checks;
}

async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(`Unable to list users: ${error.message}`);
  return data.users.find((user) => user.email === email) ?? null;
}

async function checkSourceRows(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sourceApp: "read-ai" | "grain",
): Promise<CheckResult[]> {
  const { data, error } = await supabase
    .from("import_sources")
    .select(
      "id, is_active, account_email, last_sync_at, error_message, oauth_token_expires, webhook_path_token, connection_metadata, updated_at",
    )
    .eq("user_id", userId)
    .eq("source_app", sourceApp)
    .order("updated_at", { ascending: false });

  if (error) {
    return [{
      name: `${sourceApp} source rows`,
      status: "fail",
      detail: error.message,
    }];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    is_active: boolean;
    account_email: string | null;
    last_sync_at: string | null;
    error_message: string | null;
    oauth_token_expires: number | null;
    webhook_path_token: string | null;
    connection_metadata: Record<string, unknown> | null;
    updated_at: string | null;
  }>;
  const activeRows = rows.filter((row) => row.is_active);
  const primary = activeRows[0] ?? null;
  const checks: CheckResult[] = [];

  checks.push({
    name: `${sourceApp} active source row`,
    status: primary ? "pass" : "fail",
    detail: primary
      ? `Found active source ${primary.id}; account=${primary.account_email ?? "unknown"}; lastSync=${primary.last_sync_at ?? "never"}; error=${primary.error_message ?? "none"}`
      : `No active ${sourceApp} import_sources row found for user.`,
  });

  if (primary?.error_message) {
    checks.push({
      name: `${sourceApp} source error state`,
      status: "fail",
      detail: primary.error_message,
    });
  } else if (primary) {
    checks.push({
      name: `${sourceApp} source error state`,
      status: "pass",
      detail: "No active source error_message.",
    });
  }

  if (primary && sourceApp === "grain") {
    checks.push({
      name: "grain webhook routing token",
      status: primary.webhook_path_token ? "pass" : "fail",
      detail: primary.webhook_path_token
        ? "Active Grain source has webhook_path_token."
        : "Active Grain source is missing webhook_path_token; run grain-create-webhooks.",
    });
    const hooks = primary.connection_metadata?.grain_webhooks;
    checks.push({
      name: "grain registered webhook metadata",
      status: Array.isArray(hooks) && hooks.length > 0 ? "pass" : "fail",
      detail: Array.isArray(hooks)
        ? `${hooks.length} registered hook metadata entr${hooks.length === 1 ? "y" : "ies"}.`
        : "No grain_webhooks metadata stored.",
    });
  }

  if (primary && sourceApp === "read-ai") {
    checks.push({
      name: "read-ai webhook routing token",
      status: primary.webhook_path_token ? "pass" : "skip",
      detail: primary.webhook_path_token
        ? "Active Read.ai source has webhook_path_token."
        : "Read.ai webhook settings have not been saved for this source yet.",
    });
  }

  checks.push(await checkImportedRecordingCount(supabase, userId, sourceApp));
  return checks;
}

async function checkImportedRecordingCount(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sourceApp: "read-ai" | "grain",
): Promise<CheckResult> {
  const { count, error } = await supabase
    .from("recordings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source_app", sourceApp);

  if (error) {
    const fallback = await supabase
      .from("recordings")
      .select("id", { count: "exact", head: true })
      .eq("source_app", sourceApp);

    if (!fallback.error) {
      return {
        name: `${sourceApp} imported recordings`,
        status: fallback.count && fallback.count > 0 ? "pass" : "skip",
        detail: `${fallback.count ?? 0} recording(s) currently imported for this source. User-scoped count unavailable: ${error.message || JSON.stringify(error)}`,
      };
    }

    return {
      name: `${sourceApp} imported recordings`,
      status: "skip",
      detail: `Could not count recordings: ${error.message || JSON.stringify(error)}`,
    };
  }

  return {
    name: `${sourceApp} imported recordings`,
    status: count && count > 0 ? "pass" : "skip",
    detail: `${count ?? 0} recording(s) currently imported for this source.`,
  };
}

async function checkFunctionReachable(functionName: string): Promise<CheckResult> {
  try {
    const response = await fetch(`${functionBaseUrl}/${functionName}`, {
      method: "OPTIONS",
    });
    if (response.status !== 404 && response.status < 500) {
      return {
        name: `${functionName} deployed`,
        status: "pass",
        detail: `OPTIONS returned HTTP ${response.status}`,
      };
    }
    return {
      name: `${functionName} deployed`,
      status: "fail",
      detail: `OPTIONS returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: `${functionName} deployed`,
      status: "fail",
      detail: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

async function checkPublicWebhookReady(functionName: string): Promise<CheckResult> {
  try {
    const response = await fetch(`${functionBaseUrl}/${functionName}`);
    const text = await response.text();
    return {
      name: `${functionName} public health`,
      status: response.ok ? "pass" : "fail",
      detail: `GET returned HTTP ${response.status}${text ? `: ${truncate(text)}` : ""}`,
    };
  } catch (error) {
    return {
      name: `${functionName} public health`,
      status: "fail",
      detail: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

async function checkAuthenticatedSearch(
  functionName: string,
  body: Record<string, unknown>,
): Promise<CheckResult> {
  const result = await checkAuthenticatedPost(functionName, body);
  if (result.status !== "fail") return result;
  if (/not connected|connect .* first/i.test(result.detail)) {
    return {
      ...result,
      status: "skip",
      detail: `${result.detail} Connect the account in CallVault, then rerun with the source id.`,
    };
  }
  return result;
}

async function checkAuthenticatedPost(
  functionName: string,
  body: Record<string, unknown>,
): Promise<CheckResult> {
  try {
    const response = await fetch(`${functionBaseUrl}/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const status = response.ok ? "pass" : "fail";
    return {
      name: `${functionName} authenticated POST`,
      status,
      detail: `HTTP ${response.status}${text ? `: ${truncate(text)}` : ""}`,
    };
  } catch (error) {
    return {
      name: `${functionName} authenticated POST`,
      status: "fail",
      detail: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

function printResults(items: CheckResult[]) {
  for (const item of items) {
    const marker = item.status === "pass" ? "PASS" : item.status === "skip" ? "SKIP" : "FAIL";
    console.log(`[${marker}] ${item.name} - ${item.detail}`);
  }

  const counts = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, skip: 0 } satisfies Record<CheckStatus, number>,
  );
  console.log(
    `\nConnector live verification: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped.`,
  );
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function yesterdayIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function truncate(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}
