import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RiCheckLine, RiStarLine, RiFlashlightLine } from "@remixicon/react";
import type { SubscriptionTier } from "@/hooks/useSubscription";
import { UpgradeButton } from "./UpgradeButton";

/**
 * Plan tier definition for display
 */
interface PlanTier {
  id: string;
  name: string;
  tier: SubscriptionTier;
  monthlyPrice: number | null; // null = free
  annualPrice: number | null;
  annualSavings: number | null;
  description: string;
  features: string[];
  highlighted?: boolean;
  productIdMonthly: string | null; // null = free (no checkout)
  productIdAnnual: string | null;
}

/**
 * Plan definitions per Issue #156 — Free / Pro / Team
 */
const PLANS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    monthlyPrice: 0,
    annualPrice: null,
    annualSavings: null,
    description: 'Get started with core import features and a taste of AI.',
    features: [
      '1 user, 1 workspace',
      '10 imports / month',
      '25 AI actions / month',
      'Smart import (titles + tags)',
      'No MCP / External AI integrations',
      'No AI chat',
    ],
    productIdMonthly: null,
    productIdAnnual: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    monthlyPrice: 29,
    annualPrice: 278,
    annualSavings: 70,
    description: 'Unlimited imports, full MCP access, and 1,000 AI actions / month.',
    features: [
      '1 user',
      'Unlimited imports',
      'Multiple workspaces',
      'Full MCP / External AI access',
      '1,000 AI actions / month',
      'Minimal AI chat (5 transcripts per chat)',
    ],
    highlighted: true,
    productIdMonthly: 'pro-monthly',
    productIdAnnual: 'pro-annual',
  },
  {
    id: 'team',
    name: 'Team',
    tier: 'team',
    monthlyPrice: 79,
    annualPrice: 758,
    annualSavings: 190,
    description: 'Everything in Pro, shared workspaces, roles, and 5,000 pooled AI actions.',
    features: [
      '3–10 users',
      'Shared workspaces + roles',
      'Admin dashboard',
      '5,000 AI actions / month (pooled)',
      'Everything in Pro',
    ],
    productIdMonthly: 'team-monthly',
    productIdAnnual: 'team-annual',
  },
];

export interface PlanCardsProps {
  /** Current user's tier */
  currentTier: SubscriptionTier;
  /** Whether user is currently on a trial */
  isTrialing?: boolean;
  /** Callback when upgrade is requested (optional — UpgradeButton handles checkout internally) */
  onUpgrade?: (productId: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Whether to show annual pricing toggle (default: show monthly) */
  showAnnual?: boolean;
}

/**
 * PlanCards - Side-by-side plan comparison component
 *
 * Displays Free, Pro, and Team tiers with feature lists.
 * Highlights current plan and shows upgrade buttons for higher tiers.
 *
 * @brand-version v4.3
 */
export function PlanCards({
  currentTier,
  isTrialing = false,
  onUpgrade: _onUpgrade, // Legacy prop — UpgradeButton handles checkout internally
  isLoading = false,
  showAnnual = false,
}: PlanCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-xl border border-border bg-card">
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-8 w-20 mb-4" />
            <Skeleton className="h-4 w-full mb-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton key={j} className="h-4 w-3/4" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const tierHierarchy: SubscriptionTier[] = ['free', 'pro', 'team'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PLANS.map((plan) => {
        const planTierIndex = tierHierarchy.indexOf(plan.tier);
        const isCurrentPlan = currentTier === plan.tier;
        const isUpgrade = planTierIndex > currentTierIndex;
        const isDowngrade = planTierIndex < currentTierIndex;

        const price = showAnnual ? plan.annualPrice : plan.monthlyPrice;
        const productId = showAnnual ? plan.productIdAnnual : plan.productIdMonthly;
        const interval = plan.monthlyPrice === 0 ? '' : showAnnual ? '/yr' : '/mo';

        return (
          <div
            key={plan.id}
            className={cn(
              "relative p-6 rounded-xl border bg-card transition-all",
              isCurrentPlan && "border-primary ring-2 ring-primary/20",
              plan.highlighted && !isCurrentPlan && "border-border shadow-md",
              !isCurrentPlan && !plan.highlighted && "border-border"
            )}
          >
            {/* Most Popular badge */}
            {plan.highlighted && !isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3">
                  <RiStarLine className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}

            {/* Current Plan badge */}
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" className="px-3">
                  <RiCheckLine className="h-3 w-3 mr-1" />
                  {isTrialing && plan.tier === 'pro' ? 'Trial Active' : 'Current Plan'}
                </Badge>
              </div>
            )}

            {/* Trial banner inside card */}
            {isCurrentPlan && isTrialing && plan.tier === 'pro' && (
              <div className="mb-3 -mx-6 -mt-6 pt-8 px-6 pb-3 bg-primary/5 rounded-t-xl border-b border-primary/10">
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <RiFlashlightLine className="h-3.5 w-3.5" />
                  Pro trial — upgrade to keep full access
                </div>
              </div>
            )}

            {/* Plan name and price */}
            <div className="mb-4 pt-2">
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {price === 0 ? 'Free' : `$${price}`}
                </span>
                {interval && (
                  <span className="text-sm text-muted-foreground">{interval}</span>
                )}
              </div>
              {showAnnual && plan.annualSavings != null && (
                <p className="text-xs text-success-text mt-1">
                  Save ${plan.annualSavings}/year
                </p>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4">
              {plan.description}
            </p>

            {/* Features list */}
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <RiCheckLine className="h-4 w-4 text-success-text mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Action button */}
            <div className="mt-auto">
              {isCurrentPlan && !isTrialing ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : isCurrentPlan && isTrialing ? (
                // On trial — offer upgrade to paid Pro
                <UpgradeButton
                  productId="pro-monthly"
                  variant="default"
                  className="w-full"
                >
                  Upgrade to Pro
                </UpgradeButton>
              ) : plan.tier === 'free' ? (
                // Free tier — no checkout needed, just a disabled button
                <Button variant="outline" className="w-full" disabled={currentTier !== 'free'}>
                  {isDowngrade ? 'Downgrade to Free' : 'Get Started Free'}
                </Button>
              ) : isUpgrade && productId ? (
                <UpgradeButton
                  productId={productId}
                  variant="default"
                  className="w-full"
                >
                  Upgrade to {plan.name}
                </UpgradeButton>
              ) : isDowngrade && productId ? (
                <UpgradeButton
                  productId={productId}
                  variant="outline"
                  className="w-full"
                >
                  Downgrade to {plan.name}
                </UpgradeButton>
              ) : (
                <UpgradeButton
                  productId={productId ?? ''}
                  variant="default"
                  className="w-full"
                >
                  Get Started
                </UpgradeButton>
              )}
            </div>

            {/* Downgrade notice */}
            {isDowngrade && currentTierIndex > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Extra workspaces + MCP become read-only
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
