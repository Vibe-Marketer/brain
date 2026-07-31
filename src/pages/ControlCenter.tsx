/**
 * ControlCenter - Post-login landing page ("mission control")
 *
 * Leads with what needs attention (failed imports, pending invites), then
 * call-volume stats with real week-over-week deltas, then recent calls.
 * Read-only aggregation page — all data is fetched through the existing
 * services/hooks layer (no new tables, no mock content).
 *
 * Default route at "/" (see App.tsx); also reachable at /control-center.
 *
 * @pattern pane3-overview
 */

import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  RiDashboard3Line,
  RiPhoneLine,
  RiDownloadLine,
  RiGroupLine,
  RiPlugLine,
  RiTeamLine,
  RiCalendarLine,
  RiArrowRightSLine,
  RiInboxArchiveLine,
  RiErrorWarningLine,
  RiMailSendLine,
  RiCheckboxCircleLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useRecentRecordings } from '@/hooks/useRecentRecordings';
import { useRecordingCounts } from '@/hooks/useRecordingCounts';
import { useAvailableSources } from '@/hooks/useAvailableSources';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useFailedImports } from '@/hooks/useImportSources';
import { useOrganizationInvitations } from '@/hooks/useOrganizationMembers';
import type { RecentRecording } from '@/services/recordings.service';

