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
import { formatDistanceToNow, format } from "date-fns";
import { useQaRuns } from "@/hooks/useQaRuns";
import type { QaRun } from "@/services/qa.service";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RiRobotLine,
  RiArrowDownSLine,
  RiTerminalBoxLine,
  RiPlayLine,
} from "@remixicon/react";

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

function absoluteTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, HH:mm");
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
  return (
    <Badge variant="outline" className="border-border bg-muted text-foreground">
      completed
    </Badge>
  );
}

/** A single finding inside the qa_runs.report JSON. Parsed defensively. */
interface QaFinding {
  route: string;
  type: string;
  severity: string;
  message: string;
  selector: string | null;
}

/** Pull the findings array out of the report JSON without trusting its shape. */
function parseFindings(report: Record<string, unknown> | null): QaFinding[] {
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

/* ------------------------------------------------------------------ */
/* Run-now control (v1: disabled, manual command in the tooltip)       */
/* ------------------------------------------------------------------ */

function RunNowButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper: a disabled button suppresses pointer events, so the
              tooltip trigger must sit on an enabled element to fire on hover. */}
          <span className="inline-flex" tabIndex={0} aria-label="Run now (disabled)">
            <Button
              variant="default"
              size="sm"
              disabled
              className="pointer-events-none"
            >
              <RiPlayLine className="mr-1.5 h-4 w-4" />
              Run now
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-mono text-xs">manual: npm run qa:crawl</span>
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
        <RunNowButton />
      </div>

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
          {/* Latest run summary */}
          {latest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <SectionHeading>Latest Run</SectionHeading>
                  {statusBadge(latest.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Routes crawled</span>
                    <div className="font-medium text-foreground tabular-nums md:mt-0.5">
                      {latest.routes_crawled}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Findings</span>
                    <div className="font-medium text-foreground tabular-nums md:mt-0.5">
                      {latest.findings_count}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Critical</span>
                    <div
                      className={
                        "font-medium tabular-nums md:mt-0.5 " +
                        (latest.critical_count > 0 ? "text-destructive" : "text-foreground")
                      }
                    >
                      {latest.critical_count}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Started</span>
                    <div className="font-medium text-foreground tabular-nums md:mt-0.5">
                      {absoluteTime(latest.started_at)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Finished</span>
                    <div className="font-medium text-foreground tabular-nums md:mt-0.5">
                      {absoluteTime(latest.finished_at)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:block">
                    <span className="text-muted-foreground">Triggered by</span>
                    <div className="font-medium text-foreground md:mt-0.5">
                      {latest.triggered_by}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Runs history */}
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
                        <Badge variant="hollow" className="font-mono text-[10px]">
                          {finding.type}
                        </Badge>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {finding.route}
                        </span>
                      </div>
                      {finding.message && (
                        <p className="text-sm text-foreground">{truncate(finding.message)}</p>
                      )}
                      {finding.selector && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {finding.selector}
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

      {/* How to run */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>
                <SectionHeading>How to Run</SectionHeading>
              </CardTitle>
              <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                <RiTerminalBoxLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="font-mono text-xs text-foreground">
                  npm run qa:crawl
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Runs are scheduled via launchd (the autopilot nightly crawler);
                this page only reads recorded results. Remote one-click trigger
                lands with the Phase 13 dispatcher.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
