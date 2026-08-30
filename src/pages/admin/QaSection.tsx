/**
 * Admin Center QA section (16-03 / ADMC-05) — ported from
 * worktree-admin-center, rebound to the live `qa_runs` table.
 *
 * Reads the QA crawler run ledger (admin-only SELECT). Rows are written by the
 * autopilot nightly crawler via service-role; this page is read-only.
 *
 * v1 "Run now": rendered DISABLED with a tooltip pointing at the manual command
 * (`npm run qa:crawl`). Remote trigger wiring lands with Phase 13's dispatcher
 * (a runner that can poll a request row) — until then the crawl is launchd- or
 * manually-invoked, never from the browser.
 */
import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQaRuns, useRequestQaRun, useQaFindingSummary } from "@/hooks/useQaRuns";
import type { QaRun, QaFinding, QaFindingSummary } from "@/services/qa.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiRobotLine, RiPlayLine } from "@remixicon/react";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  // span, not a heading element — always rendered inside CardTitle (an h3)
  return (
    <span className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
      {children}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function statusBadge(status: QaRun["status"]) {
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        failed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline" className="border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange">
        running
      </Badge>
    );
  }
  if (status === "requested") {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        queued
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border bg-muted text-foreground">
      completed
    </Badge>
  );
}

/** A single finding inside the qa_runs.report JSON. Parsed defensively. */
interface QaReportFinding {
  route: string;
  type: string;
  severity: string;
  message: string;
  selector: string | null;
}

/** Pull the findings array out of the report JSON without trusting its shape. */
function parseFindings(report: Record<string, unknown> | null): QaReportFinding[] {
  if (!report) return [];
  const raw = report.findings;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const f = (entry ?? {}) as Record<string, unknown>;
    return {
      route: typeof f.route === "string" ? f.route : "(unknown route)",
      type: typeof f.type === "string" ? f.type : "finding",
      severity: typeof f.severity === "string" ? f.severity : "unknown",
      message: typeof f.message === "string" ? f.message : "",
      selector: typeof f.selector === "string" ? f.selector : null,
    };
  });
}

