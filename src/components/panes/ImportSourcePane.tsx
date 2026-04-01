/**
 * ImportSourcePane - Pane 2 navigation for the Import page
 *
 * Shows import sources (Fathom, Zoom, YouTube, File Upload) with connection
 * status indicators and secondary nav items (Routing Rules, Import History).
 *
 * @pattern secondary-pane
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiRouteLine,
  RiHistoryLine,
  RiAddLine,
} from '@remixicon/react';
import type { ImportSource } from '@/services/import-sources.service';

export type ImportSourceId =
  | 'fathom'
  | 'zoom'
  | 'youtube'
  | 'file-upload'
  | 'routing-rules'
  | 'import-history';

export interface ImportSourcePaneProps {
  selectedSource: ImportSourceId | null;
  onSelectSource: (source: ImportSourceId | null) => void;
  sources: ImportSource[];
  sourcesLoading: boolean;
}

interface SourceDef {
  id: ImportSourceId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const PRIMARY_SOURCES: SourceDef[] = [
  { id: 'fathom', label: 'Fathom', subtitle: 'AI meeting recorder', icon: RiCloudLine },
  { id: 'zoom', label: 'Zoom', subtitle: 'Video conferencing', icon: RiVideoLine },
  { id: 'youtube', label: 'YouTube', subtitle: 'Video imports', icon: RiYoutubeLine },
  { id: 'file-upload', label: 'File Upload', subtitle: 'Direct upload', icon: RiUploadCloud2Line },
];

const SECONDARY_NAV: SourceDef[] = [
  { id: 'routing-rules', label: 'Routing Rules', subtitle: 'Auto-sort incoming calls', icon: RiRouteLine },
  { id: 'import-history', label: 'Import History', subtitle: 'Review past imports', icon: RiHistoryLine },
];

function isSourceConnected(sources: ImportSource[], sourceApp: string): boolean {
  const row = sources.find((s) => s.source_app === sourceApp);
  return !!(row && row.is_active && !row.error_message);
}

export function ImportSourcePane({
  selectedSource,
  onSelectSource,
  sources,
  sourcesLoading,
}: ImportSourcePaneProps) {
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col">
      {/* Pane heading with add button */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          Import Sources
        </p>
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
          aria-label="Add integration"
        >
          <RiAddLine size={15} />
        </button>
      </div>

      {/* Primary sources list */}
      <div className="flex flex-col gap-0.5">
        {sourcesLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))
          : PRIMARY_SOURCES.map(({ id, label, subtitle, icon: Icon }) => {
              const isActive = selectedSource === id;
              const connected = id !== 'file-upload' && isSourceConnected(sources, id);
              // File upload is always available — treat as connected
              const isConnected = id === 'file-upload' ? true : connected;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectSource(id)}
                  className={cn(
                    'relative w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left',
                    'text-sm transition-colors duration-150',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {isActive && (
                    <span
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full bg-vibe-orange"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    size={15}
                    className={cn(
                      'flex-shrink-0 transition-colors mt-0.5',
                      isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  </div>
                  {/* Connection status indicator */}
                  <div className="flex-shrink-0 mt-1">
                    {isConnected ? (
                      <span
                        className="block w-2 h-2 rounded-full bg-emerald-500"
                        aria-label="Connected"
                      />
                    ) : (
                      <span
                        className="block w-2 h-2 rounded-full border border-muted-foreground/40"
                        aria-label="Not connected"
                      />
                    )}
                  </div>
                </button>
              );
            })}
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 my-2" />

      {/* Secondary nav items */}
      <div className="flex flex-col gap-0.5">
        {SECONDARY_NAV.map(({ id, label, subtitle, icon: Icon }) => {
          const isActive = selectedSource === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectSource(id)}
              className={cn(
                'relative w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left',
                'text-sm transition-colors duration-150',
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              aria-current={isActive ? 'true' : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full bg-vibe-orange"
                  aria-hidden="true"
                />
              )}
              <Icon
                size={15}
                className={cn(
                  'flex-shrink-0 transition-colors mt-0.5',
                  isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                )}
              />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ImportSourcePane;
