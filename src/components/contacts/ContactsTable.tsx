/**
 * Contacts Table Component
 * Main contacts list view for Settings > Contacts tab
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RiSearchLine,
  RiDownloadLine,
  RiLoader2Line,
  RiUserLine,
  RiHeartPulseLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { useContacts, type ContactWithCallCount, type ContactType } from "@/hooks/useContacts";
import { TrackingToggle } from "./TrackingToggle";
import { ContactCard } from "./ContactCard";
import { formatDistanceToNow } from "date-fns";

type SortField = "name" | "email" | "last_seen_at" | "call_count" | "contact_type";
type SortDirection = "asc" | "desc";

const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  client: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  customer: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  lead: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300",
};

interface ContactsTableProps {
  /** Additional CSS classes */
  className?: string;
}

export function ContactsTable({ className }: ContactsTableProps) {
  const {
    contacts,
    settings,
    isLoading,
    isImporting,
    isUpdating,
    isDeleting,
    updateSettings,
    updateContact,
    deleteContact,
    importAllContacts,
  } = useContacts();

  // UI State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("last_seen_at");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [selectedContact, setSelectedContact] = React.useState<ContactWithCallCount | null>(null);

  // Filter and sort contacts
  const filteredContacts = React.useMemo(() => {
    let result = [...contacts];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.email.toLowerCase().includes(query) ||
          (c.name && c.name.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case "name":
          aVal = a.name?.toLowerCase() || a.email.toLowerCase();
          bVal = b.name?.toLowerCase() || b.email.toLowerCase();
          break;
        case "email":
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case "last_seen_at":
          aVal = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          bVal = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          break;
        case "call_count":
          aVal = a.call_count;
          bVal = b.call_count;
          break;
        case "contact_type":
          aVal = a.contact_type || "zzz"; // Put null at end
          bVal = b.contact_type || "zzz";
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "last_seen_at" || field === "call_count" ? "desc" : "asc");
    }
  };

  const handleTrackingToggle = async (enabled: boolean) => {
    await updateSettings({ track_all_contacts: enabled });
  };

  const handleContactUpdate = async (id: string, updates: Parameters<typeof updateContact>[1]) => {
    await updateContact(id, updates);
    // Update selected contact in UI
    if (selectedContact?.id === id) {
      setSelectedContact((prev) => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleContactDelete = async (id: string) => {
    await deleteContact(id);
    if (selectedContact?.id === id) {
      setSelectedContact(null);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <RiArrowUpLine className="h-3 w-3 ml-1" />
    ) : (
      <RiArrowDownLine className="h-3 w-3 ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full", className)}>
      {/* Main Content */}
      <div className={cn("flex-1 space-y-4 transition-all duration-300", selectedContact && "pr-4")}>
        {/* Tracking Toggle */}
        <TrackingToggle
          isEnabled={settings?.track_all_contacts ?? true}
          onToggle={handleTrackingToggle}
          isLoading={isLoading}
        />

        {/* Actions Row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Import All Button */}
          <Button
            variant="outline"
            onClick={() => importAllContacts()}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <RiDownloadLine className="h-4 w-4 mr-2" />
                Import All
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        {/* Table */}
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <RiUserLine className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-ink">
              {searchQuery ? "No contacts found" : "No contacts yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchQuery
                ? "Try a different search term"
                : "Import contacts from your call attendees to get started."}
            </p>
            {!searchQuery && (
              <Button
                className="mt-4"
                onClick={() => importAllContacts()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <RiDownloadLine className="h-4 w-4 mr-2" />
                    Import from Calls
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      Email
                      <SortIcon field="email" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("contact_type")}
                  >
                    <div className="flex items-center">
                      Type
                      <SortIcon field="contact_type" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("call_count")}
                  >
                    <div className="flex items-center">
                      Calls
                      <SortIcon field="call_count" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("last_seen_at")}
                  >
                    <div className="flex items-center">
                      Last Seen
                      <SortIcon field="last_seen_at" />
                    </div>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      selectedContact?.id === contact.id && "bg-muted"
                    )}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <TableCell className="font-medium">
                      {contact.name || (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email}
                    </TableCell>
                    <TableCell>
                      {contact.contact_type ? (
                        <Badge
                          variant="secondary"
                          className={cn("font-normal capitalize", CONTACT_TYPE_COLORS[contact.contact_type])}
                        >
                          {contact.contact_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {contact.call_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.last_seen_at
                        ? formatDistanceToNow(new Date(contact.last_seen_at), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {contact.track_health && (
                        <RiHeartPulseLine className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedContact && (
        <div className="w-[360px] flex-shrink-0 border-l border-border animate-in slide-in-from-right-4 duration-300">
          <ContactCard
            contact={selectedContact}
            onUpdate={handleContactUpdate}
            onDelete={handleContactDelete}
            onClose={() => setSelectedContact(null)}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
          />
        </div>
      )}
    </div>
  );
}

export default ContactsTable;
