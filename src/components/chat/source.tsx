import * as React from 'react';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { RiFileTextLine, RiExternalLinkLine, RiCalendarLine, RiUser3Line } from '@remixicon/react';

interface Source {
  id: string;
  recording_id: number;
  chunk_text: string;
  speaker_name?: string;
  call_date?: string;
  call_title?: string;
  similarity_score?: number;
}

interface SourceTriggerProps {
  label?: string;
  index?: number;
  className?: string;
}

interface SourceContentProps {
  title?: string;
  description?: string;
  speakerName?: string;
  callDate?: string;
  similarity?: number;
  className?: string;
}

interface SourceProps {
  source: Source;
  index?: number;
  onViewCall?: (recordingId: number) => void;
  className?: string;
}

// Individual source citation
export function Source({ source, index, onViewCall, className }: SourceProps) {
  const formattedDate = source.call_date
    ? new Date(source.call_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined;

  const truncatedText =
    source.chunk_text.length > 200
      ? source.chunk_text.substring(0, 200) + '...'
      : source.chunk_text;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
            'bg-vibe-green/10 text-cb-ink hover:bg-vibe-green/20',
            'text-xs font-medium transition-colors',
            className
          )}
        >
          <RiFileTextLine className="h-3 w-3" />
          <span>{index !== undefined ? `[${index + 1}]` : source.call_title || 'Source'}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 p-0"
        side="top"
        align="start"
      >
        <div className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-cb-ink line-clamp-1">
              {source.call_title || 'Transcript'}
            </h4>
            {source.similarity_score && (
              <span className="text-xs text-cb-ink-muted">
                {Math.round(source.similarity_score * 100)}% match
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-cb-ink-muted">
            {source.speaker_name && (
              <div className="flex items-center gap-1">
                <RiUser3Line className="h-3 w-3" />
                <span>{source.speaker_name}</span>
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
          <p className="text-xs text-cb-ink-soft leading-relaxed">
            "{truncatedText}"
          </p>

          {/* Action */}
          {onViewCall && (
            <button
              onClick={() => onViewCall(source.recording_id)}
              className="flex items-center gap-1 text-xs text-cb-ink hover:underline"
            >
              <RiExternalLinkLine className="h-3 w-3" />
              View full call
            </button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Sources list
interface SourcesProps {
  sources: Source[];
  onViewCall?: (recordingId: number) => void;
  className?: string;
}

export function Sources({ sources, onViewCall, className }: SourcesProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-xs text-cb-ink-muted">Sources:</span>
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

// Inline citation (for use within markdown)
interface InlineCitationProps {
  index: number;
  onClick?: () => void;
  className?: string;
}

export function InlineCitation({ index, onClick, className }: InlineCitationProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'h-4 min-w-4 rounded-sm px-1',
        'bg-vibe-green/20 text-cb-ink',
        'text-[10px] font-medium',
        'hover:bg-vibe-green/30 transition-colors',
        className
      )}
    >
      {index + 1}
    </button>
  );
}
