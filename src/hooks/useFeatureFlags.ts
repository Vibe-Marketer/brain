import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface FeatureFlag {
  id: string;
  name: string;
  is_enabled: boolean;
  enabled_for_roles: string[];
}

// Shared query — all consumers hit the same cache entry
async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.from("feature_flags").select("*");
  if (error) {
    logger.error("Error fetching feature flags", error);
    return [];
  }
  return (data as FeatureFlag[]) ?? [];
}

export function useFeatureFlags(userRole: "FREE" | "PRO" | "TEAM" | "ADMIN") {
  const { data: flags = [], isLoading: loading } = useQuery({
    queryKey: ["feature_flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000, // 5 minutes — flags change rarely
    gcTime: 10 * 60 * 1000,
    enabled: !!userRole,
  });

  const flagMap: Record<string, boolean> = {};
  for (const flag of flags) {
    const roleEnabled = flag.enabled_for_roles?.includes(userRole) ?? false;
    flagMap[flag.id] = flag.is_enabled || roleEnabled;
  }

  return {
    flags: flagMap,
    loading,
    isFeatureEnabled: (featureId: string) => !!flagMap[featureId],
  };
}
