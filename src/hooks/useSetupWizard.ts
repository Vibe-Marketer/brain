import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

interface SetupWizardData {
  wizardCompleted: boolean;
  loading: boolean;
  checkWizardStatus: () => Promise<void>;
  markWizardComplete: () => Promise<void>;
}

/**
 * Custom hook to check and update setup wizard completion status
 * Used to determine if Fathom integration wizard should be shown
 */
export function useSetupWizard(): SetupWizardData {
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkWizardStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Expected on login page - not an error condition
        logger.debug("No authenticated user (expected on login page)");
        setWizardCompleted(false);
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        logger.error("Error checking wizard status", error);
        // If error, check for legacy Fathom setup
        const { data: settings } = await supabase
          .from("user_settings")
          .select("fathom_api_key, oauth_access_token")
          .eq("user_id", user.id)
          .maybeSingle();

        // If user has existing Fathom credentials, consider setup complete
        if (settings?.fathom_api_key || settings?.oauth_access_token) {
          logger.info("Legacy Fathom setup detected, marking wizard as complete");
          setWizardCompleted(true);
        } else {
          setWizardCompleted(false);
        }
        setLoading(false);
        return;
      }

      // If wizard already marked complete, done
      if (profile?.onboarding_completed) {
        setWizardCompleted(true);
        setLoading(false);
        return;
      }

      // Check for legacy Fathom setup
      const { data: settings } = await supabase
        .from("user_settings")
        .select("fathom_api_key, oauth_access_token")
        .eq("user_id", user.id)
        .maybeSingle();

      // Auto-complete wizard for existing users with Fathom already set up
      if (settings?.fathom_api_key || settings?.oauth_access_token) {
        logger.info("Existing Fathom setup detected, auto-completing wizard");
        await markWizardComplete();
        setWizardCompleted(true);
      } else {
        setWizardCompleted(false);
      }

      setLoading(false);
    } catch (error) {
      logger.error("Unexpected error in checkWizardStatus", error);
      // On critical error, assume complete to avoid blocking existing users
      setWizardCompleted(true);
      setLoading(false);
    }
  }, [markWizardComplete]);

  const markWizardComplete = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.error("Cannot mark wizard complete: no authenticated user");
        toast.error("Authentication error");
        return;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({
          onboarding_completed: true,
        })
        .eq("user_id", user.id);

      if (error) {
        logger.error("Error marking wizard complete", error);
        toast.error("Failed to save setup completion");
        return;
      }

      setWizardCompleted(true);
      toast.success("Setup completed successfully!");
      logger.info("Wizard marked as complete for user", { userId: user.id });
    } catch (error) {
      logger.error("Unexpected error in markWizardComplete", error);
      toast.error("Failed to complete setup");
    }
  }, []);

  useEffect(() => {
    checkWizardStatus();
  }, [checkWizardStatus]);

  return {
    wizardCompleted,
    loading,
    checkWizardStatus,
    markWizardComplete,
  };
}
