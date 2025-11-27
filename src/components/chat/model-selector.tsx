import * as React from 'react';
import { cn } from '@/lib/utils';
import { RiSparklingLine, RiArrowDownSLine } from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// AI Model Configuration
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  description?: string;
  isDefault?: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable model',
    isDefault: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and efficient',
  },
];

// Provider icons - using simple colored circles for now
// Could be replaced with actual provider logos
const ProviderIcon: React.FC<{ provider: AIModel['provider']; className?: string }> = ({
  provider,
  className,
}) => {
  const colors = {
    openai: 'bg-emerald-500',
    anthropic: 'bg-orange-500',
    google: 'bg-blue-500',
  };

  return (
    <span
      className={cn(
        'flex items-center justify-center h-4 w-4 rounded-full',
        colors[provider],
        className
      )}
    >
      <RiSparklingLine className="h-2.5 w-2.5 text-white" />
    </span>
  );
};

// ============================================================================
// ModelSelector Component
// ============================================================================

interface ModelSelectorProps {
  value?: string;
  onValueChange?: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  value,
  onValueChange,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const selectedModel = AI_MODELS.find((m) => m.id === value) || AI_MODELS.find((m) => m.isDefault) || AI_MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 h-[28px] max-w-[180px]',
            'rounded-xl border border-cb-border-soft/50',
            'bg-transparent hover:bg-cb-hover',
            'text-xs text-cb-ink-soft hover:text-cb-ink',
            'transition-all duration-150 cursor-pointer select-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <ProviderIcon provider={selectedModel.provider} />
          <span className="truncate font-medium">{selectedModel.name}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 text-cb-ink-muted flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {AI_MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onValueChange?.(model.id)}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              model.id === selectedModel.id && 'bg-cb-hover'
            )}
          >
            <ProviderIcon provider={model.provider} />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{model.name}</span>
              {model.description && (
                <span className="text-[10px] text-cb-ink-muted">{model.description}</span>
              )}
            </div>
            {model.id === selectedModel.id && (
              <span className="h-1.5 w-1.5 rounded-full bg-vibe-green flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Simple Model Display (read-only badge style)
// ============================================================================

interface ModelBadgeProps {
  modelId?: string;
  className?: string;
}

export function ModelBadge({ modelId, className }: ModelBadgeProps) {
  const model = AI_MODELS.find((m) => m.id === modelId) || AI_MODELS.find((m) => m.isDefault) || AI_MODELS[0];

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 h-[26px]',
        'rounded-xl border border-cb-border-soft/50 bg-cb-hover/50',
        'text-xs text-cb-ink-soft select-none',
        className
      )}
    >
      <ProviderIcon provider={model.provider} />
      <span className="truncate font-medium">{model.name}</span>
    </div>
  );
}
