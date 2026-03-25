/**
 * ZoomImportDetail - 3rd-pane import UI for Zoom recordings
 *
 * Mirrors FathomImportDetail but uses Zoom-specific edge functions and
 * a string-based recording_id (UUID, not integer).
 *
 * Full flow: date range → search → select → workspace → import
 * Polls sync_jobs table while import is in progress.
 *
 * @pattern import-detail
 * @brand-version v1.1
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { RiVideoLine, RiSearchLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoomMeeting {
  /** UUID string — not an integer like Fathom */
  recording_id: string;
  title: string;
  created_at: string;
  recording_start_time?: string;
  recording_end_time?: string;
  synced: boolean;
  calendar_invitees?: Array<{ name: string; email: string }>;
}

interface SyncJobPoll {
  id: string;
  status: string;
  progress_current: number;
  progress_total: number;
  synced_ids: string[] | null;
  failed_ids: string[] | null;
  error_message: string | null;
}

export interface ZoomImportDetailProps {
  isConnected: boolean;
  accountEmail?: string;
  onConnect: () => void;
  onDisconnect?: () => void;
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ZoomImportDetail({
  isConnected,
  accountEmail,
  onConnect,
  onDisconnect,
}: ZoomImportDetailProps) {
  // Date range state — { from?, to? } matches DateRangePicker's API
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Results state
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Workspace state
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);

  // Sync / progress state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── UTC helpers ───────────────────────────────────────────────────────────

  const toUTCStart = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();
  const toUTCEnd = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString();

  // ── Fetch meetings ────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!dateRange.from) return;
    setLoading(true);
    setHasFetched(false);
    setMeetings([]);
    setSelected(new Set());

