import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useCreateTicket } from '@/hooks/useTickets';
import type { AdminTicketType, TicketSeverity } from '@/services/tickets.service';

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin ticket submission dialog (TKT-03). Offers exactly bug|task and the
 * four severities (default medium); context (URL, user agent, org/workspace
 * ids, app version, commit) is auto-attached by the createTicket service.
 */
export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const { user } = useAuth();
  const { activeOrgId, activeWorkspaceId } = useOrganizationContext();
  const createTicketMutation = useCreateTicket();

  const [type, setType] = useState<AdminTicketType>('bug');
  const [severity, setSeverity] = useState<TicketSeverity>('medium');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setType('bug');
    setSeverity('medium');
    setDescription('');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim() || createTicketMutation.isPending) return;

    createTicketMutation.mutate(
      {
        type,
        severity,
        message: description,
        userId: user?.id,
        organizationId: activeOrgId,
        workspaceId: activeWorkspaceId,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
          <DialogDescription>
            File a bug, task, feature request, or improvement. Context like the current URL
            and app version is attached automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 sm:w-40">
              <Label htmlFor="new-ticket-type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as AdminTicketType)}>
                <SelectTrigger id="new-ticket-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:w-40">
              <Label htmlFor="new-ticket-severity">Severity</Label>
              <Select
                value={severity}
                onValueChange={(value) => setSeverity(value as TicketSeverity)}
              >
                <SelectTrigger id="new-ticket-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-ticket-description">Description</Label>
            <Textarea
              id="new-ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to happen?"
              maxLength={5000}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={createTicketMutation.isPending || !description.trim()}
            >
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
