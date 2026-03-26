import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { generateInviteToken, getInviteExpiration, batchFetchUserProfiles } from "@/lib/team-utils";
import {
  TeamMembership,
  TeamMembershipWithUser,
  TeamRole,
  MembershipStatus,
  InviteTeamMemberInput,
  UpdateTeamMemberInput,
} from "@/types/sharing";

interface UseTeamMembersOptions {
  teamId?: string;
  userId?: string;
  enabled?: boolean;
}

interface UseTeamMembersResult {
  members: TeamMembershipWithUser[];
  currentUserMembership: TeamMembershipWithUser | null;
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  inviteMember: (input: InviteTeamMemberInput) => Promise<TeamMembership>;
  acceptInvite: (token: string) => Promise<TeamMembership>;
  updateMember: (membershipId: string, input: UpdateTeamMemberInput) => Promise<TeamMembership>;
  setManager: (membershipId: string, managerMembershipId: string | null) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  isUpdating: boolean;
}

/**
 * Hook for managing team memberships
 *
 * Provides functionality to:
 * - List all team members
 * - Invite new members
 * - Accept invites
 * - Update member roles
 * - Set manager relationships
 * - Remove members
 */
export function useTeamMembers(options: UseTeamMembersOptions): UseTeamMembersResult {
  const { teamId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch all team members
  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.teams.memberships(teamId!),
    queryFn: async () => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from("team_memberships")
        .select("*")
        .eq("team_id", teamId)
        .neq("status", "removed")
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("Error fetching team members", error);
        throw error;
      }

      // Batch-fetch all user profiles in a single query (fixes N+1)
      const allUserIds = Array.from(
        new Set((data || []).flatMap((m: TeamMembership) => {
          const ids = [m.user_id];
          if (m.manager_membership_id) {
            const mgr = data?.find((x: TeamMembership) => x.id === m.manager_membership_id);
            if (mgr) ids.push(mgr.user_id);
          }
          return ids;
        }))
      );
      const profileMap = await batchFetchUserProfiles(allUserIds);

      const enrichedData = (data || []).map((member: TeamMembership) => {
        const enriched: TeamMembershipWithUser = { ...member };
        enriched.user_email = profileMap.get(member.user_id)?.email || null;

        if (member.manager_membership_id) {
          const managerMembership = data?.find((m: TeamMembership) => m.id === member.manager_membership_id);
          if (managerMembership) {
            enriched.manager_name = profileMap.get(managerMembership.user_id)?.email || null;
          }
        }

        return enriched;
      });

      return enrichedData;
    },
    enabled: enabled && !!teamId,
  });

  // Find current user's membership
  const currentUserMembership = useMemo(() => {
    if (!members || !userId) return null;
    return members.find(m => m.user_id === userId && m.status === 'active') || null;
  }, [members, userId]);

  const isAdmin = currentUserMembership?.role === 'admin';
  const isManager = currentUserMembership?.role === 'manager' || isAdmin;

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async (input: InviteTeamMemberInput): Promise<TeamMembership> => {
      if (!teamId || !userId) {
        throw new Error("Team ID and User ID are required to invite member");
      }

      const inviteToken = generateInviteToken();
      const inviteExpiresAt = getInviteExpiration();

      // Determine role and manager
      const role = input.role || 'member';
      const managerMembershipId = input.reports_to_me ? currentUserMembership?.id : null;

      const { data, error } = await supabase
        .from("team_memberships")
        .insert({
          team_id: teamId,
          user_id: userId, // Placeholder - will be updated when member accepts
          role,
          manager_membership_id: managerMembershipId,
          status: 'pending' as MembershipStatus,
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
          invited_by_user_id: userId,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error inviting team member", error);
        throw error;
      }

      logger.info("Team member invited", { membershipId: data.id, email: input.email });

      return data as TeamMembership;
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.memberships(teamId) });
      }
    },
  });

  // Accept invite mutation
  // Now looks up team by invite_token on teams table and creates a new membership
  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string): Promise<TeamMembership> => {
      if (!userId) {
        throw new Error("User ID is required to accept invite");
      }

      // Find the team by invite token (now stored on teams table)
      const { data: team, error: findError } = await supabase
        .from("teams")
        .select("id, name, invite_token, invite_expires_at")
        .eq("invite_token", token)
        .single();

      if (findError || !team) {
        throw new Error("Invalid or expired invite");
      }

      // Check if invite expired
      if (team.invite_expires_at && new Date(team.invite_expires_at) < new Date()) {
        throw new Error("This invite has expired");
      }

      // Check if user is already a member of this team
      const { data: existingMembership } = await supabase
        .from("team_memberships")
        .select("id")
        .eq("team_id", team.id)
        .eq("user_id", userId)
        .neq("status", "removed")
        .maybeSingle();

      if (existingMembership) {
        throw new Error("You are already a member of this team");
      }

      // Create a new membership for the joining user
      const { data, error } = await supabase
        .from("team_memberships")
        .insert({
          team_id: team.id,
          user_id: userId,
          role: 'member' as TeamRole,
          status: 'active' as MembershipStatus,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error("Error accepting team invite", error);
        throw error;
      }

      logger.info("Team invite accepted", { teamId: team.id, membershipId: data.id });

      return data as TeamMembership;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
  });

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async ({ membershipId, input }: { membershipId: string; input: UpdateTeamMemberInput }): Promise<TeamMembership> => {
      const updateData: Partial<TeamMembership> = {};
      if (input.role !== undefined) updateData.role = input.role;
      if (input.manager_membership_id !== undefined) updateData.manager_membership_id = input.manager_membership_id;

      const { data, error } = await supabase
        .from("team_memberships")
        .update(updateData)
        .eq("id", membershipId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating team member", error);
        throw error;
      }

      logger.info("Team member updated", { membershipId, changes: Object.keys(updateData) });

      return data as TeamMembership;
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.memberships(teamId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.hierarchy(teamId) });
      }
    },
  });

  // Set manager mutation
  const setManagerMutation = useMutation({
    mutationFn: async ({ membershipId, managerMembershipId }: { membershipId: string; managerMembershipId: string | null }): Promise<void> => {
      // Check for circular hierarchy if setting a manager
      if (managerMembershipId) {
        // Get the membership being updated
        const { data: membership } = await supabase
          .from("team_memberships")
          .select("id")
          .eq("id", membershipId)
          .single();

        if (!membership) {
          throw new Error("Membership not found");
        }

        // Check if the new manager (or any of their ancestors) reports to this member
        let currentManagerId: string | null = managerMembershipId;
        while (currentManagerId) {
          if (currentManagerId === membershipId) {
            throw new Error("Cannot create circular reporting structure");
          }

          const { data: managerMembership } = await supabase
            .from("team_memberships")
            .select("manager_membership_id")
            .eq("id", currentManagerId)
            .single();

          currentManagerId = managerMembership?.manager_membership_id || null;
        }
      }

      const { error } = await supabase
        .from("team_memberships")
        .update({ manager_membership_id: managerMembershipId })
        .eq("id", membershipId);

      if (error) {
        logger.error("Error setting manager", error);
        throw error;
      }

      logger.info("Manager set", { membershipId, managerMembershipId });
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.memberships(teamId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.hierarchy(teamId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.directReports() });
      }
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string): Promise<void> => {
      // Check if this is the last admin
      const { data: membership } = await supabase
        .from("team_memberships")
        .select("role, team_id")
        .eq("id", membershipId)
        .single();

      if (membership?.role === 'admin') {
        const { count } = await supabase
          .from("team_memberships")
          .select("*", { count: 'exact', head: true })
          .eq("team_id", membership.team_id)
          .eq("role", "admin")
          .eq("status", "active")
          .neq("id", membershipId);

        if (count === 0) {
          throw new Error("Cannot remove the last admin. Transfer admin role first.");
        }
      }

      const { error } = await supabase
        .from("team_memberships")
        .update({ status: 'removed' as MembershipStatus })
        .eq("id", membershipId);

      if (error) {
        logger.error("Error removing team member", error);
        throw error;
      }

      // Update any members who reported to this person to have no manager
      await supabase
        .from("team_memberships")
        .update({ manager_membership_id: null })
        .eq("manager_membership_id", membershipId);

      logger.info("Team member removed", { membershipId });
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.memberships(teamId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.hierarchy(teamId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.directReports() });
      }
    },
  });

  return {
    members: members || [],
    currentUserMembership,
    isAdmin,
    isManager,
    isLoading,
    inviteMember: inviteMemberMutation.mutateAsync,
    acceptInvite: acceptInviteMutation.mutateAsync,
    updateMember: (membershipId: string, input: UpdateTeamMemberInput) =>
      updateMemberMutation.mutateAsync({ membershipId, input }),
    setManager: (membershipId: string, managerMembershipId: string | null) =>
      setManagerMutation.mutateAsync({ membershipId, managerMembershipId }),
    removeMember: removeMemberMutation.mutateAsync,
    isUpdating:
      inviteMemberMutation.isPending ||
      acceptInviteMutation.isPending ||
      updateMemberMutation.isPending ||
      setManagerMutation.isPending ||
      removeMemberMutation.isPending,
  };
}
