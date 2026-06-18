import { describe, it, expect } from "vitest";
import { extractDeployedFixSha } from "@/lib/ticket-revert";
import type { TicketMessage } from "@/services/tickets.service";
import type { RunnerRun } from "@/services/admin-dashboard.service";

function run(fix_sha: string | null): RunnerRun {
  return { id: "r", ticket_id: "t", status: "x", outcome: null, gate_verdict: null, gate_stage: null, duration_sec: null, est_cost: null, branch: null, fix_sha, diff_stat: null, test_cmd: null, test_exit: null, detail: null, started_at: "", finished_at: null, tickets_processed: null } as RunnerRun;
}
function msg(author_type: string, body: string): TicketMessage {
  return { id: "m", ticket_id: "t", author_type, author_id: null, body, attachments: [], created_at: "" } as TicketMessage;
}

describe("extractDeployedFixSha", () => {
  it("prefers a runner_run fix_sha", () => {
    expect(extractDeployedFixSha([run("02248d02c6bca582")], [])).toBe("02248d02c6bca582");
  });

  it("falls back to the gsd-runner resolve message (the auto-deploy case)", () => {
    const messages = [
      msg("user", "Commit deadbeef pushed to main"), // ignored: not an agent
      msg("agent", "Autopilot (GSD) fixed and deployed this. Commit 1a2b3c4d5e pushed to main (auto-deploying)."),
    ];
    expect(extractDeployedFixSha([run(null)], messages)).toBe("1a2b3c4d5e");
  });

  it("returns null when nothing was deployed", () => {
    expect(extractDeployedFixSha([run(null)], [msg("agent", "Reviewed and closed — no fix needed.")])).toBeNull();
  });
});
