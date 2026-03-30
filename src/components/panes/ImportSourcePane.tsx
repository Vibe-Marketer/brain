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

interface PrimarySourceDef {
  id: ImportSourceId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface SecondaryNavDef {
  id: ImportSourceId;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const PRIMARY_SOURCES: PrimarySourceDef[] = [
  { id: 'fathom', label: 'Fathom', icon: RiCloudLine },
  { id: 'zoom', label: 'Zoom', icon: RiVideoLine },
  { id: 'youtube', label: 'YouTube', icon: RiYoutubeLine },
  { id: 'file-upload', label: 'File Upload', icon: RiUploadCloud2Line },
];

const SECONDARY_NAV: SecondaryNavDef[] = [
  { id: 'routing-rules', label: 'Routing Rules', icon: RiRouteLine },
  { id: 'import-history', label: 'Import History', icon: RiHistoryLine },
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
      {/* Pane heading */}
      <p className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground mb-3 px-1">
        Import Sources
      </p>

      {/* Primary sources list */}
      <div className="flex flex-col gap-0.5">
        {sourcesLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))
          : PRIMARY_SOURCES.map(({ id, label, icon: Icon }) => {
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
                    'relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left',
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
                      'flex-shrink-0 transition-colors',
                      isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                    )}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {/* Connection status indicator */}
                  {isConnected ? (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                      aria-label="Connected"
                    />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full border border-muted-foreground/40 flex-shrink-0"
                      aria-label="Not connected"
                    />
                  )}
                </button>
              );
            })}
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 my-2" />

      {/* Secondary nav items */}
      <div className="flex flex-col gap-0.5">
        {SECONDARY_NAV.map(({ id, label, icon: Icon }) => {
          const isActive = selectedSource === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectSource(id)}
              className={cn(
                'relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left',
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
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                )}
              />
              <span className="flex-1 truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ImportSourcePane;
