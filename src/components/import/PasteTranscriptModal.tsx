/**
 * PasteTranscriptModal — Phase 24 user-paste flow.
 *
 * Modal that lets a user paste a Fathom share URL + the transcript copied via
 * Fathom's "Copy transcript" button, then saves it as a recording.
 *
 * Design choice: Radix Dialog (transient action), not Pane 4. Per src/CLAUDE.md
 * modal-vs-pane rule, paste flow is a one-shot save, not a persistent panel.
 *
 * Live preview: parses the textarea on every keystroke (memoized) using the
 * SAME parser that runs server-side (`@shared/fathom-transcript-parser`). When
 * format is detected, shows editable title/date/attendee fields prefilled from
 * the parser; when not detected, shows a soft warning and saves raw text.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RiLinkM, RiLoader4Line } from '@remixicon/react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-config';
import { parseFathomCopyFormat } from '@shared/fathom-transcript-parser';

interface PasteTranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active organization UUID — passed by ImportPage. */
  organizationId: string | null;
}

const MIN_TRANSCRIPT_CHARS = 20;

export function PasteTranscriptModal({
  open,
  onOpenChange,
  organizationId,
}: PasteTranscriptModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [shareUrl, setShareUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [dateOverride, setDateOverride] = useState(''); // datetime-local string
  const [attendeesOverride, setAttendeesOverride] = useState(''); // comma-separated
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setShareUrl('');
      setTranscript('');
      setTitleOverride('');
      setDateOverride('');
      setAttendeesOverride('');
      setSubmitting(false);
    }
  }, [open]);

  // Live preview — runs the same parser the edge function uses.
  const parsed = useMemo(() => parseFathomCopyFormat(transcript), [transcript]);

  // Auto-prefill override fields when parser detects new values, but only
  // if the user hasn't typed something custom there yet.
  useEffect(() => {
    if (parsed.parse_status !== 'parsed') return;
    if (!titleOverride && parsed.title) setTitleOverride(parsed.title);
    if (!dateOverride && parsed.recorded_at) {
      // Convert ISO → datetime-local (YYYY-MM-DDTHH:MM)
      const d = new Date(parsed.recorded_at);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDateOverride(local);
      }
    }
    if (!attendeesOverride && parsed.attendees.length > 0) {
      setAttendeesOverride(parsed.attendees.join(', '));
    }
    // Run on parse_status / title change — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.parse_status, parsed.title, parsed.recorded_at, parsed.attendees.length]);

  const speakerCount = useMemo(() => {
    if (parsed.parse_status !== 'parsed') return 0;
    const seen = new Set<string>();
    for (const seg of parsed.segments) seen.add(seg.speaker.toLowerCase());
    return seen.size;
  }, [parsed]);

  const canSubmit =
    !submitting &&
    !!organizationId &&
    transcript.trim().length >= MIN_TRANSCRIPT_CHARS;

  async function handleSave() {
    if (!organizationId) {
      toast.error('No active workspace selected');
      return;
    }
    if (transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      toast.error(`Transcript is too short (need at least ${MIN_TRANSCRIPT_CHARS} characters)`);
      return;
    }

    setSubmitting(true);

    // Convert datetime-local → ISO 8601 with offset, if provided.
    let recordedAtISO: string | undefined;
    if (dateOverride) {
      const d = new Date(dateOverride);
      if (!isNaN(d.getTime())) recordedAtISO = d.toISOString();
    }

    const attendeesArr = attendeesOverride
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const body: Record<string, unknown> = {
        raw_transcript: transcript,
        organization_id: organizationId,
      };
      if (shareUrl.trim()) body.share_url = shareUrl.trim();
      if (titleOverride.trim()) body.title = titleOverride.trim();
      if (recordedAtISO) body.recorded_at = recordedAtISO;
      if (attendeesArr.length > 0) body.attendees = attendeesArr;

      const { data, error } = await supabase.functions.invoke('save-pasted-transcript', { body });

      if (error) {
        toast.error(error.message || 'Failed to save transcript');
        setSubmitting(false);
        return;
      }

      const recordingId = (data as { data?: { recording_id?: string } } | null)?.data?.recording_id;
      const action = (data as { data?: { action?: string } } | null)?.data?.action;

      toast.success(action === 'updated' ? 'Transcript updated' : 'Transcript saved');

      // Invalidate workspace queries so the new row shows up immediately.
      await queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
      await queryClient.invalidateQueries({ queryKey: ['workspace-entries'] });

      onOpenChange(false);

      if (recordingId) {
        navigate(`/?callId=${encodeURIComponent(recordingId)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save transcript';
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save a Transcript</DialogTitle>
          <DialogDescription>
            Paste a Fathom share URL and the transcript you copied from Fathom&apos;s &ldquo;Copy
            transcript&rdquo; button. We&apos;ll save it to your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share URL field */}
          <div className="space-y-1.5">
            <Label htmlFor="paste-share-url" className="text-xs uppercase tracking-wide text-muted-foreground/70">
              Fathom share URL <span className="normal-case text-muted-foreground/60">(optional)</span>
            </Label>
            <div className="relative">
              <RiLinkM className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="paste-share-url"
                type="url"
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                placeholder="https://fathom.video/share/..."
                className="pl-9"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Transcript textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="paste-transcript" className="text-xs uppercase tracking-wide text-muted-foreground/70">
              Transcript
            </Label>
            <Textarea
              id="paste-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={`Click "Copy transcript" in Fathom, then paste here`}
              className="min-h-[240px] font-mono text-xs"
              disabled={submitting}
            />
          </div>

          {/* Live preview */}
          {transcript.trim().length >= MIN_TRANSCRIPT_CHARS && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              {parsed.parse_status === 'parsed' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      Detected
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {parsed.segments.length} {parsed.segments.length === 1 ? 'turn' : 'turns'} ·{' '}
                      {speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paste-title" className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      Title
                    </Label>
                    <Input
                      id="paste-title"
                      value={titleOverride}
                      onChange={(e) => setTitleOverride(e.target.value)}
                      placeholder="Untitled pasted transcript"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paste-date" className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      Date <span className="normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input
                      id="paste-date"
                      type="datetime-local"
                      value={dateOverride}
                      onChange={(e) => setDateOverride(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paste-attendees" className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      Attendees <span className="normal-case text-muted-foreground/60">(comma-separated)</span>
                    </Label>
                    <Input
                      id="paste-attendees"
                      value={attendeesOverride}
                      onChange={(e) => setAttendeesOverride(e.target.value)}
                      placeholder="Alice Chen, Bob Smith"
                      disabled={submitting}
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Format not auto-detected. We&apos;ll save the raw text — you can clean it up later.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={!canSubmit}>
            {submitting && (
              <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            )}
            {submitting ? 'Saving…' : 'Save Transcript'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
