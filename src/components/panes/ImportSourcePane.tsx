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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { SelectionButton } from '@/components/ui/selection-button';
import { OrganizationSwitcher } from '@/components/header/OrganizationSwitcher';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiRouteLine,
  RiHistoryLine,
  RiAddLine,
  RiDownloadLine,
  RiClipboardLine,
} from '@remixicon/react';
import type { ImportSource } from '@/services/import-sources.service';

export type ImportSourceId =
  | 'fathom'
  | 'zoom'
  | 'fireflies'
  | 'read-ai'
  | 'grain'
  | 'plaud'
  | 'youtube'
  | 'file-upload'
  | 'paste-transcript'
  | 'routing-rules'
  | 'import-history';

export interface ImportSourcePaneProps {
  selectedSource: ImportSourceId | null;
  onSelectSource: (source: ImportSourceId | null) => void;
  sources: ImportSource[];
  sourcesLoading: boolean;
  /** Phase 36-06 BUG-07: callback for the "+" Add Source button at the top of the pane */
  onAddSource?: () => void;
}

interface SourceDef {
  id: ImportSourceId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  comingSoon?: boolean;
  beta?: boolean;
}

const PRIMARY_SOURCES: SourceDef[] = [
  { id: 'fathom', label: 'Fathom', subtitle: 'AI meeting recorder', icon: RiCloudLine },
  { id: 'zoom', label: 'Zoom', subtitle: 'Cloud recordings', icon: RiVideoLine },
  { id: 'fireflies', label: 'Fireflies', subtitle: 'Transcript API import', icon: RiCloudLine },
  { id: 'read-ai', label: 'Read.ai', subtitle: 'Meeting reports', icon: RiCloudLine, beta: true },
  { id: 'grain', label: 'Grain', subtitle: 'AI meeting recordings', icon: RiCloudLine, beta: true },
  { id: 'plaud', label: 'Plaud', subtitle: 'AI voice recorder', icon: RiCloudLine, beta: true },
  { id: 'youtube', label: 'YouTube', subtitle: 'Video imports', icon: RiYoutubeLine },
  { id: 'file-upload', label: 'File Upload', subtitle: 'Direct upload', icon: RiUploadCloud2Line },
  // Phase 36-06 BUG-05: expose Paste Transcript as a first-class source entry
  { id: 'paste-transcript', label: 'Paste Transcript', subtitle: 'Manual paste / upload', icon: RiClipboardLine },
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
  onAddSource,
}: ImportSourcePaneProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header with Switcher — matches WorkspaceSidebarPane pattern */}
      <header className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiDownloadLine className="h-4 w-4 text-vibe-orange" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Imports</h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">Source Manager</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAddSource}
            disabled={!onAddSource}
            className="h-7 w-7 text-muted-foreground"
            aria-label="Add integration"
          >
            <RiAddLine size={15} />
          </Button>
        </div>

        <div className="p-2 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-1 mb-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success-bg shadow-[0_0_8px_rgba(var(--success-bg),0.5)]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Organization</span>
          </div>
          <OrganizationSwitcher />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
      {/* Primary sources list */}
      <div className="flex flex-col gap-0.5">
        {sourcesLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))
          : PRIMARY_SOURCES.map(({ id, label, subtitle, icon: Icon, comingSoon, beta }) => {
              const isActive = selectedSource === id;
              const connected = id !== 'file-upload' && isSourceConnected(sources, id);
              // File upload is always available — treat as connected
              const isConnected = id === 'file-upload' ? true : connected;

              return (
                <SelectionButton
                  key={id}
                  selected={isActive}
                  onClick={comingSoon ? undefined : () => onSelectSource(id)}
                  disabled={comingSoon}
                  className={cn(comingSoon && 'opacity-50 cursor-not-allowed')}
                  icon={
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        isActive && !comingSoon ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    />
                  }
                  label={label}
                  description={subtitle}
                  size="sm"
                  rightSlot={
                    <>
                      {beta && <StatusBadge variant="beta" />}
                      {comingSoon ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Soon
                      </span>
                      ) : isConnected ? (
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
                    </>
                  }
                  aria-current={isActive ? 'true' : undefined}
                />
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
            <SelectionButton
              key={id}
              selected={isActive}
              onClick={() => onSelectSource(id)}
              icon={
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
              }
              label={label}
              description={subtitle}
              size="sm"
              aria-current={isActive ? 'true' : undefined}
            />
          );
        })}
      </div>
      </div>

      <footer className="shrink-0 px-4 py-2" />
    </div>
  );
}

export default ImportSourcePane;
