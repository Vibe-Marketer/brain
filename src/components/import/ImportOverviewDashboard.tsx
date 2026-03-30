/**
 * ImportOverviewDashboard - Pane 3 default view for the Import page
 *
 * Shows per-source summary cards and recent import activity when no specific
 * source is selected in Pane 2. Follows D-05 and D-06 design specs.
 *
 * @pattern pane3-overview
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiAlertLine,
} from '@remixicon/react';
import type { ImportSource, FailedImport } from '@/services/import-sources.service';

interface SourceDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SOURCE_DEFS: SourceDef[] = [
  { id: 'fathom', label: 'Fathom', icon: RiCloudLine },
  { id: 'zoom', label: 'Zoom', icon: RiVideoLine },
  { id: 'youtube', label: 'YouTube', icon: RiYoutubeLine },
  { id: 'file-upload', label: 'File Upload', icon: RiUploadCloud2Line },
];

export interface ImportOverviewDashboardProps {
  sources: ImportSource[];
  counts: Record<string, number>;
  failedImports: FailedImport[];
  onSelectSource: (source: string) => void;
}

function deriveSourceStatus(
  sources: ImportSource[],
  sourceApp: string,
): 'connected' | 'error' | 'setup-needed' {
  if (sourceApp === 'file-upload') return 'connected';
  const row = sources.find((s) => s.source_app === sourceApp);
  if (!row) return 'setup-needed';
  if (row.error_message) return 'error';
  if (!row.is_active) return 'setup-needed';
  return 'connected';
}

export function ImportOverviewDashboard({
  sources,
  counts,
  failedImports,
  onSelectSource,
}: ImportOverviewDashboardProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Import Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your import sources and track sync activity
        </p>
      </div>

      {/* Failed imports alert */}
      {failedImports.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <RiAlertLine size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {failedImports.length} failed import
              {failedImports.length !== 1 ? 's' : ''} need attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a source from the sidebar to review and retry failed imports.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCE_DEFS.map(({ id, label, icon: Icon }) => {
            const status = deriveSourceStatus(sources, id);
            const count = counts[id] ?? 0;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectSource(id)}
                className={cn(
                  'bg-card border border-border/60 rounded-xl p-4',
                  'hover:border-border cursor-pointer transition-colors text-left',
                  'flex items-start gap-3 group',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    'bg-muted border border-border',
                    'group-hover:border-vibe-orange/20 transition-colors',
                  )}
                >
                  <Icon
                    size={16}
                    className="text-muted-foreground group-hover:text-vibe-orange transition-colors"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{label}</p>
                  {status === 'connected' ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Connected
                    </p>
                  ) : status === 'error' ? (
                    <p className="text-xs text-red-500 mt-0.5">Connection error</p>
                  ) : (
                    <p className="text-xs text-amber-500 mt-0.5">Setup needed</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {count > 0 ? `${count} call${count !== 1 ? 's' : ''} imported` : '—'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual hint */}
      <p className="text-sm text-muted-foreground">
        Select a source from the sidebar to manage imports.
      </p>
    </div>
  );
}

export default ImportOverviewDashboard;
