/**
 * Contact Card Component
 * Displays detailed contact information in a slide-over panel
 * Includes health alert banner and re-engagement email modal
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RiCloseLine,
  RiUserLine,
  RiMailLine,
  RiPhoneLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiDatabase2Line,
  RiHeartPulseLine,
  RiLoader2Line,
  RiTimeLine,
} from "@remixicon/react";
import type { ContactCallHistoryItem, ContactWithCallCount, ContactType, UpdateContactInput } from "@/types/contacts";
import { composeContactName, splitContactName } from "@/hooks/useContacts";
import { format, formatDistanceToNow } from "date-fns";
import { HealthAlertBanner } from "./HealthAlertBanner";
import { ReengagementEmailModal } from "./ReengagementEmailModal";

interface ContactCardProps {
  /** Contact to display */
  contact: ContactWithCallCount;
  /** Callback when contact is updated */
  onUpdate: (id: string, updates: UpdateContactInput) => Promise<void>;
  /** Callback when contact is deleted */
  onDelete: (id: string) => Promise<void>;
  /** Callback when panel should close */
  onClose: () => void;
  /** Canonical call history for this contact */
  callHistory?: ContactCallHistoryItem[];
  /** Whether call history is loading */
  isCallHistoryLoading?: boolean;
  /** Callback when a call row should open */
  onOpenCall?: (recordingId: string) => void;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Whether a delete is in progress */
  isDeleting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const CONTACT_TYPES: Array<{ value: ContactType; label: string; color: string }> = [
  { value: "client", label: "Client", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  { value: "customer", label: "Customer", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  { value: "lead", label: "Lead", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300" },
];

export function ContactCard({
  contact,
  onUpdate,
  onDelete,
  onClose,
  callHistory = [],
  isCallHistoryLoading = false,
  onOpenCall,
  isUpdating = false,
  isDeleting = false,
  className,
}: ContactCardProps) {
  const [notes, setNotes] = React.useState(contact.notes || "");
  const initialName = splitContactName(contact.name);
  const [firstName, setFirstName] = React.useState(initialName.firstName);
  const [lastName, setLastName] = React.useState(initialName.lastName);
  const [isNotesChanged, setIsNotesChanged] = React.useState(false);
  const [isNameChanged, setIsNameChanged] = React.useState(false);
  const [showEmailModal, setShowEmailModal] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const isParticipantOnly = contact.source === "participant";

  // Reset notes when contact changes
  React.useEffect(() => {
    const nextName = splitContactName(contact.name);
    setNotes(contact.notes || "");
    setFirstName(nextName.firstName);
    setLastName(nextName.lastName);
    setIsNotesChanged(false);
    setIsNameChanged(false);
  }, [contact.id, contact.name, contact.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setIsNotesChanged(value !== (contact.notes || ""));
  };

  const handleSaveNotes = async () => {
    await onUpdate(contact.id, { notes: notes || null });
    setIsNotesChanged(false);
  };

  const handleNameChange = (nextFirstName: string, nextLastName: string) => {
    setFirstName(nextFirstName);
    setLastName(nextLastName);
    setIsNameChanged(composeContactName(nextFirstName, nextLastName) !== (contact.name || null));
  };

  const handleSaveName = async () => {
    await onUpdate(contact.id, { name: composeContactName(firstName, lastName) });
    setIsNameChanged(false);
  };

  const handleTypeChange = (value: string) => {
    const newType = value === "none" ? null : (value as ContactType);
    onUpdate(contact.id, { contact_type: newType });
  };

  const handleHealthToggle = (checked: boolean) => {
    onUpdate(contact.id, { track_health: checked });
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    await onDelete(contact.id);
    setDeleteConfirmOpen(false);
    onClose();
  };

  const currentTypeConfig = CONTACT_TYPES.find((t) => t.value === contact.contact_type);
  const attendedCalls = React.useMemo(
    () => callHistory.filter((call) => call.attended),
    [callHistory],
  );
  const lastAttendedCall = attendedCalls[0] ?? null;

  const formatCallDuration = (duration: number | null) => {
    if (!duration) return "Unknown duration";
    const minutes = Math.max(1, Math.round(duration / 60));
    return `${minutes}m`;
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-background border-l border-border",
        className
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-cb-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <RiUserLine className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">
              {contact.name || contact.email}
            </h2>
            {contact.name && (
              <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close"
        >
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Health Alert Banner */}
        <HealthAlertBanner
          contact={contact}
          onSendCheckin={() => setShowEmailModal(true)}
        />

        {/* Contact Info Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact Info
            </h3>
            {isParticipantOnly && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <RiDatabase2Line className="h-3 w-3" />
                From calls
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`contact-first-name-${contact.id}`} className="text-xs text-muted-foreground">
                  First name
                </Label>
                <Input
                  id={`contact-first-name-${contact.id}`}
                  value={firstName}
                  onChange={(event) => handleNameChange(event.target.value, lastName)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && isNameChanged && !isUpdating) {
                      event.preventDefault();
                      void handleSaveName();
                    }
                  }}
                  placeholder="First"
                  disabled={isUpdating || isParticipantOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contact-last-name-${contact.id}`} className="text-xs text-muted-foreground">
                  Last name
                </Label>
                <Input
                  id={`contact-last-name-${contact.id}`}
                  value={lastName}
                  onChange={(event) => handleNameChange(firstName, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && isNameChanged && !isUpdating) {
                      event.preventDefault();
                      void handleSaveName();
                    }
                  }}
                  placeholder="Last"
                  disabled={isUpdating || isParticipantOnly}
                />
              </div>
              {isNameChanged && (
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <RiLoader2Line className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="flex items-center gap-2 text-sm">
              <RiMailLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                className="text-primary hover:underline truncate"
              >
                {contact.email}
              </a>
            </div>

            {/* Call count */}
            <div className="flex items-center gap-2 text-sm">
              <RiPhoneLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {contact.call_count} call{contact.call_count !== 1 ? "s" : ""}
                <span className="text-muted-foreground">
                  {" "}({contact.invited_count} invited, {contact.attended_count} attended)
                </span>
              </span>
            </div>

            {/* Last seen */}
            {contact.last_seen_at && (
              <div className="flex items-center gap-2 text-sm">
                <RiCalendarLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  Last seen {formatDistanceToNow(new Date(contact.last_seen_at), { addSuffix: true })}
                </span>
              </div>
            )}

            {lastAttendedCall?.recording_start_time && (
              <div className="flex items-center gap-2 text-sm">
                <RiTimeLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  Last attended {formatDistanceToNow(new Date(lastAttendedCall.recording_start_time), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Call History Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calls Attended
          </h3>

          {isCallHistoryLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 rounded-md border border-border bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : attendedCalls.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              No attended calls found for this contact.
            </div>
          ) : (
            <div className="space-y-2">
              {attendedCalls.slice(0, 8).map((call) => (
                <button
                  key={call.recording_id}
                  type="button"
                  onClick={() => onOpenCall?.(call.recording_id)}
                  className="w-full rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {call.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {call.recording_start_time
                          ? format(new Date(call.recording_start_time), "MMM d, yyyy")
                          : "Unknown date"}
                        {" · "}
                        {formatCallDuration(call.duration)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {call.invited && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Invited
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Attended
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Type Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact Type
          </h3>
          
          <div className="flex items-center gap-2">
            <Select
              value={contact.contact_type || "none"}
              onValueChange={handleTypeChange}
              disabled={isUpdating || isParticipantOnly}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No type</SelectItem>
                {CONTACT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentTypeConfig && (
              <Badge variant="secondary" className={cn("font-normal", currentTypeConfig.color)}>
                {currentTypeConfig.label}
              </Badge>
            )}
          </div>
        </section>

        {/* Health Tracking Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Health Monitoring
          </h3>
          
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <RiHeartPulseLine
                className={cn(
                  "h-5 w-5",
                  contact.track_health
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                )}
              />
              <div>
                <Label htmlFor="track-health" className="text-sm font-medium cursor-pointer">
                  Track health for this contact
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get alerts when you haven't interacted recently
                </p>
              </div>
            </div>
            <Switch
              id="track-health"
              checked={contact.track_health}
              onCheckedChange={handleHealthToggle}
              disabled={isUpdating || isParticipantOnly}
            />
          </div>
        </section>

        {/* Notes Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h3>
          
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add notes about this contact..."
            className="min-h-[100px] resize-none"
            disabled={isUpdating || isParticipantOnly}
          />

          {isNotesChanged && (
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notes"
              )}
            </Button>
          )}
        </section>

        {/* Timestamps */}
        <section className="space-y-2 text-xs text-muted-foreground">
          <p>Added {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}</p>
          {contact.updated_at !== contact.created_at && (
            <p>Updated {formatDistanceToNow(new Date(contact.updated_at), { addSuffix: true })}</p>
          )}
        </section>
      </div>

      {/* Footer */}
      {!isParticipantOnly && (
        <footer className="flex-shrink-0 p-4 border-t border-border bg-cb-card/50">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full"
          >
            {isDeleting ? (
              <>
                <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                Delete Contact
              </>
            )}
          </Button>
        </footer>
      )}

      {/* Re-engagement Email Modal */}
      <ReengagementEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        contact={contact}
      />

      {/* Delete Contact Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {contact.name || contact.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The contact and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ContactCard;
