/**
 * FathomImportDetail - 3rd-pane import UI for Fathom recordings
 *
 * Supports MULTIPLE Fathom accounts. Shows an account switcher at the top
 * when more than one account is connected. Each account has its own
 * search → select → workspace → import flow using its own OAuth tokens.
 *
 * @pattern import-detail
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-config';
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
  RiAddLine,
  RiUserLine,
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
import { getSafeUser } from '@/lib/auth-utils';
import type { ImportSource } from '@/services/import-sources.service';
import { useUserRole } from '@/hooks/useUserRole';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FathomMeeting {
  recording_id: number;
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
  error: string | null;
}

export interface FathomImportDetailProps {
  /** All connected Fathom import sources (may be empty) */
  fathomSources: ImportSource[];
  /** Connect a new or existing Fathom account. Pass sourceId to reconnect. */
  onConnect: (sourceId?: string) => void;
  /** Disconnect a specific account */
  onDisconnect: (source: ImportSource) => void;
}

// ─── Search cache ─────────────────────────────────────────────────────────────
// Module-scoped — survives re-renders and route swaps within the same SPA
// session. Keyed by source + date range. Invalidated after a successful import
// so the list reflects newly-synced meetings.
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
type CachedSearch = { meetings: FathomMeeting[]; fetchedAt: number };
const searchCache = new Map<string, CachedSearch>();
const cacheKeyFor = (sourceId: string | null, after: string, before: string) =>
  `${sourceId ?? 'default'}|${after}|${before}`;

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

