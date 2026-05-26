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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RiAlertLine, RiCheckLine, RiFileTextLine, RiLinkM, RiLoader4Line } from '@remixicon/react';

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
import { consolidateBySpeaker, parseVTTWithMetadata } from '@shared/vtt-parser';

interface PasteTranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active organization UUID — passed by ImportPage. */
  organizationId: string | null;
}

const MIN_TRANSCRIPT_CHARS = 20;
type ManualTranscriptMode = 'fathom-paste' | 'zoom' | 'file-upload';

function filenameTitle(name: string): string {
  // Strip extension, then strip any leading date pattern (YYYY-MM-DD or MM-DD-YYYY),
  // then normalise separators to spaces.
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d{4}[-_.]\d{1,2}[-_.]\d{1,2}[-_. ]*/, '') // YYYY-MM-DD prefix
    .replace(/^\d{1,2}[-_.]\d{1,2}[-_.]\d{4}[-_. ]*/, '') // MM-DD-YYYY prefix
    .replace(/[_-]+/g, ' ')
    .trim();
}

function filenameDate(name: string): string {
  const match =
    name.match(/\b(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})\b/) ??
    name.match(/\b(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})\b/);
  if (!match) return '';
  const parts = match.slice(1).map((part) => Number.parseInt(part, 10));
  const [first, second, third] = parts;
  const year = first > 31 ? first : third;
  const month = first > 31 ? second : first;
  const day = first > 31 ? third : second;
  if (!year || !month || !day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '-';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes === 0) return `${remainingSeconds}s`;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function dateTimeLocalFromIso(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PasteTranscriptModal({
  open,
  onOpenChange,
  organizationId,
}: PasteTranscriptModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [mode, setMode] = useState<ManualTranscriptMode>('fathom-paste');
  const [sourceUrl, setSourceUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [dateOverride, setDateOverride] = useState(''); // datetime-local string
  const [attendeesOverride, setAttendeesOverride] = useState(''); // comma-separated
  const [submitting, setSubmitting] = useState(false);
  // Unrecognized URL warning (ISC-5): set when user pastes a URL we can't classify
  const [unrecognizedUrl, setUnrecognizedUrl] = useState(false);

  // Reset form whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setMode('fathom-paste');
      setSourceUrl('');
      setTranscript('');
      setTitleOverride('');
      setDateOverride('');
      setAttendeesOverride('');
      setSubmitting(false);
      setUnrecognizedUrl(false);
    }
  }, [open]);

  useEffect(() => {
    if (!sourceUrl.trim()) {
      setUnrecognizedUrl(false);
      return;
    }
    if (/zoom\.us/i.test(sourceUrl)) {
      if (mode !== 'zoom') setMode('zoom');
      setUnrecognizedUrl(false);
    } else if (/fathom\.video/i.test(sourceUrl)) {
      if (mode !== 'fathom-paste') setMode('fathom-paste');
      setUnrecognizedUrl(false);
    } else {
      // URL present but not a recognised source — flag it (ISC-5)
      const looksLikeUrl = /^https?:\/\//i.test(sourceUrl.trim());
      setUnrecognizedUrl(looksLikeUrl);
    }
  }, [mode, sourceUrl]);

  // Auto-detect WEBVTT content pasted directly into the transcript textarea.
  // When the text starts with WEBVTT (with optional BOM / leading whitespace)
  // switch to Zoom-VTT mode so the parser fires correctly.
  useEffect(() => {
    if (/^\s*WEBVTT\b/i.test(transcript) && mode !== 'zoom') {
      setMode('zoom');
    }
  }, [transcript, mode]);

  // Live preview — runs the same parser the edge function uses.
  const parsed = useMemo(() => {
    if (mode === 'zoom') {
      const zoom = parseVTTWithMetadata(transcript);
      const consolidated = consolidateBySpeaker(zoom.segments);
      return {
        parse_status: zoom.segments.length >= 1 ? 'parsed' as const : 'raw' as const,
        title: zoom.title,
        recorded_at: zoom.recorded_at,
        attendees: Array.from(
          new Set(zoom.segments.map((segment) => segment.speaker).filter(Boolean) as string[]),
        ),
        duration_seconds: zoom.duration_seconds,
        import_format: 'Zoom VTT',
        segments: consolidated.map((segment) => ({
          start_ms: Math.round(
            segment.start_time
              .split(':')
              .reduce((acc, part) => acc * 60 + Number.parseFloat(part), 0) * 1000,
          ),
          speaker: segment.speaker ?? 'Unknown',
          text: segment.text,
        })),
      };
    }
    const fathom = parseFathomCopyFormat(transcript);
    const lastSegment = fathom.segments[fathom.segments.length - 1];
    return {
      ...fathom,
      duration_seconds: lastSegment ? Math.ceil(lastSegment.start_ms / 1000) : null,
      import_format: mode === 'fathom-paste' ? 'Fathom transcript' : 'Plain transcript',
    };
  }, [mode, transcript]);

  const hasInput = transcript.trim().length > 0 || sourceUrl.trim().length > 0;
  const detectedSpeakers = useMemo(() => {
    if (parsed.parse_status !== 'parsed') return [];
    return Array.from(new Set(parsed.segments.map((seg) => seg.speaker).filter(Boolean)));
  }, [parsed]);

  // Auto-prefill override fields when parser detects new values, but only
  // if the user hasn't typed something custom there yet.
  useEffect(() => {
    if (parsed.parse_status !== 'parsed') return;
    if (!titleOverride && parsed.title) setTitleOverride(parsed.title);
    if (!dateOverride && parsed.recorded_at) {
      // Convert ISO → datetime-local (YYYY-MM-DDTHH:MM)
      setDateOverride(dateTimeLocalFromIso(parsed.recorded_at));
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
        source_app: mode,
        raw_transcript: transcript,
        organization_id: organizationId,
      };
      if (sourceUrl.trim()) body.source_url = sourceUrl.trim();
      if (mode === 'fathom-paste' && sourceUrl.trim()) body.share_url = sourceUrl.trim();
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

  async function handleTranscriptFile(file: File) {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.vtt') && !lowerName.endsWith('.txt')) {
      toast.error('Upload a VTT or TXT transcript file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Transcript file exceeds the 10MB limit');
      return;
    }
    const text = await file.text();
    setTranscript(text);
    if (!titleOverride) setTitleOverride(filenameTitle(file.name));
    if (!dateOverride) setDateOverride(filenameDate(file.name));
    if (lowerName.endsWith('.vtt')) setMode('zoom');
  }

  const sourceUrlLabel =
    mode === 'fathom-paste' ? 'Fathom share URL' : mode === 'zoom' ? 'Zoom share URL' : 'Source link';
  const sourceUrlPlaceholder =
    mode === 'fathom-paste'
      ? 'https://fathom.video/share/...'
      : mode === 'zoom'
        ? 'https://*.zoom.us/rec/share/...'
        : 'https://...';
  const transcriptPlaceholder =
    mode === 'zoom'
      ? 'Upload a Zoom .vtt file or paste WEBVTT transcript text here'
      : mode === 'fathom-paste'
        ? 'Click "Copy transcript" in Fathom, then paste here'
        : 'Paste transcript text here';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save a Transcript</DialogTitle>
          <DialogDescription>
            Paste transcript text or upload a transcript file. Fathom links and Zoom share links are saved as source metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="manual-transcript-mode" className="text-xs uppercase tracking-wide text-muted-foreground/70">
              Source
            </Label>
            <select
              id="manual-transcript-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as ManualTranscriptMode)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              disabled={submitting}
            >
              <option value="fathom-paste">Fathom transcript</option>
              <option value="zoom">Zoom VTT transcript</option>
              <option value="file-upload">Plain transcript</option>
            </select>
          </div>

          {/* Share URL field */}
          <div className="space-y-1.5">
            <Label htmlFor="paste-share-url" className="text-xs uppercase tracking-wide text-muted-foreground/70">
              {sourceUrlLabel} <span className="normal-case text-muted-foreground/60">(optional)</span>
            </Label>
            <div className="relative">
              <RiLinkM className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="paste-share-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={sourceUrlPlaceholder}
                className="pl-9"
                disabled={submitting}
              />
            </div>
            {/* ISC-5: unrecognized URL warning */}
            {unrecognizedUrl && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <RiAlertLine className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">Unrecognized source URL.</span> Zoom (zoom.us) and Fathom (fathom.video) links are auto-detected. This URL will be saved as metadata only.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".vtt,.txt,text/vtt,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleTranscriptFile(file);
                event.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="hollow"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <RiFileTextLine className="h-4 w-4 mr-2" aria-hidden="true" />
              Upload transcript file
            </Button>
            <p className="text-xs text-muted-foreground">
              VTT or TXT transcript files up to 10MB. Zoom VTT files are parsed into speaker turns.
            </p>
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
              placeholder={transcriptPlaceholder}
              className="min-h-[240px] font-mono text-xs"
              disabled={submitting}
            />
          </div>

          {/* Live preview */}
          {hasInput && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              {parsed.parse_status === 'parsed' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground/70">
                      <RiCheckLine className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      Parsed details
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {parsed.segments.length} {parsed.segments.length === 1 ? 'turn' : 'turns'} ·{' '}
                      {speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground/70">Source</div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {mode === 'zoom' ? 'Zoom' : mode === 'fathom-paste' ? 'Fathom' : 'Manual'}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground/70">Format</div>
                      <div className="mt-0.5 font-medium text-foreground">{parsed.import_format}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground/70">Duration</div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {formatDuration(parsed.duration_seconds)}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-muted-foreground/70">Speakers</div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {detectedSpeakers.length > 0 ? detectedSpeakers.join(', ') : '-'}
                      </div>
                    </div>
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
                <>
                  <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Format not auto-detected. Review the fields below before saving.
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="paste-title" className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      Title
                    </Label>
                    <Input
                      id="paste-title"
                      value={titleOverride}
                      onChange={(e) => setTitleOverride(e.target.value)}
                      placeholder="Untitled transcript"
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
