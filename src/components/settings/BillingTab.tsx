import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RiBankCardLine, RiCalendarLine } from "@remixicon/react";
import { useSubscription, type SubscriptionTier } from "@/hooks/useSubscription";
import { PlanCards } from "@/components/billing/PlanCards";
import { AiUsageBar } from "@/components/billing/AiUsageBar";
import { UpgradeButton } from "@/components/billing/UpgradeButton";

/**
 * Get plan details based on subscription tier
 */
function getPlanDetails(tier: SubscriptionTier) {
  switch (tier) {
    case "team":
      return {
        name: "Team",
        price: "$79/mo",
        annualPrice: "$758/yr (save $190)",
        description: "3–10 users, shared workspaces, roles, and 5,000 pooled AI actions/month.",
        badgeVariant: "default" as const,
        features: [
          "3–10 users",
          "Shared workspaces + roles/permissions",
          "Admin dashboard",
          "5,000 AI actions / month (pooled)",
          "Everything in Pro",
        ],
      };
    case "pro":
      return {
        name: "Pro",
        price: "$29/mo",
        annualPrice: "$278/yr (save $70)",
        description: "Unlimited imports, full MCP access, and 1,000 AI actions/month.",
        badgeVariant: "default" as const,
        features: [
          "1 user",
          "Unlimited imports",
          "Multiple workspaces",
          "Full MCP / External AI access",
          "1,000 AI actions / month",
        ],
      };
    case "free":
    default:
      return {
        name: "Free",
        price: "$0",
        annualPrice: undefined,
        description: "Core import features and a taste of AI.",
        badgeVariant: "outline" as const,
        features: [
          "1 user, 1 workspace",
          "10 imports / month",
          "25 AI actions / month",
          "Smart import (titles + tags)",
        ],
      };
  }
}

/**
 * Format subscription status for display
 */
function formatStatus(status: string | null): { label: string; variant: "default" | "outline" | "destructive" } {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" };
    case "trialing":
      return { label: "Trial", variant: "outline" };
    case "canceled":
      return { label: "Canceled", variant: "destructive" };
    case "past_due":
      return { label: "Past Due", variant: "destructive" };
    case "unpaid":
      return { label: "Unpaid", variant: "destructive" };
    default:
      return { label: "Free", variant: "outline" };
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillingTab() {
  const {
    tier,
    status,
    periodEnd,
    isPaid,
    isTrialing,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useSubscription();

  const plan = getPlanDetails(tier);

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

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
          {subscriptionLoading ? (
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ) : subscriptionError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              Failed to load subscription data: {subscriptionError.message}
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
                    <h3 className="text-lg font-semibold">
                      {plan.name} Plan
                      {isTrialing && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          (14-day trial)
                        </span>
                      )}
                    </h3>
                    <Badge variant={formatStatus(status).variant}>
                      {formatStatus(status).label}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      {plan.price}
                    </span>
                  </div>
                  {plan.annualPrice && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Or {plan.annualPrice}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
              </div>

              {/* Subscription Details (for paid plans) */}
              {isPaid && periodEnd && (
                <div className="pl-16">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RiCalendarLine className="h-4 w-4" />
                    <span>
                      {isTrialing
                        ? 'Trial ends: '
                        : status === 'canceled'
                        ? 'Access until: '
                        : 'Renews: '}
                      {formatDate(periodEnd)}
                    </span>
                  </div>
                </div>
              )}

              {/* Plan Features */}
              <div className="pl-16">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  What's included
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Upgrade CTA for free users */}
              {tier === 'free' && (
                <div className="pl-16">
                  <UpgradeButton productId="pro-monthly" className="mt-2">
                    Upgrade to Pro
                  </UpgradeButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Usage Section */}
      <Separator className="my-16" />
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Usage
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Monthly AI action consumption
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="p-4 rounded-lg border border-border bg-card">
            <AiUsageBar />
          </div>
        </div>
      </div>

      {/* All Plans */}
      <Separator className="my-16" />
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            All Plans
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Compare features and upgrade your plan
          </p>
        </div>
        <div className="lg:col-span-2">
          <PlanCards
            currentTier={tier}
            isTrialing={isTrialing}
            isLoading={subscriptionLoading}
          />

          {/* Enterprise callout */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Enterprise</h4>
              <span className="text-sm text-muted-foreground">Custom pricing</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Unlimited users · SSO · Dedicated CSM · SLA · Custom security
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Contact us for enterprise pricing and features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