    try {
      const createdAfter = toUTCStart(dateRange.from);
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : toUTCEnd(dateRange.from);

      const { data, error } = await supabase.functions.invoke('zoom-fetch-meetings', {
        body: { createdAfter, createdBefore },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fetched: ZoomMeeting[] = data.meetings || [];
      setMeetings(fetched);
      setHasFetched(true);

      const unsyncedCount = fetched.filter((m) => !m.synced).length;
      toast.success(
        `Found ${fetched.length} recording${fetched.length !== 1 ? 's' : ''} — ${unsyncedCount} available to import`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Zoom recordings';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const unsyncedMeetings = meetings.filter((m) => !m.synced);
  const allUnsyncedSelected =
    unsyncedMeetings.length > 0 && unsyncedMeetings.every((m) => selected.has(m.recording_id));

  const toggleSelectAll = () => {
    if (allUnsyncedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unsyncedMeetings.map((m) => m.recording_id)));
    }
  };

  const toggleMeeting = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Import / sync ─────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (selected.size === 0 || !workspaceId) return;

    setSyncing(true);
    setSyncProgress({ current: 0, total: selected.size });

    try {
      // Zoom recording IDs are UUIDs — pass as strings, not integers
      const recordingIds = Array.from(selected);
      const createdAfter = dateRange.from ? toUTCStart(dateRange.from) : undefined;
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : undefined;

      const { data, error } = await supabase.functions.invoke('zoom-sync-meetings', {
        body: { recordingIds, createdAfter, createdBefore, workspace_id: workspaceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const jobId: string = data.job_id;

      pollRef.current = setInterval(async () => {
        try {
          const { data: jobData, error: jobError } = await supabase
            .from('sync_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

          if (jobError || !jobData) return;

          const job = jobData as SyncJobPoll;
          setSyncProgress({ current: job.progress_current, total: job.progress_total });

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setSyncing(false);

            if (job.status === 'completed') {
              const syncedIds = new Set(job.synced_ids || []);
              setMeetings((prev) =>
                prev.map((m) =>
                  syncedIds.has(m.recording_id) ? { ...m, synced: true } : m
                )
              );
              setSelected(new Set());
              toast.success(
                `Successfully imported ${job.synced_ids?.length ?? 0} recording${(job.synced_ids?.length ?? 0) !== 1 ? 's' : ''}`
              );
            } else {
              toast.error(job.error_message || 'Import failed');
            }
          }
        } catch {
          // Silently ignore transient poll errors
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start import';
      toast.error(msg);
      setSyncing(false);
    }
  }, [selected, workspaceId, dateRange]);

  // ── Not connected state ───────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-8 text-center">
        <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
          <RiVideoLine className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Connect Zoom</p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Connect your Zoom account to search and import cloud recordings.
          </p>
        </div>
        <Button
          onClick={onConnect}
          className="bg-vibe-orange hover:bg-vibe-orange/90 text-white gap-2"
          size="sm"
        >
          <RiVideoLine className="h-4 w-4" />
          Connect Zoom
        </Button>
      </div>
    );
  }

  // ── Progress pct ──────────────────────────────────────────────────────────

  const progressPct =
    syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : 0;

  // ── Connected state ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card">
        <div className="flex items-center gap-2.5">
          <RiVideoLine className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Zoom</span>
          {accountEmail && (
            <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground bg-muted/40">
              {accountEmail}
            </span>
          )}
        </div>
        {onDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          >
            Disconnect
          </Button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Step 1: Destination workspace */}
        <div className="px-6 pt-5 pb-4 border-b border-border/30">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Destination
          </p>
          <WorkspaceSelector
            integration="zoom"
            value={workspaceId}
            onWorkspaceChange={setWorkspaceId}
            label=""
            disabled={syncing}
            onCreateNew={() => setCreateWorkspaceOpen(true)}
          />
        </div>

        {/* Step 2: Date range + search */}
        <div className="px-6 pt-4 pb-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Search date range
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              showQuickSelect={true}
              extendedQuickSelect={true}
              disableFuture={true}
              disabled={syncing}
              placeholder="Pick a date range"
              triggerClassName="min-w-[200px]"
            />

            <Button
              onClick={handleSearch}
              disabled={!dateRange?.from || loading || syncing}
              size="sm"
              className="gap-2 bg-vibe-orange hover:bg-vibe-orange/90 text-white"
            >
              <RiSearchLine className="h-3.5 w-3.5" />
              {loading ? 'Searching…' : 'Search Zoom'}
            </Button>
          </div>
        </div>

        {/* ── Results skeleton ── */}
        {loading && (
          <div className="px-6 space-y-2 pb-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Results list ── */}
        {!loading && hasFetched && (
          <div className="px-6 pb-4">
            {/* Results header row */}
            <div className="flex items-center gap-3 py-2 mb-1">
              <Checkbox
                checked={allUnsyncedSelected}
                onCheckedChange={toggleSelectAll}
                disabled={unsyncedMeetings.length === 0 || syncing}
                aria-label="Select all available"
              />
              <span className="text-xs text-muted-foreground flex-1">
                {meetings.length} recording{meetings.length !== 1 ? 's' : ''} found
                {unsyncedMeetings.length !== meetings.length &&
                  ` — ${unsyncedMeetings.length} available to import`}
              </span>
              {selected.size > 0 && (
                <span className="text-xs font-medium text-foreground">
                  {selected.size} selected
                </span>
              )}
            </div>

            {meetings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No recordings found in this date range.
              </p>
            ) : (
              <div className="space-y-px">
                {meetings.map((meeting) => {
                  const duration = formatDuration(meeting.recording_start_time, meeting.recording_end_time);
                  const participantCount = meeting.calendar_invitees?.length;
                  const isSelected = selected.has(meeting.recording_id);

                  return (
                    <div
                      key={meeting.recording_id}
                      className={cn(
                        'flex items-center gap-3 px-2 py-2.5 rounded-md transition-colors',
                        !meeting.synced && !syncing
                          ? 'cursor-pointer hover:bg-muted/40'
                          : 'opacity-60',
                        isSelected && 'bg-muted/50'
                      )}
                      onClick={() => {
                        if (!meeting.synced && !syncing) toggleMeeting(meeting.recording_id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          if (!meeting.synced && !syncing) toggleMeeting(meeting.recording_id);
                        }}
                        disabled={meeting.synced || syncing}
                        aria-label={`Select ${meeting.title}`}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{meeting.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(meeting.created_at), 'MMM d, yyyy')}
                          </span>
                          {duration && (
                            <span className="text-[10px] text-muted-foreground">{duration}</span>
                          )}
                          {participantCount && participantCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {participantCount} participant{participantCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {meeting.synced && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 shrink-0">
                          <RiCheckLine className="h-3 w-3" />
                          Already imported
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky action bar (only after fetching) ── */}
      {hasFetched && (
        <div className="border-t border-border/40 bg-card">
          {/* Progress bar */}
          {syncing && (
            <div className="px-6 pt-3 pb-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  Importing… {syncProgress.current} / {syncProgress.total}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {progressPct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-vibe-orange/80 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-6 py-3">
            <span className="text-xs text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} recording${selected.size !== 1 ? 's' : ''} selected`
                : 'Select recordings to import'}
            </span>

            <Button
              onClick={handleImport}
              disabled={selected.size === 0 || syncing || !workspaceId}
              size="sm"
              className={cn(
                'gap-1.5 text-white',
                'bg-gradient-to-r from-vibe-orange to-vibe-orange/80',
                'hover:from-vibe-orange/90 hover:to-vibe-orange/70',
                'disabled:opacity-50'
              )}
            >
              {syncing ? 'Importing…' : `Import${selected.size > 0 ? ` ${selected.size}` : ''} recording${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        onWorkspaceCreated={(id) => {
          setWorkspaceId(id);
          setCreateWorkspaceOpen(false);
        }}
      />
    </div>
  );
}
