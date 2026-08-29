/**
 * Falsifiable closure-gate verdict for resolved tickets (governance ticket
 * b36e673c — "Enforce a lifecycle state machine with falsifiable closure
 * gates"). Read-only, informational: it does NOT block the status Select
 * (a human can still close a ticket the automation can't verify), it makes
 * closure honesty visible instead of silent.
 *
 * The underlying Argo-style success/failure/rollback/inconclusive signals
 * already exist in runner_runs (Phase 19 autopilot trust schema —
 * gate_verdict, test_exit, survival_status, canary_status, reopened_at).
 * This module is the first place anything reads them together to answer
 * "is this closure actually verified?" instead of just recording the data.
 */
import type { RunnerRun } from "@/services/admin-dashboard.service";

export type ClosureGateVerdict = "verified" | "pending" | "failed" | "unverified";

export interface ClosureGateResult {
  verdict: ClosureGateVerdict;
  /** Plain-English reasons feeding the verdict, most important first. */
  reasons: string[];
}

/** The run most relevant to this ticket's closure: the one that shipped the fix. */
function deployedRun(runs: RunnerRun[]): RunnerRun | null {
  return runs.find((r) => r.fix_sha) ?? null;
}

/**
 * success | failure | rollback | inconclusive, applied to a single ticket:
 *
 * - "failed"     — reopened after shipping, or the shipped run's own gate/tests
 *                   never actually passed. Falsifies the closure outright.
 * - "pending"    — deployed and gated clean, but the post-deploy observation
 *                   window (survival_status) hasn't concluded yet — inconclusive,
 *                   not yet safe to call it a durable success.
 * - "verified"   — deployed, gated clean, and the observation window closed
 *                   with no reopen (survival_status === 'held').
 * - "unverified" — no runner evidence at all (e.g. closed by hand with no
 *                   automation run) — can't be falsified either way.
 */
export function evaluateClosureGate(runs: RunnerRun[]): ClosureGateResult {
  const run = deployedRun(runs);

  if (!run) {
    return {
      verdict: "unverified",
      reasons: ["No automated run shipped a fix for this ticket — verify manually."],
    };
  }

  const reasons: string[] = [];

  const reopened = run.survival_status === "reopened" || Boolean(run.reopened_at);
  if (reopened) {
    reasons.push("Reopened after shipping — the symptom came back.");
  }

  const gateFailed = run.gate_verdict === "fail";
  if (gateFailed) {
    reasons.push("The deterministic verification gate did not pass.");
  }

  const testsFailed = run.test_exit !== null && run.test_exit !== 0;
  if (testsFailed) {
    reasons.push(`Tests exited non-zero (${run.test_exit}).`);
  }

  const canaryFailed = run.canary_status === "failed";
  if (canaryFailed) {
    reasons.push("Post-deploy canary re-check failed.");
  }

  if (reopened || gateFailed || testsFailed || canaryFailed) {
    return { verdict: "failed", reasons };
  }

  if (run.survival_status === "held") {
    return {
      verdict: "verified",
      reasons: [
        "Fix reproduced the issue, passed verification, deployed, and stayed clean through the observation window.",
      ],
    };
  }

  const pendingReasons: string[] = [];
  if (run.gate_verdict !== "pass") {
    pendingReasons.push("Verification gate has not recorded a pass yet.");
  }
  if (run.test_exit === null) {
    pendingReasons.push("No test result recorded yet.");
  }
  if (run.survival_status == null || run.survival_status === "pending") {
    pendingReasons.push("Post-deploy observation window has not concluded yet.");
  }

  return {
    verdict: "pending",
    reasons:
      pendingReasons.length > 0
        ? pendingReasons
        : ["Deployed; waiting on the post-deploy observation window to close."],
  };
}
