import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Markdown } from './markdown';
import { SaveContentButton } from '@/components/content-library/SaveContentButton';
import { CitationMarker } from './source';
import type { ContentMetadata } from '@/types/content-library';
import type { SourceData } from './source';

// ============================================================================
// Citation Types & Parsing
// ============================================================================

/**
 * A citation source extracted from tool results, with a sequential display index.
 */
export interface CitationSource {
  /** Display number [1], [2], etc. */
  index: number;
  /** Unique recording identifier */
  recording_id: number;
  /** Call title for display */
  call_title: string;
  /** Call date for display */
  call_date: string;
  /** Speaker name (optional) */
  speaker?: string;
  /** Brief text excerpt from cited chunk */
  text_snippet?: string;
}

/**
 * A tool result part containing search results with recording metadata.
 */
interface ToolResultPart {
  type: string;
  result?: Record<string, unknown> & {
    results?: Array<{
      recording_id: number;
      text: string;
      speaker: string;
      call_date: string;
      call_title: string;
      relevance: string;
    }>;
    calls?: Array<{
      recording_id: number;
      title: string;
      date?: string;
      created_at?: string;
      recorded_by?: string;
      summary_preview?: string;
      summary?: string;
    }>;
    recording_id?: number;
    title?: string;
    date?: string;
    recorded_by?: string;
    summary?: string;
    error?: string;
  };
}

/**
 * Extract unique citation sources from message tool result parts.
 * Assigns sequential [1], [2], [3] indices to each unique recording_id.
 */
