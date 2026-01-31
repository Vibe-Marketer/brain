import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RiCheckLine, RiStarLine } from "@remixicon/react";
import type { SubscriptionTier } from "@/hooks/useSubscription";

/**
 * Plan tier definition for display
 */
interface PlanTier {
  id: string;
  name: string;
  tier: SubscriptionTier;
  monthlyPrice: number;
  annualPrice: number;
  annualSavings: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  productIdMonthly: string;
  productIdAnnual: string;
}

/**
 * Plan definitions per CONTEXT.md
 * Solo ($29/mo), Team ($99/mo), Business ($249/mo)
 */
const PLANS: PlanTier[] = [
  {
    id: 'solo',
    name: 'Solo',
    tier: 'solo',
    monthlyPrice: 29,
    annualPrice: 278,
    annualSavings: 70,
    description: 'Perfect for individuals with unlimited calls and AI features.',
    features: [
      '1 user',
      'Unlimited calls & AI summaries',
      'Folders, tags, AI search',
      '1 coach + 1 coachee',
      '10 notes per call',
    ],
    productIdMonthly: 'solo-monthly',
    productIdAnnual: 'solo-annual',
  },
  {
    id: 'team',
    name: 'Team',
    tier: 'team',
    monthlyPrice: 99,
    annualPrice: 950,
    annualSavings: 238,
    description: 'Up to 5 users with team hierarchy and shared collaboration.',
    features: [
      'Up to 5 full users',
      'Team hierarchy & manager auto-access',
      'Shared folders',
      '2 coaches / 3 coachees',
      'Unlimited coach notes',
    ],
    highlighted: true,
    productIdMonthly: 'team-monthly',
    productIdAnnual: 'team-annual',
  },
  {
    id: 'business',
    name: 'Business',
    tier: 'business',
    monthlyPrice: 249,
    annualPrice: 2390,
    annualSavings: 598,
    description: 'Up to 20 users with advanced admin controls and priority support.',
    features: [
      'Up to 20 full users',
      'Advanced admin controls',
      '5 coaches / 10 coachees',
      'Priority support',
      'Custom integrations',
    ],
    productIdMonthly: 'business-monthly',
    productIdAnnual: 'business-annual',
  },
];

export interface PlanCardsProps {
  /** Current user's tier */
  currentTier: SubscriptionTier;
  /** Callback when upgrade is requested */
  onUpgrade: (productId: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Whether to show annual pricing toggle (default: show monthly) */
  showAnnual?: boolean;
}

/**
 * PlanCards - Side-by-side plan comparison component
 * 
 * Displays Solo, Team, and Business tiers with feature lists.
 * Highlights current plan and shows upgrade buttons for higher tiers.
 * 
 * @brand-version v4.2
 */
export function PlanCards({
  currentTier,
  onUpgrade,
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

  const tierHierarchy: SubscriptionTier[] = ['free', 'solo', 'team', 'business'];
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
        const interval = showAnnual ? '/yr' : '/mo';

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
            {/* Popular badge for highlighted plan */}
            {plan.highlighted && !isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3">
                  <RiStarLine className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}

            {/* Current plan badge */}
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" className="px-3">
                  <RiCheckLine className="h-3 w-3 mr-1" />
                  Current Plan
                </Badge>
              </div>
            )}

            {/* Plan name and price */}
            <div className="mb-4 pt-2">
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-foreground">${price}</span>
                <span className="text-sm text-muted-foreground">{interval}</span>
              </div>
              {showAnnual && (
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
              {isCurrentPlan ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : isUpgrade ? (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => onUpgrade(productId)}
                >
                  Upgrade to {plan.name}
                </Button>
              ) : isDowngrade ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onUpgrade(productId)}
                >
                  Downgrade to {plan.name}
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => onUpgrade(productId)}
                >
                  Get Started
                </Button>
              )}
            </div>

            {/* Downgrade notice */}
            {isDowngrade && currentTierIndex > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Excess features become read-only
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
