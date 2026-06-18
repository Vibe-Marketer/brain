/**
 * Pure helper for the auto-deploy "undo" affordance (TKT-REVERT).
 *
 * Finds the commit a ticket auto-deployed so the UI can offer a `git revert`.
 * Kept out of the component file so React fast-refresh stays clean.
 */
import type { TicketMessage } from "@/services/tickets.service";
import type { RunnerRun } from "@/services/admin-dashboard.service";

/**
 * Two sources, in order of fidelity:
 *   1. runner_runs.fix_sha — the held-fix / approval path records the full sha.
 *   2. the gsd-runner resolve message — auto-deployed fixes write
 *      "…Commit <sha> pushed to main…" and DON'T populate runner_runs.fix_sha,
 *      so this is the only source for the common auto-deploy case.
 * Returns null when the ticket deployed nothing (e.g. a benign close).
 */
export function extractDeployedFixSha(
  runs: RunnerRun[],
  messages: TicketMessage[],
): string | null {
  const fromRun = runs.find((r) => r.fix_sha)?.fix_sha;
  if (fromRun) return fromRun;
  for (const message of messages) {
    if (message.author_type !== "agent") continue;
    const match = /Commit\s+([0-9a-f]{7,40})\s+pushed to main/i.exec(message.body ?? "");
    if (match) return match[1];
  }
  return null;
}
