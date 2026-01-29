"use client";

import * as React from 'react';
import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { RiMicLine, RiCalendarLine, RiUser3Line, RiPlayCircleLine } from '@remixicon/react';

// ============================================================================
// Call Source Context - Adapted from prompt-kit Source pattern
// ============================================================================

interface CallSourceContextValue {
  recordingId: number;
  title: string;
  onViewCall?: (recordingId: number) => void;
}

const CallSourceContext = createContext<CallSourceContextValue | null>(null);

function useCallSourceContext() {
  const ctx = useContext(CallSourceContext);
  if (!ctx) throw new Error('CallSource.* must be used inside <CallSource>');
  return ctx;
}

// ============================================================================
// Source Data Interface
// ============================================================================

export interface SourceData {
  id: string;
  recording_id: number;
  chunk_text?: string;
  speaker_name?: string;
  call_date?: string;
  call_title?: string;
  similarity_score?: number;
}

// ============================================================================
// CallSource - Main container (like prompt-kit Source)
// ============================================================================

export interface CallSourceProps {
  source: SourceData;
  onViewCall?: (recordingId: number) => void;
  children: React.ReactNode;
}

export function CallSource({ source, onViewCall, children }: CallSourceProps) {
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({
      recordingId: source.recording_id,
      title: source.call_title || 'Transcript',
      onViewCall,
    }),
    [source.recording_id, source.call_title, onViewCall]
  );

  return (
    <CallSourceContext.Provider value={contextValue}>
      <HoverCard openDelay={150} closeDelay={0}>
        {children}
      </HoverCard>
    </CallSourceContext.Provider>
  );
}

// ============================================================================
// CallSourceTrigger - The pill badge (like prompt-kit SourceTrigger)
// ============================================================================

export interface CallSourceTriggerProps {
  label?: string | number;
  showIcon?: boolean;
  className?: string;
}

export function CallSourceTrigger({
  label,
  showIcon = true,
  className,
}: CallSourceTriggerProps) {
  const { title, recordingId, onViewCall } = useCallSourceContext();
  const labelToShow = label ?? title;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onViewCall?.(recordingId);
  };

  return (
    <HoverCardTrigger asChild>
      <button
        onClick={handleClick}
        className={cn(
          'bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground',
          'inline-flex h-5 max-w-40 items-center gap-1 overflow-hidden rounded-full',
          'text-xs no-underline transition-colors duration-150 cursor-pointer',
          showIcon ? 'pr-2 pl-1' : 'px-2',
          className
        )}
      >
        {showIcon && (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-vibe-orange/20">
            <RiMicLine className="h-2.5 w-2.5 text-vibe-orange" />
          </span>
        )}
        <span className="truncate tabular-nums text-center font-normal">
          {labelToShow}
        </span>
      </button>
    </HoverCardTrigger>
  );
}

// ============================================================================
// CallSourceContent - The hover card content (like prompt-kit SourceContent)
// ============================================================================

export interface CallSourceContentProps {
  source: SourceData;
  className?: string;
}

export function CallSourceContent({ source, className }: CallSourceContentProps) {
  const { recordingId, onViewCall } = useCallSourceContext();

  const formattedDate = source.call_date
    ? new Date(source.call_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  // Gracefully handle missing chunk_text - degrade to showing call title info
  const hasChunkText = source.chunk_text && source.chunk_text.trim().length > 0;
  const truncatedText = hasChunkText
    ? source.chunk_text!.length > 150
      ? source.chunk_text!.substring(0, 150) + '...'
      : source.chunk_text
    : null;

  // Check if we have any metadata to display
  const hasMetadata = source.speaker_name || formattedDate;

  const handleClick = () => {
    onViewCall?.(recordingId);
  };

  return (
    <HoverCardContent className={cn('w-80 p-0 shadow-md', className)} side="top" align="start">
      <div className="flex flex-col gap-2 p-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vibe-orange/20 flex-shrink-0">
            <RiMicLine className="h-3 w-3 text-vibe-orange" />
          </span>
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {source.call_title || 'Transcript'}
          </span>
          {source.similarity_score != null && source.similarity_score > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {Math.round(source.similarity_score * 100)}%
            </span>
          )}
        </div>

        {/* Metadata row - only show if we have metadata */}
        {hasMetadata && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {source.speaker_name && (
              <div className="flex items-center gap-1">
                <RiUser3Line className="h-3 w-3" />
                <span className="truncate max-w-24">{source.speaker_name}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center gap-1">
                <RiCalendarLine className="h-3 w-3" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>
        )}

        {/* Content preview - show chunk text if available, otherwise show fallback message */}
        {truncatedText ? (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            "{truncatedText}"
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
            Click to view the full call transcript
          </p>
        )}

        {/* VIEW pill button */}
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 w-fit leading-none flex items-center gap-0.5 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={handleClick}
        >
          <RiPlayCircleLine className="h-3 w-3 flex-shrink-0" />
          VIEW
        </Badge>
      </div>
    </HoverCardContent>
  );
}

// ============================================================================
// Convenience Components - For simpler usage
// ============================================================================

// Single source citation with all parts composed
export interface SourceProps {
  source: SourceData;
  index?: number;
  onViewCall?: (recordingId: number) => void;
  className?: string;
}

export function Source({ source, index, onViewCall, className }: SourceProps) {
  const label = index !== undefined ? `${index + 1}` : undefined;

  return (
    <CallSource source={source} onViewCall={onViewCall}>
      <CallSourceTrigger label={label} className={className} />
      <CallSourceContent source={source} />
    </CallSource>
  );
}

// Sources list
export interface SourcesProps {
  sources: SourceData[];
  onViewCall?: (recordingId: number) => void;
  className?: string;
}

export function Sources({ sources, onViewCall, className }: SourcesProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">Sources:</span>
      {sources.map((source, index) => (
        <Source
          key={source.id}
          source={source}
          index={index}
          onViewCall={onViewCall}
        />
      ))}
    </div>
  );
}

