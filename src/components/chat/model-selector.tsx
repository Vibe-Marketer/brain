import * as React from 'react';
import { cn } from '@/lib/utils';
import { RiSparklingLine, RiArrowDownSLine, RiLoader4Line } from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// AI Model Types
// ============================================================================

export interface AIModel {
  id: string; // Format: 'provider/model-name' (e.g., 'openai/gpt-4o')
  name: string;
  provider: string;
  providerDisplayName?: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  isFeatured?: boolean;
}

interface AvailableModelsResponse {
  models: AIModel[];
  providers: string[];
  providerDisplayNames?: Record<string, string>;
  defaultModel: string | null;
  hasOpenRouter: boolean;
  totalCount?: number;
  error?: string;
}

// ============================================================================
// Hook to fetch available models from OpenRouter
// ============================================================================

export function useAvailableModels() {
  const { session } = useAuth();
  const [models, setModels] = React.useState<AIModel[]>([]);
  const [providers, setProviders] = React.useState<string[]>([]);
  const [providerDisplayNames, setProviderDisplayNames] = React.useState<Record<string, string>>({});
  const [defaultModel, setDefaultModel] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchModels() {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-available-models`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data: AvailableModelsResponse = await response.json();

        if (data.error && data.models.length === 0) {
          setError(data.error);
        } else {
          setModels(data.models);
          setProviders(data.providers);
          setProviderDisplayNames(data.providerDisplayNames || {});
          setDefaultModel(data.defaultModel);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching available models:', err);
        setError(err instanceof Error ? err.message : 'Failed to load models');
        // Set fallback models
        setModels([
          { id: 'z-ai/glm-4.6', name: 'GLM-4.6', provider: 'z-ai' },
          { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
        ]);
        setDefaultModel('z-ai/glm-4.6');
      } finally {
        setIsLoading(false);
      }
    }

    fetchModels();
  }, [session?.access_token]);

  return { models, providers, providerDisplayNames, defaultModel, isLoading, error };
}

// ============================================================================
// Provider Colors
// ============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  'z-ai': 'bg-violet-600',
  openai: 'bg-emerald-500',
  anthropic: 'bg-orange-500',
  google: 'bg-blue-500',
  groq: 'bg-amber-500',
  xai: 'bg-slate-700',
  mistralai: 'bg-indigo-500',
  mistral: 'bg-indigo-500',
  perplexity: 'bg-teal-500',
  'meta-llama': 'bg-blue-600',
  meta: 'bg-blue-600',
  cohere: 'bg-rose-500',
  deepseek: 'bg-cyan-500',
  qwen: 'bg-purple-500',
  nvidia: 'bg-lime-600',
  microsoft: 'bg-sky-500',
  togetherai: 'bg-purple-500',
  fireworks: 'bg-red-500',
  default: 'bg-gray-500',
};

const ProviderIcon: React.FC<{ provider: string; className?: string }> = ({
  provider,
  className,
}) => {
  const color = PROVIDER_COLORS[provider.toLowerCase()] || PROVIDER_COLORS.default;

  return (
    <span
      className={cn(
        'flex items-center justify-center h-4 w-4 rounded-full',
        color,
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
  const { models, providers, providerDisplayNames, defaultModel, isLoading, error } = useAvailableModels();

  // Find selected model or use default
  const selectedModel = React.useMemo(() => {
    if (!models.length) return null;
    return models.find((m) => m.id === value)
      || models.find((m) => m.id === defaultModel)
      || models[0];
  }, [models, value, defaultModel]);

  // Group models by provider
  const modelsByProvider = React.useMemo(() => {
    const grouped: Record<string, AIModel[]> = {};
    for (const model of models) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    }
    return grouped;
  }, [models]);

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 h-[28px]',
        'rounded-xl border border-cb-border-soft/50',
        'bg-transparent text-xs text-cb-ink-muted',
        className
      )}>
        <RiLoader4Line className="h-3.5 w-3.5 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!selectedModel) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 h-[28px]',
        'rounded-xl border border-cb-border-soft/50',
        'bg-transparent text-xs text-cb-ink-muted',
        className
      )}>
        <span>{error || 'No models available'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 h-[28px] max-w-[200px]',
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
      <DropdownMenuContent align="start" className="w-[240px] max-h-[400px] overflow-y-auto">
        {providers.map((provider, idx) => (
          <React.Fragment key={provider}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2 text-[10px] uppercase text-cb-ink-muted">
              <ProviderIcon provider={provider} className="h-3 w-3" />
              {providerDisplayNames[provider] || provider}
            </DropdownMenuLabel>
            {modelsByProvider[provider]?.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => onValueChange?.(model.id)}
                className={cn(
                  'flex items-center justify-between gap-2 cursor-pointer ml-2',
                  model.id === selectedModel.id && 'bg-cb-hover'
                )}
              >
                <span className="text-sm font-medium truncate">{model.name}</span>
                {model.id === selectedModel.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-vibe-green flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
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
  const { models, defaultModel } = useAvailableModels();

  const model = React.useMemo(() => {
    if (!models.length) return null;
    return models.find((m) => m.id === modelId)
      || models.find((m) => m.id === defaultModel)
      || models[0];
  }, [models, modelId, defaultModel]);

  if (!model) {
    return null;
  }

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
