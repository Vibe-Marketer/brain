import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiUsage } from '@/hooks/useAiUsage';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeButton } from './UpgradeButton';

/**
 * AiUsageBar - Displays current AI actions used vs monthly limit
 *
 * Shows a progress bar with used/limit counts.
 * When the limit is reached, shows an inline upgrade CTA.
 *
 * Place in Settings > Billing or Settings > Usage sections.
 */
export function AiUsageBar() {
  const { used, limit, remaining, percentage, canPerformAction, isLoading } = useAiUsage();
  const { tier, isTrialing, periodEnd } = useSubscription();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const isNearLimit = percentage >= 80 && canPerformAction;
  const isAtLimit = !canPerformAction;

  const barColor = isAtLimit
    ? 'bg-destructive'
    : isNearLimit
    ? 'bg-orange-500'
    : 'bg-primary';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">AI Actions</p>
          {isTrialing && periodEnd && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Pro trial ends {periodEnd.toLocaleDateString()}
            </p>
          )}
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
        />
      </div>

      {/* Status message */}
      {isAtLimit ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive font-medium">
            {tier === 'free'
              ? 'Upgrade to Pro to keep using smart features'
              : 'Upgrade to Team or contact us for higher limits'}
          </p>
          {tier !== 'team' && (
            <UpgradeButton
              productId={tier === 'free' ? 'pro-monthly' : 'team-monthly'}
              variant="default"
              className="h-8 text-xs px-3"
            >
              {tier === 'free' ? 'Upgrade to Pro' : 'Upgrade to Team'}
            </UpgradeButton>
          )}
        </div>
      ) : isNearLimit ? (
        <p className="text-xs text-muted-foreground">
          {remaining.toLocaleString()} action{remaining !== 1 ? 's' : ''} remaining this month
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {remaining.toLocaleString()} action{remaining !== 1 ? 's' : ''} remaining this month
        </p>
      )}
    </div>
  );
}
