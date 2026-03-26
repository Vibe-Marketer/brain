import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { batchFetchUserProfiles } from "@/lib/team-utils";
import {
  TeamShare,
  TeamShareWithDetails,
  ShareType,
} from "@/types/sharing";

interface UseTeamSharesOptions {
  teamId?: string;
  userId?: string;
  enabled?: boolean;
}

interface UseTeamSharesResult {
  shares: TeamShareWithDetails[];
  sharesWithMe: TeamShareWithDetails[];
  isLoading: boolean;
  addShare: (input: { recipient_user_id: string; share_type: ShareType; folder_id?: string; tag_id?: string }) => Promise<TeamShare>;
  removeShare: (shareId: string) => Promise<void>;
  isUpdating: boolean;
}

/**
 * Hook for managing peer-to-peer folder/tag sharing within a team
 */
export function useTeamShares(options: UseTeamSharesOptions): UseTeamSharesResult {
  const { teamId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch shares
  const { data: shares, isLoading } = useQuery({
    queryKey: queryKeys.teams.shares(teamId!),
    queryFn: async () => {
      if (!teamId) return { myShares: [], sharesWithMe: [] };

      // Get shares created by current user
      const { data: myShares, error: myError } = await supabase
        .from("team_shares")
        .select(`
          *,
          folders:folder_id(name),
          transcript_tags:tag_id(name)
        `)
        .eq("team_id", teamId)
        .eq("owner_user_id", userId!)
        .order("created_at", { ascending: false });

      if (myError) {
        logger.error("Error fetching my team shares", myError);
        throw myError;
      }

      // Get shares where current user is recipient
      const { data: sharesWithMe, error: withMeError } = await supabase
        .from("team_shares")
        .select(`
          *,
          folders:folder_id(name),
          transcript_tags:tag_id(name)
        `)
        .eq("team_id", teamId)
        .eq("recipient_user_id", userId!)
        .order("created_at", { ascending: false });

      if (withMeError) {
        logger.error("Error fetching team shares with me", withMeError);
        throw withMeError;
      }

      // Batch-fetch all referenced user profiles in a single query (fixes N+1)
      const shareUserIds = Array.from(new Set([
        ...(myShares || []).map((s: TeamShare) => s.recipient_user_id),
        ...(sharesWithMe || []).map((s: TeamShare) => s.owner_user_id),
      ]));
      const shareProfileMap = await batchFetchUserProfiles(shareUserIds);

      const enrichMyShares = (myShares || []).map((share: TeamShare & { folders?: { name: string }; transcript_tags?: { name: string } }) => ({
        ...share,
        owner_name: null, // Current user is owner
        recipient_name: shareProfileMap.get(share.recipient_user_id)?.email || null,
        folder_name: share.folders?.name || null,
        tag_name: share.transcript_tags?.name || null,
      } as TeamShareWithDetails));

      const enrichSharesWithMe = (sharesWithMe || []).map((share: TeamShare & { folders?: { name: string }; transcript_tags?: { name: string } }) => ({
        ...share,
        owner_name: shareProfileMap.get(share.owner_user_id)?.email || null,
        recipient_name: null, // Current user is recipient
        folder_name: share.folders?.name || null,
        tag_name: share.transcript_tags?.name || null,
      } as TeamShareWithDetails));

      return {
        myShares: enrichMyShares,
        sharesWithMe: enrichSharesWithMe,
      };
    },
    enabled: enabled && !!teamId && !!userId,
  });

  // Add share mutation
  const addShareMutation = useMutation({
    mutationFn: async (input: {
      recipient_user_id: string;
      share_type: ShareType;
      folder_id?: string;
      tag_id?: string;
    }): Promise<TeamShare> => {
      if (!teamId || !userId) {
        throw new Error("Team ID and User ID are required");
      }

      const { data, error } = await supabase
        .from("team_shares")
        .insert({
          team_id: teamId,
          owner_user_id: userId,
          recipient_user_id: input.recipient_user_id,
          share_type: input.share_type,
          folder_id: input.folder_id || null,
          tag_id: input.tag_id || null,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error adding team share", error);
        throw error;
      }

      logger.info("Team share added", { shareId: data.id });

      return data as TeamShare;
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.shares(teamId) });
      }
    },
  });

  // Remove share mutation
  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string): Promise<void> => {
      const { error } = await supabase
        .from("team_shares")
        .delete()
        .eq("id", shareId);

      if (error) {
        logger.error("Error removing team share", error);
        throw error;
      }

      logger.info("Team share removed", { shareId });
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.shares(teamId) });
      }
    },
  });

  return {
    shares: shares?.myShares || [],
    sharesWithMe: shares?.sharesWithMe || [],
    isLoading,
    addShare: addShareMutation.mutateAsync,
    removeShare: removeShareMutation.mutateAsync,
    isUpdating: addShareMutation.isPending || removeShareMutation.isPending,
  };
}
