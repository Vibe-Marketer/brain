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
import { useContacts } from '@/hooks/useContacts';
import { ContactCard } from '@/components/contacts/ContactCard';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactDetailPanelProps {
  contactId: string;
}

export function ContactDetailPanel({ contactId }: ContactDetailPanelProps) {
  const { closePanel } = usePanelStore();
  const { activeOrgId } = useOrganizationContext();
  const {
    contacts,
    isLoading,
    isUpdating,
    isDeleting,
    updateContact,
    deleteContact,
  } = useContacts(activeOrgId);

  const contact = contacts.find((c) => c.id === contactId) ?? null;

  const handleUpdate = async (id: string, updates: Parameters<typeof updateContact>[1]) => {
    await updateContact(id, updates);
  };

  const handleDelete = async (id: string) => {
    await deleteContact(id);
    closePanel();
  };

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
      <div className="flex-1 min-h-0 overflow-auto">
        <ContactCard
          contact={contact}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => closePanel()}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
          className="border-0"
        />
      </div>
      <footer className="shrink-0 px-4 py-2" />
    </div>
  );
}
