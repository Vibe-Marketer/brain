import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

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

      const { error } = await supabase
        .from("user_profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

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

        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled) {
          if (error) {
            logger.error("[useOnboarding] Error fetching profile", error);
            // On error, don't block the user — assume they've onboarded
            setShouldShowOnboarding(false);
          } else {
            // Show onboarding if the flag is explicitly false or null/missing
            setShouldShowOnboarding(!profile?.onboarding_completed);
          }
          setLoading(false);
        }
      } catch (err) {
        logger.error("[useOnboarding] Unexpected error checking status", err);
        if (!cancelled) {
          setShouldShowOnboarding(false);
          setLoading(false);
        }
      }
    };

    checkOnboardingStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return { shouldShowOnboarding, loading, completeOnboarding };
}
