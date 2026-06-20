import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/services/sync-status.service.ts"),
  "utf8",
);

/**
 * IMP-01 invariant — the canonical sync-status reader must keep ids as TEXT
 * end to end. The Phase 30/BUG-01 class of bug (parseInt on source_call_id
 * silently dropping every UUID-id provider) is enforced absent here at the
 * source level: a pure-source assertion that never mocks the DB.
 */
describe("getSyncStatusForExternalIds — no numeric coercion of ids", () => {
  it("never coerces ids with parseInt", () => {
    expect(source).not.toMatch(/parseInt/);
  });

  it("never coerces ids with Number(", () => {
    expect(source).not.toMatch(/Number\(/);
  });

  it("queries recordings.source_call_id with a TEXT IN filter", () => {
    expect(source).toMatch(/\.in\("source_call_id"/);
  });

  it("exports getSyncStatusForExternalIds", () => {
    expect(source).toMatch(/export\s+async\s+function\s+getSyncStatusForExternalIds/);
  });
});
