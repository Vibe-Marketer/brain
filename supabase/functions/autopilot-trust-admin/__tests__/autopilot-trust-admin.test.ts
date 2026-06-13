import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("autopilot-trust-admin wiring", () => {
  it("verifies caller JWT in function code and gates every mutation on ADMIN role", () => {
    expect(source).toMatch(/authenticateRequest\(req, supabase, corsHeaders\)/);
    expect(source).toMatch(/if \(authResult instanceof Response\) return authResult/);
    expect(source).toMatch(
      /rpc\('has_role', \{\s*_user_id: authResult\.userId,\s*_role: 'ADMIN',?\s*\}\)/,
    );
    expect(source).toMatch(/Admin access required/);
    expect(source).toMatch(/status,\s*headers/);
    expect(source).toMatch(/403/);
  });

  it("validates a bounded closed action/category payload", () => {
    expect(source).toMatch(/action: z\.enum\(\['promote_auto', 'demote_manual', 'reset_eligible'\]\)/);
    expect(source).toMatch(/max\(120, 'Category must be 120 characters or fewer'\)/);
    expect(source).toMatch(/max\(500, 'Reason must be 500 characters or fewer'\)/);
    expect(source).toMatch(/status,\s*headers/);
    expect(source).toMatch(/400/);
  });

  it("checks autopilot_trust_metrics before promote_auto and returns 409 when ineligible", () => {
    const metricsIdx = source.indexOf("autopilot_trust_metrics");
    const notEligibleIdx = source.indexOf("category_not_eligible");
    const upsertIdx = source.indexOf("upsert(updatePayload");

    expect(metricsIdx).toBeGreaterThan(-1);
    expect(source).toMatch(/action === 'promote_auto' && \(!metric \|\| !metric\.eligible\)/);
    expect(source).toMatch(/category_not_eligible/);
    expect(source).toMatch(/409/);
    expect(notEligibleIdx).toBeGreaterThan(metricsIdx);
    expect(upsertIdx).toBeGreaterThan(notEligibleIdx);
  });

  it("updates category rung explicitly for promote, demote, and reset actions", () => {
    expect(source).toMatch(/newRung: TrustRung =\s*action === 'promote_auto' \? 'auto'/);
    expect(source).toMatch(/action === 'demote_manual' \? 'manual' : 'eligible'/);
    expect(source).toMatch(/from\('autopilot_category_trust'\)\s*\.upsert\(updatePayload/);
    expect(source).toMatch(/last_promoted_by = authResult\.userId/);
    expect(source).toMatch(/last_demoted_by = authResult\.userId/);
  });

  it("writes both trust events and admin audit rows using the verified actor", () => {
    expect(source).toMatch(/from\('autopilot_trust_events'\)\.insert\(\{\s*category,\s*actor_id: authResult\.userId/);
    expect(source).toMatch(/event_type:\s*action === 'promote_auto'/);
    expect(source).toMatch(/old_value: oldRung/);
    expect(source).toMatch(/new_value: newRung/);
    expect(source).toMatch(/from\('admin_audit_log'\)\.insert\(\{\s*actor_user_id: authResult\.userId/);
    expect(source).toMatch(/action: `autopilot_trust_\$\{action\}`/);
    expect(source).toMatch(/target_type: 'system'/);
  });

  it("never accepts actor identity from the request body", () => {
    expect(source).not.toMatch(/actor(_id|UserId)?:\s*(rawBody|validation\.data|payload)/);
    expect(source).not.toMatch(/user_id:\s*(rawBody|validation\.data|payload)/);
  });

  it("is configured as a user-initiated edge function with in-code auth", () => {
    expect(config).toMatch(/\[functions\.autopilot-trust-admin\]/);
    expect(config).toMatch(/\[functions\.autopilot-trust-admin\][^[]*verify_jwt = false/);
  });
});
