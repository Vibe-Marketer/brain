/**
 * Admin Center command palette (⌘K) — 16-01, Users restored in 16-02.
 *
 * Ported from worktree-admin-center and rebound to LIVE vocabulary:
 * - Sections: Dashboard, Tickets, Users. Flags/Automation/QA stripped.
 * - Tickets come from main's useTickets (paginated live `tickets` table).
 * - Users come from useAdminUsers; selecting one opens the pane-native
 *   UserProfileDetails via adminDetailStore.
 * - "Mark resolved" mutates through main's useUpdateTicketStatus.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RiDashboardLine,
  RiTicket2Line,
  RiTeamLine,
  RiRobotLine,
  RiHistoryLine,
  RiUserLine,
  RiCheckboxCircleLine,
} from "@remixicon/react";
import { useTickets, useUpdateTicketStatus } from "@/hooks/useTickets";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { ticketTypeMeta } from "@/lib/ticket-display";
import type { Ticket } from "@/services/tickets.service";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: RiDashboardLine },
  { id: "tickets", label: "Tickets", icon: RiTicket2Line },
  { id: "users", label: "Users", icon: RiTeamLine },
  { id: "qa", label: "QA", icon: RiRobotLine },
  { id: "audit", label: "Audit", icon: RiHistoryLine },
] as const;

/** Statuses that still need attention — shown in the palette's ticket list. */
const ACTIVE_TICKET_STATUSES = new Set([
  "new",
  "triaged",
  "in_progress",
  "awaiting_approval",
  "awaiting_user",
  "escalated",
]);

function ticketLabel(ticket: Ticket): string {
  const typeMeta = ticketTypeMeta[ticket.type] ?? ticketTypeMeta.bug;
  return `${typeMeta.label} · ${ticket.severity}`;
}

function LoadingRows() {
  return (
    <div className="px-2 py-1.5 space-y-2" aria-hidden="true">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-3/4" />
    </div>
  );
}

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { openTicket, openUser } = useAdminDetailStore();

  const { data: ticketPage, isLoading: ticketsLoading } = useTickets();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { mutate: updateTicketStatus } = useUpdateTicketStatus();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset the query each time the palette opens so stale filters don't linger.
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    const q = search.trim().toLowerCase();
    const matches = q
      ? list.filter(
          (u) =>
            (u.email ?? "").toLowerCase().includes(q) ||
            (u.display_name ?? "").toLowerCase().includes(q)
        )
      : list;
    return matches.slice(0, 8);
  }, [users, search]);

  const activeTickets = useMemo(() => {
    return (ticketPage?.tickets ?? [])
      .filter((t) => ACTIVE_TICKET_STATUSES.has(t.status))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [ticketPage]);

  const resolvableTickets = activeTickets.slice(0, 5);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search sections, users, tickets, actions..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <CommandItem
                key={s.id}
                value={`section ${s.label}`}
                onSelect={() => runCommand(() => navigate(`/admin/${s.id}`))}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{s.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Users">
          {usersLoading ? (
            <LoadingRows />
          ) : (
            filteredUsers.map((u) => (
              <CommandItem
                key={u.id}
                value={`user ${u.display_name ?? ""} ${u.email ?? ""} ${u.id}`}
                onSelect={() =>
                  runCommand(() => {
                    navigate("/admin/users");
                    openUser(u.id);
                  })
                }
              >
                <RiUserLine className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {u.display_name || u.email || u.id}
                </span>
                {u.email && u.display_name && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {u.email}
                  </span>
                )}
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tickets">
          {ticketsLoading ? (
            <LoadingRows />
          ) : (
            activeTickets.slice(0, 8).map((t) => (
              <CommandItem
                key={t.id}
                value={`ticket ${t.type} ${t.severity} ${t.status} ${t.reporter} ${t.id}`}
                onSelect={() =>
                  runCommand(() => {
                    navigate("/admin/tickets");
                    openTicket(t.id);
                  })
                }
              >
                <RiTicket2Line className="mr-2 h-4 w-4" />
                <span className="truncate">{ticketLabel(t)}</span>
                <span className="ml-2 text-xs text-muted-foreground truncate">
                  {t.reporter} · {t.status}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {resolvableTickets.map((t) => (
            <CommandItem
              key={`resolve-${t.id}`}
              value={`action mark ticket resolved ${t.type} ${t.reporter} ${t.id}`}
              onSelect={() =>
                runCommand(() =>
                  updateTicketStatus({ ticketId: t.id, status: "resolved" })
                )
              }
            >
              <RiCheckboxCircleLine className="mr-2 h-4 w-4" />
              <span className="truncate">
                Mark ticket resolved: {ticketLabel(t)} ({t.reporter})
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
