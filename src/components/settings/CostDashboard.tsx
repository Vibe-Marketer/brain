import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RiCpuLine,
  RiStackLine,
  RiTimeLine,
  RiBarChart2Line,
} from '@remixicon/react';
import { useAICosts, CostPeriod } from '@/hooks/useAICosts';

/**
 * Format USD with appropriate precision
 */
function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Format large numbers with K/M suffix
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get display name for operation type
 */
function formatOperationType(type: string): string {
  const names: Record<string, string> = {
    chat: 'Chat',
    embedding: 'Embeddings',
    search: 'Search',
    enrichment: 'Enrichment',
  };
  return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Get short model name for display
 */
function formatModelName(model: string): string {
  // Remove provider prefix for cleaner display
  if (model.includes('/')) {
    return model.split('/')[1];
  }
  return model;
}

/**
 * CostDashboard - AI usage cost tracking dashboard
 *
 * Shows:
 * - Summary cards (total cost, requests, avg cost)
 * - Breakdown by model
 * - Breakdown by operation type
 * - Recent activity
 */
export function CostDashboard() {
  const [period, setPeriod] = useState<CostPeriod>('month');
  const cardAccentClass = 'cv-side-indicator-pill';

  const {
    totalCostUsd,
    totalRequests,
    avgCostPerRequest,
    totalTokens,
    byModel,
    byOperationType,
    recentActivity,
    isLoading,
    error,
  } = useAICosts(period);

  const periodLabels: Record<CostPeriod, string> = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'This Month',
    all: 'All Time',
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
        Failed to load cost data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">
            AI Cost Dashboard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track usage and costs across all AI operations
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as CostPeriod)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative p-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
            <div className={cardAccentClass} aria-hidden="true" />
            <div className="pl-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Cost
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {formatUsd(totalCostUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodLabels[period]}
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total Requests
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {totalRequests.toLocaleString()}
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Avg Cost/Request
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {formatUsd(avgCostPerRequest)}
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total Tokens
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {formatTokens(totalTokens)}
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* Two Column Layout for Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* By Model */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RiCpuLine className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">By Model</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : byModel.length === 0 ? (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              No usage data for this period
            </div>
          ) : (
            <div className="space-y-2">
              {byModel.map((model) => (
                <div
                  key={model.model}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <RiCpuLine className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatModelName(model.model)}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.requests} request{model.requests !== 1 ? 's' : ''} · {formatTokens(model.totalTokens)} tokens
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatUsd(model.costCents / 100)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Operation Type */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RiStackLine className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">By Feature</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : byOperationType.length === 0 ? (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              No usage data for this period
            </div>
          ) : (
            <div className="space-y-2">
              {byOperationType.map((op) => (
                <div
                  key={op.operationType}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <RiBarChart2Line className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatOperationType(op.operationType)}</p>
                      <p className="text-xs text-muted-foreground">
                        {op.requests} request{op.requests !== 1 ? 's' : ''} · {formatTokens(op.totalTokens)} tokens
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatUsd(op.costCents / 100)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <RiTimeLine className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Recent Activity</h3>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="rounded-lg border border-border dark:border-cb-border-dark overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-cb-border-dark bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Model</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Tokens</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr
                    key={activity.id}
                    className="border-b border-border dark:border-cb-border-dark last:border-0"
                  >
                    <td className="p-3">
                      <span className="font-medium">{formatModelName(activity.model)}</span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {formatOperationType(activity.operationType)}
                      </Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {formatTokens(activity.inputTokens + activity.outputTokens)}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {formatUsd(activity.costCents / 100)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatRelativeTime(activity.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CostDashboard;
