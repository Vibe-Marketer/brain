/**
 * TicketEvidence (14-04, APPR-01) — renders agent-authored evidence bundles on
 * the ticket detail. Ported from the dead branch's TicketDetailView evidence
 * rendering + RevertCard (`git show worktree-admin-center:src/components/admin/
 * TicketDetailView.tsx`), REBOUND to the live vocabulary:
 *
 *   - Evidence arrives as ticket_messages rows with author_type === 'agent'
 *     (service-role write — 13-CONTEXT "Evidence bundle"), NOT the dead
 *     branch's `evidence`/`needs_review` ticket_events.
 *   - The body is the markdown bundle assembled by the daemon
 *     (~/dev/autopilot/src/lib/evidence.ts assembleBundle): a "# Autopilot fix
 *     evidence" header with "Branch:" / "Fix SHA:" lines and "## Diff",
 *     "## Tests", "## Repro replay", "## Codex review", "## Revert",
 *     "## Deploy" sections. Header strings are pinned in the test fixtures.
 *   - RevertCard is rebuilt from the held-branch name + fix/revert SHAs parsed
 *     out of the bundle (the dead branch derived these from dead event
 *     payloads — the live source is the evidence message text).
 *
 * SECURITY (T-14-12): every string renders as a React text node or inside a
 * <pre>. No dangerouslySetInnerHTML, no markdown-to-HTML library, no new deps —
 * hostile ticket/repo content in the bundle can never become live DOM.
 */
import { useState } from "react";
import { RiArrowGoBackLine, RiFileCopyLine } from "@remixicon/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RunnerRun } from "@/services/admin-dashboard.service";
import type { TicketEvent, TicketMessage } from "@/services/tickets.service";

interface TicketEvidenceProps {
  messages: TicketMessage[];
  runnerRuns?: RunnerRun[];
  /** Reserved for future merge/deploy-event enrichment; unused in v1. */
  events?: TicketEvent[];
}

const sectionLabelClass =
  "text-[10px] uppercase tracking-wide text-muted-foreground/60";

/** The bundle's first line — pins an evidence message vs. ordinary prose. */
const EVIDENCE_HEADER = "# Autopilot fix evidence";

/** Section headers the daemon writes, in render order (assembleBundle). */
const KNOWN_SECTIONS = [
  "Diff",
  "Tests",
  "Repro replay",
  "Codex review",
  "Revert",
  "Deploy",
] as const;

/** Render the tail of a payload (diff/test output) without flooding the pane. */
function tail(text: string, maxChars = 4000): string {
  return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
}

/**
 * Strip ANSI escape sequences (color codes, cursor moves) out of captured
 * terminal output. The daemon shells `vitest`/`npm build` and captures raw
 * stdout — without this, the Tests/Diff panes render `[32m✓[39m` garbage.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** A plain-English, glance-able verdict parsed from the Tests section body. */
interface CheckSummary {
  testsPassed: number | null;
  testsSkipped: number | null;
  testsOk: boolean;
  buildOk: boolean;
}

/**
 * Parse the daemon's Tests section ("vitest exit N … build exit N …") into a
 * glance-able pass/fail summary, so the operator sees "1,867 tests pass · Build
 * clean" without opening a terminal dump. Tolerant: anything it can't read
 * comes back null/false and the raw expander still carries the truth.
 */
function parseChecks(testsBody: string): CheckSummary {
  const clean = stripAnsi(testsBody);
  const vitestExit = /vitest exit\s+(-?\d+)/i.exec(clean);
  const buildExit = /build exit\s+(-?\d+)/i.exec(clean);
  const passed = /(\d[\d,]*)\s+passed/i.exec(clean);
  const skipped = /(\d[\d,]*)\s+skipped/i.exec(clean);
  return {
    testsPassed: passed ? Number(passed[1].replace(/,/g, "")) : null,
    testsSkipped: skipped ? Number(skipped[1].replace(/,/g, "")) : null,
    testsOk: vitestExit ? vitestExit[1] === "0" : false,
    buildOk: buildExit ? buildExit[1] === "0" : false,
  };
}

