import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import {
  Team,
  TeamWithOwner,
  TeamMembership,
  TeamMembershipWithUser,
  TeamShare,
  TeamShareWithDetails,
  ManagerNote,
  TeamRole,
  MembershipStatus,
  ShareType,
  OrgChart,
  OrgChartNode,
  CreateTeamInput,
  InviteTeamMemberInput,
  UpdateTeamMemberInput,
} from "@/types/sharing";

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

interface UseManagerNotesOptions {
  callId: number | string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseManagerNotesResult {
  note: ManagerNote | null;
  isLoading: boolean;
  saveNote: (noteText: string) => Promise<ManagerNote>;
  deleteNote: () => Promise<void>;
  isSaving: boolean;
}

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

interface UseOrgChartOptions {
  teamId?: string;
  enabled?: boolean;
}

interface UseOrgChartResult {
  orgChart: OrgChart | null;
  isLoading: boolean;
  refetch: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
function generateInviteToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Calculates invite expiration date (7 days from now)
 */
function getInviteExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

/**
 * Builds org chart tree from flat membership list
 */
function buildOrgChart(members: TeamMembershipWithUser[]): OrgChartNode[] {
  const memberMap = new Map<string, OrgChartNode>();
  const rootNodes: OrgChartNode[] = [];

  // Create nodes for all members
  members.forEach(member => {
    memberMap.set(member.id, { membership: member, children: [] });
  });

  // Build hierarchy
  members.forEach(member => {
    const node = memberMap.get(member.id)!;
    if (member.manager_membership_id) {
      const parentNode = memberMap.get(member.manager_membership_id);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Manager not found, treat as root
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
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

// ============================================================================
// Hook: useTeamMembers
// ============================================================================

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

      // Enrich with user emails and manager names
      const enrichedData = await Promise.all(
        (data || []).map(async (member: TeamMembership) => {
          const enriched: TeamMembershipWithUser = { ...member };

          // Get user email
          const { data: userData } = await supabase.rpc('get_user_email', {
            user_id: member.user_id
          });
          enriched.user_email = userData || null;

          // Get manager name if exists
          if (member.manager_membership_id) {
            const managerMembership = data?.find(m => m.id === member.manager_membership_id);
            if (managerMembership) {
              const { data: managerData } = await supabase.rpc('get_user_email', {
                user_id: managerMembership.user_id
              });
              enriched.manager_name = managerData || null;
            }
          }

          return enriched;
        })
      );

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

// ============================================================================
// Hook: useDirectReports
// ============================================================================

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

      if (!myMemberships?.length) {
        return { directReports: [], calls: [] };
      }

      const myMembershipIds = myMemberships.map(m => m.id);

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

      if (!reports?.length) {
        return { directReports: [], calls: [] };
      }

      // Enrich direct reports with user info
      const enrichedReports = await Promise.all(
        reports.map(async (report: TeamMembership) => {
          const enriched: TeamMembershipWithUser = { ...report };
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: report.user_id
          });
          enriched.user_email = email || null;
          return enriched;
        })
      );

      // Get calls from all direct reports
      const directReportUserIds = reports.map(r => r.user_id);
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

      // Enrich calls with owner info
      const enrichedCalls: DirectReportCall[] = await Promise.all(
        (calls || []).map(async (call) => {
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: call.user_id
          });
          return {
            ...call,
            owner_email: email || '',
            owner_name: null,
            owner_user_id: call.user_id,
          };
        })
      );

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

// ============================================================================
// Hook: useManagerNotes
// ============================================================================

/**
 * Hook for managers to add private notes on direct report calls
 */
export function useManagerNotes(options: UseManagerNotesOptions): UseManagerNotesResult {
  const { callId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch note for this call
  const { data: note, isLoading } = useQuery({
    queryKey: queryKeys.teams.managerNotes(callId!),
    queryFn: async () => {
      if (!callId || !userId) return null;

      const { data, error } = await supabase
        .from("manager_notes")
        .select("*")
        .eq("manager_user_id", userId)
        .eq("call_recording_id", callId)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching manager note", error);
        throw error;
      }

      return data as ManagerNote | null;
    },
    enabled: enabled && !!callId && !!userId,
  });

  // Save note mutation (create or update)
  const saveNoteMutation = useMutation({
    mutationFn: async (noteText: string): Promise<ManagerNote> => {
      if (!callId || !userId) {
        throw new Error("Call ID and User ID are required");
      }

      // Get the call owner for the composite FK
      const { data: callData, error: callError } = await supabase
        .from("fathom_calls")
        .select("user_id")
        .eq("recording_id", callId)
        .single();

      if (callError || !callData) {
        throw new Error("Call not found");
      }

      if (note) {
        // Update existing note
        const { data, error } = await supabase
          .from("manager_notes")
          .update({
            note: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.id)
          .select()
          .single();

        if (error) {
          logger.error("Error updating manager note", error);
          throw error;
        }

        logger.info("Manager note updated", { noteId: data.id });
        return data as ManagerNote;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from("manager_notes")
          .insert({
            manager_user_id: userId,
            call_recording_id: Number(callId),
            user_id: callData.user_id, // Call owner for composite FK
            note: noteText,
          })
          .select()
          .single();

        if (error) {
          logger.error("Error creating manager note", error);
          throw error;
        }

        logger.info("Manager note created", { noteId: data.id });
        return data as ManagerNote;
      }
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.managerNotes(callId) });
      }
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!note) {
        throw new Error("No note to delete");
      }

      const { error } = await supabase
        .from("manager_notes")
        .delete()
        .eq("id", note.id);

      if (error) {
        logger.error("Error deleting manager note", error);
        throw error;
      }

      logger.info("Manager note deleted", { noteId: note.id });
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.managerNotes(callId) });
      }
    },
  });

  return {
    note: note || null,
    isLoading,
    saveNote: saveNoteMutation.mutateAsync,
    deleteNote: deleteNoteMutation.mutateAsync,
    isSaving: saveNoteMutation.isPending || deleteNoteMutation.isPending,
  };
}

// ============================================================================
// Hook: useTeamShares
// ============================================================================

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

      // Enrich with user names
      const enrichMyShares = await Promise.all(
        (myShares || []).map(async (share: TeamShare & { folders?: { name: string }; transcript_tags?: { name: string } }) => {
          const { data: recipientEmail } = await supabase.rpc('get_user_email', {
            user_id: share.recipient_user_id
          });
          return {
            ...share,
            owner_name: null, // Current user is owner
            recipient_name: recipientEmail || null,
            folder_name: share.folders?.name || null,
            tag_name: share.transcript_tags?.name || null,
          } as TeamShareWithDetails;
        })
      );

      const enrichSharesWithMe = await Promise.all(
        (sharesWithMe || []).map(async (share: TeamShare & { folders?: { name: string }; transcript_tags?: { name: string } }) => {
          const { data: ownerEmail } = await supabase.rpc('get_user_email', {
            user_id: share.owner_user_id
          });
          return {
            ...share,
            owner_name: ownerEmail || null,
            recipient_name: null, // Current user is recipient
            folder_name: share.folders?.name || null,
            tag_name: share.transcript_tags?.name || null,
          } as TeamShareWithDetails;
        })
      );

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

// ============================================================================
// Hook: useOrgChart
// ============================================================================

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

      // Enrich with user info
      const enrichedMembers = await Promise.all(
        (members || []).map(async (member: TeamMembership) => {
          const enriched: TeamMembershipWithUser = { ...member };
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: member.user_id
          });
          enriched.user_email = email || null;
          return enriched;
        })
      );

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
