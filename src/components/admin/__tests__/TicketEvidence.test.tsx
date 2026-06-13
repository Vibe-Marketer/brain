import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { TicketEvidence } from "@/components/admin/TicketEvidence";
import type { RunnerRun } from "@/services/admin-dashboard.service";
import type { TicketMessage } from "@/services/tickets.service";

// sonner is only used by the CopyButton click path; stub it so render is clean.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Mirrors ~/dev/autopilot/src/lib/evidence.ts assembleBundle output — the
 * exact header strings the daemon writes. If the daemon's headers change, this
 * fixture (and the component's KNOWN_SECTIONS) must change in lockstep.
 */
const EVIDENCE_BODY = `# Autopilot fix evidence

Branch: \`fix/ticket-f7d4935a\` — held for approval (v1 ships nothing autonomously)
Fix SHA: \`f6d91d9b1122334455\`

## Diff

\`\`\`
 src/components/DebugPanel.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
\`\`\`

## Tests

\`\`\`
Test Files  3 passed (3)
     Tests  41 passed (41)
\`\`\`

## Repro replay

no repro artifact on ticket — replay not applicable (ISC-110)

## Codex review

REVIEW: APPROVE — tiny accessibility-only change, no security or scope concerns.

(Advisory cross-vendor review — the deterministic push-gate and the admin approval event hold the keys.)

## Revert

To discard this fix: delete branch \`fix/ticket-f7d4935a\`; base/revert SHA is \`a0b1c2d3e4f5\`.

## Deploy

(Deploy-SHA verification is appended here by the approval-merge path after merge — ISC-112.)

Resolution note: symptom — missing aria-labels; root cause + fix — added labels; fix-commit — f6d91d9b.
`;

function makeMessage(overrides: Partial<TicketMessage>): TicketMessage {
  return {
    id: "m-1",
    ticket_id: "t-1",
    author_id: "agent",
    author_type: "agent",
    body: EVIDENCE_BODY,
    attachments: null,
    created_at: "2026-06-11T10:00:00.000Z",
    ...overrides,
  } as TicketMessage;
}

function makeRunnerRun(overrides: Partial<RunnerRun> = {}): RunnerRun {
  return {
    id: "run-1",
    ticket_id: "t-1",
    status: "awaiting_approval",
    outcome: "passed",
    gate_verdict: "pass",
    gate_stage: "test_integrity",
    duration_sec: 91,
    est_cost: "budget: low",
    branch: "fix/ticket-f7d4935a",
    fix_sha: "f6d91d9b1122334455",
    diff_stat: "src/App.tsx | 2 ++",
    test_cmd: "npm test -- src/App.test.tsx",
    test_exit: 0,
    detail: {
      test_output_tail: "<script>alert('xss')</script>\nTests  2 passed",
      gate_reasoning: "commit advanced; test integrity passed",
      rebase_result: "clean rebase onto origin/main",
      repro_replay: {
        artifact: "node repro",
        argv: ["node", "scripts/repro.js"],
        exit: 1,
        output_tail: "\u001b[31mrepro failed after rebase\u001b[39m",
      },
    },
    started_at: "2026-06-13T15:00:00.000Z",
    finished_at: "2026-06-13T15:01:31.000Z",
    tickets_processed: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TicketEvidence", () => {
  it("renders nothing when there are no agent messages", () => {
    const { container } = render(
      <TicketEvidence
        messages={[makeMessage({ author_type: "user", body: "I broke it" })]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty message list", () => {
    const { container } = render(<TicketEvidence messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for no agent messages and no runner rows", () => {
    const { container } = render(<TicketEvidence messages={[]} runnerRuns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the known evidence sections from a structured bundle", () => {
    render(<TicketEvidence messages={[makeMessage({})]} />);

    expect(screen.getByText(/^fix evidence$/i)).toBeInTheDocument();
    // Section labels render from the parsed "## " headers.
    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("Tests")).toBeInTheDocument();
    expect(screen.getByText("Codex review")).toBeInTheDocument();
    // Expander summaries for known sections.
    expect(screen.getByText(/view diff/i)).toBeInTheDocument();
    expect(screen.getByText(/view tests/i)).toBeInTheDocument();
    // Codex verdict content is present in the DOM (default-open expander).
    expect(screen.getByText(/REVIEW: APPROVE/)).toBeInTheDocument();
  });

  it("renders a RevertCard with branch + fix SHA + revert command when present", () => {
    render(<TicketEvidence messages={[makeMessage({})]} />);

    expect(screen.getByText(/^revert available$/i)).toBeInTheDocument();
    expect(screen.getByText("fix/ticket-f7d4935a")).toBeInTheDocument();
    expect(screen.getByText("git revert a0b1c2d3e4f5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy branch/i })).toBeInTheDocument();
  });

  it("falls back to a single expander for an agent message that is not a bundle", () => {
    render(
      <TicketEvidence
        messages={[makeMessage({ body: "free-form agent note with no headers" })]}
      />,
    );

    expect(screen.getByText(/view agent message/i)).toBeInTheDocument();
    expect(screen.getByText("free-form agent note with no headers")).toBeInTheDocument();
    // No RevertCard when no branch/SHA can be parsed.
    expect(screen.queryByText(/^revert available$/i)).not.toBeInTheDocument();
  });

  it("does not render a RevertCard when the bundle carries no branch or SHA", () => {
    const noRevertBody = `# Autopilot fix evidence

## Codex review

REVIEW: ESCALATE — could not reproduce.
`;
    render(<TicketEvidence messages={[makeMessage({ body: noRevertBody })]} />);

    expect(screen.getByText("Codex review")).toBeInTheDocument();
    expect(screen.queryByText(/^revert available$/i)).not.toBeInTheDocument();
  });

  it("renders runner row diff, tests, gate, rebase, and replay detail safely", () => {
    render(<TicketEvidence messages={[]} runnerRuns={[makeRunnerRun()]} />);

    expect(screen.getByText(/^run evidence$/i)).toBeInTheDocument();
    expect(screen.getByText("src/App.tsx | 2 ++")).toBeInTheDocument();
    expect(screen.getByText(/npm test -- src\/App\.test\.tsx/i)).toBeInTheDocument();
    expect(screen.getByText(/exit 0/i)).toBeInTheDocument();
    expect(screen.getByText(/pass · test_integrity/i)).toBeInTheDocument();
    expect(screen.getByText(/commit advanced; test integrity passed/i)).toBeInTheDocument();
    expect(screen.getByText(/clean rebase onto origin\/main/i)).toBeInTheDocument();
    expect(screen.getByText(/exit 1/i)).toBeInTheDocument();
    expect(screen.getByText(/argv: node scripts\/repro\.js/i)).toBeInTheDocument();
    expect(screen.getByText(/repro failed after rebase/i)).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\('xss'\)<\/script>/i)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
