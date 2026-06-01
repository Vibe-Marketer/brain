import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { submitSupportTicket } from '@/services/support-ticket.service';

interface SupportTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportTicketDialog({ open, onOpenChange }: SupportTicketDialogProps) {
  const { user } = useAuth();
  const { activeOrgId, activeWorkspaceId } = useOrganizationContext();
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userEmail = useMemo(() => user?.email?.trim() ?? '', [user?.email]);
  const resolvedReplyEmail = userEmail || replyEmail.trim();
  const requireReplyEmail = !userEmail;

  const resetForm = () => {
    setMessage('');
    setReplyEmail('');
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    if (requireReplyEmail && !replyEmail.trim()) return;

    setIsSubmitting(true);
    try {
      await submitSupportTicket({
        message,
        replyEmail: resolvedReplyEmail || undefined,
        userId: user?.id,
        organizationId: activeOrgId,
        workspaceId: activeWorkspaceId,
      });
      toast.success('Ticket sent to support');
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Ticket could not be sent');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit a Ticket</DialogTitle>
          <DialogDescription>
            Tell us what happened and we will follow up as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {requireReplyEmail ? (
            <div className="space-y-2">
              <Label htmlFor="support-ticket-reply-email">Reply email</Label>
              <Input
                id="support-ticket-reply-email"
                type="email"
                value={replyEmail}
                onChange={(event) => setReplyEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="support-ticket-message">Message</Label>
            <Textarea
              id="support-ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What can we help with?"
              minLength={1}
              maxLength={5000}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !message.trim() || (requireReplyEmail && !replyEmail.trim())}>
              Send ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
