import type { SubscriptionStatus } from "@/hooks/useSubscription";

export const TRIAL_PRODUCT_ID = "pro-trial";

export function isActiveProTrial(
  productId: string | null,
  status: SubscriptionStatus,
  periodEnd: Date | null,
  now: Date = new Date(),
): boolean {
  if (productId !== TRIAL_PRODUCT_ID || status !== "trialing") return false;
  return !periodEnd || periodEnd > now;
}

export function getTrialDaysRemaining(
  periodEnd: Date | null,
  now: Date = new Date(),
): number | null {
  if (!periodEnd) return null;

  const remainingMs = periodEnd.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;

  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

export function formatTrialEndDate(periodEnd: Date | null): string {
  if (!periodEnd) return "your trial ends";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(periodEnd);
}
