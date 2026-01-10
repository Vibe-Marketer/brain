import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RiBankCardLine, RiSparkling2Line, RiCpuLine } from "@remixicon/react";
import { BarChart } from "@tremor/react";
import { useEmbeddingCosts } from "@/hooks/useEmbeddingCosts";

/**
 * Format USD with appropriate precision
 * Shows more decimals for small amounts
 */
function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
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

export default function BillingTab() {
  const {
    totalCostUsd,
    totalTokens,
    avgCostPerTranscript,
    totalTranscripts,
    monthlyTrends,
    costByOperationType,
    isLoading,
    error,
  } = useEmbeddingCosts(6);

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Embedding Costs Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            AI Usage
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Embedding and search costs for your transcripts
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
              <RiCpuLine className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-semibold">Embedding Costs</h3>
                <Badge variant="outline">OpenAI</Badge>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                  <Skeleton className="h-48" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                  Failed to load usage data: {error.message}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Cost Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Total Cost
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {formatUsd(totalCostUsd)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Avg per Transcript
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {formatUsd(avgCostPerTranscript)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Total Tokens
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {formatTokens(totalTokens)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Transcripts
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {totalTranscripts}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Trend Chart */}
                  {monthlyTrends.length > 0 ? (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium text-muted-foreground mb-4">
                        Monthly Cost Trend (Last 6 Months)
                      </h4>
                      <BarChart
                        data={monthlyTrends}
                        index="name"
                        categories={["cost"]}
                        colors={["blue"]}
                        valueFormatter={(value) => formatUsd(value)}
                        yAxisWidth={60}
                        className="h-48"
                        showAnimation={true}
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
                      <p>No usage data yet. Costs will appear here as you process transcripts.</p>
                    </div>
                  )}

                  {/* Cost by Operation Type */}
                  {costByOperationType.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Cost by Operation Type
                      </h4>
                      <div className="space-y-2">
                        {costByOperationType.map((op) => (
                          <div
                            key={op.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{op.name}</span>
                            <span className="font-medium">{formatUsd(op.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* Current Plan Section */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Current Plan
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Your subscription and billing information
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <RiBankCardLine className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">Free Plan</h3>
                <Badge variant="outline">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You're currently on the Free plan with unlimited access to core features.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* Pro Plan Coming Soon */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            PRO Plan
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Advanced features for power users
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-vibe-orange/20 to-vibe-orange/10 flex items-center justify-center">
              <RiSparkling2Line className="h-6 w-6 text-vibe-orange" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">PRO Features</h3>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Advanced analytics, custom integrations, priority support, and more.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Advanced AI insights and sentiment analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Custom CRM integrations
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Team collaboration features
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Priority support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
