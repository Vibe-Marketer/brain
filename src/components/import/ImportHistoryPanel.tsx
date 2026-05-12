/**
 * ImportHistoryPanel — Phase 36-06 BUG-06
 *
 * A real Import History surface that lists past import runs aggregated from
 * the recordings table (since there is no dedicated import_history table yet).
 * Each row shows the date, source app, and number of recordings imported
 * on that day. Failed imports are shown at the bottom via the existing
 * FailedImportsSection.
 *
 * Future work (BACKLOG v2.3): dedicated import_history table with retry,
 * dedupe, partial-success badges, and per-run audit details.
 */

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  RiDownloadCloud2Line,
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiClipboardLine,
} from '@remixicon/react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgContext } from '@/hooks/useOrgContext';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { FailedImportsSection } from '@/components/import/FailedImportsSection';
import { SOURCE_LABELS } from '@/lib/source-labels';
import { cn } from '@/lib/utils';

interface ImportRunRow {
  date: string; // YYYY-MM-DD
  source_app: string;
  count: number;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  fathom: RiCloudLine,
  zoom: RiVideoLine,
  youtube: RiYoutubeLine,
  'file-upload': RiUploadCloud2Line,
  'fathom-paste': RiClipboardLine,
};

export function ImportHistoryPanel() {
  const { activeOrgId } = useOrgContext();

  const { data: runs, isLoading } = useQuery<ImportRunRow[]>({
    queryKey: ['imports', 'history', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      // Aggregate recordings by (synced_at::date, source_app) to produce
      // a daily import-run view. Pull the last 90 days, max 200 rows.
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data, error } = await supabase
        .from('recordings')
        .select('synced_at, created_at, source_app')
        .eq('organization_id', activeOrgId)
        .not('source_app', 'is', null)
        .order('synced_at', { ascending: false, nullsFirst: false })
        .limit(2000);

      if (error) throw error;
      if (!data) return [];

      // Aggregate client-side: group by (YYYY-MM-DD, source_app)
      const byDateSource = new Map<string, ImportRunRow>();
      for (const r of data) {
        const ts = r.synced_at ?? r.created_at;
        if (!ts) continue;
        const date = format(parseISO(ts), 'yyyy-MM-dd');
        const source = (r.source_app ?? 'unknown') as string;
        const key = `${date}|${source}`;
        const existing = byDateSource.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          byDateSource.set(key, { date, source_app: source, count: 1 });
        }
      }
      // Sort by date desc, then source
      return Array.from(byDateSource.values()).sort((a, b) =>
        a.date === b.date ? a.source_app.localeCompare(b.source_app) : b.date.localeCompare(a.date),
      );
    },
    enabled: !!activeOrgId,
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Import History"
        subtitle="Past imports grouped by day and source"
        icon={RiDownloadCloud2Line}
      />

      <div className="px-6 py-4 space-y-6">
        {/* Failed imports — keep at top for triage */}
        <FailedImportsSection />

        {/* Daily import runs */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Import Runs</h3>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          )}

          {!isLoading && (!runs || runs.length === 0) && (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
              No recent imports. Connect a source from the sidebar to get started.
            </div>
          )}

          {!isLoading && runs && runs.length > 0 && (
            <ul className="divide-y divide-border/40 border border-border rounded-xl bg-card">
              {runs.map(({ date, source_app, count }) => {
                const Icon = SOURCE_ICONS[source_app] ?? RiDownloadCloud2Line;
                const label = SOURCE_LABELS[source_app] ?? source_app;
                return (
                  <li
                    key={`${date}-${source_app}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                    )}
                  >
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted flex-shrink-0">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums font-medium text-foreground">
                      {count} {count === 1 ? 'call' : 'calls'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default ImportHistoryPanel;
