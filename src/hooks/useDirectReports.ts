import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { batchFetchUserProfiles } from "@/lib/team-utils";
import {
  TeamMembership,
  TeamMembershipWithUser,
} from "@/types/sharing";

interface UseDirectReportsOptions {
  userId?: string;
  enabled?: boolean;
}

interface DirectReportCall {
  recording_id: number;
  call_name: string;
  recording_start_time: string;
  duration: string | null;
  owner_email: string;
  owner_name?: string | null;
  owner_user_id: string;
}

interface UseDirectReportsResult {
  directReports: TeamMembershipWithUser[];
  directReportCalls: DirectReportCall[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook for managers to view their direct reports and their calls
 */
export function useDirectReports(options: UseDirectReportsOptions): UseDirectReportsResult {
  const { userId, enabled = true } = options;

  // Fetch direct reports
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.teams.directReports(userId),
    queryFn: async () => {
      if (!userId) return { directReports: [], calls: [] };

      // First, find current user's membership(s)
      const { data: myMemberships, error: membershipError } = await supabase
        .from("team_memberships")
        .select("id, team_id")
        .eq("user_id", userId)
        .eq("status", "active");

      if (membershipError) {
        logger.error("Error fetching user memberships", membershipError);
        throw membershipError;
      }

      const myMembershipRows = (myMemberships ?? []) as unknown as Pick<TeamMembership, "id" | "team_id">[];

      if (!myMembershipRows.length) {
        return { directReports: [], calls: [] };
      }

      const myMembershipIds = myMembershipRows.map(m => m.id);

      // Find all members who report to current user
      const { data: reports, error: reportsError } = await supabase
        .from("team_memberships")
        .select("*")
        .in("manager_membership_id", myMembershipIds)
        .eq("status", "active");

      if (reportsError) {
        logger.error("Error fetching direct reports", reportsError);
        throw reportsError;
      }

      const reportRows = (reports ?? []) as unknown as TeamMembership[];

      if (!reportRows.length) {
        return { directReports: [], calls: [] };
      }

      // Batch-fetch profiles for all direct report users (fixes N+1)
      const directReportUserIds = reportRows.map((r) => r.user_id);
      const reportProfileMap = await batchFetchUserProfiles(directReportUserIds);

      const enrichedReports = reportRows.map((report) => {
        const enriched: TeamMembershipWithUser = { ...report };
        enriched.user_email = reportProfileMap.get(report.user_id)?.email || null;
        return enriched;
      });

      // Get calls from all direct reports
      const { data: calls, error: callsError } = await supabase
        .from("fathom_calls")
        .select("recording_id, call_name, recording_start_time, duration, user_id")
        .in("user_id", directReportUserIds)
        .order("recording_start_time", { ascending: false })
        .limit(100);

      if (callsError) {
        logger.error("Error fetching direct report calls", callsError);
        throw callsError;
      }

      // Enrich calls with owner info using already-fetched profiles (no extra queries)
      const enrichedCalls: DirectReportCall[] = (calls || []).map((call) => ({
        ...call,
        owner_email: reportProfileMap.get(call.user_id)?.email || '',
        owner_name: reportProfileMap.get(call.user_id)?.display_name || null,
        owner_user_id: call.user_id,
      }));

      return {
        directReports: enrichedReports,
        calls: enrichedCalls,
      };
    },
    enabled: enabled && !!userId,
  });

  return {
    directReports: data?.directReports || [],
    directReportCalls: data?.calls || [],
    isLoading,
    refetch,
  };
}
