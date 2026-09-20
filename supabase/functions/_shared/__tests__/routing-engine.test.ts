import { describe, expect, it } from "vitest";
import type { ConnectorRecord } from "../connector-pipeline.ts";
import {
  evaluateAllMatchingRules,
  evaluateRecordAgainstRules,
  type RoutingRule,
} from "../routing-engine.ts";

function record(overrides: Partial<ConnectorRecord> = {}): ConnectorRecord {
  return {
    external_id: "ext-1",
    source_app: "zoom",
    title: "Weekly standup",
    full_transcript: "",
    recording_start_time: "2026-01-15T10:00:00.000Z",
    duration: 1800,
    source_metadata: {},
    ...overrides,
  };
}

function rule(overrides: Partial<RoutingRule> & Pick<RoutingRule, "conditions">): RoutingRule {
  return {
    id: "rule-1",
    name: "Zoom standup",
    priority: 1,
    logic_operator: "AND",
    target_workspace_id: "ws-a",
    target_folder_id: null,
    target_organization_id: null,
    delete_after_copy: false,
    ...overrides,
  };
}

describe("evaluateRecordAgainstRules", () => {
  it("matches nothing when the rule has no conditions (no accidental catch-all)", () => {
    const dest = evaluateRecordAgainstRules(
      [rule({ conditions: [] })],
      record(),
    );
    expect(dest).toBeNull();
  });

  it("first matching rule wins", () => {
    const dest = evaluateRecordAgainstRules(
      [
        rule({
          id: "zoom",
          name: "Zoom",
          conditions: [{ field: "source", operator: "equals", value: "zoom" }],
          target_workspace_id: "ws-zoom",
        }),
        rule({
          id: "standup",
          name: "Standup",
          conditions: [{ field: "title", operator: "contains", value: "standup" }],
          target_workspace_id: "ws-standup",
        }),
      ],
      record(),
    );
    expect(dest?.matchedRuleId).toBe("zoom");
    expect(dest?.workspaceId).toBe("ws-zoom");
  });

  it("AND requires every condition; OR matches if any condition hits", () => {
    const rec = record({ source_app: "zoom", title: "1:1 with Jane" });
    const andMiss = evaluateRecordAgainstRules(
      [
        rule({
          logic_operator: "AND",
          conditions: [
            { field: "source", operator: "equals", value: "zoom" },
            { field: "title", operator: "contains", value: "standup" },
          ],
        }),
      ],
      rec,
    );
    expect(andMiss).toBeNull();

    const orHit = evaluateRecordAgainstRules(
      [
        rule({
          id: "or",
          logic_operator: "OR",
          conditions: [
            { field: "source", operator: "equals", value: "zoom" },
            { field: "title", operator: "contains", value: "standup" },
          ],
          target_workspace_id: "ws-or",
        }),
      ],
      rec,
    );
    expect(orHit?.workspaceId).toBe("ws-or");
  });
});

describe("evaluateAllMatchingRules", () => {
  it("returns every matching destination instead of first-match-wins", () => {
    const dests = evaluateAllMatchingRules(
      [
        rule({
          id: "zoom",
          conditions: [{ field: "source", operator: "equals", value: "zoom" }],
          target_workspace_id: "ws-zoom",
        }),
        rule({
          id: "standup",
          conditions: [{ field: "title", operator: "contains", value: "standup" }],
          target_workspace_id: "ws-standup",
        }),
      ],
      record(),
    );
    expect(dests.map((d) => d.workspaceId)).toEqual(["ws-zoom", "ws-standup"]);
  });
});
