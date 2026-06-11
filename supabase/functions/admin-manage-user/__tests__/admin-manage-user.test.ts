import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("admin-manage-user wiring", () => {
  it("verifies the caller's JWT in function code before anything else", () => {
    expect(source).toMatch(/authenticateRequest/);
    expect(source).toMatch(/if \(authResult instanceof Response\) return authResult/);
  });

  it("gates every action on has_role(verified caller, ADMIN) — not is_admin()", () => {
    expect(source).toMatch(/rpc\('has_role', \{\s*_user_id: authResult\.userId,\s*_role: 'ADMIN',?\s*\}\)/);
    expect(source).not.toMatch(/rpc\(['"]is_admin/);
    expect(source).toMatch(/Admin access required/);
  });

  it("validates the payload with a closed action union", () => {
    expect(source).toMatch(/discriminatedUnion\('action'/);
    expect(source).toMatch(/change_role/);
    expect(source).toMatch(/reset_password/);
    expect(source).toMatch(/revoke_access/);
    expect(source).toMatch(/restore_access/);
    // No billing actions — deliberately excluded (doc comment explains why,
    // but no action literal may reference billing).
    expect(source).not.toMatch(/literal\(['"][^'"]*billing/i);
    expect(source).not.toMatch(/update_billing|change_billing|manage_billing/i);
  });

  it("performs privileged mutations via the service-role client", () => {
    expect(source).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).toMatch(/auth\.admin\.updateUserById/);
    expect(source).toMatch(/ban_duration: '87600h'/);
    expect(source).toMatch(/ban_duration: 'none'/);
  });

  it("writes the audit row to admin_audit_log with the verified actor", () => {
    expect(source).toMatch(/from\('admin_audit_log'\)\.insert\(\{\s*actor_user_id: authResult\.userId/);
    expect(source).toMatch(/manage_user_\$\{action\}/);
    // Passwords never reach the audit metadata.
    expect(source).toMatch(/Never include the password itself in metadata/);
  });

  it("is configured as a user-initiated edge function (in-code JWT auth)", () => {
    expect(config).toMatch(/\[functions\.admin-manage-user\]/);
    expect(config).toMatch(
      /\[functions\.admin-manage-user\][^[]*verify_jwt = false/
    );
  });
});
