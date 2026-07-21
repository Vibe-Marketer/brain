/**
 * Admin Center Tickets section (16-01).
 *
 * Mounts main's LIVE ticket components (TicketTable, TicketDetailDialog,
 * NewTicketDialog from 11-03/04/05) inside the admin shell — composition
 * only, those components are owned by the ticket workstream and are not
 * modified here. The adminDetailStore lets the Dashboard "Needs You" queue
 * and the command palette open a specific ticket in this section.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RiAddLine, RiLoader2Line, RiArrowDownSLine, RiInformationLine, RiArchiveLine, RiInboxLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TicketTable } from "@/components/settings/TicketTable";
import { TicketDetailDialog } from "@/components/settings/TicketDetailDialog";
import { NewTicketDialog } from "@/components/settings/NewTicketDialog";
import { RunnerStatusBar } from "@/components/admin/RunnerStatusBar";
import { useTickets, useTicketSourceMetrics } from "@/hooks/useTickets";
import {
  TICKET_SOURCE_FILTER_OPTIONS,
  ticketTypeMeta,
} from "@/lib/ticket-display";
import {
  formatTicketSourceCycleTime,
  formatTicketSourceFixRate,
} from "@/services/admin-dashboard.service";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import {
  TICKETS_PAGE_SIZE,
  type TicketSeverity,
  type TicketSource,
  type TicketType,
  type TicketView,
} from "@/services/tickets.service";

// Type filter options — the human-facing subset (bug/task + the feature-request
// backlog). suggestion/question exist in the enum but aren't first-class here.
const TICKET_TYPE_FILTER_OPTIONS: TicketType[] = [
  "bug",
  "task",
  "feature_request",
  "improvement",
];

export default function TicketsSection() {
  // Default = active work only. Resolved/rejected live in the Archive, opened
  // on demand — never cluttering the main list.
  const [view, setView] = useState<TicketView>("open");
  const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<TicketSource | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TicketType | "all">("all");
  const [groupBySource, setGroupBySource] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TICKETS_PAGE_SIZE);
  const isArchive = view === "archive";

  // Local selection (row click) + store-driven selection (Needs You / palette)
  const { detail, close } = useAdminDetailStore();
  const [localTicketId, setLocalTicketId] = useState<string | null>(null);
  const storeTicketId = detail?.type === "ticket" ? detail.id : null;
  const selectedTicketId = storeTicketId ?? localTicketId;

  const {
    data: ticketPageData,
    isLoading,
    isError,
  } = useTickets(
    { view, severity: severityFilter, source: sourceFilter, type: typeFilter },
    page,
    pageSize,
  );
  const {
    data: sourceMetrics,
    isError: sourceMetricsError,
  } = useTicketSourceMetrics();
  const tickets = ticketPageData?.tickets ?? [];
  const totalCount = ticketPageData?.totalCount ?? 0;
  const hasFilters =
    severityFilter !== "all" || sourceFilter !== "all" || typeFilter !== "all";
  const sourceMix = useMemo(() => {
    const metricsBySource = new Map(
      (sourceMetrics ?? []).map((metric) => [metric.source, metric])
    );

    return TICKET_SOURCE_FILTER_OPTIONS.map((option) => {
      const metric = metricsBySource.get(option.source);
      return {
        ...option,
        volume: metric?.volume ?? 0,
        fixRate: metric?.fixRate ?? 0,
        cycleTime: formatTicketSourceCycleTime(metric?.averageCycleTimeHours ?? null),
      };
    });
  }, [sourceMetrics]);

  useEffect(() => {
    if (isError) toast.error("Failed to load tickets");
  }, [isError]);

  useEffect(() => {
    if (sourceMetricsError) toast.error("Source metrics failed to load");
  }, [sourceMetricsError]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            {isArchive ? "Archived Tickets" : "Tickets"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isArchive
              ? "Resolved and closed tickets. Nothing here needs you — it's just kept for reference."
              : "Open work that may need you. Resolved tickets move to the Archive automatically."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Active / Archive toggle — active is the default; closed work is
              tucked away until you ask for it. */}
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => { setView("open"); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                !isArchive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RiInboxLine className="h-3.5 w-3.5" />
              Active
            </button>
            <button
              type="button"
              onClick={() => { setView("archive"); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isArchive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RiArchiveLine className="h-3.5 w-3.5" />
              Archive
            </button>
          </div>
          <Button variant="default" onClick={() => setNewTicketOpen(true)}>
            <RiAddLine className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Live autopilot status — answers "is it working right now, on what?"
          on the LIST itself, not just the dashboard card. Active view only;
          the archive is historical. */}
      {!isArchive && <RunnerStatusBar onOpenTicket={setLocalTicketId} />}

      {/* Plain-language column legend — decodes the table so a human knows what
          each column and origin means (punch item 6). */}
      <Collapsible>
        <div className="rounded-lg border border-border bg-muted/30">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-lg">
            <span className="flex items-center gap-2 text-xs font-medium text-foreground">
              <RiInformationLine className="h-4 w-4 text-muted-foreground" />
              What am I looking at?
            </span>
            <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 px-4 pb-4 pt-1 text-xs text-muted-foreground">
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <div><dt className="inline font-medium text-foreground">Type</dt> — bug, task, feature request, improvement, or support request.</div>
                <div><dt className="inline font-medium text-foreground">Severity</dt> — how urgent: critical, high, medium, low.</div>
                <div><dt className="inline font-medium text-foreground">Status</dt> — where it stands (new → triaged → in progress → resolved). Awaiting Approval / Escalated need you.</div>
                <div><dt className="inline font-medium text-foreground">Source</dt> — where it came from (see below).</div>
                <div><dt className="inline font-medium text-foreground">Reporter</dt> — who or what filed it.</div>
                <div><dt className="inline font-medium text-foreground">Created</dt> — when it was filed.</div>
              </dl>
              <div className="border-t border-border pt-2">
                <span className="font-medium text-foreground">Where tickets come from:</span>
                <ul className="mt-1 space-y-0.5">
                  {TICKET_SOURCE_FILTER_OPTIONS.map((option) => (
                    <li key={option.source}>
                      <span className="font-medium text-foreground">{option.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="border-t border-border pt-2">
                <span className="font-medium text-foreground">Actionable vs noise:</span> rows in
                <span className="text-foreground"> Awaiting Approval</span> or
                <span className="text-foreground"> Escalated</span> need a decision from you. Resolved
                and Rejected are closed. Use the Status filter to focus on what's open.
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Filters — no status filter by design: status is handled by the
          Active/Archive toggle so closed work never clutters the list. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="sm:w-40">
          <Label htmlFor="admin-ticket-severity-filter">Severity</Label>
          <Select
            value={severityFilter}
            onValueChange={(value) => {
              setSeverityFilter(value as TicketSeverity | "all");
              setPage(1);
            }}
          >
            <SelectTrigger id="admin-ticket-severity-filter" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Label htmlFor="admin-ticket-type-filter">Type</Label>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as TicketType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger id="admin-ticket-type-filter" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TICKET_TYPE_FILTER_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {ticketTypeMeta[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-56">
          <Label htmlFor="admin-ticket-source-filter">Source</Label>
          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              setSourceFilter(value as TicketSource | "all");
              setPage(1);
            }}
          >
            <SelectTrigger id="admin-ticket-source-filter" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {TICKET_SOURCE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.source} value={option.source}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <Switch
            id="admin-ticket-group-by-source"
            checked={groupBySource}
            onCheckedChange={setGroupBySource}
          />
          <Label
            htmlFor="admin-ticket-group-by-source"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Group by source
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          Source mix
        </h3>
        {sourceMetricsError && (
          <p className="text-xs text-muted-foreground">
            Source metrics failed to load. Retrying in the background.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {sourceMix.map((source) => {
            const isSelected = sourceFilter === source.source;

            return (
              <button
                key={source.source}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSourceFilter(source.source);
                  setPage(1);
                }}
                className={cn(
                  "min-h-24 rounded-md border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange",
                  isSelected && "border-vibe-orange/30 bg-vibe-orange/10 text-foreground",
                )}
              >
                <span className="block text-sm font-medium text-foreground">
                  {source.label}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground tabular-nums">
                  {source.volume} tickets
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatTicketSourceFixRate(source.fixRate)} fixed
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {source.cycleTime === "No cycle time yet"
                    ? source.cycleTime
                    : `${source.cycleTime} avg cycle`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            Could not load tickets. Refresh to try again.
          </p>
        </div>
      ) : (
        <ErrorBoundary>
          <TicketTable
            tickets={tickets}
            totalCount={totalCount}
            hasActiveFilters={hasFilters}
            groupBySource={groupBySource}
            onRowClick={(ticketId) => setLocalTicketId(ticketId)}
          />
          {totalCount > pageSize && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </ErrorBoundary>
      )}

      <TicketDetailDialog
        open={!!selectedTicketId}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setLocalTicketId(null);
            if (storeTicketId) close();
          }
        }}
        ticketId={selectedTicketId}
      />

      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />
    </div>
  );
}
