import { RiFlashlightLine } from "@remixicon/react";
import { useSubscription } from "@/hooks/useSubscription";
import { formatTrialEndDate, getTrialDaysRemaining, isActiveProTrial } from "@/lib/trial";
import { cn } from "@/lib/utils";

interface TrialCountdownBadgeProps {
  className?: string;
}

export function TrialCountdownBadge({ className }: TrialCountdownBadgeProps) {
  const { isLoading, productId, status, periodEnd } = useSubscription();
  const activeTrial = isActiveProTrial(productId, status, periodEnd);

  if (isLoading || !activeTrial) return null;

  const daysRemaining = getTrialDaysRemaining(periodEnd);
  const dayCopy =
    daysRemaining == null
      ? "Trial active"
      : daysRemaining === 0
        ? "Trial ends today"
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] rounded-xl border border-border/70 bg-card px-3 py-2 shadow-lg",
        className,
      )}
      aria-label={`Pro trial status: ${dayCopy}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-vibe-orange/25 bg-vibe-orange/10">
          <RiFlashlightLine className="h-4 w-4 text-vibe-orange" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{dayCopy}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Pro trial ends {formatTrialEndDate(periodEnd)}
          </p>
        </div>
      </div>
    </div>
  );
}
