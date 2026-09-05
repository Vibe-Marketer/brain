/**
 * IDENT-01 byte-identical regression test (Phase 34, Plan 02).
 *
 * Proves that adding a nullable `identity_id` column to speakers/contacts/
 * call_participants -- the only state this migration produces, since the
 * Phase 35+ resolver that populates it hasn't landed yet -- changes zero
 * current behavior. Mirrors Phase 30's EVT-03 precedent
 * (event-schema-noop.integration.test.ts) exactly: EXPLICIT-COLUMNS readers
 * (RPCs with a fixed RETURNS TABLE shape) are byte-identical because
 * identity_id was never added to their output signature. BARE-SELECT-STAR /
 * BARE-SELECT-NOARGS readers (reader-inventory.json's 3 REQUIRES-ATTENTION
 * entries) are structurally different: a new nullable column DOES appear in
 * their returned key set (the inventory's own select_style_legend says so).
 * For those, "unaffected" means the new key is NULL and every pre-existing
 * column's value is untouched -- not that the key set is unchanged, which
 * would be false for a star-select by construction.
 *
 * Coverage-completeness: this suite also loads reader-inventory.json (Plan
 * 01's exhaustive 46-entry sweep) and asserts its shape/count programmatically,
 * so a future edit to that file that silently drops an entry is caught here
 * rather than trusted from prose.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and supabase/CLAUDE.md
 * "Running integration tests safely". No fallback to production-like env vars.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-34-02 identity-schema-noop]";

// get_people_summary's exact RETURNS TABLE shape
// (supabase/migrations/20260309120000_call_participants.sql). identity_id is
// NOT in this list -- if it ever leaks in, this assertion fails.
const GET_PEOPLE_SUMMARY_KEYS = [
  "display_name",
  "email",
  "call_count",
  "last_call_at",
  "first_call_at",
  "recording_ids",
].sort();

// get_recordings_for_person's exact RETURNS TABLE shape (same migration).
const GET_RECORDINGS_FOR_PERSON_KEYS = [
  "recording_id",
  "title",
  "recording_start_time",
  "duration",
  "participant_count",
  "participant_name",
  "participant_email",
  "participant_type",
].sort();

// reader-inventory.json (Plan 01) -- machine-readable sidecar so this suite
// can assert coverage completeness rather than trusting prose. Scoped to
// speakers|contacts|call_participants (the 3 tables gaining identity_id).
interface ReaderInventoryEntry {
  path: string;
  table: "speakers" | "contacts" | "call_participants";
  select_style:
    | "EXPLICIT-COLUMNS"
    | "BARE-SELECT-STAR"
    | "BARE-SELECT-NOARGS"
    | "AGGREGATE-EXISTS";
  risk: "low" | "medium" | "high";
}
interface ReaderInventory {
  total: number;
  readers: ReaderInventoryEntry[];
}

const inventoryPath = join(
  process.cwd(),
  ".planning/phases/34-identity-consolidation/reader-inventory.json",
);
const inventory: ReaderInventory = JSON.parse(
  readFileSync(inventoryPath, "utf-8"),
);

describe("reader-inventory.json coverage completeness", () => {
  it("total matches the readers array length (no silently dropped entries)", () => {
    expect(inventory.readers.length).toBe(inventory.total);
  });

  it("every entry's table is one of the 3 tables gaining identity_id", () => {
    for (const entry of inventory.readers) {
      expect(["speakers", "contacts", "call_participants"]).toContain(
        entry.table,
      );
    }
  });

  it("the 3 REQUIRES-ATTENTION (high/medium risk, bare-select) entries this suite exercises directly are present", () => {
    const highRisk = inventory.readers.filter((r) => r.risk === "high");
    expect(
      highRisk.map((r) => r.path).sort(),
      "expected exactly useContacts.ts:498 and :663 as high-risk bare-select contacts readers",
    ).toEqual(
      ["src/hooks/useContacts.ts:498", "src/hooks/useContacts.ts:663"].sort(),
    );

    const mediumRisk = inventory.readers.filter((r) => r.risk === "medium");
    expect(
      mediumRisk.some((r) => r.path === "src/test/rls-regression.test.ts:1140"),
      "expected the rls-regression.test.ts CROSS_ORG_TABLES generic loop entry to be present",
    ).toBe(true);
  });
});

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} IDENT-01 byte-identical while identity_id IS NULL`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let orgId = "";
    let userId = "";
    let workspaceId = "";
    let recordingId = "";
    let speakerId = "";
    let contactId = "";
    let participantId = "";

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      const userEmail = `phase34-identnoop-${stamp}@callvault.test`;
      const userPassword = `phase34-identnoop-${stamp}-pwd!`;

      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      if (createUser.error || !createUser.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser failed: ${createUser.error?.message}`,
        );
      }
      userId = createUser.data.user.id;

      const org = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (org.error || !org.data) {
        throw new Error(`${SUITE_TAG} insert org failed: ${org.error?.message}`);
      }
      orgId = org.data.id as string;

      await admin.from("organization_memberships").insert({
        organization_id: orgId,
        user_id: userId,
        role: "organization_owner",
      });

      const ws = await admin
        .from("workspaces")
        .update({ name: `${SUITE_TAG} ws ${stamp}` })
        .eq("organization_id", orgId)
        .eq("is_home", true)
        .select("id")
        .single();
      if (ws.error || !ws.data) {
        throw new Error(
          `${SUITE_TAG} fetch/rename home workspace failed: ${ws.error?.message}`,
        );
      }
      workspaceId = ws.data.id as string;

      const rec = await admin
        .from("recordings")
        .insert({
          organization_id: orgId,
          owner_user_id: userId,
          title: `${SUITE_TAG} rec ${stamp}`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (rec.error || !rec.data) {
        throw new Error(
          `${SUITE_TAG} insert recording failed: ${rec.error?.message}`,
        );
      }
      recordingId = rec.data.id as string;

      // speakers row -- identity_id left at its NULL default (its only
      // post-migration state; the Phase 35+ resolver populates it).
      const speaker = await admin
        .from("speakers")
        .insert({
          user_id: userId,
          name: `${SUITE_TAG} Speaker`,
          email: `identnoop-speaker-${stamp}@example.com`,
        })
        .select("id")
        .single();
      if (speaker.error || !speaker.data) {
        throw new Error(
          `${SUITE_TAG} insert speaker failed: ${speaker.error?.message}`,
        );
      }
      speakerId = speaker.data.id as string;

      // contacts row -- same NULL identity_id contract.
      const contact = await admin
        .from("contacts")
        .insert({
          user_id: userId,
          org_id: orgId,
          email: `identnoop-contact-${stamp}@example.com`,
          name: `${SUITE_TAG} Contact`,
        })
        .select("id")
        .single();
      if (contact.error || !contact.data) {
        throw new Error(
          `${SUITE_TAG} insert contact failed: ${contact.error?.message}`,
        );
      }
      contactId = contact.data.id as string;

      // call_participants row -- feeds get_people_summary/get_recordings_for_person.
      const participant = await admin
        .from("call_participants")
        .insert({
          recording_id: recordingId,
          organization_id: orgId,
          email: `identnoop-participant-${stamp}@example.com`,
          name: `${SUITE_TAG} Participant`,
          participant_type: "attendee",
        })
        .select("id")
        .single();
      if (participant.error || !participant.data) {
        throw new Error(
          `${SUITE_TAG} insert call_participants failed: ${participant.error?.message}`,
        );
      }
      participantId = participant.data.id as string;
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      try {
        if (recordingId) {
          await admin.from("recordings").delete().eq("id", recordingId);
        }
        if (speakerId) {
          await admin.from("speakers").delete().eq("id", speakerId);
        }
        if (contactId) {
          await admin.from("contacts").delete().eq("id", contactId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} fixture cleanup threw:`, err);
      }

      try {
        if (orgId) {
          await admin.from("organizations").delete().eq("id", orgId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} org cleanup threw:`, err);
      }

      try {
        const { error } = await admin.rpc("cleanup_test_fixture_users", {
          p_max_age_minutes: 0,
        });
        if (error) {
          console.warn(
            `${SUITE_TAG} cleanup_test_fixture_users RPC failed:`,
            error.message,
          );
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} cleanup threw:`, err);
      }
    }, 60_000);

    it("fixture speakers/contacts/call_participants rows all have identity_id IS NULL", async () => {
      const speakerRow = await admin
        .from("speakers")
        .select("id, identity_id")
        .eq("id", speakerId)
        .single();
      expect(speakerRow.error).toBeNull();
      expect(speakerRow.data?.identity_id).toBeNull();

      const contactRow = await admin
        .from("contacts")
        .select("id, identity_id")
        .eq("id", contactId)
        .single();
      expect(contactRow.error).toBeNull();
      expect(contactRow.data?.identity_id).toBeNull();

      const participantRow = await admin
        .from("call_participants")
        .select("id, identity_id")
        .eq("id", participantId)
        .single();
      expect(participantRow.error).toBeNull();
      expect(participantRow.data?.identity_id).toBeNull();
    });

    it("get_people_summary (EXPLICIT-COLUMNS RPC) returns the unchanged 6-column shape, no identity_id key", async () => {
      const { data, error } = await admin.rpc("get_people_summary", {
        p_organization_id: orgId,
      });
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const matched = rows.filter((r) =>
        String(r.email ?? "").startsWith("identnoop-participant-"),
      );
      expect(matched.length).toBe(1);
      for (const row of matched) {
        const keys = Object.keys(row).sort();
        expect(keys, "get_people_summary row key set changed shape").toEqual(
          GET_PEOPLE_SUMMARY_KEYS,
        );
        expect(keys).not.toContain("identity_id");
      }
    });

    it("get_recordings_for_person (EXPLICIT-COLUMNS RPC) returns the unchanged 8-column shape, no identity_id key", async () => {
      const participantEmail = (
        await admin
          .from("call_participants")
          .select("email")
          .eq("id", participantId)
          .single()
      ).data?.email as string;

      const { data, error } = await admin.rpc("get_recordings_for_person", {
        p_organization_id: orgId,
        p_email: participantEmail,
      });
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const ourRows = rows.filter((r) => r.recording_id === recordingId);
      expect(ourRows.length).toBe(1);
      for (const row of ourRows) {
        const keys = Object.keys(row).sort();
        expect(
          keys,
          "get_recordings_for_person row key set changed shape",
        ).toEqual(GET_RECORDINGS_FOR_PERSON_KEYS);
        expect(keys).not.toContain("identity_id");
      }
    });

    it("REQUIRES-ATTENTION: contacts bare select('*') (useContacts.ts:498 pattern) gains identity_id as NULL, no other column corrupted", async () => {
      const { data, error } = await admin
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();
      expect(error).toBeNull();
      const row = data as Record<string, unknown>;
      // Ground truth per reader-inventory.json's own legend: a BARE-SELECT-STAR
      // reader WILL gain the new column -- assert that honestly, plus that it's
      // NULL and every pre-existing field this test seeded is intact.
      expect(row).toHaveProperty("identity_id");
      expect(row.identity_id).toBeNull();
      expect(row.id).toBe(contactId);
      expect(row.user_id).toBe(userId);
      expect(row.org_id).toBe(orgId);
      expect(String(row.email)).toContain("identnoop-contact-");
    });

    it("REQUIRES-ATTENTION: contacts bare select() after insert (useContacts.ts:663 pattern) gains identity_id as NULL, no other column corrupted", async () => {
      const stamp = Date.now();
      const insertResult = await admin
        .from("contacts")
        .insert({
          user_id: userId,
          org_id: orgId,
          email: `identnoop-contact-noargs-${stamp}@example.com`,
          name: `${SUITE_TAG} Contact NoArgs`,
        })
        .select(); // no args -- returns every column, same effect as select('*')
      expect(insertResult.error).toBeNull();
      const rows = insertResult.data as Array<Record<string, unknown>>;
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row).toHaveProperty("identity_id");
      expect(row.identity_id).toBeNull();
      expect(row.user_id).toBe(userId);
      expect(row.org_id).toBe(orgId);

      // Cleanup this extra fixture row inline (not tracked by the shared
      // afterAll -- it cascades away with nothing else, so delete directly).
      await admin.from("contacts").delete().eq("id", row.id as string);
    });

    it("REQUIRES-ATTENTION (medium risk): rls-regression.test.ts:1140-style call_participants bare select('*') filtered by recording_id still works with row-count-only semantics, identity_id present as NULL", async () => {
      // Exact replica of the CROSS_ORG_TABLES generic loop's query shape:
      // .from('call_participants').select('*').eq('recording_id', <id>).
      // That loop only ever checks data.length (row count), never individual
      // field access -- so gaining a NULL identity_id key cannot break it.
      const { data, error } = await admin
        .from("call_participants")
        .select("*")
        .eq("recording_id", recordingId);
      expect(error).toBeNull();
      expect(data?.length ?? 0).toBe(1);
      const row = (data ?? [])[0] as Record<string, unknown>;
      expect(row).toHaveProperty("identity_id");
      expect(row.identity_id).toBeNull();
      expect(row.id).toBe(participantId);
    });
  },
);
