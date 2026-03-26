import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { batchFetchUserProfiles, buildOrgChart } from "@/lib/team-utils";
import {
  Team,
  TeamMembership,
  TeamMembershipWithUser,
  OrgChart,
} from "@/types/sharing";

interface UseOrgChartOptions {
  teamId?: string;
  enabled?: boolean;
}

interface UseOrgChartResult {
  orgChart: OrgChart | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook for fetching and building the org chart structure
 */
export function useOrgChart(options: UseOrgChartOptions): UseOrgChartResult {
  const { teamId, enabled = true } = options;

  const { data: orgChart, isLoading, refetch } = useQuery({
    queryKey: queryKeys.teams.hierarchy(teamId!),
    queryFn: async () => {
      if (!teamId) return null;

      // Fetch team
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError) {
        logger.error("Error fetching team for org chart", teamError);
        throw teamError;
      }

      // Fetch all active members
      const { data: members, error: membersError } = await supabase
        .from("team_memberships")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (membersError) {
        logger.error("Error fetching members for org chart", membersError);
        throw membersError;
      }

      // Batch-fetch user profiles for all org chart members (fixes N+1)
      const orgMemberUserIds = (members || []).map((m: TeamMembership) => m.user_id);
      const orgProfileMap = await batchFetchUserProfiles(orgMemberUserIds);

      const enrichedMembers = (members || []).map((member: TeamMembership) => {
        const enriched: TeamMembershipWithUser = { ...member };
        enriched.user_email = orgProfileMap.get(member.user_id)?.email || null;
        return enriched;
      });

      // Build tree structure
      const rootNodes = buildOrgChart(enrichedMembers);

      return {
        team: team as Team,
        root_nodes: rootNodes,
        total_members: enrichedMembers.length,
      } as OrgChart;
    },
    enabled: enabled && !!teamId,
  });

  return {
    orgChart: orgChart || null,
    isLoading,
    refetch,
  };
}
