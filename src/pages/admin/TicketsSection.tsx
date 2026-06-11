/**
 * Admin Center Tickets section (16-01).
 *
 * Mounts main's LIVE ticket components (TicketTable, TicketDetailDialog,
 * NewTicketDialog from 11-03/04/05) inside the admin shell — composition
 * only, those components are owned by the ticket workstream and are not
 * modified here. The adminDetailStore lets the Dashboard "Needs You" queue
 * and the command palette open a specific ticket in this section.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RiAddLine, RiLoader2Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { useTickets } from "@/hooks/useTickets";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import {
  TICKETS_PAGE_SIZE,
  type TicketSeverity,
  type TicketSource,
  type TicketStatus,
} from "@/services/tickets.service";

export default function TicketsSection() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<TicketSource | "all">("all");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TICKETS_PAGE_SIZE);

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
    { status: statusFilter, severity: severityFilter, source: sourceFilter },
    page,
    pageSize,
  );
  const tickets = ticketPageData?.tickets ?? [];
  const totalCount = ticketPageData?.totalCount ?? 0;
  const hasFilters =
    statusFilter !== "all" || severityFilter !== "all" || sourceFilter !== "all";

  useEffect(() => {
    if (isError) toast.error("Failed to load tickets");
  }, [isError]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-foreground">Tickets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Support tickets, bug reports, and tasks across the platform
          </p>
        </div>
        <Button variant="default" onClick={() => setNewTicketOpen(true)}>
          <RiAddLine className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:w-44">
          <Label htmlFor="admin-ticket-status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as TicketStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger id="admin-ticket-status-filter" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="triaged">Triaged</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
              <SelectItem value="awaiting_user">Awaiting User</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div className="sm:w-40">
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
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="sentry">Sentry</SelectItem>
            </SelectContent>
          </Select>
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
