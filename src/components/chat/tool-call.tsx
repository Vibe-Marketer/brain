import * as React from 'react';
import { cn } from '@/lib/utils';
import { RiToolsFill, RiCheckLine, RiLoader4Line, RiErrorWarningLine, RiArrowDownSLine } from '@remixicon/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

interface ToolCallPart {
  type: string;
  toolName: string;
  toolCallId: string;
  state?: ToolCallStatus;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

interface ToolCallProps {
  toolPart: ToolCallPart;
  defaultOpen?: boolean;
  className?: string;
}

const statusConfig: Record<ToolCallStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: RiLoader4Line, color: 'text-cb-ink-muted', label: 'Pending' },
  running: { icon: RiLoader4Line, color: 'text-blue-500', label: 'Running' },
  success: { icon: RiCheckLine, color: 'text-green-500', label: 'Completed' },
  error: { icon: RiErrorWarningLine, color: 'text-red-500', label: 'Failed' },
};

export function ToolCall({ toolPart, defaultOpen = false, className }: ToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const status = toolPart.state || 'pending';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatToolName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'rounded-lg border border-cb-border-subtle bg-card overflow-hidden',
          className
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-cb-ink-subtle/5">
          <div className="flex items-center gap-2">
            <RiToolsFill className="h-4 w-4 text-cb-ink-muted" />
            <span className="text-sm font-medium text-cb-ink-primary">
              {formatToolName(toolPart.toolName)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn(
                'h-4 w-4',
                config.color,
                status === 'running' && 'animate-spin'
              )}
            />
            <RiArrowDownSLine
              className={cn(
                'h-4 w-4 text-cb-ink-muted transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-cb-border-subtle p-3 space-y-3">
            {/* Input/Args */}
            {toolPart.args && Object.keys(toolPart.args).length > 0 && (
              <div>
                <div className="text-xs font-medium text-cb-ink-muted uppercase mb-1">Input</div>
                <pre className="text-xs bg-cb-ink-subtle/5 rounded p-2 overflow-x-auto">
                  <code>{JSON.stringify(toolPart.args, null, 2)}</code>
                </pre>
              </div>
            )}

            {/* Output/Result */}
            {toolPart.result && (
              <div>
                <div className="text-xs font-medium text-cb-ink-muted uppercase mb-1">Output</div>
                <pre className="text-xs bg-cb-ink-subtle/5 rounded p-2 overflow-x-auto">
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

// Multiple tool calls in a message
interface ToolCallsProps {
  parts: ToolCallPart[];
  className?: string;
}

export function ToolCalls({ parts, className }: ToolCallsProps) {
  const toolCalls = parts.filter((p) => p.type === 'tool-call' || p.type === 'tool-result');

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
