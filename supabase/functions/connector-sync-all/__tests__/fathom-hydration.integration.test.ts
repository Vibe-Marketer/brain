import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationDbReachable, makeIntegrationClient } from "../../../../src/test/integration-setup";
import { checkDuplicate, runPipeline } from "../../_shared/connector-pipeline.ts";
import { hydrateFathomRecord } from "../../_shared/fathom-content.ts";
import { FathomRateLimitError } from "../../_shared/fathom-client.ts";
import type { ConnectorRecord } from "../../_shared/connector-pipeline.ts";

type SliceJob = {
  id: string;
  user_id: string;
  organization_id: string;
  workspace_id: string;
  source_app: string;
  provider_cursor: string | null;
  synced_ids: string[];
  failed_ids: string[];
  skipped_count: number;
};

// Execute the current processSlice source without Deno.serve or remote module
// imports. Only credential/provider boundaries are supplied; actual Supabase
// queries, runPipeline and checkpoint writes run against the real TEST DB.
function loadSlice(provider: {
  list: () => Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }>;
  hydrate: (record: ConnectorRecord, token: string) => Promise<ConnectorRecord>;
}): (db: ReturnType<typeof makeIntegrationClient>, job: SliceJob) => Promise<{ done: boolean; nextCursor: string | null; retryAfterSeconds?: number }> {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/connector-sync-all/index.ts"), "utf8");
  const ast = ts.createSourceFile("sync-all.ts", source, ts.ScriptTarget.Latest, true);
  const names = new Set(["encodeSubpageCursor", "decodeSubpageCursor", "pickString", "coerceTimestamp", "epochToIso", "pickTimestamp", "mapItemToConnectorRecord", "extractExternalId", "isUniqueViolation", "processSlice"]);
  const constants = new Set(["SLICE_ITEM_BUDGET", "FATHOM_SLICE_ITEM_BUDGET", "SUBPAGE_PREFIX"]);
  const selected = ast.statements.filter((statement) =>
    ts.isFunctionDeclaration(statement) ? Boolean(statement.name && names.has(statement.name.text))
      : ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && constants.has(declaration.name.text)),
  ).map((statement) => statement.getText(ast)).join("\n");
  const code = ts.transpileModule(selected, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = new Function("runPipeline", "checkDuplicate", "hydrateFathomRecord", "resolveListPage", "resolveJobOwnerAccessToken", "FathomRateLimitError", "Deno", `${code}\nreturn processSlice;`);
  return load(runPipeline, checkDuplicate, provider.hydrate, () => provider.list, async () => "fixture-token", FathomRateLimitError, { env: { get: () => undefined } });
}

// Only Fathom's HTTP responses are fixtures. All pipeline reads/writes, database
// constraints, participants and workspace entries use the dedicated TEST DB.
const testDbUrl = process.env.SUPABASE_TEST_DB_URL ?? "";
const hasDedicatedTestDbUrl = Boolean(testDbUrl) && !testDbUrl.includes("vltmrnjsubfzrgrtdqey");

