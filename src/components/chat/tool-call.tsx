import * as React from 'react';
import { cn } from '@/lib/utils';
import { RiCheckLine, RiLoader4Line, RiErrorWarningLine, RiAlertLine, RiArrowDownSLine } from '@remixicon/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended status that distinguishes empty results from true success */
type ToolCallStatus = 'pending' | 'running' | 'success' | 'empty' | 'error';

interface ToolCallPart {
  type: string;
  toolName: string;
  toolCallId: string;
  /** UI state mapped from AI SDK v5 part states in Chat.tsx */
  state?: 'pending' | 'running' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

interface ToolCallProps {
  toolPart: ToolCallPart;
  defaultOpen?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Status logic — the core fix for CHAT-02
// ---------------------------------------------------------------------------

/**
 * Determines the three-state visual status from tool part data.
 *
 * - `success`: Output available AND contains results
 * - `empty`: Output available but zero results / "could not find" / empty array
 * - `error`: Explicit error state or error in output
 * - `running`: Tool is actively executing (input-streaming mapped to 'running')
 * - `pending`: Waiting to start
 */
function getToolStatus(toolPart: ToolCallPart): ToolCallStatus {
  // Explicit error from AI SDK
  if (toolPart.state === 'error') return 'error';
  if (toolPart.error) return 'error';

  // Still running
  if (toolPart.state === 'running') return 'running';

  // Pending (not started yet)
  if (!toolPart.state || toolPart.state === 'pending') return 'pending';

  // Has output (state === 'success' means output-available in Chat.tsx mapping)
  if (toolPart.state === 'success') {
    const result = toolPart.result;

    // No result object at all
    if (!result) return 'empty';

    // Explicit error in result payload
    if (result.error) return 'error';

    // "Could not find" / "no results" messages from backend
    const message = typeof result.message === 'string' ? result.message.toLowerCase() : '';
    if (message.includes('could not find') || message.includes('no results') || message.includes('not found')) {
      return 'empty';
    }

    // Empty results array
    if (Array.isArray(result.results) && result.results.length === 0) return 'empty';

    // Explicit zero count
    if (typeof result.count === 'number' && result.count === 0) return 'empty';

    // Top-level array result (some tools return arrays directly)
    if (Array.isArray(result) && (result as unknown[]).length === 0) return 'empty';

    // If we have a results array with items → success
    if (Array.isArray(result.results) && result.results.length > 0) return 'success';

    // If we have a count > 0 → success
    if (typeof result.count === 'number' && result.count > 0) return 'success';

    // Default: has output, assume success (single-object returns like getCallDetails)
    return 'success';
  }

  return 'pending';
}

/**
 * Extracts a human-readable result count from tool output.
 * Returns null when count is not determinable.
 */
function getResultCount(toolPart: ToolCallPart): number | null {
  const result = toolPart.result;
  if (!result) return null;

  // Explicit results array
  if (Array.isArray(result.results)) return result.results.length;

  // Explicit count field
  if (typeof result.count === 'number') return result.count;

  // Calls array (getCallsList, compareCalls)
  if (Array.isArray(result.calls)) return (result.calls as unknown[]).length;

  // Top-level array
  if (Array.isArray(result)) return (result as unknown[]).length;

  return null;
}

// ---------------------------------------------------------------------------
// Tool name formatting
// ---------------------------------------------------------------------------

/** Known tool name → past-tense human label */
const TOOL_LABELS: Record<string, string> = {
  searchTranscriptsByQuery: 'Searched Transcripts',
  searchBySpeaker: 'Searched By Speaker',
  searchByDateRange: 'Searched By Date Range',
  searchByCategory: 'Searched By Category',
  searchByIntentSignal: 'Searched By Intent Signal',
  searchBySentiment: 'Searched By Sentiment',
  searchByTopics: 'Searched By Topics',
  searchByUserTags: 'Searched By User Tags',
  searchByEntity: 'Searched By Entity',
  getCallDetails: 'Got Call Details',
  getCallsList: 'Got Calls List',
  getAvailableMetadata: 'Got Available Metadata',
  advancedSearch: 'Advanced Search',
  compareCalls: 'Compared Calls',
};

/**
 * Converts a camelCase tool name to a human-readable label.
 * Uses the known-labels map first, then falls back to splitting camelCase.
 */
function formatToolName(name: string | undefined): string {
  if (!name) return 'Tool';
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];

