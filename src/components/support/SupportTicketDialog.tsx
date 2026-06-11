import { useEffect, useMemo, useState } from 'react';
import { RiCameraLine, RiCloseLine } from '@remixicon/react';
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
import type { ScreenshotResult } from '@/lib/screenshot';
import { submitSupportTicket } from '@/services/support-ticket.service';

interface SupportTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-dialog problem-view capture (D-01). Null when capture failed/timed out. */
  screenshot?: ScreenshotResult | null;
  /** Re-captures the problem view with the dialog-exclusion list (D-02 Retake). */
  onRetake?: () => Promise<ScreenshotResult | null>;
}

export function SupportTicketDialog({
  open,
  onOpenChange,
  screenshot = null,
  onRetake,
}: SupportTicketDialogProps) {
  const { user } = useAuth();
  const { activeOrgId, activeWorkspaceId } = useOrganizationContext();
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedScreenshot, setAttachedScreenshot] = useState<ScreenshotResult | null>(screenshot);
  const [isRetaking, setIsRetaking] = useState(false);

  // Re-seed the held screenshot from the pre-dialog capture each time the
  // dialog opens (a stale capture from a previous open must not leak in).
  useEffect(() => {
    if (open) {
      setAttachedScreenshot(screenshot);
    }
  }, [open, screenshot]);

  const userEmail = useMemo(() => user?.email?.trim() ?? '', [user?.email]);
  const resolvedReplyEmail = userEmail || replyEmail.trim();
  const requireReplyEmail = !userEmail;

  const resetForm = () => {
    setMessage('');
    setReplyEmail('');
    setIsSubmitting(false);
  };

  const handleRetake = async () => {
    if (!onRetake || isRetaking) return;
    setIsRetaking(true);
    try {
      const result = await onRetake();
      if (result) {
        setAttachedScreenshot(result);
      }
    } catch (error) {
      console.error('Screenshot retake failed:', error);
    } finally {
      setIsRetaking(false);
    }
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

          {attachedScreenshot ? (
            <div className="space-y-2">
              <img
                src={attachedScreenshot.dataUrl}
                alt="Screenshot of the page you were viewing"
                className="max-h-32 w-full rounded-md border border-border object-contain bg-muted/40"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Screenshot attached</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRetake}
                    disabled={isRetaking}
                    aria-label="Retake screenshot"
                  >
                    <RiCameraLine className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachedScreenshot(null)}
                    aria-label="Remove screenshot"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Screenshot unavailable</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRetake}
                disabled={isRetaking}
                aria-label="Retake screenshot"
              >
                <RiCameraLine className="h-4 w-4" />
              </Button>
            </div>
          )}

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
