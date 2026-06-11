// Service-role RLS probe for the autopilot surface (Phase 13 Plan 01).
// Proves the 20260611200000 migration's policy contract against the LIVE DB:
//   1. service-role can SELECT + UPDATE runner_state (daemon heartbeat path)
//   2. anon-key client gets zero rows from runner_state and cannot UPDATE it
//   3. anon-key client cannot UPDATE tickets.priority/urgent
//   4. service-role can INSERT ticket_messages author_type='agent'; anon cannot (spoof probe, 11-05)
//   5. runner_state has exactly one row with id = 1
// Conventions follow scripts/verify-connectors-live.ts (dotenv/config, env
// fallbacks, CheckResult shape). Exits non-zero on any fail. No secrets in repo.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type CheckStatus = "pass" | "fail" | "skip";

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
  "";

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_PUBLISHABLE_KEY. Refusing to run autopilot RLS verification.",
  );
  process.exit(1);
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results: CheckResult[] = [];

// --- Check 1: service-role SELECT + UPDATE runner_state (heartbeat path) ---
{
  const { data: row, error: selErr } = await service
    .from("runner_state")
    .select("id, status, kill_switch, last_heartbeat")
    .eq("id", 1)
    .maybeSingle();
  if (selErr || !row) {
    results.push({
      name: "service-role runner_state SELECT",
      status: "fail",
      detail: selErr?.message ?? "No runner_state row returned.",
    });
  } else {
    const heartbeat = new Date().toISOString();
    const { data: updated, error: updErr } = await service
      .from("runner_state")
      .update({ last_heartbeat: heartbeat })
      .eq("id", 1)
      .select("id, last_heartbeat");
    results.push({
      name: "service-role runner_state SELECT + heartbeat UPDATE",
      status: !updErr && updated?.length === 1 ? "pass" : "fail",
      detail: updErr
        ? updErr.message
        : updated?.length === 1
          ? `Heartbeat written: ${updated[0].last_heartbeat}`
          : "UPDATE matched 0 rows.",
    });
  }
}

// --- Check 2: anon runner_state SELECT zero rows; UPDATE blocked ---
{
  const { data, error } = await anon.from("runner_state").select("id");
  const selectBlocked = !error && (data ?? []).length === 0;
  const { data: updData, error: updError } = await anon
    .from("runner_state")
    .update({ kill_switch: true })
    .eq("id", 1)
    .select("id");
  const updateBlocked = Boolean(updError) || (updData ?? []).length === 0;
  results.push({
    name: "anon runner_state blocked (SELECT 0 rows, UPDATE no-op)",
    status: selectBlocked && updateBlocked ? "pass" : "fail",
    detail: selectBlocked && updateBlocked
      ? `SELECT returned ${data?.length ?? 0} rows; UPDATE ${updError ? `errored (${updError.message})` : "matched 0 rows"}.`
      : `SELECT rows=${data?.length ?? "err:" + error?.message}; UPDATE rows=${updData?.length ?? 0} err=${updError?.message ?? "none"} — LEAK.`,
  });
}

// --- Need a known ticket id for checks 3 and 4 ---
const { data: ticketRows, error: ticketErr } = await service
  .from("tickets")
  .select("id, priority, urgent")
  .order("created_at", { ascending: true })
  .limit(1);
const ticket = ticketRows?.[0] ?? null;

// --- Check 3: anon cannot UPDATE tickets.priority/urgent ---
if (!ticket) {
  results.push({
    name: "anon tickets priority/urgent UPDATE blocked",
    status: "skip",
    detail: ticketErr?.message ?? "No tickets exist to probe against.",
  });
} else {
  const { data: updData, error: updError } = await anon
    .from("tickets")
    .update({ priority: 999, urgent: true })
    .eq("id", ticket.id)
    .select("id");
  const blocked = Boolean(updError) || (updData ?? []).length === 0;
  results.push({
    name: "anon tickets priority/urgent UPDATE blocked",
    status: blocked ? "pass" : "fail",
    detail: blocked
      ? `UPDATE on ticket ${ticket.id} ${updError ? `errored (${updError.message})` : "matched 0 rows"}.`
      : `LEAK: anon updated ${updData?.length} ticket row(s).`,
  });
  if (!blocked) {
    // Restore mutated state per cleanup contract.
    await service
      .from("tickets")
      .update({ priority: ticket.priority, urgent: ticket.urgent })
      .eq("id", ticket.id);
  }
}

// --- Check 4: agent message spoof probe (11-05 policy re-proof) ---
if (!ticket) {
  results.push({
    name: "ticket_messages author_type='agent' service-role-only",
    status: "skip",
    detail: "No tickets exist to attach a probe message to.",
  });
} else {
  const probeBody =
    "[13-01 RLS probe] service-role agent-message write check — safe to ignore.";
  const { data: inserted, error: insErr } = await service
    .from("ticket_messages")
    .insert({
      ticket_id: ticket.id,
      author_type: "agent",
      author_id: null,
      body: probeBody,
    })
    .select("id");
  const serviceOk = !insErr && inserted?.length === 1;
  if (serviceOk && inserted?.[0]?.id) {
    await service.from("ticket_messages").delete().eq("id", inserted[0].id);
  }
  const { error: anonInsErr } = await anon.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_type: "agent",
    author_id: null,
    body: probeBody,
  });
  const anonBlocked = Boolean(anonInsErr);
  results.push({
    name: "ticket_messages author_type='agent' service-role-only",
    status: serviceOk && anonBlocked ? "pass" : "fail",
    detail: serviceOk && anonBlocked
      ? `Service-role insert ok (cleaned up); anon insert rejected (${anonInsErr?.message}).`
      : `service insert=${serviceOk ? "ok" : insErr?.message}; anon insert ${anonBlocked ? "blocked" : "SUCCEEDED — SPOOF LEAK"}.`,
  });
}

// --- Check 5: runner_state has exactly one row with id = 1 ---
{
  const { data, error } = await service.from("runner_state").select("id");
  const ok = !error && data?.length === 1 && data[0].id === 1;
  results.push({
    name: "runner_state singleton (exactly one row, id=1)",
    status: ok ? "pass" : "fail",
    detail: error
      ? error.message
      : `rows=${data?.length}, ids=[${(data ?? []).map((r) => r.id).join(",")}]`,
  });
}

for (const item of results) {
  const marker =
    item.status === "pass" ? "PASS" : item.status === "skip" ? "SKIP" : "FAIL";
  console.log(`[${marker}] ${item.name} - ${item.detail}`);
}
const counts = results.reduce(
  (acc, item) => {
    acc[item.status] += 1;
    return acc;
  },
  { pass: 0, fail: 0, skip: 0 } satisfies Record<CheckStatus, number>,
);
console.log(
  `\nAutopilot RLS verification: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped.`,
);
if (counts.fail > 0) process.exit(1);