  // Fallback: split camelCase → Title Case
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const statusConfig: Record<ToolCallStatus, { icon: React.ElementType; color: string; labelColor: string }> = {
  pending:  { icon: RiLoader4Line,      color: 'text-ink-muted',  labelColor: 'text-ink-muted' },
  running:  { icon: RiLoader4Line,      color: 'text-blue-500',   labelColor: 'text-blue-500' },
  success:  { icon: RiCheckLine,        color: 'text-green-500',  labelColor: 'text-green-600 dark:text-green-400' },
  empty:    { icon: RiAlertLine,        color: 'text-amber-500',  labelColor: 'text-amber-600 dark:text-amber-400' },
  error:    { icon: RiErrorWarningLine, color: 'text-red-500',    labelColor: 'text-red-600 dark:text-red-400' },
};

// ---------------------------------------------------------------------------
// Streaming query extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a short query preview from tool args for display while running.
 * Shows the first string arg value (usually the search query).
 */
function getStreamingQuery(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;

  // Priority: 'query' → 'search_query' → 'name' → 'speaker' → first string value
  for (const key of ['query', 'search_query', 'name', 'speaker', 'category', 'topic', 'entity', 'tag', 'signal', 'sentiment']) {
    const val = args[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }

  // Fallback: first short string value
  for (const val of Object.values(args)) {
    if (typeof val === 'string' && val.trim() && val.length < 100) return val.trim();
  }

  return null;
}

// ---------------------------------------------------------------------------
// Status label builder
// ---------------------------------------------------------------------------

function getStatusLabel(status: ToolCallStatus, toolPart: ToolCallPart): string {
  switch (status) {
    case 'pending':
      return '';
    case 'running': {
      const query = getStreamingQuery(toolPart.args);
      return query ? `'${query}'` : '';
    }
    case 'success': {
      const count = getResultCount(toolPart);
      if (count !== null) return `${count} result${count !== 1 ? 's' : ''}`;
      return 'Done';
    }
    case 'empty': {
      return '0 results';
    }
    case 'error': {
      return 'Failed';
    }
  }
}

// ---------------------------------------------------------------------------
// ToolCall component
// ---------------------------------------------------------------------------

export function ToolCall({ toolPart, defaultOpen = false, className }: ToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const status = getToolStatus(toolPart);
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const label = getStatusLabel(status, toolPart);
  const toolLabel = formatToolName(toolPart.toolName);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        data-testid="tool-call"
        data-tool-status={status}
        data-tool-name={toolPart.toolName}
        className={cn(
          'rounded-lg border border-soft bg-card overflow-hidden',
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-hover">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                config.color,
                (status === 'running' || status === 'pending') && 'animate-spin'
              )}
            />
            <span className="text-sm font-medium text-ink truncate">
              {toolLabel}
            </span>
            {label && (
              <>
                {status === 'running' ? (
                  <span className="text-xs text-blue-500 truncate">
                    {label}
                  </span>
                ) : status === 'error' ? (
                  <span className={cn('text-xs font-medium', config.labelColor)}>
                    — {label}
                  </span>
                ) : (
                  <span className={cn('text-xs', config.labelColor)}>
                    ({label})
                  </span>
                )}
              </>
            )}
          </div>
          <RiArrowDownSLine
            className={cn(
              'h-4 w-4 text-ink-muted transition-transform flex-shrink-0',
              isOpen && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-soft p-3 space-y-3">
            {/* Input/Args */}
            {toolPart.args && Object.keys(toolPart.args).length > 0 && (
              <div>
                <div className="text-xs font-medium text-ink-muted uppercase mb-1">Input</div>
                <pre className="text-xs bg-hover rounded p-2 overflow-x-auto max-h-40">
                  <code>{JSON.stringify(toolPart.args, null, 2)}</code>
                </pre>
              </div>
            )}

            {/* Output/Result */}
            {toolPart.result && (
              <div>
                <div className="text-xs font-medium text-ink-muted uppercase mb-1">Output</div>
                <pre className="text-xs bg-hover rounded p-2 overflow-x-auto max-h-60">
                  <code>{JSON.stringify(toolPart.result, null, 2)}</code>
                </pre>
              </div>
            )}

            {/* Error */}
            {toolPart.error && (
              <div>
                <div className="text-xs font-medium text-red-500 uppercase mb-1">Error</div>
                <pre className="text-xs bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded p-2 overflow-x-auto">
                  <code>{toolPart.error}</code>
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// ToolCalls list component
// ---------------------------------------------------------------------------

interface ToolCallsProps {
  parts: ToolCallPart[];
  className?: string;
}

export function ToolCalls({ parts, className }: ToolCallsProps) {
  // Defensive guard: ensure parts is a valid array before filtering
  if (!parts || !Array.isArray(parts)) {
    return null;
  }

  const toolCalls = parts.filter((p) => p && (p.type === 'tool-call' || p.type === 'tool-result'));

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {toolCalls.map((part) => (
        <ToolCall key={part.toolCallId} toolPart={part} />
      ))}
    </div>
  );
}