describe.skipIf(!integrationDbReachable || !hasDedicatedTestDbUrl)("Fathom hydrated pipeline (real TEST DB)", () => {
  const db = makeIntegrationClient();
  const tag = `[fathom hydration integration] ${randomUUID()}`;
  const externalId = String(Date.now());
  let userId = "";
  let organizationId = "";
  let workspaceId = "";
  const createdOrganizationIds: string[] = [];

  beforeAll(async () => {
    const createdUser = await db.auth.admin.createUser({
      email: `fathom-hydration-${randomUUID()}@callvault.test`,
      password: `Fixture-${randomUUID()}!`,
      email_confirm: true,
    });
    if (createdUser.error || !createdUser.data.user) {
      throw new Error(`TEST fixture user failed: ${createdUser.error?.message}`);
    }
    userId = createdUser.data.user.id;
    // Signup provisions a personal organization/workspace; capture only this
    // new user's fixture scope so teardown never sweeps another test's data.
    const personalOrganizations = await db.from("organization_memberships")
      .select("organization_id").eq("user_id", userId);
    if (personalOrganizations.error) throw personalOrganizations.error;
    createdOrganizationIds.push(...(personalOrganizations.data ?? []).map((row) => row.organization_id));
    const organization = await db.from("organizations").insert({ name: tag, type: "business" }).select("id").single();
    if (organization.error || !organization.data) throw new Error(`TEST fixture organization failed: ${organization.error?.message}`);
    organizationId = organization.data.id;
    createdOrganizationIds.push(organizationId);
    const membership = await db.from("organization_memberships").insert({
      organization_id: organizationId,
      user_id: userId,
      role: "organization_owner",
    });
    if (membership.error) throw membership.error;
    const workspace = await db.from("workspaces").select("id").eq("organization_id", organizationId).eq("is_home", true).single();
    if (workspace.error || !workspace.data) throw new Error(`TEST fixture workspace failed: ${workspace.error?.message}`);
    workspaceId = workspace.data.id;
  }, 30_000);

  afterAll(async () => {
    if (userId) {
      // Normal auth.deleteUser is blocked by the last-owner/default-workspace
      // triggers on signup's personal workspace. Use the repository's existing
      // transactional trigger-bypass pattern, limited to captured fixture IDs.
      const sql = new Client({ connectionString: testDbUrl, ssl: { rejectUnauthorized: false } });
      try {
        await sql.connect();
        await sql.query("BEGIN");
        await sql.query("ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner");
        await sql.query("ALTER TABLE public.workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion");
        await sql.query("ALTER TABLE public.workspaces DISABLE TRIGGER protect_default_workspace");
        await sql.query("DELETE FROM public.workspace_entries WHERE recording_id IN (SELECT id FROM public.recordings WHERE owner_user_id = $1)", [userId]);
        await sql.query("DELETE FROM public.recordings WHERE owner_user_id = $1", [userId]);
        await sql.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrganizationIds]);
        await sql.query("DELETE FROM auth.users WHERE id = $1", [userId]);
        await sql.query("ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner");
        await sql.query("ALTER TABLE public.workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion");
        await sql.query("ALTER TABLE public.workspaces ENABLE TRIGGER protect_default_workspace");
        await sql.query("COMMIT");
        const remaining = await sql.query("SELECT id FROM auth.users WHERE id = $1", [userId]);
        expect(remaining.rows).toEqual([]);
      } catch (error) {
        await sql.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        await sql.end();
      }
    }
  }, 30_000);

  it("persists fetched transcript, summary and structured speakers, then skips a duplicate without overwriting content", async () => {
    const record = await hydrateFathomRecord({
      external_id: externalId,
      source_app: "fathom",
      title: tag,
      full_transcript: "",
      recording_start_time: "2026-07-28T13:00:00.000Z",
      recording_end_time: "2026-07-28T13:30:00.000Z",
      organization_id: organizationId,
      workspace_id: workspaceId,
      source_metadata: { import_source: "connector-sync-all", integration_test: true },
    }, "fixture-token", {
      fetchContent: async (url) => url.endsWith("/transcript")
        ? Response.json({ transcript: [{ speaker: { display_name: "John", matched_calendar_invitee_email: "john@example.com" }, text: "Actual source transcript.", timestamp: "00:00:12" }] })
        : Response.json({ summary: { markdown_formatted: "## Source summary\nDecision recorded." } }),
    });

    const inserted = await runPipeline(db, userId, record);
    expect(inserted).toMatchObject({ success: true, recordingId: expect.any(String) });
    const stored = await db.from("recordings")
      .select("id, full_transcript, summary, transcript_segments, duration, source_call_id")
      .eq("id", inserted.recordingId).single();
    expect(stored.error).toBeNull();
    expect(stored.data).toMatchObject({
      full_transcript: "[0:12] John: Actual source transcript.",
      summary: "## Source summary\nDecision recorded.",
      duration: 1800,
      source_call_id: externalId,
      transcript_segments: [{ speaker_name: "John", speaker_email: "john@example.com", start_seconds: 12 }],
    });
    const entries = await db.from("workspace_entries").select("workspace_id").eq("recording_id", inserted.recordingId);
    expect(entries.error).toBeNull();
    expect(entries.data).toEqual([{ workspace_id: workspaceId }]);

    expect(await checkDuplicate(db, userId, "fathom", externalId)).toMatchObject({ isDuplicate: true });
    expect(await runPipeline(db, userId, { ...record, full_transcript: "", summary: null }))
      .toEqual({ success: false, skipped: true });
    const afterDuplicate = await db.from("recordings")
      .select("id, full_transcript, summary").eq("organization_id", organizationId).eq("source_call_id", externalId);
    expect(afterDuplicate.error).toBeNull();
    expect(afterDuplicate.data).toEqual([{
      id: inserted.recordingId,
      full_transcript: record.full_transcript,
      summary: record.summary,
    }]);
  }, 30_000);

  async function createJob(): Promise<SliceJob> {
    const result = await db.from("sync_jobs").insert({
      user_id: userId,
      organization_id: organizationId,
      workspace_id: workspaceId,
      source_app: "fathom",
      mode: "all",
      status: "processing",
      provider_cursor: null,
      synced_ids: [],
      failed_ids: [],
      skipped_count: 0,
    }).select("*").single();
    if (result.error || !result.data) throw new Error(`TEST sync job failed: ${result.error?.message}`);
    return result.data as SliceJob;
  }

  it("restores an existing recording removed from all workspaces without requiring provider content", async () => {
    const existing = await db.from("recordings").select("id,full_transcript,summary").eq("organization_id", organizationId).eq("source_call_id", externalId).single();
    expect(existing.error).toBeNull();
    const removed = await db.from("workspace_entries").delete().eq("recording_id", existing.data!.id);
    expect(removed.error).toBeNull();
    const slice = loadSlice({
      list: async () => ({ items: [{ recording_id: externalId, title: tag }], nextCursor: null }),
      hydrate: async () => { throw new Error("Local re-entry must not depend on Fathom content availability"); },
    });
    expect(await slice(db, await createJob())).toMatchObject({ done: true });
    const restored = await db.from("workspace_entries").select("workspace_id").eq("recording_id", existing.data!.id);
    expect(restored.data).toEqual([{ workspace_id: workspaceId }]);
    const recording = await db.from("recordings").select("id,full_transcript,summary").eq("id", existing.data!.id).single();
    expect(recording.data).toEqual(existing.data);
  }, 30_000);

  it("checkpoints the first throttled item without failure and resumes all unseen content exactly once", async () => {
    const ids = [String(Date.now() + 1), String(Date.now() + 2), String(Date.now() + 3)];
    let throttleSecond = true;
    const slice = loadSlice({
      list: async () => ({ items: ids.map((id) => ({ recording_id: id, title: `${tag} rate ${id}`, recording_start_time: "2026-07-28T13:00:00.000Z" })), nextCursor: null }),
      hydrate: async (record, token) => {
        if (record.external_id === ids[1] && throttleSecond) {
          throttleSecond = false;
          throw new FathomRateLimitError(new Response(null, { status: 429, headers: { "Retry-After": "12" } }));
        }
        return hydrateFathomRecord(record, token, {
          fetchContent: async (url) => url.endsWith("/transcript")
            ? Response.json({ transcript: [{ speaker: { display_name: "John" }, text: "Complete after retry.", timestamp: "00:00:01" }] })
            : Response.json({ summary: { markdown_formatted: "Source summary." } }),
        });
      },
    });
    const job = await createJob();
    expect(await slice(db, job)).toMatchObject({ done: false, retryAfterSeconds: 60 });
    const checkpoint = await db.from("sync_jobs").select("*").eq("id", job.id).single();
    expect(checkpoint.error).toBeNull();
    expect(checkpoint.data).toMatchObject({
      status: "processing",
      synced_ids: [ids[0]],
      failed_ids: [],
      provider_cursor: '__subpage__:{"c":null,"o":1}',
    });
    expect(await slice(db, checkpoint.data as SliceJob)).toMatchObject({ done: true });
    const completed = await db.from("sync_jobs").select("status,synced_ids,failed_ids,progress_current").eq("id", job.id).single();
    expect(completed.data).toMatchObject({ status: "completed", synced_ids: ids, failed_ids: [], progress_current: 3 });
    const recordings = await db.from("recordings").select("source_call_id,full_transcript").eq("organization_id", organizationId).in("source_call_id", ids);
    expect(recordings.error).toBeNull();
    expect(recordings.data).toHaveLength(3);
    expect(recordings.data?.every((row) => row.full_transcript.includes("Complete after retry."))).toBe(true);
  }, 30_000);

  it("keeps an initial list429 resumable with a non-null cursor and no failed or skipped items", async () => {
    const slice = loadSlice({
      list: async () => { throw new FathomRateLimitError(new Response(null, { status: 429, headers: { "Retry-After": "12" } })); },
      hydrate: async () => { throw new Error("Hydration must not run when the list is throttled"); },
    });
    const job = await createJob();
    expect(await slice(db, job)).toEqual({ done: false, nextCursor: '__subpage__:{"c":null,"o":0}', retryAfterSeconds: 60 });
    const checkpoint = await db.from("sync_jobs").select("status,provider_cursor,synced_ids,failed_ids,skipped_count").eq("id", job.id).single();
    expect(checkpoint.data).toEqual({ status: "processing", provider_cursor: '__subpage__:{"c":null,"o":0}', synced_ids: [], failed_ids: [], skipped_count: 0 });
  }, 30_000);
});
