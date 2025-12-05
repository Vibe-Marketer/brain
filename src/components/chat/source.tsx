"use client";

import * as React from 'react';
import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
  chunk_text: string;
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
  return (
    <CallSourceContext.Provider
      value={{
        recordingId: source.recording_id,
        title: source.call_title || 'Transcript',
        onViewCall,
      }}
    >
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

  const truncatedText =
    source.chunk_text.length > 150
      ? source.chunk_text.substring(0, 150) + '...'
      : source.chunk_text;

  const handleClick = () => {
    onViewCall?.(recordingId);
  };

  return (
    <HoverCardContent className={cn('w-80 p-0 shadow-md', className)} side="top" align="start">
      <button
        onClick={handleClick}
        className="flex w-full flex-col gap-2 p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vibe-orange/20 flex-shrink-0">
            <RiMicLine className="h-3 w-3 text-vibe-orange" />
          </span>
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {source.call_title || 'Transcript'}
          </span>
          {source.similarity_score && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {Math.round(source.similarity_score * 100)}%
            </span>
          )}
        </div>

        {/* Metadata row */}
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

        {/* Content preview */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          "{truncatedText}"
        </p>

        {/* View call action */}
        <div className="flex items-center gap-1 text-xs text-primary font-medium pt-1">
          <RiPlayCircleLine className="h-3.5 w-3.5" />
          <span>View full call</span>
        </div>
      </button>
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
