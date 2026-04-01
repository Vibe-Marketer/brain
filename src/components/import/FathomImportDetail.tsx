/**
 * FathomImportDetail - 3rd-pane import UI for Fathom recordings
 *
 * Full flow: date range → search → select → workspace → import
 * Polls sync_jobs table while import is in progress.
 *
 * @pattern import-detail
 * @brand-version v1.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import {
  RiCloudLine,
  RiSearchLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiEyeLine,
  RiEyeOffLine,
  RiExternalLinkLine,
  RiSettings4Line,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { getFathomOAuthUrl } from '@/lib/api-client';
import { getSafeUser } from '@/lib/auth-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FathomMeeting {
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
  synced_ids: number[] | null;
  failed_ids: number[] | null;
  error_message: string | null;
}

export interface FathomImportDetailProps {
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

export function FathomImportDetail({
  isConnected,
  accountEmail,
  onConnect,
  onDisconnect,
}: FathomImportDetailProps) {
  // Date range state — { from?, to? } matches DateRangePicker's API
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Results state
  const [meetings, setMeetings] = useState<FathomMeeting[]>([]);
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

  // ── Connection Settings state ─────────────────────────────────────────────
  const [connectionOpen, setConnectionOpen] = useState(!isConnected);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);
  const [hasCredentialsLoaded, setHasCredentialsLoaded] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  // Load credential settings on mount
  useEffect(() => {
    loadCredentialSettings();
  }, []);

  // Expand connection settings when disconnected
  useEffect(() => {
    if (!isConnected) setConnectionOpen(true);
  }, [isConnected]);

  const loadCredentialSettings = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      const { data: settings } = await supabase
        .from('user_settings')
        .select('fathom_api_key, webhook_secret, oauth_access_token')
        .eq('user_id', user.id)
        .maybeSingle();

      setHasOAuth(!!settings?.oauth_access_token);
      if (settings?.fathom_api_key) setApiKey(settings.fathom_api_key);
      if (settings?.webhook_secret) setWebhookSecret(settings.webhook_secret);
      setHasCredentialsLoaded(true);
    } catch (error) {
      logger.error('Error loading credential settings', error);
      setHasCredentialsLoaded(true);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      setSavingCredentials(true);
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        toast.error('Not authenticated');
        return;
      }
      if (!apiKey.trim()) {
        toast.error('API key is required');
        return;
      }
      if (!webhookSecret.startsWith('whsec_')) {
        toast.error("Invalid webhook secret format. Should start with 'whsec_'");
        return;
      }

      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          fathom_api_key: apiKey.trim(),
          webhook_secret: webhookSecret.trim(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        logger.error('Failed to save credentials', error);
        toast.error('Failed to save credentials: ' + error.message);
        return;
      }

      toast.success('Credentials updated successfully');
      setEditingCredentials(false);
    } catch (error) {
      logger.error('Error saving credentials', error);
      toast.error('Failed to save credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleOAuthReconnect = async () => {
    try {
      setOauthConnecting(true);
      const response = await getFathomOAuthUrl();
      if (response.data?.authUrl) {
        window.open(response.data.authUrl, '_blank', 'noopener,noreferrer');
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (error) {
      logger.error('Failed to get OAuth URL', error);
      toast.error('Failed to connect to Fathom');
      setOauthConnecting(false);
    }
  };

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Fetch meetings ────────────────────────────────────────────────────────

  const toUTCStart = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString();
  const toUTCEnd = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString();

  const handleSearch = useCallback(async () => {
    if (!dateRange.from) return;
    setLoading(true);
    setHasFetched(false);
    setMeetings([]);
    setSelected(new Set());

    try {
      const createdAfter = toUTCStart(dateRange.from);
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : toUTCEnd(dateRange.from);

      const { data, error } = await supabase.functions.invoke('fetch-meetings', {
        body: { createdAfter, createdBefore },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fetched: FathomMeeting[] = data.meetings || [];
      setMeetings(fetched);
      setHasFetched(true);

      const unsyncedCount = fetched.filter((m) => !m.synced).length;
      toast.success(`Found ${fetched.length} call${fetched.length !== 1 ? 's' : ''} — ${unsyncedCount} available to import`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch meetings';
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
      const recordingIds = Array.from(selected).map((id) => parseInt(id, 10));
      const createdAfter = dateRange.from ? toUTCStart(dateRange.from) : undefined;
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : undefined;

      const { data, error } = await supabase.functions.invoke('sync-meetings', {
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
              const syncedIds = new Set((job.synced_ids || []).map(String));
              setMeetings((prev) =>
                prev.map((m) =>
                  syncedIds.has(m.recording_id) ? { ...m, synced: true } : m
                )
              );
              setSelected(new Set());
              toast.success(
                `Successfully imported ${job.synced_ids?.length ?? 0} call${(job.synced_ids?.length ?? 0) !== 1 ? 's' : ''}`
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
          <RiCloudLine className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Connect Fathom</p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Connect your Fathom account to search and import call recordings.
          </p>
        </div>
        <Button
          onClick={onConnect}
          className="bg-vibe-orange hover:bg-vibe-orange/90 text-white gap-2"
          size="sm"
        >
          <RiCloudLine className="h-4 w-4" />
          Connect Fathom
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
          <RiCloudLine className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Fathom</span>
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

        {/* ── Connection Settings (collapsible) ── */}
        {hasCredentialsLoaded && (
          <div className="border-b border-border/30">
            <button
              type="button"
              onClick={() => setConnectionOpen(!connectionOpen)}
              className="flex items-center gap-2 w-full px-6 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              {connectionOpen ? (
                <RiArrowDownSLine className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <RiSettings4Line className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Connection Settings
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {apiKey && hasOAuth ? 'Configured' : apiKey ? 'API key only' : hasOAuth ? 'OAuth only' : 'Not configured'}
              </span>
            </button>

            {connectionOpen && (
              <div className="px-6 pb-4 space-y-4">
                {/* API Credentials */}
                {!editingCredentials ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">API Credentials</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {apiKey ? 'API key and webhook secret configured' : 'Not configured'}
                        </p>
                      </div>
                      <Button
                        variant="hollow"
                        size="sm"
                        onClick={() => setEditingCredentials(true)}
                        className="h-7 text-[11px]"
                      >
                        {apiKey ? 'Edit' : 'Add'} Credentials
                      </Button>
                    </div>

                    {/* OAuth Status */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">OAuth Connection</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {hasOAuth ? 'Connected — auto-sync enabled' : 'Not connected'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleOAuthReconnect}
                        disabled={oauthConnecting}
                        className="h-7 text-[11px] gap-1.5"
                      >
                        <RiExternalLinkLine className="h-3 w-3" />
                        {hasOAuth ? 'Reconnect' : 'Connect'} OAuth
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="fathom-api-key" className="text-xs">
                        API Key
                      </Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="fathom-api-key"
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Your Fathom API key"
                          className="pr-10 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? (
                            <RiEyeOffLine className="h-3.5 w-3.5" />
                          ) : (
                            <RiEyeLine className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="fathom-webhook-secret" className="text-xs">
                        Webhook Secret
                      </Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="fathom-webhook-secret"
                          type={showWebhookSecret ? 'text' : 'password'}
                          value={webhookSecret}
                          onChange={(e) => setWebhookSecret(e.target.value)}
                          placeholder="whsec_xxxxxxxxxxxxxxxxxx"
                          className="pr-10 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showWebhookSecret ? (
                            <RiEyeOffLine className="h-3.5 w-3.5" />
                          ) : (
                            <RiEyeLine className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        onClick={handleSaveCredentials}
                        disabled={savingCredentials || !apiKey || !webhookSecret}
                        size="sm"
                        className="h-7 text-[11px]"
                      >
                        {savingCredentials ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant="hollow"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          setEditingCredentials(false);
                          loadCredentialSettings();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>

                    {/* OAuth Status (also visible when editing) */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <div>
                        <p className="text-xs font-medium text-foreground">OAuth Connection</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {hasOAuth ? 'Connected — auto-sync enabled' : 'Not connected'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleOAuthReconnect}
                        disabled={oauthConnecting}
                        className="h-7 text-[11px] gap-1.5"
                      >
                        <RiExternalLinkLine className="h-3 w-3" />
                        {hasOAuth ? 'Reconnect' : 'Connect'} OAuth
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Destination workspace */}
        <div className="px-6 pt-5 pb-4 border-b border-border/30">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Destination
          </p>
          <WorkspaceSelector
            integration="fathom"
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
              {loading ? 'Searching…' : 'Search Fathom'}
            </Button>
          </div>
        </div>

        {/* ── Results ── */}
        {loading && (
          <div className="px-6 space-y-2 pb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded-md bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        )}

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
                {meetings.length} call{meetings.length !== 1 ? 's' : ''} found
                {unsyncedMeetings.length !== meetings.length &&
                  ` — ${unsyncedMeetings.length} available to import`}
              </span>
              {selected.size > 0 && (
                <span className="text-xs font-medium text-foreground">
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Meeting rows */}
            {meetings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No calls found in this date range.
              </p>
            ) : (
              <div className="space-y-px">
                {meetings.map((meeting) => {
                  const duration = formatDuration(
                    meeting.recording_start_time,
                    meeting.recording_end_time
                  );
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
                ? `${selected.size} call${selected.size !== 1 ? 's' : ''} selected`
                : 'Select calls to import'}
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
              {syncing ? 'Importing…' : `Import${selected.size > 0 ? ` ${selected.size}` : ''} call${selected.size !== 1 ? 's' : ''}`}
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