export function extractSourcesFromParts(parts: ToolResultPart[]): CitationSource[] {
  const seen = new Map<number, CitationSource>();
  let nextIndex = 1;

  for (const part of parts) {
    if (!part.result) continue;

    // Handle search results (most tools)
    if (part.result.results && Array.isArray(part.result.results)) {
      for (const r of part.result.results) {
        if (!seen.has(r.recording_id)) {
          seen.set(r.recording_id, {
            index: nextIndex++,
            recording_id: r.recording_id,
            call_title: r.call_title,
            call_date: r.call_date,
            speaker: r.speaker,
            text_snippet: r.text?.slice(0, 120),
          });
        }
      }
    }

    // Handle getCallsList / compareCalls results
    if (part.result.calls && Array.isArray(part.result.calls)) {
      for (const c of part.result.calls) {
        if (!seen.has(c.recording_id)) {
          seen.set(c.recording_id, {
            index: nextIndex++,
            recording_id: c.recording_id,
            call_title: c.title,
            call_date: c.date || c.created_at || '',
            speaker: c.recorded_by,
            text_snippet: (c.summary_preview || c.summary || '').slice(0, 120),
          });
        }
      }
    }

    // Handle getCallDetails single result
    if (
      part.result.recording_id &&
      part.result.title &&
      !part.result.error
    ) {
      const rid = part.result.recording_id as number;
      if (!seen.has(rid)) {
        seen.set(rid, {
          index: nextIndex++,
          recording_id: rid,
          call_title: part.result.title as string,
          call_date: (part.result.date as string) || '',
          speaker: part.result.recorded_by as string | undefined,
          text_snippet: ((part.result.summary as string) || '').slice(0, 120),
        });
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Convert CitationSource[] to SourceData[] for use with source.tsx components.
 */
export function citationSourcesToSourceData(
  sources: CitationSource[],
  messageId: string
): SourceData[] {
  return sources.map((s) => ({
    id: `${messageId}-citation-${s.index}`,
    recording_id: s.recording_id,
    call_title: s.call_title,
    call_date: s.call_date,
    speaker_name: s.speaker,
    chunk_text: s.text_snippet,
  }));
}

// Regex to match citation markers [N] where N is 1-99
const CITATION_REGEX = /\[(\d{1,2})\]/g;

/**
 * Check if a text string contains citation markers like [1], [2], etc.
 */
export function hasCitationMarkers(text: string): boolean {
  return CITATION_REGEX.test(text);
}

/**
 * Parse text containing [N] citation markers into an array of segments.
 * Each segment is either a text string or a citation reference { index: number }.
 */
export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'citation'; index: number };

export function parseCitations(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  const regex = /\[(\d{1,2})\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // Add citation marker
    segments.push({ type: 'citation', index: parseInt(match[1], 10) });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Strip the bottom "sources list" section from model output text.
 * The model outputs a section like:
 *   [1] Call Title (Speaker, Date)
 *   [2] Another Call (Speaker, Date)
 * at the end. We strip this since we render our own SourceList component.
 */
export function stripSourcesList(text: string): string {
  // Match a trailing sources section: lines starting with [N] at the end of the text
  // Look for patterns like:
  //   \n[1] Title (Speaker, Date)\n[2] Title...
  //   or with a "Sources:" header
  const sourcesPattern = /\n*(?:(?:Sources?|References?):?\s*\n)?(?:\s*\[\d+\]\s+.+\n?){1,}/;
  
  // Only strip if it appears near the end (within last 30% of text or last 500 chars)
  const threshold = Math.max(text.length * 0.7, text.length - 500);
  const match = sourcesPattern.exec(text);
  
  if (match && match.index >= threshold) {
    return text.slice(0, match.index).trimEnd();
  }
  
  return text;
}

// Message container
interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Message({ children, className, ...props }: MessageProps) {
  return (
    <div className={cn('group flex gap-3 py-4', className)} {...props}>
      {children}
    </div>
  );
}

// Message avatar
interface MessageAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  delayMs?: number;
  className?: string;
}

export function MessageAvatar({ src, alt, fallback, delayMs, className }: MessageAvatarProps) {
  return (
    <Avatar className={cn('h-8 w-8 shrink-0', className)}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
    </Avatar>
  );
}

// Message content
interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  markdown?: boolean;
  /**
   * Callback when a "View Details" link in markdown is clicked.
   */
  onViewCall?: (recordingId: number) => void;
}

export function MessageContent({ children, markdown = false, onViewCall, className, ...props }: MessageContentProps) {
  if (markdown && typeof children === 'string') {
    return (
      <div className={cn('flex-1 space-y-2 overflow-hidden', className)} {...props}>
        <Markdown
          className="prose prose-sm dark:prose-invert max-w-none font-sans font-light text-ink"
          onViewCall={onViewCall}
        >
          {children}
        </Markdown>
      </div>
    );
  }

  return (
    <div
      className={cn('flex-1 space-y-2 overflow-hidden font-sans font-light text-ink', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Message actions (copy, regenerate, etc.)
interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function MessageActions({ children, className, ...props }: MessageActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Single message action with tooltip
interface MessageActionProps {
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function MessageAction({ tooltip, children, side = 'top', className }: MessageActionProps) {
  if (!tooltip) {
    return <span className={className}>{children}</span>;
  }

  // Note: TooltipProvider is at the app level in App.tsx, no need to wrap here
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// User message variant - iMessage blue style (exact match with Transcript Conversation View)
interface UserMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function UserMessage({ children, className }: UserMessageProps) {
  return (
    <div className={cn('flex justify-end py-3', className)}>
      <div className="max-w-[70%] flex flex-col items-end gap-1">
        <div className="rounded-[18px] rounded-br-[4px] bg-[#007AFF] dark:bg-[#0A84FF] px-4 py-2 text-white">
          <p className="text-[15px] leading-[20px]">{children}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Markdown with Inline Citations
// ============================================================================

/**
 * Renders markdown text with inline [N] citation markers replaced by
 * interactive CitationMarker components.
 *
 * Strategy: We use react-markdown's `components` prop to override text-containing
 * elements (p, li, td, strong, em) with versions that scan their string children
 * for [N] patterns and inject CitationMarker components inline.
 */
function MarkdownWithCitations({
  text,
  citations,
  onCitationClick,
  onViewCall,
  className,
}: {
  text: string;
  citations: CitationSource[];
  onCitationClick?: (recordingId: number) => void;
  onViewCall?: (recordingId: number) => void;
  className?: string;
}) {
  // Build a lookup from index → CitationSource
  const citationMap = React.useMemo(() => {
    const map = new Map<number, CitationSource>();
    for (const c of citations) {
      map.set(c.index, c);
    }
    return map;
  }, [citations]);

  // Convert CitationSource to SourceData for CitationMarker
  const toSourceData = React.useCallback(
    (source: CitationSource): SourceData => ({
      id: `citation-${source.index}`,
      recording_id: source.recording_id,
      call_title: source.call_title,
      call_date: source.call_date,
      speaker_name: source.speaker,
      chunk_text: source.text_snippet,
    }),
    []
  );

  // Process React children: replace [N] in string children with CitationMarker components
  const processChildren = React.useCallback(
    (children: React.ReactNode): React.ReactNode => {
      return React.Children.map(children, (child) => {
        if (typeof child !== 'string') return child;

        const segments = parseCitations(child);
        if (segments.length === 1 && segments[0].type === 'text') {
          return child; // No citations found, return as-is
        }

        return segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <React.Fragment key={i}>{seg.content}</React.Fragment>;
          }
          const source = citationMap.get(seg.index);
          if (!source) {
            // No matching source, render as plain text
            return <React.Fragment key={i}>[{seg.index}]</React.Fragment>;
          }
          return (
            <CitationMarker
              key={`cite-${seg.index}-${i}`}
              source={toSourceData(source)}
              index={source.index}
              onSourceClick={onCitationClick}
            />
          );
        });
      });
    },
    [citationMap, onCitationClick, toSourceData]
  );

  // Custom Markdown component overrides that process children for citations
  const citationComponents = React.useMemo(
    () => ({
      p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { children?: React.ReactNode }) => (
        <p className="my-2 leading-relaxed" {...props}>
          {processChildren(children)}
        </p>
      ),
      li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement> & { children?: React.ReactNode }) => (
        <li {...props}>{processChildren(children)}</li>
      ),
      td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children?: React.ReactNode }) => (
        <td className="border-b border-cb-border-subtle px-4 py-2" {...props}>
          {processChildren(children)}
        </td>
      ),
      strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
        <strong className="font-medium text-ink" {...props}>
          {processChildren(children)}
        </strong>
      ),
      em: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
        <em {...props}>{processChildren(children)}</em>
      ),
    }),
    [processChildren]
  );

  // Strip the model's source list from the bottom (we render our own SourceList)
  const cleanedText = React.useMemo(
    () => stripSourcesList(text),
    [text]
  );

  return (
    <Markdown
      className={className}
      components={citationComponents}
      onViewCall={onViewCall}
    >
      {cleanedText}
    </Markdown>
  );
}

// ============================================================================
// Assistant Message
// ============================================================================

// Assistant message variant - gray bubble style (exact match with Transcript Conversation View)
interface AssistantMessageProps {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
  isLoading?: boolean;
  /**
   * Citation sources extracted from tool results.
   * When provided, [N] markers in text are rendered as interactive citations.
   */
  citations?: CitationSource[];
  /**
   * Callback when a citation is clicked. Opens CallDetailDialog.
   */
  onCitationClick?: (recordingId: number) => void;
  /**
   * Callback when a "View Details" link in markdown is clicked.
   * Opens CallDetailDialog for the specified recording.
   */
  onViewCall?: (recordingId: number) => void;
  /**
   * Enable save to library button for this message.
   * When true, a save button appears on hover.
   */
  showSaveButton?: boolean;
  /**
   * Optional metadata to attach when saving to library.
   */
  saveMetadata?: ContentMetadata;
  /**
   * Callback after content is saved.
   */
  onSaved?: () => void;
}

export function AssistantMessage({
  children,
  markdown = true,
  className,
  isLoading,
  citations,
  onCitationClick,
  onViewCall,
  showSaveButton = false,
  saveMetadata,
  onSaved,
}: AssistantMessageProps) {
  // Get the text content for saving
  const textContent = typeof children === 'string' ? children : '';
  const canSave = showSaveButton && !isLoading && textContent.length > 0;
  const hasCitations = citations && citations.length > 0 && typeof children === 'string';

  return (
    <div className={cn('flex justify-start py-3 group/message', className)}>
      <div className="max-w-[70%] flex flex-col items-start gap-1">
        <div className="relative">
          <div className="rounded-[18px] rounded-bl-[4px] bg-hover dark:bg-cb-panel-dark px-4 py-2 text-ink">
            {isLoading ? (
              <div className="flex items-center gap-1 py-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cb-ink-muted" />
              </div>
            ) : hasCitations ? (
              <MarkdownWithCitations
                text={children as string}
                citations={citations!}
                onCitationClick={onCitationClick}
                onViewCall={onViewCall}
                className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[20px]"
              />
            ) : markdown && typeof children === 'string' ? (
              <Markdown
                className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[20px]"
                onViewCall={onViewCall}
              >
                {children}
              </Markdown>
            ) : (
              <div className="text-[15px] leading-[20px]">
                {children}
              </div>
            )}
          </div>
          {/* Save button - appears on hover */}
          {canSave && (
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity">
              <SaveContentButton
                content={textContent}
                metadata={saveMetadata}
                variant="ghost"
                size="icon-sm"
                onSaved={onSaved}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