function formatCallDuration(duration: number | null): string {
  if (!duration) return 'Unknown length';
  const minutes = Math.max(1, Math.round(duration / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

interface QuickLink {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
}

// Trimmed to 3 actions that aren't just restating the sidebar: Calls is the
// primary "get what I came here for" action, the other two are things you'd
// actually come to a landing page to *do* (connect, invite) rather than just
// navigate to. Rules/People/Settings are one click away in the sidebar and
// don't earn a duplicate card here.
const QUICK_LINKS: QuickLink[] = [
  {
    id: 'transcripts',
    label: 'Browse calls',
    description: 'Your call library',
    path: '/transcripts',
    icon: RiPhoneLine,
  },
  {
    id: 'import',
    label: 'Connect a source',
    description: 'Add another call feed',
    path: '/import',
    icon: RiDownloadLine,
  },
  {
    id: 'invite',
    label: 'Invite teammate',
    description: 'Add someone to your org',
    path: '/organization',
    icon: RiGroupLine,
  },
];

export default function ControlCenter() {
  const navigate = useNavigate();
  const { activeOrgId } = useOrganizationContext();

  const { data: counts, isLoading: countsLoading } = useRecordingCounts(activeOrgId || undefined);
  const { data: recentCalls, isLoading: recentLoading } = useRecentRecordings(activeOrgId || undefined, 8);
  const { data: sources, isLoading: sourcesLoading } = useAvailableSources(activeOrgId || undefined);
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId || null);
  const { data: failedImports, isLoading: failedImportsLoading } = useFailedImports();
  const { invitations: pendingInvitations, isLoading: invitationsLoading } =
    useOrganizationInvitations(activeOrgId || '');

  const weekDelta =
    counts && counts.callsPriorWeek > 0
      ? Math.round(((counts.callsThisWeek - counts.callsPriorWeek) / counts.callsPriorWeek) * 100)
      : null;

  const statTiles = [
    {
      id: 'total-calls',
      label: 'Total Calls',
      value: counts?.totalCalls,
      icon: RiPhoneLine,
      loading: countsLoading,
    },
    {
      id: 'this-week',
      label: 'Calls This Week',
      value: counts?.callsThisWeek,
      icon: RiCalendarLine,
      loading: countsLoading,
      delta: weekDelta,
    },
    {
      id: 'sources',
      label: 'Connected Sources',
      value: sources?.length,
      icon: RiPlugLine,
      loading: sourcesLoading,
    },
    {
      id: 'workspaces',
      label: 'Workspaces',
      value: (workspaces || []).length,
      icon: RiTeamLine,
      loading: workspacesLoading,
    },
  ];

  const attentionLoading = failedImportsLoading || invitationsLoading;
  const failedImportCount = failedImports?.length ?? 0;
  const pendingInvitationCount = pendingInvitations.length;
  const hasAttentionItems = failedImportCount > 0 || pendingInvitationCount > 0;

  return (
    <AppShell config={{ showDetailPane: false }}>
      <div className="flex flex-col h-full overflow-y-auto">
        <PageHeader
          title="Control Center"
          subtitle="What needs you, what's new, and where to go next"
          icon={RiDashboard3Line}
        />

        <div className="px-6 py-6 space-y-8">
          {/* Needs attention — leads the page. Real signal (failed imports,
              pending invites) beats a flat stat, and a caught-up state
              still confirms nothing is broken instead of just vanishing. */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Needs Attention
            </h2>
            {attentionLoading ? (
              <Skeleton className="h-14 w-full rounded-xl" />
            ) : !hasAttentionItems ? (
              <div className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20">
                  <RiCheckboxCircleLine size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <p className="text-sm text-foreground">You're all caught up — no failed imports, no pending invites.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {failedImportCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/import')}
                    className={cn(
                      'bg-card border border-red-500/30 rounded-xl px-4 py-3',
                      'hover:border-red-500/50 cursor-pointer transition-colors text-left',
                      'flex items-center gap-3 group',
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/10 border border-red-500/20">
                      <RiErrorWarningLine size={16} className="text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {failedImportCount} import{failedImportCount === 1 ? '' : 's'} failed
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {failedImports?.[0]?.error_message || 'Tap to review and retry'}
                      </p>
                    </div>
                    <RiArrowRightSLine size={16} className="text-muted-foreground/40 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" aria-hidden="true" />
                  </button>
                )}
                {pendingInvitationCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/organization')}
                    className={cn(
                      'bg-card border border-border/60 rounded-xl px-4 py-3',
                      'hover:border-vibe-orange/40 cursor-pointer transition-colors text-left',
                      'flex items-center gap-3 group',
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted border border-border">
                      <RiMailSendLine size={16} className="text-muted-foreground group-hover:text-vibe-orange transition-colors" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {pendingInvitationCount} invite{pendingInvitationCount === 1 ? '' : 's'} pending
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Waiting on a response — resend or check status
                      </p>
                    </div>
                    <RiArrowRightSLine size={16} className="text-muted-foreground/40 group-hover:text-vibe-orange group-hover:translate-x-0.5 transition-all flex-shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stat tiles */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statTiles.map((tile, i) => (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="bg-card border border-border/60 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <tile.icon size={14} className="text-muted-foreground" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                      {tile.label}
                    </span>
                  </div>
                  {tile.loading ? (
                    <Skeleton className="h-6 w-12 mt-0.5" />
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-xl font-bold text-foreground tabular-nums">
                        {tile.value ?? 0}
                      </p>
                      {'delta' in tile && tile.delta !== null && tile.delta !== undefined && tile.delta !== 0 && (
                        <span
                          className={cn(
                            'flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
                            tile.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                          )}
                        >
                          {tile.delta > 0 ? (
                            <RiArrowUpLine size={11} aria-hidden="true" />
                          ) : (
                            <RiArrowDownLine size={11} aria-hidden="true" />
                          )}
                          {Math.abs(tile.delta)}%
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Quick Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={cn(
                    'bg-card border border-border/60 rounded-xl p-4',
                    'hover:border-vibe-orange/40 cursor-pointer transition-colors text-left',
                    'flex items-center gap-3 group',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      'bg-muted border border-border',
                      'group-hover:border-vibe-orange/20 transition-colors',
                    )}
                  >
                    <link.icon
                      size={16}
                      className="text-muted-foreground group-hover:text-vibe-orange transition-colors"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                  </div>
                  <RiArrowRightSLine
                    size={16}
                    className="text-muted-foreground/40 group-hover:text-vibe-orange group-hover:translate-x-0.5 transition-all flex-shrink-0"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Recent calls */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Calls
              </h2>
              <button
                type="button"
                onClick={() => navigate('/transcripts')}
                className="text-xs font-medium text-muted-foreground hover:text-vibe-orange transition-colors"
              >
                View all
              </button>
            </div>

            {recentLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : !recentCalls || recentCalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border/60 rounded-xl">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                  <RiInboxArchiveLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No calls yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Connect a source to start pulling in calls.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/import')}
                  className="text-xs font-medium text-vibe-orange hover:underline"
                >
                  Go to Import
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentCalls.map((call: RecentRecording) => (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => navigate(`/call/${call.id}`)}
                    className={cn(
                      'bg-card border border-border/60 rounded-xl px-4 py-3',
                      'hover:border-vibe-orange/40 cursor-pointer transition-colors text-left',
                      'flex items-center gap-3 group',
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted border border-border">
                      <RiPhoneLine size={15} className="text-muted-foreground group-hover:text-vibe-orange transition-colors" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {call.title || 'Untitled call'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {call.summary || (call.source_app ? `via ${call.source_app}` : 'No summary available')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 text-right">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {call.recording_start_time
                          ? formatDistanceToNow(new Date(call.recording_start_time), { addSuffix: true })
                          : 'Unknown date'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {formatCallDuration(call.duration)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
