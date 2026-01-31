import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePolarCustomer } from "@/hooks/usePolarCustomer";
import { logger } from "@/lib/logger";

export interface UpgradeButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Polar product ID to upgrade to (e.g., 'solo-monthly', 'team-annual') */
  productId: string;
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
 * <UpgradeButton productId="solo-monthly">
 *   Upgrade to Pro
 * </UpgradeButton>
 * 
 * // In billing page
 * <UpgradeButton productId="team-monthly" variant="outline">
 *   Switch to Team
 * </UpgradeButton>
 * ```
 * 
 * @brand-version v4.2
 */
export function UpgradeButton({
  productId,
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
        body: { productId },
      });
      
      toast.dismiss(loadingToast);
      
      if (error) {
        logger.error("Checkout error", error);
        toast.error("Failed to start checkout", {
          description: error.message || "Please try again",
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
