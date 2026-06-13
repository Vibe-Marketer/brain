import React from "react";
import { formatDistanceToNow } from "date-fns";
import { RiArrowUpDownLine, RiTicketLine } from "@remixicon/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTableSort } from "@/hooks/useTableSort";
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
  ticketSourceLabel,
  TICKET_SOURCE_ORDER,
} from "@/lib/ticket-display";
import type { Ticket } from "@/services/tickets.service";

interface TicketTableProps {
  tickets: Ticket[];
  totalCount: number;
  hasActiveFilters: boolean;
  groupBySource?: boolean;
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
  groupBySource = false,
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

  const renderTicketRow = (ticket: Ticket) => {
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
        <TableCell className="py-0.5 whitespace-nowrap">
          <StatusBadge variant={severityBadge.variant} label={severityBadge.label} />
        </TableCell>
        <TableCell className="py-0.5 whitespace-nowrap">
          <StatusBadge variant={statusBadge.variant} label={statusBadge.label} />
        </TableCell>
        <TableCell className="hidden md:table-cell py-0.5 whitespace-nowrap text-sm text-muted-foreground">
          {ticketSourceLabel(ticket.source)}
        </TableCell>
        <TableCell className="hidden lg:table-cell py-0.5 whitespace-nowrap text-sm text-foreground">
          {ticket.reporter}
        </TableCell>
        <TableCell className="py-0.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {formatRelative(ticket.created_at)}
        </TableCell>
      </TableRow>
    );
  };

  const groupedTickets = React.useMemo(() => {
    if (!groupBySource) return [];
    return TICKET_SOURCE_ORDER
      .map((source) => {
        const rows = sortedTickets.filter((ticket) => ticketSourceLabel(ticket.source) === ticketSourceLabel(source));
        return {
          source,
          label: ticketSourceLabel(source),
          rows,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [groupBySource, sortedTickets]);

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
        <RiTicketLine className="h-12 w-12 text-muted-foreground mb-4" />
        {hasActiveFilters ? (
          <p className="text-sm text-muted-foreground">No tickets match these filters</p>
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
            {groupBySource
              ? groupedTickets.map((group) => (
                <React.Fragment key={group.source}>
                  <TableRow className="hover:bg-transparent bg-muted/30">
                    <TableCell
                      colSpan={6}
                      className="h-9 py-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {group.label} · {group.rows.length}
                    </TableCell>
                  </TableRow>
                  {group.rows.map(renderTicketRow)}
                </React.Fragment>
              ))
              : sortedTickets.map(renderTicketRow)}
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
