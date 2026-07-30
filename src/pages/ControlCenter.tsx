/**
 * ControlCenter - Landing overview page
 *
 * Surfaces the most important things at a glance when someone lands in
 * CallVault: recent calls, quick call-volume stats, and fast navigation
 * to the areas people use most. Read-only aggregation page — all data is
 * fetched through the existing services/hooks layer (no new tables, no
 * mock content).
 *
 * Not wired as the default post-login route yet (see App.tsx) — reachable
 * at /control-center via the sidebar until that decision is made.
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
  RiRouteLine,
  RiGroupLine,
  RiSettings3Line,
  RiPlugLine,
  RiTeamLine,
  RiCalendarLine,
  RiArrowRightSLine,
  RiInboxArchiveLine,
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

const QUICK_LINKS: QuickLink[] = [
  {
    id: 'transcripts',
    label: 'Calls',
    description: 'Browse your call library',
    path: '/transcripts',
    icon: RiPhoneLine,
  },
  {
    id: 'import',
    label: 'Import',
    description: 'Connect a new source',
    path: '/import',
    icon: RiDownloadLine,
  },
  {
    id: 'rules',
    label: 'Rules',
    description: 'Auto-sort incoming calls',
    path: '/rules',
    icon: RiRouteLine,
  },
  {
    id: 'people',
    label: 'People',
    description: 'Contacts & team',
    path: '/people',
    icon: RiGroupLine,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Account & preferences',
    path: '/settings',
    icon: RiSettings3Line,
  },
];

export default function ControlCenter() {
  const navigate = useNavigate();
  const { activeOrgId } = useOrganizationContext();

  const { data: counts, isLoading: countsLoading } = useRecordingCounts(activeOrgId || undefined);
  const { data: recentCalls, isLoading: recentLoading } = useRecentRecordings(activeOrgId || undefined, 8);
  const { data: sources, isLoading: sourcesLoading } = useAvailableSources(activeOrgId || undefined);
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId || null);

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

  return (
    <AppShell config={{ showDetailPane: false }}>
      <div className="flex flex-col h-full overflow-y-auto">
        <PageHeader
          title="Control Center"
          subtitle="Your workspace at a glance"
          icon={RiDashboard3Line}
        />

        <div className="px-6 py-6 space-y-8">
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
                    <p className="text-xl font-bold text-foreground tabular-nums">
                      {tile.value ?? 0}
                    </p>
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