/** Loud, green/amber check verdict shown above any expander. */
function VerdictSummary({ checks }: { checks: CheckSummary }) {
  const allGood = checks.testsOk && checks.buildOk;
  const testLabel =
    checks.testsPassed !== null
      ? `${checks.testsPassed.toLocaleString()} tests pass`
      : checks.testsOk
        ? "Tests pass"
        : "Tests FAILED";
  return (
    <div
      className={
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3 text-sm " +
        (allGood
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-vibe-orange/30 bg-vibe-orange/10")
      }
    >
      <span className={"font-semibold " + (checks.testsOk ? "text-emerald-600 dark:text-emerald-400" : "text-vibe-orange")}>
        {checks.testsOk ? "✓" : "✕"} {testLabel}
        {checks.testsSkipped ? ` (${checks.testsSkipped} skipped)` : ""}
      </span>
      <span className={"font-semibold " + (checks.buildOk ? "text-emerald-600 dark:text-emerald-400" : "text-vibe-orange")}>
        {checks.buildOk ? "✓ Build clean" : "✕ Build failed"}
      </span>
    </div>
  );
}

function copyToClipboard(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Copy failed"));
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 shrink-0"
      aria-label={`Copy ${label}`}
      onClick={() => copyToClipboard(value, label)}
    >
      <RiFileCopyLine className="h-3.5 w-3.5" />
    </Button>
  );
}

interface ParsedSection {
  heading: string;
  body: string;
}

interface ParsedBundle {
  /** The text before the first "## " header (header + Branch/Fix SHA lines). */
  preamble: string;
  sections: ParsedSection[];
}

/**
 * Split a markdown evidence bundle on its "## " section headers. The preamble
 * (everything before the first header) carries the Branch/Fix SHA lines.
 * Tolerant: a body with no headers yields zero sections and the whole text as
 * preamble — the caller renders that as a single expander (never crash).
 */
