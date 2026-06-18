import { describe, it, expect } from "vitest";
import { buildTicketTimeline } from "@/lib/ticket-timeline";
import type { TicketEvent, TicketMessage } from "@/services/tickets.service";
import type { RunnerRun } from "@/services/admin-dashboard.service";

function ev(partial: Partial<TicketEvent> & { id: string; event_type: string; created_at: string }): TicketEvent {
  return { ticket_id: "t1", actor_id: null, old_value: null, new_value: null, ...partial } as TicketEvent;
}
function msg(partial: Partial<TicketMessage> & { id: string; created_at: string }): TicketMessage {
  return { ticket_id: "t1", author_type: "agent", author_id: null, body: "", attachments: [], ...partial } as TicketMessage;
}
function run(partial: Partial<RunnerRun> & { id: string; started_at: string }): RunnerRun {
  return { ticket_id: "t1", status: "x", outcome: null, gate_verdict: null, gate_stage: null, duration_sec: null, est_cost: null, branch: null, fix_sha: null, diff_stat: null, test_cmd: null, test_exit: null, detail: null, finished_at: null, tickets_processed: null, ...partial } as RunnerRun;
}

describe("buildTicketTimeline", () => {
  it("maps real event types to plain English (no raw enums)", () => {
    const entries = buildTicketTimeline(
      [
        ev({ id: "1", event_type: "created", new_value: "new", created_at: "2026-06-12T00:00:00Z" }),
        ev({ id: "2", event_type: "status_change", old_value: "new", new_value: "in_progress", created_at: "2026-06-12T00:01:00Z" }),
        ev({ id: "3", event_type: "fix_prepared", new_value: "branch", created_at: "2026-06-12T00:02:00Z" }),
        ev({ id: "4", event_type: "status_change", old_value: "in_progress", new_value: "awaiting_approval", created_at: "2026-06-12T00:03:00Z" }),
        ev({ id: "5", event_type: "approval", created_at: "2026-06-12T00:04:00Z" }),
        ev({ id: "6", event_type: "status_change", old_value: "awaiting_approval", new_value: "resolved", created_at: "2026-06-12T00:05:00Z" }),
      ],
      [],
      [],
    );
    const titles = entries.map((e) => e.title);
    expect(titles).toEqual([
      "Ticket opened",
      "Autopilot started working on it",
      "Wrote a fix",
      "Fix ready — waiting for approval",
      "You approved the fix",
      "Resolved and deployed",
    ]);
    // Never a raw enum
    expect(titles.join(" ")).not.toMatch(/status_change|fix_prepared|awaiting_approval/);
  });

  it("drops machine churn (run_started, claim_released) and bundle messages", () => {
    const entries = buildTicketTimeline(
      [
        ev({ id: "1", event_type: "run_started", new_value: "fix/x", created_at: "2026-06-12T00:00:00Z" }),
        ev({ id: "2", event_type: "claim_released", created_at: "2026-06-12T00:00:01Z" }),
      ],
      [msg({ id: "m1", author_type: "agent", body: "# Autopilot fix evidence\nBranch: `x`", created_at: "2026-06-12T00:00:02Z" })],
      [],
    );
    expect(entries).toHaveLength(0);
  });

  it("collapses repeated rate-limit retries into one ×N entry", () => {
    const events: TicketEvent[] = [];
    for (let i = 0; i < 3; i++) {
      events.push(ev({ id: `r${i}`, event_type: "rate_limit_defer", created_at: `2026-06-1${2 + i}T00:00:00Z` }));
    }
    const entries = buildTicketTimeline(events, [], []);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toMatch(/×3$/);
  });

  it("surfaces a real fix run with its sha and diff", () => {
    const entries = buildTicketTimeline(
      [],
      [],
      [run({ id: "run1", started_at: "2026-06-12T00:00:00Z", fix_sha: "02248d02c6bc", diff_stat: "file.ts | 36 ++\n1 file changed" })],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].fixSha).toBe("02248d02c6bc");
    expect(entries[0].diffStat).toContain("1 file changed");
  });

  it("keeps customer notes as human entries", () => {
    const entries = buildTicketTimeline(
      [],
      [msg({ id: "m1", author_type: "user", body: "It breaks when I upload a Plaud file", created_at: "2026-06-12T00:00:00Z" })],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Customer added a note");
    expect(entries[0].detail).toContain("Plaud");
  });
});
