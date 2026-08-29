import { useEffect, useMemo, useRef, useState } from 'react';
import { RiCameraLine, RiCheckboxCircleFill, RiCloseLine, RiImageAddLine } from '@remixicon/react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebugPanel } from '@/components/debug-panel';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { deriveConsoleBuffer, serializeConsoleBuffer } from '@/lib/console-buffer';
import { fileToScreenshotResult, type ScreenshotResult } from '@/lib/screenshot';
import { useAdminDetailStore } from '@/stores/adminDetailStore';
import { submitSupportTicket, type SupportTicketType } from '@/services/support-ticket.service';

/** Hard cap on manually attached screenshots per ticket — keeps upload size sane. */
const MAX_SCREENSHOTS = 5;

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { activeOrgId, activeWorkspaceId } = useOrganizationContext();
  const openTicket = useAdminDetailStore((state) => state.openTicket);
  // Provider is mounted above the dialog in App.tsx (15-RESEARCH Pattern 2);
  // the buffer is DERIVED from the existing global interceptor — never a
  // second console wrap (anti-pattern).
  const { messages: debugMessages } = useDebugPanel();
  const [message, setMessage] = useState('');
  const [type, setType] = useState<SupportTicketType>('bug');
  const [replyEmail, setReplyEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<ScreenshotResult[]>(screenshot ? [screenshot] : []);
  const [isRetaking, setIsRetaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-seed the held screenshots from the pre-dialog capture each time the
  // dialog opens (a stale capture from a previous open must not leak in).
  useEffect(() => {
    if (open) {
      setScreenshots(screenshot ? [screenshot] : []);
    }
  }, [open, screenshot]);

  const userEmail = useMemo(() => user?.email?.trim() ?? '', [user?.email]);
  const resolvedReplyEmail = userEmail || replyEmail.trim();
  const requireReplyEmail = !userEmail;

  const resetForm = () => {
    setMessage('');
    setType('bug');
    setReplyEmail('');
    setIsSubmitting(false);
  };

  const handleRetake = async () => {
    if (!onRetake || isRetaking) return;
    setIsRetaking(true);
    try {
      const result = await onRetake();
      if (result) {
        // Replaces the auto-captured slot only — manually attached
        // screenshots after it are left alone.
        setScreenshots((prev) => (prev.length > 0 ? [result, ...prev.slice(1)] : [result]));
      }
    } catch (error) {
      console.error('Screenshot retake failed:', error);
    } finally {
      setIsRetaking(false);
    }
  };

  const handleRemoveAt = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const addFiles = async (files: File[] | FileList) => {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;

    const room = MAX_SCREENSHOTS - screenshots.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_SCREENSHOTS} screenshots`);
      return;
    }
    if (images.length > room) {
      toast.error(`Only ${room} more screenshot${room === 1 ? '' : 's'} can be attached`);
    }

    const results = await Promise.all(images.slice(0, room).map(fileToScreenshotResult));
    setScreenshots((prev) => [...prev, ...results]);
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files && files.length > 0) {
      await addFiles(files);
    }
    event.target.value = '';
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (files.length === 0) return;
    // Only intercept the paste when it's actually an image — plain-text
    // paste into the message textarea must behave normally.
    event.preventDefault();
    await addFiles(files);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    if (requireReplyEmail && !replyEmail.trim()) return;

    setIsSubmitting(true);
    try {
      // Console buffer derived at submit time (D-03) — an empty console still
      // produces a clean (empty-entries) JSON attachment, never an error.
      const consoleBlob = serializeConsoleBuffer(deriveConsoleBuffer(debugMessages));

      const { ticketId } = await submitSupportTicket({
        message,
        type,
        replyEmail: resolvedReplyEmail || undefined,
        userId: user?.id,
        organizationId: activeOrgId,
        workspaceId: activeWorkspaceId,
        screenshots: screenshots.map((s) => ({ blob: s.blob, capturedAt: s.metadata.timestamp })),
        consoleBuffer: { blob: consoleBlob },
      });
      toast.success('Got it — an AI agent is on it now', {
        description: 'Most small fixes ship within minutes — no support queue.',
        duration: 10000,
        ...(isAdmin && ticketId
          ? {
              action: {
                label: 'Track ticket',
                onClick: () => {
                  openTicket(ticketId);
                  navigate('/admin/tickets');
                },
              },
            }
          : {}),
      });
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
            Tell us what happened. An AI agent reviews new reports within minutes. Most small fixes ship the same session.
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

          <div className="space-y-2 sm:w-48">
            <Label htmlFor="support-ticket-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as SupportTicketType)}>
              <SelectTrigger id="support-ticket-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-ticket-message">Message</Label>
            <Textarea
              id="support-ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onPaste={handlePaste}
              placeholder="What can we help with? You can also paste a screenshot here."
              minLength={1}
              maxLength={5000}
              required
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            aria-hidden
            tabIndex={-1}
          />

          <div className="space-y-2">
            {screenshots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {screenshots.map((shot, index) => (
                  <div key={shot.dataUrl.slice(-32) + index} className="relative">
                    <img
                      src={shot.dataUrl}
                      alt="Screenshot of the page you were viewing"
                      className="h-24 w-full rounded-md border border-border object-cover bg-muted/40"
                    />
                    <RiCheckboxCircleFill
                      className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-background text-emerald-500"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAt(index)}
                      aria-label="Remove screenshot"
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <RiCloseLine className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {screenshots.length > 0
                  ? `${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'} attached`
                  : 'Screenshot unavailable'}
              </span>
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={screenshots.length >= MAX_SCREENSHOTS}
                  aria-label="Add screenshot"
                >
                  <RiImageAddLine className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