// Inline citation (numbered badge for use within text)
export interface InlineCitationProps {
  index: number;
  source: SourceData;
  onViewCall?: (recordingId: number) => void;
  className?: string;
}

export function InlineCitation({ index, source, onViewCall, className }: InlineCitationProps) {
  return (
    <CallSource source={source} onViewCall={onViewCall}>
      <CallSourceTrigger label={index + 1} showIcon={false} className={className} />
      <CallSourceContent source={source} />
    </CallSource>
  );
}

// ============================================================================
// CitationMarker - Superscript inline citation for use within markdown text
// ============================================================================

export interface CitationMarkerProps {
  /** The source data for hover tooltip */
  source: SourceData;
  /** The display number (1-based) */
  index: number;
  /** Callback when clicked — opens CallDetailDialog */
  onSourceClick?: (recordingId: number) => void;
  className?: string;
}

/**
 * Renders a small superscript [N] marker inline within text.
 * Hover: shows call title + speaker + date tooltip via HoverCard.
 * Click: calls onSourceClick(recording_id) to open CallDetailDialog.
 */
export function CitationMarker({
  source,
  index,
  onSourceClick,
  className,
}: CitationMarkerProps) {
  return (
    <CallSource source={source} onViewCall={onSourceClick}>
      <HoverCardTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSourceClick?.(source.recording_id);
          }}
          className={cn(
            'inline-flex items-center justify-center',
            'text-[10px] font-semibold text-primary/80 hover:text-primary',
            'cursor-pointer transition-colors duration-150',
            'align-super leading-none',
            'px-0.5 -mx-0.5',
            'hover:bg-primary/10 rounded',
            className
          )}
          aria-label={`Citation ${index}: ${source.call_title || 'Source'}`}
        >
          [{index}]
        </button>
      </HoverCardTrigger>
      <CallSourceContent source={source} />
    </CallSource>
  );
}

// ============================================================================
// SourceList - Bottom-of-message citation list
// ============================================================================

export interface SourceListProps {
  /** Citation sources to display */
  sources: SourceData[];
  /** Display indices (1-based) matching CitationSource.index */
  indices?: number[];
  /** Callback when a source is clicked */
  onSourceClick?: (recordingId: number) => void;
  className?: string;
}

/**
 * Renders a compact source list at the bottom of an assistant message.
 * Shows:
 *   Sources
 *   [1] Call Title — Speaker — Date
 *   [2] Another Call — Speaker — Date
 *
 * Each source is clickable (opens CallDetailDialog).
 * Only renders when sources exist.
 */
export function SourceList({
  sources,
  indices,
  onSourceClick,
  className,
}: SourceListProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-muted/50 dark:bg-muted/30 rounded-lg p-3 mt-2',
        'border border-border/40',
        className
      )}
    >
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        Sources
      </div>
      <div className="space-y-1">
        {sources.map((source, i) => {
          const displayIndex = indices ? indices[i] : i + 1;
          const formattedDate = source.call_date
            ? new Date(source.call_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : undefined;

          return (
            <button
              key={source.id}
              onClick={() => onSourceClick?.(source.recording_id)}
              className={cn(
                'flex items-baseline gap-1.5 w-full text-left',
                'text-xs text-muted-foreground hover:text-foreground',
                'transition-colors duration-150 rounded px-1 -mx-1 py-0.5',
                'hover:bg-muted/80'
              )}
            >
              <span className="text-primary/70 font-semibold shrink-0 tabular-nums">
                [{displayIndex}]
              </span>
              <span className="truncate">
                {source.call_title || 'Untitled Call'}
                {source.speaker_name && (
                  <span className="text-muted-foreground/70"> — {source.speaker_name}</span>
                )}
                {formattedDate && (
                  <span className="text-muted-foreground/70"> — {formattedDate}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
