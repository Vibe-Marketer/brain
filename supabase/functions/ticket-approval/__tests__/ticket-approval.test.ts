import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

describe("ticket-approval wiring", () => {
  it("verifies the caller's JWT in function code before anything else (401 path)", () => {
    expect(source).toMatch(/authenticateRequest/);
    expect(source).toMatch(/if \(authResult instanceof Response\) return authResult/);
  });

  it("gates on has_role(verified caller, ADMIN) via the service-role client (403 path)", () => {
    expect(source).toMatch(
      /rpc\('has_role', \{\s*_user_id: authResult\.userId,\s*_role: 'ADMIN',?\s*\}\)/,
    );
    expect(source).toMatch(/Admin access required/);
    expect(source).toMatch(/status: 403/);
  });

  it("validates the payload: closed approve|reject union, reason required on reject (400 path)", () => {
    expect(source).toMatch(/action: z\.enum\(\['approve', 'reject'\]\)/);
    expect(source).toMatch(/ticket_id: z\.string\(\)\.uuid\(\)/);
    // Refinement: non-empty reason required when rejecting, max 2000 chars.
    expect(source).toMatch(/reason is required when rejecting/);
    expect(source).toMatch(/max\(2000/);
    expect(source).toMatch(/status: 400/);
  });

  it("refuses to write unless the ticket is awaiting_approval (409 path, guard BEFORE writes)", () => {
    expect(source).toMatch(/ticket\.status !== 'awaiting_approval'/);
    expect(source).toMatch(/ticket_not_awaiting_approval/);
    expect(source).toMatch(/status: 409/);
    // 404 for missing ticket.
    expect(source).toMatch(/Ticket not found/);
    // The status guard must appear in source BEFORE the first ticket_events insert.
    const guardIdx = source.indexOf("ticket_not_awaiting_approval");
    const firstInsertIdx = source.indexOf("from('ticket_events').insert");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(firstInsertIdx).toBeGreaterThan(guardIdx);
  });

  it("approve writes an admin-authored approval event and NEVER touches ticket status", () => {
    expect(source).toMatch(/event_type: 'approval'/);
    expect(source).toMatch(/old_value: 'awaiting_approval'/);
    expect(source).toMatch(/new_value: 'approved'/);
    // actor_id is always the verified userId — never client-supplied (T-14-01).
    expect(source).toMatch(/actor_id: authResult\.userId/);
    expect(source).not.toMatch(/actor_id:\s*(rawBody|validation\.data|payload)/);
    // The approve branch contains NO tickets status update: the only
    // tickets.update in the file sets status 'rejected' (reject branch).
    const ticketUpdates = source.match(/from\('tickets'\)\s*\.update\(/g) ?? [];
    expect(ticketUpdates).toHaveLength(1);
    expect(source).toMatch(/\.update\(\{ status: 'rejected' \}\)/);
  });

  it("reject writes rejection event + admin reason message + status rejected", () => {
    expect(source).toMatch(/event_type: 'rejection'/);
    expect(source).toMatch(/new_value: 'rejected'/);
    expect(source).toMatch(
      /from\('ticket_messages'\)\.insert\(\{\s*ticket_id,\s*author_id: authResult\.userId,\s*author_type: 'admin'/,
    );
    expect(source).toMatch(/Rejected by admin: /);
    expect(source).toMatch(/\.update\(\{ status: 'rejected' \}\)/);
  });

  it("writes an admin_audit_log row with the verified actor on both actions", () => {
    expect(source).toMatch(
      /from\('admin_audit_log'\)\.insert\(\{\s*actor_user_id: authResult\.userId/,
    );
    expect(source).toMatch(/ticket_\$\{action\}/);
    expect(source).toMatch(/target_type: 'ticket'/);
  });

  it("is configured as a user-initiated edge function (in-code JWT auth)", () => {
    expect(config).toMatch(/\[functions\.ticket-approval\]/);
    expect(config).toMatch(/\[functions\.ticket-approval\][^[]*verify_jwt = false/);
  });
});