function parseBundle(body: string): ParsedBundle {
  const lines = body.split("\n");
  const sections: ParsedSection[] = [];
  const preambleLines: string[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const headerMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { heading: headerMatch[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      preambleLines.push(line);
    }
  }
  if (current) sections.push(current);

  return {
    preamble: preambleLines.join("\n").trim(),
    sections: sections.map((s) => ({ heading: s.heading, body: s.body.trim() })),
  };
}

/** Pull a `Label: \`value\`` (backtick-wrapped) field out of the preamble. */
function extractField(preamble: string, label: string): string | null {
  const re = new RegExp(`${label}:\\s*\`([^\`]+)\``, "i");
  const match = re.exec(preamble);
  return match ? match[1].trim() : null;
}

/** Pull a bare SHA out of the Revert section ("...revert SHA is `<sha>`"). */
function extractRevertSha(sections: ParsedSection[]): string | null {
  const revert = sections.find((s) => s.heading.toLowerCase() === "revert");
  if (!revert) return null;
  const match = /revert SHA is\s*`([^`]+)`/i.exec(revert.body);
  return match ? match[1].trim() : null;
}

function EvidenceExpander({
  summary,
  content,
  defaultOpen = false,
}: {
  summary: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none text-xs text-muted-foreground">
        {summary}
      </summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
        {tail(stripAnsi(content))}
      </pre>
    </details>
  );
}

/**
 * Revert affordance — rendered ONLY when a branch or fix SHA was parsed out of
 * the bundle. Vibe-orange RiArrowGoBackLine accent (structural-accent use),
 * CopyButtons, and a `git revert <sha>` hint, matching the dead branch.
 */
function RevertCard({
  branch,
  fixSha,
  revertSha,
}: {
  branch: string | null;
  fixSha: string | null;
  revertSha: string | null;
}) {
  if (!branch && !fixSha) return null;

  const command = revertSha
    ? `git revert ${revertSha}`
    : branch
      ? `git branch -D ${branch}`
      : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <RiArrowGoBackLine className="h-4 w-4 text-vibe-orange" aria-hidden="true" />
        <h3 className="font-montserrat text-xs font-extrabold uppercase tracking-wide text-foreground">
          Revert Available
        </h3>
      </div>
      <div className="space-y-2 text-xs">
        {branch && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Branch</span>
            <span className="flex min-w-0 items-center gap-1">
              <code className="truncate">{branch}</code>
              <CopyButton value={branch} label="Branch" />
            </span>
          </div>
        )}
        {fixSha && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Fix SHA</span>
            <span className="flex min-w-0 items-center gap-1">
              <code className="truncate tabular-nums">{fixSha.slice(0, 12)}</code>
              <CopyButton value={fixSha} label="Fix SHA" />
            </span>
          </div>
        )}
        {revertSha && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Revert SHA</span>
            <span className="flex min-w-0 items-center gap-1">
              <code className="truncate tabular-nums">{revertSha.slice(0, 12)}</code>
              <CopyButton value={revertSha} label="Revert SHA" />
            </span>
          </div>
        )}
      </div>
      {command && (
        <div className="flex items-center justify-between gap-2 rounded bg-muted p-2">
          <code className="truncate text-xs">{command}</code>
          <CopyButton value={command} label="Command" />
        </div>
      )}
    </div>
  );
}

function EvidenceMessage({ message }: { message: TicketMessage }) {
  const body = message.body ?? "";
  const isBundle = body.trimStart().startsWith(EVIDENCE_HEADER);

  // Unknown shape (agent message that isn't a structured bundle): render the
  // whole body in one expander — tolerate, never crash (acceptance criterion).
  if (!isBundle) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <EvidenceExpander summary="View agent message" content={body} />
      </div>
    );
  }

  const { preamble, sections } = parseBundle(body);
  const branch = extractField(preamble, "Branch");
  const fixSha = extractField(preamble, "Fix SHA");
  const revertSha = extractRevertSha(sections);
  const testsSection = sections.find((s) => s.heading.toLowerCase() === "tests");
  const checks = testsSection ? parseChecks(testsSection.body) : null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {/* Loud green-light verdict first — no terminal-diving to approve. */}
      {checks && <VerdictSummary checks={checks} />}

      {preamble && (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{stripAnsi(preamble)}</p>
      )}

      {sections.map((section, idx) => {
        const known = (KNOWN_SECTIONS as readonly string[]).includes(section.heading);
        return (
          <div key={`${section.heading}-${idx}`} className="space-y-1">
            <p className={sectionLabelClass}>{section.heading}</p>
            {known ? (
              <EvidenceExpander
                summary={`View ${section.heading.toLowerCase()}`}
                content={section.body}
                defaultOpen={section.heading === "Codex review"}
              />
            ) : (
              <p className="whitespace-pre-wrap text-xs text-foreground">{stripAnsi(section.body)}</p>
            )}
          </div>
        );
      })}

      <RevertCard branch={branch} fixSha={fixSha} revertSha={revertSha} />
    </div>
  );
}

function detailRecord(value: RunnerRun["detail"]): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * True when a run actually carries evidence worth a card. Rate-limit defers and
 * bare requeues record nothing concrete (no diff/test/sha, gate skipped) — the
 * activity timeline already narrates those, so rendering an "everything not
 * recorded" card here is dead clutter. Keep runs with a real diff, sha, test,
 * a pass/fail gate, or any captured detail field.
 */
function runHasEvidence(run: RunnerRun): boolean {
  const detail = detailRecord(run.detail);
  const hasDetailField = [
    "test_output_tail",
    "gate_reasoning",
    "rebase_result",
    "repro_replay",
  ].some((key) => {
    const value = detail[key];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });
  return Boolean(
    run.diff_stat?.trim() ||
      run.fix_sha ||
      run.test_cmd ||
      run.test_exit !== null ||
      run.gate_verdict === "pass" ||
      run.gate_verdict === "fail" ||
      hasDetailField,
  );
}

function detailText(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function detailReplayText(detail: Record<string, unknown>): string | null {
  const value = detail.repro_replay;
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const replay = value as Record<string, unknown>;
  const lines: string[] = [];
  const exit = replay.exit;
  const argv = replay.argv;
  const outputTail = replay.output_tail;

  if (typeof exit === "number" || typeof exit === "string") lines.push(`exit ${exit}`);
  if (Array.isArray(argv) && argv.every((entry) => typeof entry === "string")) {
    lines.push(`argv: ${argv.join(" ")}`);
  }
  if (typeof outputTail === "string" && outputTail.trim().length > 0) {
    lines.push(outputTail);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function runGateLabel(run: RunnerRun): string {
  // "unknown" reads as a stuck/broken state when paired with a finished run
  // (e.g. a skipped:known-unfixable run that never reached the gate) — "n/a"
  // is honest that the gate simply didn't run, not that something is wrong.
  if (!run.gate_verdict && !run.gate_stage) return "n/a";
  if (!run.gate_stage) return run.gate_verdict ?? "n/a";
  if (!run.gate_verdict) return run.gate_stage;
  return `${run.gate_verdict} · ${run.gate_stage}`;
}

function RunnerRunEvidence({ run }: { run: RunnerRun }) {
  const detail = detailRecord(run.detail);
  const testOutputTail = detailText(detail, "test_output_tail");
  const gateReasoning = detailText(detail, "gate_reasoning");
  const rebaseResult = detailText(detail, "rebase_result");
  const reproReplay = detailReplayText(detail);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <p className={sectionLabelClass}>Diff</p>
          <p className="whitespace-pre-wrap text-foreground">
            {run.diff_stat ?? "not recorded"}
          </p>
        </div>
        <div>
          <p className={sectionLabelClass}>Tests</p>
          <p className="whitespace-pre-wrap text-foreground">
            {run.test_cmd ?? "not recorded"}
            {run.test_exit !== null ? ` · exit ${run.test_exit}` : ""}
          </p>
        </div>
        <div>
          <p className={sectionLabelClass}>Gate</p>
          <p className="whitespace-pre-wrap text-foreground">{runGateLabel(run)}</p>
          {gateReasoning && (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {stripAnsi(gateReasoning)}
            </p>
          )}
        </div>
        <div>
          <p className={sectionLabelClass}>Rebase / Replay</p>
          <p className="whitespace-pre-wrap text-foreground">
            {rebaseResult ?? "rebase not recorded"}
          </p>
          {reproReplay && (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {stripAnsi(reproReplay)}
            </p>
          )}
        </div>
      </div>
      {testOutputTail && (
        <EvidenceExpander
          summary="View test output tail"
          content={testOutputTail}
        />
      )}
    </div>
  );
}

/**
 * Renders the evidence group for a ticket: every agent-authored message gets
 * a structured (or single-expander fallback) evidence block. Renders null when
 * the ticket has no agent messages — ordinary support tickets show nothing new
 * (15-03 zero-regression truth).
 */
export function TicketEvidence({ messages, runnerRuns = [] }: TicketEvidenceProps) {
  const agentMessages = messages.filter((m) => m.author_type === "agent");
  // Drop runs with nothing concrete to show — they render as empty "not
  // recorded" cards otherwise (the timeline already covers them).
  const evidenceRuns = runnerRuns.filter(runHasEvidence);
  if (agentMessages.length === 0 && evidenceRuns.length === 0) return null;

  return (
    <div className="space-y-4">
      {evidenceRuns.length > 0 && (
        <div className="space-y-2">
          <p className={sectionLabelClass}>Run Evidence</p>
          <div className="space-y-3">
            {evidenceRuns.map((run) => (
              <RunnerRunEvidence key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}

      {agentMessages.length > 0 && (
        <div className="space-y-2">
          <p className={sectionLabelClass}>Fix Evidence</p>
          <div className="space-y-3">
            {agentMessages.map((message) => (
              <EvidenceMessage key={message.id} message={message} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
