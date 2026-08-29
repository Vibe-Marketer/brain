import { describe, expect, it } from "vitest";
import { evaluateClosureGate } from "@/lib/ticket-closure-gate";
import type { RunnerRun } from "@/services/admin-dashboard.service";

function makeRunnerRun(overrides: Partial<RunnerRun> = {}): RunnerRun {
  return {
    id: "run-1",
    ticket_id: "t-1",
    status: "resolved",
    outcome: "merged",
    canary_failure_detail: null,
    canary_last_run_at: null,
    canary_next_run_at: null,
    canary_status: null,
    gate_verdict: "pass",
    gate_stage: "test_integrity",
    duration_sec: 91,
    est_cost: "budget: low",
    branch: "fix/ticket-1",
    fix_category: "frontend",
    fix_sha: "f6d91d9b1122334455",
    diff_stat: "src/App.tsx | 2 ++",
    merged_at: "2026-06-13T15:02:00.000Z",
    reopened_at: null,
    reopened_event_id: null,
    survival_due_at: "2026-07-13T15:02:00.000Z",
    survival_status: null,
    test_cmd: "npm test",
    test_exit: 0,
    detail: {},
    started_at: "2026-06-13T15:00:00.000Z",
    finished_at: "2026-06-13T15:01:31.000Z",
    tickets_processed: 1,
    ...overrides,
  };
}

describe("evaluateClosureGate", () => {
  it("returns unverified when no run shipped a fix", () => {
    const result = evaluateClosureGate([]);
    expect(result.verdict).toBe("unverified");
  });

  it("returns unverified when runs exist but none carry a fix_sha", () => {
    const result = evaluateClosureGate([makeRunnerRun({ fix_sha: null })]);
    expect(result.verdict).toBe("unverified");
  });

  it("returns verified once the fix deployed, gated clean, and survived its window", () => {
    const result = evaluateClosureGate([makeRunnerRun({ survival_status: "held" })]);
    expect(result.verdict).toBe("verified");
  });

  it("returns pending when deployed but the observation window hasn't closed", () => {
    const result = evaluateClosureGate([makeRunnerRun({ survival_status: "pending" })]);
    expect(result.verdict).toBe("pending");
    expect(result.reasons.join(" ")).toMatch(/observation window/i);
  });

  it("returns pending when survival_status is null (window not tracked yet)", () => {
    const result = evaluateClosureGate([makeRunnerRun({ survival_status: null })]);
    expect(result.verdict).toBe("pending");
  });

  it("returns failed when the ticket was reopened after shipping", () => {
    const result = evaluateClosureGate([
      makeRunnerRun({ survival_status: "reopened", reopened_at: "2026-06-20T00:00:00.000Z" }),
    ]);
    expect(result.verdict).toBe("failed");
    expect(result.reasons.join(" ")).toMatch(/reopened/i);
  });

  it("returns failed when the gate never actually passed", () => {
    const result = evaluateClosureGate([makeRunnerRun({ gate_verdict: "fail" })]);
    expect(result.verdict).toBe("failed");
  });

  it("returns failed when tests exited non-zero", () => {
    const result = evaluateClosureGate([makeRunnerRun({ test_exit: 1 })]);
    expect(result.verdict).toBe("failed");
    expect(result.reasons.join(" ")).toMatch(/exited non-zero/i);
  });

  it("returns failed when the post-deploy canary failed", () => {
    const result = evaluateClosureGate([
      makeRunnerRun({ survival_status: "held", canary_status: "failed" }),
    ]);
    expect(result.verdict).toBe("failed");
  });

  it("picks the run that actually shipped a fix_sha among several runs", () => {
    const result = evaluateClosureGate([
      makeRunnerRun({ id: "run-0", fix_sha: null, gate_verdict: "fail" }),
      makeRunnerRun({ id: "run-1", survival_status: "held" }),
    ]);
    expect(result.verdict).toBe("verified");
  });
});
