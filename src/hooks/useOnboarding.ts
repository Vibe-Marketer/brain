import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { isNavigationAbort } from "@/lib/is-navigation-abort";

interface OnboardingData {
  shouldShowOnboarding: boolean;
  loading: boolean;
  completeOnboarding: () => Promise<void>;
}

/**
 * Hook to detect whether the first-run onboarding modal should be shown.
 *
 * shouldShowOnboarding = true when user_profiles.onboarding_completed is false or null
 * completeOnboarding() sets onboarding_completed = true via supabase update
 */
export function useOnboarding(): OnboardingData {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const completeOnboarding = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        logger.error("[useOnboarding] Cannot complete onboarding: auth error", authError);
        return;
      }

      // Use upsert to handle cases where the signup trigger didn't create a profile row
      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          email: user.email ?? '',
          display_name: user.user_metadata?.display_name ?? user.email ?? '',
          onboarding_completed: true,
        }, { onConflict: 'user_id' });

      if (error) {
        logger.error("[useOnboarding] Error marking onboarding complete", error);
        return;
      }

      setShouldShowOnboarding(false);
      logger.info("[useOnboarding] Onboarding marked complete", { userId: user.id });
    } catch (err) {
      logger.error("[useOnboarding] Unexpected error in completeOnboarding", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const checkOnboardingStatus = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user) {
          if (!cancelled) {
            setShouldShowOnboarding(false);
            setLoading(false);
          }
          return;
        }

        // Zoom Marketplace reviewer test account — never gate on onboarding
        if (user.email === "hello@callvaultai.com") {
          if (!cancelled) {
            setShouldShowOnboarding(false);
            setLoading(false);
          }
          return;
        }

        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .abortSignal(controller.signal)
          .maybeSingle();

        if (!cancelled) {
          if (error) {
            // Swallow only profile fetches aborted by unmount/navigation.
            // Real network/security failures still log.
            if (!isNavigationAbort(error, controller.signal)) {
              logger.error("[useOnboarding] Error fetching profile", error);
            }
            // On error, don't block the user — assume they've onboarded
            setShouldShowOnboarding(false);
          } else {
            // Show onboarding if the flag is explicitly false or null/missing
            setShouldShowOnboarding(!profile?.onboarding_completed);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!isNavigationAbort(err, controller.signal)) {
          logger.error("[useOnboarding] Unexpected error checking status", err);
        }
        if (!cancelled) {
          setShouldShowOnboarding(false);
          setLoading(false);
        }
      }
    };

    checkOnboardingStatus();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { shouldShowOnboarding, loading, completeOnboarding };
}
