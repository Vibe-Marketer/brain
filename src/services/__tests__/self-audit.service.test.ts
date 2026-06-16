import { describe, expect, it } from "vitest";
import {
  computeSelfAudit,
  type SelfAuditInputs,
} from "@/services/self-audit.service";

const NOW = new Date("2026-06-16T00:00:00.000Z");

function base(overrides: Partial<SelfAuditInputs> = {}): SelfAuditInputs {
  return {
    runs7d: [],
    runs24h: [],
    tickets7d: [],
    sentryTicketsEver: 0,
    runner: { last_heartbeat: NOW.toISOString(), kill_switch: false },
    now: NOW,
    ...overrides,
  };
}

function signal(input: SelfAuditInputs, key: string) {
  return computeSelfAudit(input).signals.find((s) => s.key === key);
}

describe("computeSelfAudit — fixes shipped", () => {
  it("flags critical when the loop ran but merged nothing (the real failure)", () => {
    const s = signal(
      base({
        runs7d: [
          { status: "escalated", outcome: "escalated:verdict" },
          { status: "benign", outcome: "resolved:benign" },
          { status: "requeued", outcome: "deferred:rate-limit" },
        ],
      }),
      "fixes_shipped",
    );
    expect(s?.status).toBe("critical");
    expect(s?.metric).toBe("0");
    expect(s?.action).toBeTruthy();
  });

  it("is ok when real fixes merged", () => {
    const s = signal(
      base({
        runs7d: [
          { status: "merged", outcome: "merged" },
          { status: "benign", outcome: "resolved:benign" },
        ],
      }),
      "fixes_shipped",
    );
    expect(s?.status).toBe("ok");
    expect(s?.metric).toBe("1");
  });
});

describe("computeSelfAudit — Sentry pipe", () => {
  it("flags critical when Sentry has never delivered an error", () => {
    const s = signal(base({ sentryTicketsEver: 0 }), "sentry_pipe");
    expect(s?.status).toBe("critical");
    expect(s?.headline).toMatch(/never delivered/i);
  });

  it("is ok once Sentry has ever ingested", () => {
    const s = signal(
      base({ sentryTicketsEver: 4, tickets7d: [{ source: "sentry" }] }),
      "sentry_pipe",
    );
    expect(s?.status).toBe("ok");
    expect(s?.metric).toBe("1");
  });
});

describe("computeSelfAudit — queue signal", () => {
  it("warns when the queue is all crawler noise and no real-user signal", () => {
    const s = signal(
      base({
        sentryTicketsEver: 1, // keep sentry signal ok so we isolate queue
        tickets7d: [
          { source: "nightly_qa" },
          { source: "nightly_qa" },
          { source: "internal" },
        ],
      }),
      "queue_signal",
    );
    expect(s?.status).toBe("warn");
    expect(s?.headline).toMatch(/noise/i);
  });

  it("is ok when real-user/production tickets exist", () => {
    const s = signal(
      base({
        sentryTicketsEver: 1,
        tickets7d: [{ source: "in_app_user" }, { source: "nightly_qa" }],
      }),
      "queue_signal",
    );
    expect(s?.status).toBe("ok");
  });
});

describe("computeSelfAudit — loop liveness", () => {
  it("flags critical when armed but the heartbeat is stale", () => {
    const stale = new Date(NOW.getTime() - 45 * 60 * 1000).toISOString();
    const s = signal(
      base({ runner: { last_heartbeat: stale, kill_switch: false } }),
      "loop_liveness",
    );
    expect(s?.status).toBe("critical");
  });

  it("treats a paused (kill-switch) loop as ok, not failure", () => {
    const s = signal(
      base({ runner: { last_heartbeat: null, kill_switch: true } }),
      "loop_liveness",
    );
    expect(s?.status).toBe("ok");
    expect(s?.metric).toBe("paused");
  });
});

describe("computeSelfAudit — work ratio + overall", () => {
  it("warns when most 24h runs deferred", () => {
    const s = signal(
      base({
        runs24h: [
          { status: "requeued", outcome: "deferred:rate-limit" },
          { status: "requeued", outcome: "deferred:rate-limit" },
          { status: "requeued", outcome: "deferred:rate-limit" },
          { status: "merged", outcome: "merged" },
        ],
      }),
      "work_ratio",
    );
    expect(s?.status).toBe("warn");
    expect(s?.metric).toBe("75%");
  });

  it("overall is the worst signal across the report", () => {
    // 0 fixes + dead sentry => critical overall
    const report = computeSelfAudit(
      base({ runs7d: [{ status: "benign", outcome: "resolved:benign" }] }),
    );
    expect(report.overall).toBe("critical");
  });

  it("overall is ok on a healthy system", () => {
    const report = computeSelfAudit(
      base({
        runs7d: [{ status: "merged", outcome: "merged" }],
        runs24h: [{ status: "merged", outcome: "merged" }],
        tickets7d: [{ source: "sentry" }],
        sentryTicketsEver: 9,
        runner: { last_heartbeat: NOW.toISOString(), kill_switch: false },
      }),
    );
    expect(report.overall).toBe("ok");
  });
});
