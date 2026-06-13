import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../../src/types/supabase";

config({ path: ".env" });
config({ path: ".env.local" });

type CheckStatus = "pass" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ""
).trim().replace(/\/+$/, "");
const publishableKey = (
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  ""
).trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const adminEmail = process.env.CALLVAULTAI_LOGIN?.trim() || "";
const adminPassword = process.env.CALLVAULTAI_LOGIN_PASSWORD?.trim() || "";

if (!supabaseUrl || !publishableKey || !serviceRoleKey || !adminEmail || !adminPassword) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, CALLVAULTAI_LOGIN, or CALLVAULTAI_LOGIN_PASSWORD."
  );
  process.exit(1);
}

const service = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminBrowser = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const nonAdminBrowser = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results: CheckResult[] = [];

function pass(name: string, detail: string): void {
  results.push({ name, status: "pass", detail });
}

function fail(name: string, detail: string): void {
  results.push({ name, status: "fail", detail });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

function isForbidden(error: unknown): boolean {
  return /forbidden/i.test(errorMessage(error));
}

function isExecuteBlocked(error: unknown): boolean {
  return /permission denied|not authorized|not allowed|function .* does not exist|forbidden/i.test(
    errorMessage(error)
  );
}

async function signIn(
  client: typeof adminBrowser,
  email: string,
  password: string
): Promise<string> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? "sign-in returned no access token");
  }
  return data.session.access_token;
}

const probePassword = `Probe18-05!${Date.now()}`;
const probeEmail = `probe-18-05-${Date.now()}@callvault.test`;
let probeUserId: string | null = null;

try {
  await signIn(adminBrowser, adminEmail, adminPassword);
  const { data: adminRows, error: adminRpcError } =
    await adminBrowser.rpc("ticket_source_metrics");
  if (adminRpcError) {
    fail("admin browser RPC returns metrics", adminRpcError.message);
  } else if (!adminRows || adminRows.length === 0) {
    fail("admin browser RPC returns metrics", "Admin RPC returned zero rows.");
  } else {
    pass(
      "admin browser RPC returns metrics",
      `Rows=${adminRows.length}; sources=${adminRows.map((row) => row.source).join(",")}`
    );
  }

  const { error: anonRpcError } = await anon.rpc("ticket_source_metrics");
  if (anonRpcError && isExecuteBlocked(anonRpcError)) {
    pass("anon RPC execution blocked", anonRpcError.message);
  } else {
    fail(
      "anon RPC execution blocked",
      anonRpcError ? anonRpcError.message : "Anon call unexpectedly succeeded."
    );
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: probeEmail,
    password: probePassword,
    email_confirm: true,
  });
  if (createError || !created.user?.id) {
    throw new Error(createError?.message ?? "probe user creation returned no user id");
  }
  probeUserId = created.user.id;

  await signIn(nonAdminBrowser, probeEmail, probePassword);
  const { error: nonAdminRpcError } =
    await nonAdminBrowser.rpc("ticket_source_metrics");
  if (nonAdminRpcError && isForbidden(nonAdminRpcError)) {
    pass("non-admin authenticated RPC rejected", nonAdminRpcError.message);
  } else {
    fail(
      "non-admin authenticated RPC rejected",
      nonAdminRpcError
        ? nonAdminRpcError.message
        : "Non-admin authenticated call unexpectedly succeeded."
    );
  }
} catch (error) {
  fail("probe setup", errorMessage(error));
} finally {
  if (probeUserId) {
    const { error } = await service.auth.admin.deleteUser(probeUserId);
    if (error) {
      const { error: cleanupError } = await service.rpc("cleanup_test_fixture_users", {
        p_max_age_minutes: 0,
      });
      if (cleanupError) {
        fail(
          "probe user cleanup",
          `${error.message}; cleanup_test_fixture_users failed: ${cleanupError.message}`
        );
      } else {
        pass(
          "probe user cleanup",
          `Direct delete blocked (${error.message}); cleanup_test_fixture_users swept @callvault.test fixtures.`
        );
      }
    } else {
      pass("probe user cleanup", `Deleted ${probeEmail}`);
    }
  }
}

for (const result of results) {
  const marker = result.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${marker}] ${result.name} - ${result.detail}`);
}

const failures = results.filter((result) => result.status === "fail");
console.log(`\nTicket source metrics RPC verification: ${results.length - failures.length} passed, ${failures.length} failed.`);
if (failures.length > 0) process.exit(1);
