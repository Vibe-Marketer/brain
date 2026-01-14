import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RiBankCardLine, RiSparkling2Line, RiCpuLine } from "@remixicon/react";
import { BarChart } from "@tremor/react";
import { useEmbeddingCosts } from "@/hooks/useEmbeddingCosts";
import { useUserRole } from "@/hooks/useUserRole";

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

/**
 * Get plan details based on user role
 * Maps database roles to actual pricing tiers
 */
function getPlanDetails(role: string) {
  switch (role) {
    case "ADMIN":
      return {
        name: "Admin",
        displayName: "Admin",
        price: null,
        description: "Full system access with administrative privileges and all features.",
        badgeVariant: "default" as const,
        features: [
          "All Business features",
          "Full administrative access",
          "System configuration",
          "User management",
        ],
      };
    case "TEAM":
      return {
        name: "Team",
        displayName: "Team",
        price: "$99/mo",
        annualPrice: "$950/yr (save $238)",
        description: "Up to 5 users with team hierarchy and shared collaboration.",
        badgeVariant: "default" as const,
        features: [
          "Up to 5 full users",
          "Team hierarchy & manager auto-access",
          "Shared folders",
          "2 coaches / 3 coachees",
          "Unlimited coach notes",
        ],
        nextTier: {
          name: "Business",
          price: "$249/mo",
          benefits: ["Up to 20 users", "Advanced admin controls", "5 coaches / 10 coachees", "Priority support"],
        },
      };
    case "PRO":
      return {
        name: "Solo",
        displayName: "Solo",
        price: "$29/mo",
        annualPrice: "$278/yr (save $70)",
        description: "Perfect for individuals with unlimited calls and AI features.",
        badgeVariant: "default" as const,
        features: [
          "1 user",
          "Unlimited calls & AI summaries",
          "Folders, tags, AI search",
          "1 coach + 1 coachee",
          "10 notes per call",
        ],
        nextTier: {
          name: "Team",
          price: "$99/mo",
          benefits: ["Up to 5 users", "Team hierarchy", "Shared folders", "More coaching capacity"],
        },
      };
    case "FREE":
    default:
      return {
        name: "Free",
        displayName: "Free",
        price: "$0",
        description: "Limited usage with core features. Can view shared calls from paid users.",
        badgeVariant: "outline" as const,
        features: [
          "1 user",
          "300 minutes/month limit",
          "Limited storage",
          "View-only for shared calls",
          "No Teams or coaching",
        ],
        nextTier: {
          name: "Solo",
          price: "$29/mo",
          benefits: ["Unlimited calls", "AI summaries", "Coaching features", "Advanced AI search"],
        },
      };
  }
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

  const { role, loading: roleLoading, isPro, isTeam, isAdmin } = useUserRole();

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
          {roleLoading ? (
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Plan Header */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <RiBankCardLine className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold">{getPlanDetails(role).displayName} Plan</h3>
                    <Badge variant={getPlanDetails(role).badgeVariant}>Active</Badge>
                    {getPlanDetails(role).price && (
                      <span className="text-sm font-medium text-muted-foreground">
                        {getPlanDetails(role).price}
                      </span>
                    )}
                  </div>
                  {getPlanDetails(role).annualPrice && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Or {getPlanDetails(role).annualPrice}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {getPlanDetails(role).description}
                  </p>
                </div>
              </div>

              {/* Plan Features */}
              <div className="pl-16">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  What's included
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {getPlanDetails(role).features?.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Plans - Show pricing table for reference */}
      <Separator className="my-16" />
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            All Plans
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Compare features across all tiers
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {/* Free Tier */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Free</h4>
                <span className="text-sm text-muted-foreground">$0</span>
              </div>
              <p className="text-xs text-muted-foreground">300 min/month • View shared calls • Limited storage</p>
            </div>

            {/* Solo Tier */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Solo</h4>
                <span className="text-sm text-muted-foreground">$29/mo or $278/yr</span>
              </div>
              <p className="text-xs text-muted-foreground">1 user • Unlimited calls • 1 coach/coachee • AI search</p>
            </div>

            {/* Team Tier */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Team</h4>
                <span className="text-sm text-muted-foreground">$99/mo or $950/yr</span>
              </div>
              <p className="text-xs text-muted-foreground">Up to 5 users • Team hierarchy • Shared folders • 2 coaches/3 coachees</p>
            </div>

            {/* Business Tier */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Business</h4>
                <span className="text-sm text-muted-foreground">$249/mo or $2,390/yr</span>
              </div>
              <p className="text-xs text-muted-foreground">Up to 20 users • Advanced admin • 5 coaches/10 coachees • Priority support</p>
            </div>

            {/* Enterprise Tier */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Enterprise</h4>
                <span className="text-sm text-muted-foreground">Custom pricing</span>
              </div>
              <p className="text-xs text-muted-foreground">Unlimited users • SSO • Dedicated CSM • SLA • Custom security</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade to Next Tier - Show for FREE, PRO, and TEAM users */}
      {!roleLoading && getPlanDetails(role).nextTier && (
        <>
          <Separator className="my-16" />
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                Upgrade to {getPlanDetails(role).nextTier.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Unlock more features and capacity
              </p>
            </div>
            <div className="lg:col-span-2">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-vibe-orange/20 to-vibe-orange/10 flex items-center justify-center">
                  <RiSparkling2Line className="h-6 w-6 text-vibe-orange" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{getPlanDetails(role).nextTier.name} Plan</h3>
                    <Badge variant="outline">Upgrade</Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      {getPlanDetails(role).nextTier.price}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get access to these additional features:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    {getPlanDetails(role).nextTier.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-vibe-orange" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      Coming Soon - Stripe Integration
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
