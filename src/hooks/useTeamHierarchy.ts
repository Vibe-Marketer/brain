/**
 * useTeamHierarchy — main hook for team CRUD operations.
 *
 * Split from original monolith into separate files:
 * - useTeamMembers.ts — member management
 * - useDirectReports.ts — manager's direct reports
 * - useManagerNotes.ts — private manager notes
 * - useTeamShares.ts — peer-to-peer sharing
 * - useOrgChart.ts — org chart visualization
 * - lib/team-utils.ts — shared helpers
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { generateInviteToken, getInviteExpiration } from "@/lib/team-utils";
import {
  Team,
  TeamWithOwner,
  CreateTeamInput,
} from "@/types/sharing";

// Re-export split hooks for backward compatibility
export { useTeamMembers } from "@/hooks/useTeamMembers";
export { useDirectReports } from "@/hooks/useDirectReports";
export { useManagerNotes } from "@/hooks/useManagerNotes";
export { useTeamShares } from "@/hooks/useTeamShares";
export { useOrgChart } from "@/hooks/useOrgChart";

// ============================================================================
// Types
// ============================================================================

interface UseTeamHierarchyOptions {
  teamId?: string;
  userId?: string;
  enabled?: boolean;
}

interface UseTeamHierarchyResult {
  // Queries
  team: TeamWithOwner | null;
  isLoading: boolean;
  // Mutations
  createTeam: (input: CreateTeamInput) => Promise<Team>;
  updateTeam: (input: Partial<CreateTeamInput>) => Promise<Team>;
  deleteTeam: () => Promise<void>;
  generateTeamInvite: () => Promise<{ invite_token: string; invite_url: string }>;
  isUpdating: boolean;
  isGeneratingInvite: boolean;
}

// ============================================================================
// Main Hook: useTeamHierarchy
// ============================================================================

/**
 * Hook for managing team details
 *
 * Provides functionality to:
 * - Get team details
 * - Create/update/delete team
 */
export function useTeamHierarchy(options: UseTeamHierarchyOptions): UseTeamHierarchyResult {
  const { teamId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch team details
  const { data: team, isLoading } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: async () => {
      if (!teamId) return null;

      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (error) {
        logger.error("Error fetching team", error);
        throw error;
      }

      // Enrich with owner email
      const enriched: TeamWithOwner = { ...data };
      const { data: ownerEmail } = await supabase.rpc('get_user_email', {
        user_id: data.owner_user_id
      });
      enriched.owner_email = ownerEmail || null;

      return enriched;
    },
    enabled: enabled && !!teamId,
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (input: CreateTeamInput): Promise<Team> => {
      if (!userId) {
        throw new Error("User ID is required to create team");
      }

      // Use the Edge Function to create team with proper business logic
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: input.name,
          user_id: userId,
          admin_sees_all: input.admin_sees_all ?? false,
          domain_auto_join: input.domain_auto_join || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("Error creating team", errorData);
        throw new Error(errorData.error || "Failed to create team");
      }

      const result = await response.json();
      logger.info("Team created", { teamId: result.team.id, name: result.team.name });

      return result.team as Team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async (input: Partial<CreateTeamInput>): Promise<Team> => {
      if (!teamId) {
        throw new Error("Team ID is required to update team");
      }

      const updateData: Partial<Team> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.admin_sees_all !== undefined) updateData.admin_sees_all = input.admin_sees_all;
      if (input.domain_auto_join !== undefined) updateData.domain_auto_join = input.domain_auto_join;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("teams")
        .update(updateData)
        .eq("id", teamId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating team", error);
        throw error;
      }

      logger.info("Team updated", { teamId, changes: Object.keys(updateData) });

      return data as Team;
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
      }
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!teamId) {
        throw new Error("Team ID is required to delete team");
      }

      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId);

      if (error) {
        logger.error("Error deleting team", error);
        throw error;
      }

      logger.info("Team deleted", { teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
  });

  // Generate team invite link mutation
  // Stores invite token on the teams table for shareable links
  const generateTeamInviteMutation = useMutation({
    mutationFn: async (): Promise<{ invite_token: string; invite_url: string }> => {
      if (!teamId) {
        throw new Error("Team ID is required to generate invite");
      }
      if (!userId) {
        throw new Error("User ID is required to generate invite");
      }

      // First check if team already has a valid invite token
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("invite_token, invite_expires_at")
        .eq("id", teamId)
        .single();

      // If there's an existing valid token, return it
      if (existingTeam?.invite_token && existingTeam?.invite_expires_at) {
        const expiresAt = new Date(existingTeam.invite_expires_at);
        if (expiresAt > new Date()) {
          const inviteUrl = `${window.location.origin}/join/team/${existingTeam.invite_token}`;
          logger.info("Returning existing team invite", { teamId });
          return { invite_token: existingTeam.invite_token, invite_url: inviteUrl };
        }
      }

      // Generate new token and store on teams table
      const inviteToken = generateInviteToken();
      const inviteExpiresAt = getInviteExpiration();

      const { error } = await supabase
        .from("teams")
        .update({
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        })
        .eq("id", teamId);

      if (error) {
        logger.error("Error generating team invite", error);
        throw error;
      }

      const inviteUrl = `${window.location.origin}/join/team/${inviteToken}`;

      logger.info("Team invite generated", { teamId });

      return { invite_token: inviteToken, invite_url: inviteUrl };
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
      }
    },
  });

  return {
    team: team || null,
    isLoading,
    createTeam: createTeamMutation.mutateAsync,
    updateTeam: updateTeamMutation.mutateAsync,
    deleteTeam: deleteTeamMutation.mutateAsync,
    generateTeamInvite: generateTeamInviteMutation.mutateAsync,
    isUpdating: createTeamMutation.isPending || updateTeamMutation.isPending || deleteTeamMutation.isPending,
    isGeneratingInvite: generateTeamInviteMutation.isPending,
  };
}
