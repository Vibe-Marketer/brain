/**
 * ImportSourcePane (2nd Pane)
 *
 * Displays the list of import sources for multi-pane navigation.
 * Matches the SettingsCategoryPane style exactly.
 *
 * @pattern import-source-pane
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  RiCloudLine,
  RiVideoLine,
  RiYoutubeLine,
  RiUploadCloud2Line,
  RiRouteLine,
  RiDownloadCloud2Line,
} from '@remixicon/react';

export type ImportSourceId = 'fathom' | 'zoom' | 'youtube' | 'upload' | 'rules';
type ConnectionStatus = 'active' | 'paused' | 'error' | 'disconnected';

interface SourceItem {
  id: ImportSourceId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: ConnectionStatus;
}

function statusDescription(status: ConnectionStatus): string {
  switch (status) {
    case 'active':   return 'Connected';
    case 'paused':   return 'Paused';
    case 'error':    return 'Connection error';
    case 'disconnected': return 'Not connected';
  }
}

interface ImportSourcePaneProps {
  selectedSource: ImportSourceId | null;
  onSelectSource: (source: ImportSourceId) => void;
  fathomStatus: ConnectionStatus;
  zoomStatus: ConnectionStatus;
  showZoom: boolean;
}

export function ImportSourcePane({
  selectedSource,
  onSelectSource,
  fathomStatus,
  zoomStatus,
  showZoom,
}: ImportSourcePaneProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const connectorSources: SourceItem[] = [
    {
      id: 'fathom',
      label: 'Fathom',
      description: statusDescription(fathomStatus),
      icon: RiCloudLine,
      status: fathomStatus,
    },
    ...(showZoom
      ? [{
          id: 'zoom' as ImportSourceId,
          label: 'Zoom',
          description: statusDescription(zoomStatus),
          icon: RiVideoLine,
          status: zoomStatus,
        }]
      : []),
  ];

  const manualSources: SourceItem[] = [
    {
      id: 'youtube',
      label: 'YouTube',
      description: 'Import from YouTube URL',
      icon: RiYoutubeLine,
    },
    {
      id: 'upload',
      label: 'File Upload',
      description: 'Upload audio or video file',
      icon: RiUploadCloud2Line,
    },
  ];

  const otherSources: SourceItem[] = [
    {
      id: 'rules',
      label: 'Routing Rules',
      description: 'Auto-tag and sort calls',
      icon: RiRouteLine,
    },
  ];

  const renderItem = (item: SourceItem) => {
    const isActive = selectedSource === item.id;
    const IconComponent = item.icon;

    // Status dot color for connector sources
    const dotClass = item.status === 'active'
      ? 'bg-green-500'
      : item.status === 'paused'
        ? 'bg-amber-500'
        : item.status === 'error'
          ? 'bg-red-500'
          : item.status === 'disconnected'
            ? 'bg-muted-foreground/40'
            : undefined;

    return (
      <div key={item.id} role="listitem" className="relative mb-1">
        <button
          type="button"
          onClick={() => onSelectSource(item.id)}
          className={cn(
            'relative w-full flex items-start gap-3 px-3 py-3 rounded-lg',
            'text-left transition-all duration-150 ease-in-out',
            'hover:bg-hover/70',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            isActive && [
              'bg-hover',
              'border-l-0 pl-4',
              "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
            ]
          )}
          aria-current={isActive ? 'true' : undefined}
        >
          {/* Icon box */}
          <div
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
              'bg-cb-card border border-border',
              'transition-all duration-500 ease-in-out',
              isActive && 'bg-muted dark:bg-white/10'
            )}
            aria-hidden="true"
          >
            <IconComponent
              className={cn(
                'h-4 w-4 transition-colors duration-500 ease-in-out',
                isActive ? 'text-ink dark:text-white' : 'text-ink-muted'
              )}
            />
          </div>

          {/* Label + description */}
          <div className="flex-1 min-w-0 pt-0.5">
            <span
              className={cn(
                'block text-sm font-medium truncate',
                'transition-colors duration-500 ease-in-out',
                isActive ? 'text-ink dark:text-white' : 'text-ink'
              )}
            >
              {item.label}
            </span>
            <span className="block text-xs text-ink-muted truncate">
              {item.description}
            </span>
          </div>

          {/* Status dot (connectors only) */}
          {dotClass && (
            <div
              className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-2', dotClass)}
              aria-hidden="true"
            />
          )}

          {/* Arrow indicator */}
          <div
            className={cn(
              'flex-shrink-0 mt-1.5',
              'transition-all duration-500 ease-in-out',
              isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1',
              dotClass && 'hidden' // hide arrow when status dot is shown
            )}
            aria-hidden="true"
          >
            <svg className="h-4 w-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        'transition-all duration-500 ease-in-out',
        isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
      )}
      role="navigation"
      aria-label="Import sources"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
          aria-hidden="true"
        >
          <RiDownloadCloud2Line className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
            Import
          </h2>
          <p className="text-xs text-ink-muted">Connect &amp; sync sources</p>
        </div>
      </header>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto py-2 px-2" role="list">
        {/* Connectors */}
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted/60">
          Connectors
        </p>
        {connectorSources.map(renderItem)}

        {/* Divider */}
        <div className="mx-2 my-2 border-t border-border/50" />

        {/* Manual */}
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted/60">
          Manual
        </p>
        {manualSources.map(renderItem)}

        {/* Divider */}
        <div className="mx-2 my-2 border-t border-border/50" />

        {/* Other */}
        {otherSources.map(renderItem)}
      </div>
    </div>
  );
}

export default ImportSourcePane;
