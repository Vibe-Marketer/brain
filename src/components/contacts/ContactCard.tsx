/**
 * Contact Card Component
 * Displays detailed contact information in a slide-over panel
 * Includes health alert banner and re-engagement email modal
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  RiCloseLine,
  RiUserLine,
  RiMailLine,
  RiPhoneLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiHeartPulseLine,
  RiLoader2Line,
} from "@remixicon/react";
import type { ContactWithCallCount, ContactType, UpdateContactInput } from "@/types/contacts";
import { formatDistanceToNow } from "date-fns";
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
  isUpdating = false,
  isDeleting = false,
  className,
}: ContactCardProps) {
  const [notes, setNotes] = React.useState(contact.notes || "");
  const [isNotesChanged, setIsNotesChanged] = React.useState(false);
  const [showEmailModal, setShowEmailModal] = React.useState(false);

  // Reset notes when contact changes
  React.useEffect(() => {
    setNotes(contact.notes || "");
    setIsNotesChanged(false);
  }, [contact.id, contact.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setIsNotesChanged(value !== (contact.notes || ""));
  };

  const handleSaveNotes = async () => {
    await onUpdate(contact.id, { notes: notes || null });
    setIsNotesChanged(false);
  };

  const handleTypeChange = (value: string) => {
    const newType = value === "none" ? null : (value as ContactType);
    onUpdate(contact.id, { contact_type: newType });
  };

  const handleHealthToggle = (checked: boolean) => {
    onUpdate(contact.id, { track_health: checked });
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete contact "${contact.name || contact.email}"? This cannot be undone.`)) {
      await onDelete(contact.id);
      onClose();
    }
  };

  const currentTypeConfig = CONTACT_TYPES.find((t) => t.value === contact.contact_type);

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
            <h2 className="text-sm font-bold text-ink truncate">
              {contact.name || contact.email}
            </h2>
            {contact.name && (
              <p className="text-xs text-ink-muted truncate">{contact.email}</p>
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact Info
          </h3>
          
          <div className="space-y-2">
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
              <span className="text-ink">
                {contact.call_count} call{contact.call_count !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Last seen */}
            {contact.last_seen_at && (
              <div className="flex items-center gap-2 text-sm">
                <RiCalendarLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-ink">
                  Last seen {formatDistanceToNow(new Date(contact.last_seen_at), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
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
              disabled={isUpdating}
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
              disabled={isUpdating}
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
            disabled={isUpdating}
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

      {/* Re-engagement Email Modal */}
      <ReengagementEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        contact={contact}
      />
    </div>
  );
}

export default ContactCard;