function severityChip(severity: string) {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        {severity}
      </Badge>
    );
  }
  if (s === "medium") {
    return (
      <Badge variant="outline" className="border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange">
        {severity}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
      {severity}
    </Badge>
  );
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Turn a machine finding type ("missing_alt") into a plain label. */
function describeFindingType(type: string): string {
  const map: Record<string, string> = {
    console_error: "Error on the page",
    js_error: "Error on the page",
    network_error: "A request failed to load",
    http_error: "A page failed to load",
    missing_alt: "Image missing a description",
    broken_link: "Broken link",
    link_404: "Broken link",
    accessibility: "Accessibility issue",
    a11y: "Accessibility issue",
    aria: "Accessibility issue",
    render_error: "Something didn't display right",
    layout: "Layout problem",
  };
  return map[type] ?? type.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Triage / review-lane audit block                                     */
/*                                                                      */
/* Makes suppressed/review/promoted QA findings AUDITABLE inside the     */
/* existing QA section (D-03) without dumping raw problems on the        */
/* operator (D-07). Copy is triage-oriented: this is review state to     */
/* glance at, never a task list. High/critical review rows are framed as */
/* second-opinion candidates, not operator chores.                      */
/* ------------------------------------------------------------------ */

/** Plain operational label for a finding lane — never the raw enum. */
function describeLane(lane: string): string {
  const map: Record<string, string> = {
    quarantined: "Quarantined",
    qa_review: "Needs review",
    promoted: "Promoted",
    ignored_noise: "Known noise",
  };
  return map[lane] ?? lane.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** A single lane-count tile. */
function LaneCount({ label, count, emphasize }: { label: string; count: number; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 md:block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={
          "font-medium tabular-nums md:mt-0.5 " +
          (emphasize && count > 0 ? "text-vibe-orange" : "text-foreground")
        }
      >
        {count}
      </div>
    </div>
  );
}

function TriageAuditCard({ summary }: { summary: QaFindingSummary }) {
  const { counts, latestReview } = summary;
  const hasAnything =
    counts.quarantined > 0 ||
    counts.qa_review > 0 ||
    counts.promoted > 0 ||
    counts.ignored_noise > 0 ||
    latestReview.length > 0;

  // Nothing to audit yet — keep the surface clean rather than show an empty card.
  if (!hasAnything) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Triage State</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Held for a second look — quarantined and review items aren't waiting on you.
        </p>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <LaneCount label="Quarantined" count={counts.quarantined} />
          <LaneCount label="Needs review" count={counts.qa_review} emphasize />
          <LaneCount label="Promoted" count={counts.promoted} />
          <LaneCount label="Known noise" count={counts.ignored_noise} />
        </div>

        {latestReview.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground/60">
              Latest review candidates
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Where</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>What</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestReview.map((finding) => (
                  <TableRow key={finding.fingerprint}>
                    <TableCell className="text-sm text-foreground">
                      {finding.route ?? "(unknown route)"}
                    </TableCell>
                    <TableCell>{severityChip(finding.severity)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                        {describeLane(finding.lane)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {finding.occurrence_count}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {relativeTime(finding.last_seen_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {describeFindingType(finding.finding_type ?? "finding")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Request-scan control — queues a 'requested' qa_runs row the nightly  */
/* crawler claims. No remote runner fires a crawl synchronously, so the */
/* honest action is "queue it", not a fake "run now".                   */
/* ------------------------------------------------------------------ */

function RequestScanButton() {
  const { mutate: requestRun, isPending } = useRequestQaRun();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={isPending}
            onClick={() => requestRun()}
          >
            <RiPlayLine className="mr-1.5 h-4 w-4" />
            {isPending ? "Starting…" : "Run scan now"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">Starts a QA crawl now — the runner picks it up within about a minute. A full scan also runs automatically every night.</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                              */
/* ------------------------------------------------------------------ */

export default function QaSection() {
  const { data: runs, isLoading, error } = useQaRuns(20);
  const { data: findingSummary } = useQaFindingSummary();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          QA runs failed to load. Retrying in the background.
        </CardContent>
      </Card>
    );
  }

  const allRuns = runs ?? [];
  const latest = allRuns[0] ?? null;
  const selected = allRuns.find((run) => run.id === selectedRunId) ?? latest;
  const findings = selected ? parseFindings(selected.report) : [];

  return (
    <div className="space-y-6">
      {/* Section header with the disabled Run-now control */}
      <div className="flex items-center justify-between">
        <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          QA Crawler
        </h2>
        <RequestScanButton />
      </div>

      {findingSummary && <TriageAuditCard summary={findingSummary} />}

      {allRuns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <RiRobotLine className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No QA runs recorded — run the crawler to populate this.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Runs history — the top row IS the latest run, so no separate summary card. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>
                <SectionHeading>Run History</SectionHeading>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Routes</TableHead>
                    <TableHead className="text-right">Findings</TableHead>
                    <TableHead className="text-right">Critical</TableHead>
                    <TableHead>Triggered by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRuns.map((run) => (
                    <TableRow
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      data-state={selected?.id === run.id ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell className="tabular-nums">
                        {relativeTime(run.started_at)}
                      </TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {run.routes_crawled}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {run.findings_count}
                      </TableCell>
                      <TableCell
                        className={
                          "text-right tabular-nums " +
                          (run.critical_count > 0 ? "text-destructive" : "")
                        }
                      >
                        {run.critical_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.triggered_by}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Findings for the selected run */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>
                <SectionHeading>
                  Findings{selected ? ` — ${relativeTime(selected.started_at)}` : ""}
                </SectionHeading>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                    <RiRobotLine className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No findings in this run's report.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {findings.map((finding, index) => (
                    <div key={index} className="space-y-1 py-3">
                      <div className="flex items-center gap-2">
                        {severityChip(finding.severity)}
                        <span className="text-sm font-medium text-foreground">
                          {describeFindingType(finding.type)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          on {finding.route}
                        </span>
                      </div>
                      {finding.message && (
                        <p className="text-sm text-muted-foreground">{truncate(finding.message)}</p>
                      )}
                      {finding.selector && (
                        <p className="text-xs text-muted-foreground/70">
                          <span className="text-muted-foreground/50">where: </span>
                          <code className="font-mono">{finding.selector}</code>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
