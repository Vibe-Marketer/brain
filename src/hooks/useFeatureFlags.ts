import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface FeatureFlag {
  id: string;
  name: string;
  is_enabled: boolean;
  enabled_for_roles: string[];
}

export function useFeatureFlags(userRole: "FREE" | "PRO" | "TEAM" | "ADMIN") {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlags() {
      try {
        const { data, error } = await supabase.from("feature_flags").select("*");
        if (error) {
          logger.error("Error fetching feature flags", error);
          setLoading(false);
          return;
        }

        const flagMap: Record<string, boolean> = {};
        for (const flag of data as FeatureFlag[]) {
          // A feature is enabled if it's explicitly enabled for all, 
          // OR if the user's role is in the enabled_for_roles list
          const roleEnabled = flag.enabled_for_roles.includes(userRole);
          flagMap[flag.id] = flag.is_enabled || roleEnabled;
        }

        setFlags(flagMap);
        setLoading(false);
      } catch (err) {
        logger.error("Unexpected error fetching feature flags", err);
        setLoading(false);
      }
    }

    // Only fetch if role is loaded
    if (userRole) {
      fetchFlags();
    }
  }, [userRole]);

  return {
    flags,
    loading,
    isFeatureEnabled: (featureId: string) => !!flags[featureId]
  };
}
