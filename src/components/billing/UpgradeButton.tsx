import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePolarCustomer } from "@/hooks/usePolarCustomer";
import { logger } from "@/lib/logger";

export interface UpgradeButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Polar product UUID to upgrade to. Use POLAR_PRODUCT_IDS constants. */
  productId: string;
  /** Optional in-app path for checkout success redirects. */
  successPath?: string;
  /** Called after checkout URL is created and before browser redirect. */
  onCheckoutStarted?: () => Promise<void> | void;
  /** Button text (default: "Upgrade") */
  children?: React.ReactNode;
}

/**
 * UpgradeButton - Standalone upgrade CTA component
 * 
 * Handles full checkout flow:
 * 1. Ensures Polar customer exists (creates if needed)
 * 2. Calls polar-checkout Edge Function
 * 3. Redirects to Polar checkout URL
 * 
 * @example
 * ```tsx
 * // In header for free users
 * <UpgradeButton productId={POLAR_PRODUCT_IDS.PRO_MONTHLY}>
 *   Upgrade to Pro
 * </UpgradeButton>
 * 
 * // In billing page
 * <UpgradeButton productId={POLAR_PRODUCT_IDS.TEAM_MONTHLY} variant="outline">
 *   Switch to Team
 * </UpgradeButton>
 * ```
 * 
 * @brand-version v4.2
 */
export function UpgradeButton({
  productId,
  successPath,
  onCheckoutStarted,
  children = "Upgrade",
  variant = "default",
  disabled,
  ...props
}: UpgradeButtonProps) {
  const { ensureCustomer, isCreating } = usePolarCustomer();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const isLoading = isCreating || isCheckingOut;

  async function handleUpgrade() {
    if (isLoading) return;
    
    try {
      setIsCheckingOut(true);
      
      // Show loading toast
      const loadingToast = toast.loading("Preparing checkout...");
      
      // Step 1: Ensure customer exists
      await ensureCustomer();
      
      // Step 2: Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.dismiss(loadingToast);
        toast.error("Please sign in to upgrade");
        return;
      }
      
      // Step 3: Call polar-checkout Edge Function
      const { data, error } = await supabase.functions.invoke('polar-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { productId, successPath },
      });
      
      toast.dismiss(loadingToast);
      
      if (error) {
        logger.error("Checkout error", error);
        const message = await getFunctionErrorMessage(error);
        toast.error("Failed to start checkout", {
          description: message || "Please try again",
        });
        return;
      }
      
      if (!data?.checkoutUrl) {
        toast.error("No checkout URL received");
        return;
      }
      
      // Step 4: Redirect to checkout
      toast.success("Redirecting to checkout...");
      logger.info("Redirecting to Polar checkout", { productId, checkoutId: data.checkoutId });
      await onCheckoutStarted?.();
      
      // Small delay to show success toast
      setTimeout(() => {
        window.location.href = data.checkoutUrl;
      }, 500);
      
    } catch (err) {
      logger.error("Upgrade error", err);
      toast.error("Failed to start upgrade", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleUpgrade}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Processing..." : children}
    </Button>
  );
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "Please try again";
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return fallback;

  try {
    const text = await context.clone().text();
    if (!text) return fallback;

    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string") return parsed.error;
      if (typeof parsed.message === "string") return parsed.message;
    } catch {
      return text.slice(0, 180);
    }
  } catch {
    return fallback;
  }

  return fallback;
}
