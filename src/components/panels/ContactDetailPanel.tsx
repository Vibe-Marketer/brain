/**
 * ContactDetailPanel - Pane 4 detail panel for contacts
 *
 * Renders the ContactCard component inside the standard panel layout,
 * wired to the panelStore for open/close behavior.
 *
 * @pattern detail-panel
 */

import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useContactCallHistory, useContacts } from '@/hooks/useContacts';
import { ContactCard } from '@/components/contacts/ContactCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { WorkspaceInviteDialog } from '@/components/dialogs/WorkspaceInviteDialog';
import { RiUserAddLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface ContactDetailPanelProps {
  contactId: string;
}

export function ContactDetailPanel({ contactId }: ContactDetailPanelProps) {
  const { closePanel } = usePanelStore();
  const { activeOrgId, activeWorkspace, defaultWorkspace, workspaces } = useOrganizationContext();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    contacts,
    isLoading,
    isUpdating,
    isDeleting,
    updateContact,
    deleteContact,
  } = useContacts(activeOrgId);

  const contact = contacts.find((c) => c.id === contactId) ?? null;
  const isUniqueContactName = contact?.name
    ? contacts.filter((candidate) => candidate.name?.trim().toLowerCase() === contact.name?.trim().toLowerCase()).length === 1
    : false;
  const {
    data: callHistory = [],
    isLoading: isCallHistoryLoading,
  } = useContactCallHistory(activeOrgId, contact, isUniqueContactName);

  const handleUpdate = async (id: string, updates: Parameters<typeof updateContact>[1]) => {
    await updateContact(id, updates);
  };

  const handleDelete = async (id: string) => {
    await deleteContact(id);
    closePanel();
  };

  const handleOpenCall = (recordingId: string) => {
    navigate(`/?callId=${recordingId}`);
  };

  const inviteWorkspace = activeWorkspace ?? defaultWorkspace ?? workspaces[0] ?? null;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Contact not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {inviteWorkspace && (
        <div className="shrink-0 border-b border-border bg-cb-card/50 px-4 py-3">
          <Button
            type="button"
            variant="hollow"
            size="sm"
            className="w-full"
            onClick={() => setInviteOpen(true)}
          >
            <RiUserAddLine className="h-4 w-4 mr-2" />
            Invite to {inviteWorkspace.name}
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <ContactCard
          contact={contact}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => closePanel()}
          callHistory={callHistory}
          isCallHistoryLoading={isCallHistoryLoading}
          onOpenCall={handleOpenCall}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
          className="border-0"
        />
      </div>
      <footer className="shrink-0 px-4 py-2" />
      {inviteWorkspace && (
        <WorkspaceInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={inviteWorkspace.id}
          workspaceName={inviteWorkspace.name}
          initialEmail={contact.email}
        />
      )}
    </div>
  );
}
