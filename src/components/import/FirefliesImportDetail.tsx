import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  RiCheckLine,
  RiDownloadCloud2Line,
  RiFileCopyLine,
  RiKey2Line,
  RiLinkM,
  RiLoader4Line,
  RiRefreshLine,
  RiSearchLine,
  RiShieldKeyholeLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-config';
import { cn } from '@/lib/utils';
import type { ImportSource } from '@/services/import-sources.service';

interface FirefliesMeeting {
  recording_id: string;
  title: string;
  created_at: string;
  recording_start_time: string | null;
  recording_end_time: string | null;
  duration: number | null;
  synced: boolean;
  calendar_invitees: Array<{ name: string | null; email: string | null }>;
  source_url: string | null;
  share_url: string | null;
}

interface SyncJobPoll {
  id: string;
  status: 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  progress_current: number;
  progress_total: number;
  synced_ids: string[] | null;
  failed_ids: string[] | null;
  skipped_count: number | null;
  error_message: string | null;
}

export interface FirefliesImportDetailProps {
  source: ImportSource | null;
  onDisconnect?: () => void;
}

export function FirefliesImportDetail({ source, onDisconnect }: FirefliesImportDetailProps) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [webhookSigningSecret, setWebhookSigningSecret] = useState('');
  const [savingConnection, setSavingConnection] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [meetings, setMeetings] = useState<FirefliesMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toUTCStart = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();
  const toUTCEnd = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString();
  const webhookUrl = `https://api.callvaultai.com/fireflies-webhook`;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSyncing(false);
  };

  const handleSaveConnection = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error('Fireflies API key is required');
      return;
    }

    setSavingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('fireflies-save-source', {
        body: {
          apiKey: apiKey.trim(),
          webhookSigningSecret: webhookSigningSecret.trim() || null,
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      toast.success('Fireflies connected');
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.sources() });
      setApiKey('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect Fireflies');
    } finally {
      setSavingConnection(false);
    }
  }, [apiKey, queryClient, webhookSigningSecret]);

  const handleCopyWebhookUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 2000);
      toast.success('Webhook URL copied to clipboard');
    } catch {
      toast.error('Failed to copy webhook URL');
    }
  }, [webhookUrl]);

  const handleSearch = useCallback(async () => {
    if (!source?.id) {
      toast.error('Connect Fireflies first');
      return;
    }
    if (!dateRange.from) {
      toast.error('Choose a date range');
      return;
    }

    setLoading(true);
    setHasFetched(false);
    setMeetings([]);
    setSelected(new Set());

    try {
      const createdAfter = toUTCStart(dateRange.from);
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : toUTCEnd(dateRange.from);
      const { data, error } = await supabase.functions.invoke('fireflies-fetch-meetings', {
        body: {
          sourceId: source.id,
          createdAfter,
          createdBefore,
          limit: 50,
          skip: 0,
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      const fetched = ((data as { meetings?: FirefliesMeeting[] } | null)?.meetings ?? []);
      setMeetings(fetched);
      setHasFetched(true);
      toast.success(`Found ${fetched.length} Fireflies recording${fetched.length === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch Fireflies recordings');
    } finally {
      setLoading(false);
    }
  }, [dateRange, source?.id]);

  const unsyncedMeetings = meetings.filter((meeting) => !meeting.synced);
  const allUnsyncedSelected = unsyncedMeetings.length > 0 && unsyncedMeetings.every((meeting) => selected.has(meeting.recording_id));

  const toggleSelectAll = () => {
    if (allUnsyncedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unsyncedMeetings.map((meeting) => meeting.recording_id)));
    }
  };

  const toggleMeeting = (recordingId: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(recordingId)) next.delete(recordingId);
      else next.add(recordingId);
      return next;
    });
  };

  const handleImport = useCallback(async () => {
    if (!source?.id) {
      toast.error('Connect Fireflies first');
      return;
    }
    if (!workspaceId) {
      toast.error('Choose a workspace before importing');
      return;
    }
    if (selected.size === 0) {
      toast.error('Choose at least one Fireflies recording');
      return;
    }

    setSyncing(true);
    setSyncProgress({ current: 0, total: selected.size });

    try {
      const transcriptIds = Array.from(selected);
      const { data, error } = await supabase.functions.invoke('fireflies-sync-meetings', {
        body: {
          sourceId: source.id,
          transcriptIds,
          workspace_id: workspaceId,
        },
      });
      if (error) throw error;
      const jobId = (data as { jobId?: string } | null)?.jobId;
      if (!jobId) throw new Error('Fireflies sync started without a job ID');

      pollRef.current = setInterval(async () => {
        try {
          const { data: jobData, error: jobError } = await supabase
            .from('sync_jobs')
            .select('*')
            .eq('id', jobId)
            .single();
          if (jobError || !jobData) return;
          const job = jobData as SyncJobPoll;
          setSyncProgress({
            current: job.progress_current ?? 0,
            total: job.progress_total ?? transcriptIds.length,
          });
          if (job.status === 'processing') return;

          stopPolling();
          const syncedCount = job.synced_ids?.length ?? 0;
          const failedCount = job.failed_ids?.length ?? 0;
          const skippedCount = job.skipped_count ?? 0;

          if (job.status === 'completed') {
            toast.success(`Imported ${syncedCount} Fireflies recording${syncedCount === 1 ? '' : 's'}`);
          } else if (job.status === 'completed_with_errors') {
            toast.warning(`Fireflies import finished with ${syncedCount} imported, ${failedCount} failed, ${skippedCount} skipped`);
          } else {
            toast.error(job.error_message || 'Fireflies import failed');
          }

          queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
          queryClient.invalidateQueries({ queryKey: ['workspace-entries'] });
          await handleSearch();
          setSelected(new Set());
        } catch {
          // Ignore transient poll failures.
        }
      }, 1000);
    } catch (error) {
      stopPolling();
      toast.error(error instanceof Error ? error.message : 'Failed to start Fireflies import');
    }
  }, [handleSearch, queryClient, selected, source?.id, workspaceId]);

  const progressPct = syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Fireflies"
        subtitle="Connect once, search recordings, bulk import, and keep future ingestion wired"
        icon={RiDownloadCloud2Line}
      />
      <div className="px-6 py-4 max-w-3xl space-y-5">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Fireflies account connection</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Fireflies uses an account-level API key instead of OAuth. Connect the account once,
                then bulk backfill and continue ingesting future calls from the same source.
              </p>
              {source?.account_email && (
                <p className="text-xs text-muted-foreground mt-2">Connected as {source.account_email}</p>
              )}
            </div>
            {source && onDisconnect && (
              <Button variant="hollow" onClick={onDisconnect}>Disconnect</Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fireflies-api-key" className="text-xs flex items-center gap-2">
                <RiKey2Line className="h-3.5 w-3.5 text-muted-foreground" />
                API Key
              </Label>
              <Input
                id="fireflies-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={source ? 'Enter a replacement API key to reconnect' : 'Your Fireflies API key'}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fireflies-webhook-secret" className="text-xs flex items-center gap-2">
                <RiShieldKeyholeLine className="h-3.5 w-3.5 text-muted-foreground" />
                Webhook signing secret (optional)
              </Label>
              <Input
                id="fireflies-webhook-secret"
                type="password"
                value={webhookSigningSecret}
                onChange={(event) => setWebhookSigningSecret(event.target.value)}
                placeholder="Optional Fireflies webhook secret"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleSaveConnection()} disabled={savingConnection || !apiKey.trim()}>
              {savingConnection ? 'Saving…' : source ? 'Reconnect Fireflies' : 'Connect Fireflies'}
            </Button>
            <p className="text-xs text-muted-foreground">
              One Fireflies account only for now.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">Webhook URL for Fireflies</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this friendly webhook URL in Fireflies. A single shared URL is enough for every CallVault user;
                  the per-account signing secret is what routes each webhook to the correct connected Fireflies source.
                </p>
              </div>
              <Button variant="hollow" size="sm" onClick={() => void handleCopyWebhookUrl()} className="shrink-0">
                {copiedWebhookUrl ? (
                  <>
                    <RiCheckLine className="h-4 w-4 mr-2 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <RiFileCopyLine className="h-4 w-4 mr-2" />
                    Copy URL
                  </>
                )}
              </Button>
            </div>
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground">
              In Fireflies, set this URL as the webhook destination. Then save the matching signing secret here if you
              want future calls to ingest automatically as they land.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Search and import recordings</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This follows the Fathom/Zoom model: fetch provider-native recordings for a time window,
              select many, then import them into a workspace.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button onClick={() => void handleSearch()} disabled={!source || loading || syncing || !dateRange.from} className="gap-2">
              {loading ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiSearchLine className="h-4 w-4" />}
              Search Fireflies
            </Button>
          </div>

          {hasFetched && meetings.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No Fireflies recordings found for that date range.
            </div>
          )}

          {meetings.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={allUnsyncedSelected} onCheckedChange={toggleSelectAll} />
                  <span>Select all unsynced ({unsyncedMeetings.length})</span>
                </div>
                <WorkspaceSelector
                  integration="fireflies"
                  value={workspaceId}
                  onWorkspaceChange={setWorkspaceId}
                  disabled={syncing}
                  className="min-w-[280px]"
                />
              </div>

              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {meetings.map((meeting) => (
                  <div key={meeting.recording_id} className="flex items-start gap-3 p-4 bg-card">
                    <Checkbox
                      checked={selected.has(meeting.recording_id)}
                      disabled={meeting.synced || syncing}
                      onCheckedChange={() => toggleMeeting(meeting.recording_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{meeting.title}</span>
                        {meeting.synced && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5">
                            Imported
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>{format(new Date(meeting.created_at), 'MMM d, yyyy')}</span>
                        {meeting.duration != null && <span>{Math.max(1, Math.round(meeting.duration / 60))}m</span>}
                        <span>{meeting.calendar_invitees.length} attendee{meeting.calendar_invitees.length === 1 ? '' : 's'}</span>
                      </div>
                      {meeting.share_url && (
                        <button
                          type="button"
                          className={cn('mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground')}
                          onClick={() => window.open(meeting.share_url || meeting.source_url || '', '_blank', 'noopener,noreferrer')}
                        >
                          <RiLinkM className="h-3.5 w-3.5" />
                          View in Fireflies
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={() => void handleImport()} disabled={syncing || selected.size === 0 || !workspaceId} className="gap-2">
                  {syncing ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiRefreshLine className="h-4 w-4" />}
                  {syncing ? 'Importing…' : `Import ${selected.size || ''} Fireflies recording${selected.size === 1 ? '' : 's'}`.trim()}
                </Button>
                {syncing && (
                  <span className="text-xs text-muted-foreground">
                    {syncProgress.current}/{syncProgress.total} · {progressPct}%
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