function accountLabel(source: ImportSource, index: number): string {
  if (source.account_email) return source.account_email;
  return `Fathom Account ${index + 1}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FathomImportDetail({
  fathomSources,
  onConnect,
  onDisconnect,
}: FathomImportDetailProps) {
  const { isPro, isTeam, isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const canAddMultipleAccounts = isPro || isTeam || isAdmin;

  const activeSources = fathomSources.filter((s) => s.is_active);
  const hasAnyAccount = activeSources.length > 0;

  // Currently selected account (default to first active)
  const [activeSourceId, setActiveSourceId] = useState<string | null>(
    activeSources[0]?.id ?? null
  );

  // Keep activeSourceId in sync when sources change
  useEffect(() => {
    if (activeSources.length === 0) {
      setActiveSourceId(null);
    } else if (!activeSources.some((s) => s.id === activeSourceId)) {
      setActiveSourceId(activeSources[0].id);
    }
  }, [activeSources, activeSourceId]);

  const activeSource = activeSources.find((s) => s.id === activeSourceId) ?? null;

  // Date range state — { from?, to? } matches DateRangePicker's API
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Results state
  const [meetings, setMeetings] = useState<FathomMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  // Live progress while paginating Fathom: shown next to the spinner.
  const [searchProgress, setSearchProgress] = useState<{ page: number; count: number } | null>(null);

  // Selection state — Fathom recording_id is numeric
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Workspace state
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);

  // Sync / progress state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connection Settings state ─────────────────────────────────────────────
  const [connectionOpen, setConnectionOpen] = useState(false);
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
      // Reconnect the currently selected account (or create new)
      onConnect(activeSourceId ?? undefined);
    } catch (error) {
      logger.error('Failed to get OAuth URL', error);
      toast.error('Failed to connect to Fathom');
    } finally {
      // Reset after a brief delay (OAuth opens in new tab)
      setTimeout(() => setOauthConnecting(false), 2000);
    }
  };

  // Reset search state when switching accounts
  useEffect(() => {
    setMeetings([]);
    setHasFetched(false);
    setSelected(new Set());
    setSyncing(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [activeSourceId]);

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

  // Refetch the current date range silently — used after import to refresh
  // sync state from server truth (defensive: doesn't trust local set-merge).
  const refetchMeetingsSilently = useCallback(async () => {
    if (!dateRange.from) return;
    try {
      const createdAfter = toUTCStart(dateRange.from);
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : toUTCEnd(dateRange.from);
      // Bust the cache for this range so the next manual search re-fetches.
      searchCache.delete(cacheKeyFor(activeSourceId, createdAfter, createdBefore));

      const { data, error } = await supabase.functions.invoke('fetch-meetings', {
        body: { createdAfter, createdBefore, sourceId: activeSourceId },
      });
      if (error || data?.error) return;

      const fetched: FathomMeeting[] = data.meetings || [];
      setMeetings(fetched);
      searchCache.set(cacheKeyFor(activeSourceId, createdAfter, createdBefore), {
        meetings: fetched,
        fetchedAt: Date.now(),
      });
    } catch {
      // Best-effort refresh — already showed the success toast on import.
    }
  }, [dateRange, activeSourceId]);

  const handleSearch = useCallback(async () => {
    if (!dateRange.from) return;
    setLoading(true);
    setHasFetched(false);
    setMeetings([]);
    setSelected(new Set());
    setSearchProgress(null);

    const createdAfter = toUTCStart(dateRange.from);
    const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : toUTCEnd(dateRange.from);
    const cacheKey = cacheKeyFor(activeSourceId, createdAfter, createdBefore);

    // Cache hit: render instantly. Skip the Fathom round-trip entirely.
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL_MS) {
      setMeetings(cached.meetings);
      setHasFetched(true);
      setLoading(false);
      const unsynced = cached.meetings.filter((m) => !m.synced).length;
      toast.success(
        `Found ${cached.meetings.length} call${cached.meetings.length !== 1 ? 's' : ''} — ${unsynced} available (cached)`
      );
      return;
    }

    try {
      // Page-by-page so the user sees results stream in instead of a 14s freeze.
      let cursor: string | null = null;
      let page = 0;
      const collected: FathomMeeting[] = [];

      do {
        page++;
        const { data, error } = await supabase.functions.invoke('fetch-meetings', {
          body: {
            createdAfter,
            createdBefore,
            sourceId: activeSourceId,
            cursor: cursor ?? undefined,
            pageMode: true,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const pageMeetings: FathomMeeting[] = data.meetings || [];
        collected.push(...pageMeetings);
        // Render meetings as they arrive — early results become clickable
        // before the full search finishes.
        setMeetings([...collected]);
        setSearchProgress({ page, count: collected.length });

        cursor = (data.next_cursor as string | null) ?? null;
      } while (cursor);

      setHasFetched(true);
      searchCache.set(cacheKey, { meetings: collected, fetchedAt: Date.now() });

      const unsynced = collected.filter((m) => !m.synced).length;
      toast.success(
        `Found ${collected.length} call${collected.length !== 1 ? 's' : ''} — ${unsynced} available to import`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch meetings';
      toast.error(msg);
    } finally {
      setLoading(false);
      setSearchProgress(null);
    }
  }, [dateRange, activeSourceId]);

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

  const toggleMeeting = (id: number) => {
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
      const recordingIds = Array.from(selected);
      const createdAfter = dateRange.from ? toUTCStart(dateRange.from) : undefined;
      const createdBefore = dateRange.to ? toUTCEnd(dateRange.to) : undefined;

      const { data, error } = await supabase.functions.invoke('sync-meetings', {
        body: {
          recordingIds,
          createdAfter,
          createdBefore,
          workspace_id: workspaceId,
          sourceId: activeSourceId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const jobId: string = data.jobId || data.job_id;

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

          if (job.status === 'completed' || job.status === 'failed' || job.status === 'completed_with_errors') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setSyncing(false);

            if (job.status === 'completed' || job.status === 'completed_with_errors') {
              // synced_ids is text[] in Postgres → arrives as string[]; recording_id is numeric.
              // Coerce both sides to string for the membership check.
              const syncedIds = new Set((job.synced_ids || []).map(String));
              setMeetings((prev) =>
                prev.map((m) =>
                  syncedIds.has(String(m.recording_id)) ? { ...m, synced: true } : m
                )
              );
              setSelected(new Set());
              toast.success(
                `Successfully imported ${job.synced_ids?.length ?? 0} call${(job.synced_ids?.length ?? 0) !== 1 ? 's' : ''}`
              );
              // Invalidate call lists so workspace/home views refresh instantly
              queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
              queryClient.invalidateQueries({ queryKey: ['workspace-entries'] });
              // Defensive: refetch from fetch-meetings so the list is rebuilt
              // from server truth. Catches any case where the local set-merge
              // missed a row (stale closure, type drift, cached bundle, etc).
              void refetchMeetingsSilently();
            } else {
              toast.error(job.error || 'Import failed');
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
  }, [selected, workspaceId, dateRange, activeSourceId, queryClient, refetchMeetingsSilently]);

  // ── Not connected state ───────────────────────────────────────────────────

  if (!hasAnyAccount) {
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
          onClick={() => onConnect()}
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

      {/* ── Header with account switcher ── */}
      <header className="bg-card/50 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiCloudLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-sm uppercase tracking-wide truncate">Fathom</h2>
              <p className="text-xs text-muted-foreground truncate font-normal">Import from Fathom recordings</p>
            </div>
          </div>
          {canAddMultipleAccounts ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onConnect()}
              className="h-7 px-2 text-xs gap-1"
            >
              <RiAddLine className="h-3 w-3" />
              Add Account
            </Button>
          ) : hasAnyAccount ? (
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Pro for multi-account
            </span>
          ) : null}
        </div>

        {/* Account tabs — only shown when multiple accounts */}
        {activeSources.length > 1 && (
          <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto">
            {activeSources.map((source, idx) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setActiveSourceId(source.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap',
                  source.id === activeSourceId
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <RiUserLine className="h-3 w-3 shrink-0" />
                {accountLabel(source, idx)}
              </button>
            ))}
          </div>
        )}

        {/* Single account header — shown when exactly one account */}
        {activeSources.length === 1 && activeSource && (
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground bg-muted/40">
              {activeSource.account_email || 'Connected'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect(activeSource)}
              className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              Disconnect
            </Button>
          </div>
        )}

        {/* Multi-account: show disconnect for active account */}
        {activeSources.length > 1 && activeSource && (
          <div className="flex items-center justify-end px-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect(activeSource)}
              className="h-6 px-2 text-[10px] text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              Disconnect this account
            </Button>
          </div>
        )}
      </header>

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
              {loading
                ? searchProgress
                  ? `Searching… (${searchProgress.count} found, page ${searchProgress.page})`
                  : 'Searching…'
                : 'Search Fathom'}
            </Button>
          </div>
        </div>

        {/* ── Results ── */}
        {loading && meetings.length === 0 && (
          <div className="px-6 space-y-2 pb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded-md bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && hasFetched && meetings.length === 0 && (
          <div className="px-6 pb-4">
            <p className="text-xs text-muted-foreground py-4 text-center">
              No calls found in this date range.
            </p>
          </div>
        )}

        {(loading || hasFetched) && meetings.length > 0 && (
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
