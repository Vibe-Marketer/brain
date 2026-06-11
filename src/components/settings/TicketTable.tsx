import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  RiArrowUpDownLine,
  RiBugLine,
  RiLightbulbLine,
  RiQuestionLine,
  RiTaskLine,
  RiTicketLine,
} from "@remixicon/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge";
import { useTableSort } from "@/hooks/useTableSort";
import type {
  Ticket,
  TicketSeverity,
  TicketStatus,
  TicketType,
} from "@/services/tickets.service";

type BadgeVariant = StatusBadgeProps["variant"];

/** UI-SPEC status → StatusBadge variant mapping (locked). */
export const ticketStatusBadge: Record<TicketStatus, { variant: BadgeVariant; label: string }> = {
  new: { variant: "new", label: "New" },
  triaged: { variant: "info", label: "Triaged" },
  in_progress: { variant: "active", label: "In Progress" },
  awaiting_approval: { variant: "warning", label: "Awaiting Approval" },
  awaiting_user: { variant: "default", label: "Awaiting User" },
  resolved: { variant: "success", label: "Resolved" },
  rejected: { variant: "inactive", label: "Rejected" },
  escalated: { variant: "error", label: "Escalated" },
};

/** UI-SPEC severity → StatusBadge variant mapping (locked). */
export const ticketSeverityBadge: Record<TicketSeverity, { variant: BadgeVariant; label: string }> = {
  critical: { variant: "error", label: "Critical" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "default", label: "Low" },
};

export const ticketTypeMeta: Record<TicketType, { icon: typeof RiBugLine; label: string }> = {
  bug: { icon: RiBugLine, label: "Bug" },
  suggestion: { icon: RiLightbulbLine, label: "Suggestion" },
  question: { icon: RiQuestionLine, label: "Question" },
  task: { icon: RiTaskLine, label: "Task" },
};

interface TicketTableProps {
  tickets: Ticket[];
  totalCount: number;
  hasActiveFilters: boolean;
  onRowClick: (ticketId: string) => void;
}

const formatRelative = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
};

export const TicketTable = React.memo(({
  tickets,
  totalCount,
  hasActiveFilters,
  onRowClick,
}: TicketTableProps) => {
  const { sortField, sortedData: sortedTickets, handleSort } = useTableSort(tickets, "created_at");

  const SortButton = ({ field, children }: { field: keyof Ticket; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-sm rounded-md transition-colors cursor-pointer"
    >
      {children}
      <RiArrowUpDownLine className={`h-3.5 w-3.5 ${sortField === field ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
        <RiTicketLine className="h-12 w-12 text-muted-foreground mb-4" />
        {hasActiveFilters ? (
          <p className="text-sm text-muted-foreground">No tickets match your filters</p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mb-1">No tickets yet</p>
            <p className="text-xs text-muted-foreground">
              Tickets submitted from the support form or created here will appear in this list.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="min-w-[110px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="type">TYPE</SortButton>
              </TableHead>
              <TableHead className="min-w-[220px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                SUMMARY
              </TableHead>
              <TableHead className="min-w-[100px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="severity">SEVERITY</SortButton>
              </TableHead>
              <TableHead className="min-w-[110px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="status">STATUS</SortButton>
              </TableHead>
              <TableHead className="hidden md:table-cell min-w-[90px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="source">SOURCE</SortButton>
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-[140px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="reporter">REPORTER</SortButton>
              </TableHead>
              <TableHead className="min-w-[120px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="created_at">CREATED</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTickets.map((ticket) => {
              const typeMeta = ticketTypeMeta[ticket.type] ?? ticketTypeMeta.bug;
              const TypeIcon = typeMeta.icon;
              const statusBadge = ticketStatusBadge[ticket.status] ?? ticketStatusBadge.new;
              const severityBadge = ticketSeverityBadge[ticket.severity] ?? ticketSeverityBadge.medium;

              return (
                <TableRow
                  key={ticket.id}
                  className="group h-10 md:h-12 hover:bg-muted/50 cursor-pointer"
                  onClick={() => onRowClick(ticket.id)}
                >
                  <TableCell className="py-0.5 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {typeMeta.label}
                    </div>
                  </TableCell>
                  <TableCell className="py-0.5 max-w-[320px]">
                    <p className="text-sm text-foreground truncate">
                      {ticket.summary || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="py-0.5 whitespace-nowrap">
                    <StatusBadge variant={severityBadge.variant} label={severityBadge.label} />
                  </TableCell>
                  <TableCell className="py-0.5 whitespace-nowrap">
                    <StatusBadge variant={statusBadge.variant} label={statusBadge.label} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-0.5 whitespace-nowrap text-sm text-muted-foreground">
                    {ticket.source}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-0.5 whitespace-nowrap text-sm text-foreground">
                    {ticket.reporter}
                  </TableCell>
                  <TableCell className="py-0.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatRelative(ticket.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>
          Showing {tickets.length} of {totalCount} tickets
        </p>
      </div>
    </div>
  );
});

TicketTable.displayName = "TicketTable";
