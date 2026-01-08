import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-config";
import {
  AccessLevel,
  CallAccessInfo,
  PersonWithAccess,
  SharingStatus,
  ShareLink,
} from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface UseAccessControlOptions {
  callId: number | string | null;
  callOwnerId?: string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseAccessControlResult {
  // Access checks
  canAccess: boolean;
  accessLevel: AccessLevel | null;
  accessInfo: CallAccessInfo | null;
  // Sharing status
  sharingStatus: SharingStatus;
  // People with access
  peopleWithAccess: PersonWithAccess[];
  // Loading state
  isLoading: boolean;
  // Helpers
  isOwner: boolean;
  isCoach: boolean;
  isManager: boolean;
  isPeer: boolean;
  isSharedLink: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines if a call is shared with a coach based on sharing rules
 */
async function checkCoachAccess(
  callId: number | string,
  callOwnerId: string,
  coachUserId: string
): Promise<{ hasAccess: boolean; relationshipId: string | null }> {
  // Find active relationship where user is coach
  const { data: relationship, error: relError } = await supabase
    .from("coach_relationships")
    .select("id")
    .eq("coach_user_id", coachUserId)
    .eq("coachee_user_id", callOwnerId)
    .eq("status", "active")
    .maybeSingle();

  if (relError || !relationship) {
    return { hasAccess: false, relationshipId: null };
  }

  // Check sharing rules for this relationship
  const { data: shares, error: sharesError } = await supabase
    .from("coach_shares")
    .select("share_type, folder_id, tag_id")
    .eq("relationship_id", relationship.id);

  if (sharesError || !shares?.length) {
    return { hasAccess: false, relationshipId: relationship.id };
  }

  // If sharing all, grant access
  if (shares.some(s => s.share_type === 'all')) {
    return { hasAccess: true, relationshipId: relationship.id };
  }

  // Check folder-based sharing
  const folderIds = shares.filter(s => s.share_type === 'folder').map(s => s.folder_id);
  if (folderIds.length > 0) {
    const { data: folderAssignment } = await supabase
      .from("folder_assignments")
      .select("id")
      .eq("recording_id", callId)
      .in("folder_id", folderIds)
      .limit(1);

    if (folderAssignment?.length) {
      return { hasAccess: true, relationshipId: relationship.id };
    }
  }

  // Check tag-based sharing
  const tagIds = shares.filter(s => s.share_type === 'tag').map(s => s.tag_id);
  if (tagIds.length > 0) {
    const { data: tagAssignment } = await supabase
      .from("call_tags")
      .select("id")
      .eq("recording_id", callId)
      .in("tag_id", tagIds)
      .limit(1);

    if (tagAssignment?.length) {
      return { hasAccess: true, relationshipId: relationship.id };
    }
  }

  return { hasAccess: false, relationshipId: relationship.id };
}

/**
 * Determines if a call is visible to a manager
 */
async function checkManagerAccess(
  callOwnerId: string,
  potentialManagerUserId: string
): Promise<boolean> {
  // Get the call owner's membership
  const { data: ownerMembership, error: ownerError } = await supabase
    .from("team_memberships")
    .select("id, manager_membership_id, team_id")
    .eq("user_id", callOwnerId)
    .eq("status", "active")
    .maybeSingle();

  if (ownerError || !ownerMembership) {
    return false;
  }

  // If no manager, check if admin_sees_all is enabled
  if (!ownerMembership.manager_membership_id) {
    // Check team settings
    const { data: team } = await supabase
      .from("teams")
      .select("admin_sees_all, owner_user_id")
      .eq("id", ownerMembership.team_id)
      .single();

    if (team?.admin_sees_all) {
      // Check if potential manager is admin
      const { data: adminMembership } = await supabase
        .from("team_memberships")
        .select("role")
        .eq("team_id", ownerMembership.team_id)
        .eq("user_id", potentialManagerUserId)
        .eq("status", "active")
        .eq("role", "admin")
        .maybeSingle();

      if (adminMembership) {
        return true;
      }
    }
    return false;
  }

  // Check if the potential manager owns the manager_membership
  const { data: managerMembership, error: managerError } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("id", ownerMembership.manager_membership_id)
    .single();

  if (managerError || !managerMembership) {
    return false;
  }

  if (managerMembership.user_id === potentialManagerUserId) {
    return true;
  }

  // Recursively check up the hierarchy
  return checkManagerAccess(ownerMembership.manager_membership_id, potentialManagerUserId);
}

/**
 * Determines if a call is shared via peer sharing (team_shares)
 */
async function checkPeerAccess(
  callId: number | string,
  callOwnerId: string,
  recipientUserId: string
): Promise<boolean> {
  // Get team shares where user is recipient and call owner is owner
  const { data: shares, error } = await supabase
    .from("team_shares")
    .select("share_type, folder_id, tag_id")
    .eq("owner_user_id", callOwnerId)
    .eq("recipient_user_id", recipientUserId);

  if (error || !shares?.length) {
    return false;
  }

  // Check folder-based sharing
  const folderIds = shares.filter(s => s.share_type === 'folder').map(s => s.folder_id);
  if (folderIds.length > 0) {
    const { data: folderAssignment } = await supabase
      .from("folder_assignments")
      .select("id")
      .eq("recording_id", callId)
      .in("folder_id", folderIds)
      .limit(1);

    if (folderAssignment?.length) {
      return true;
    }
  }

  // Check tag-based sharing
  const tagIds = shares.filter(s => s.share_type === 'tag').map(s => s.tag_id);
  if (tagIds.length > 0) {
    const { data: tagAssignment } = await supabase
      .from("call_tags")
      .select("id")
      .eq("recording_id", callId)
      .in("tag_id", tagIds)
      .limit(1);

    if (tagAssignment?.length) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Main Hook: useAccessControl
// ============================================================================

/**
 * Hook for checking access control and permissions for a call
 *
 * Provides functionality to:
 * - Check if current user can access a call
 * - Determine access level (owner, coach, manager, peer, shared_link)
 * - Get all people with access to a call
 * - Get sharing status for a call
 */
export function useAccessControl(options: UseAccessControlOptions): UseAccessControlResult {
  const { callId, callOwnerId, userId, enabled = true } = options;

  // Fetch comprehensive access control data
  const { data: accessData, isLoading } = useQuery({
    queryKey: ['access-control', callId, userId],
    queryFn: async () => {
      if (!callId || !userId) {
        return {
          isOwner: false,
          accessLevel: null,
          shareLinks: [],
          coachAccess: null,
          isManager: false,
          isPeer: false,
          peopleWithAccess: [],
        };
      }

      // First, check if user owns the call
      const { data: ownedCall, error: ownError } = await supabase
        .from("fathom_calls")
        .select("recording_id, user_id")
        .eq("recording_id", callId)
        .eq("user_id", userId)
        .maybeSingle();

      const isOwner = !!ownedCall && !ownError;

      // Get call owner ID if not provided
      let effectiveCallOwnerId = callOwnerId;
      if (!effectiveCallOwnerId && !isOwner) {
        const { data: callData } = await supabase
          .from("fathom_calls")
          .select("user_id")
          .eq("recording_id", callId)
          .maybeSingle();

        effectiveCallOwnerId = callData?.user_id || null;
      } else if (isOwner) {
        effectiveCallOwnerId = userId;
      }

      // If owner, we have full access
      if (isOwner) {
        // Fetch share links for the call
        const { data: shareLinks } = await supabase
          .from("call_share_links")
          .select("*")
          .eq("call_recording_id", callId)
          .eq("user_id", userId);

        // Fetch people who accessed via share links
        const linkAccessPromises = (shareLinks || [])
          .filter((l: ShareLink) => l.status === 'active')
          .map(async (link: ShareLink) => {
            const { data: accessLog } = await supabase
              .from("call_share_access_log")
              .select("accessed_by_user_id, accessed_at")
              .eq("share_link_id", link.id)
              .order("accessed_at", { ascending: false });

            return (accessLog || []).map(log => ({
              user_id: log.accessed_by_user_id,
              access_type: 'shared_link' as AccessLevel,
              granted_at: log.accessed_at,
            }));
          });

        const linkAccessResults = await Promise.all(linkAccessPromises);
        const linkAccess = linkAccessResults.flat();

        // Get coaches with access
        const { data: coachRelationships } = await supabase
          .from("coach_relationships")
          .select("coach_user_id, created_at")
          .eq("coachee_user_id", userId)
          .eq("status", "active");

        const coachAccess = (coachRelationships || []).map(rel => ({
          user_id: rel.coach_user_id,
          access_type: 'coach' as AccessLevel,
          granted_at: rel.created_at,
        }));

        // Get managers with access
        const { data: ownerMembership } = await supabase
          .from("team_memberships")
          .select("manager_membership_id, team_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        const managerAccess: Array<{ user_id: string; access_type: AccessLevel; granted_at: string }> = [];
        if (ownerMembership?.manager_membership_id) {
          const { data: managerMembership } = await supabase
            .from("team_memberships")
            .select("user_id, joined_at")
            .eq("id", ownerMembership.manager_membership_id)
            .single();

          if (managerMembership) {
            managerAccess.push({
              user_id: managerMembership.user_id,
              access_type: 'manager',
              granted_at: managerMembership.joined_at || new Date().toISOString(),
            });
          }
        }

        // Get peers with access via team shares
        const { data: teamShares } = await supabase
          .from("team_shares")
          .select("recipient_user_id, created_at")
          .eq("owner_user_id", userId);

        const peerAccess = (teamShares || []).map(share => ({
          user_id: share.recipient_user_id,
          access_type: 'peer' as AccessLevel,
          granted_at: share.created_at,
        }));

        // Combine all people with access
        const allAccess = [...linkAccess, ...coachAccess, ...managerAccess, ...peerAccess];

        // Deduplicate by user_id, keeping highest access level
        const accessLevelPriority: Record<AccessLevel, number> = {
          owner: 4,
          manager: 3,
          coach: 2,
          peer: 1,
          shared_link: 0,
        };

        const uniqueAccess = Object.values(
          allAccess.reduce((acc, person) => {
            const existing = acc[person.user_id];
            if (!existing || accessLevelPriority[person.access_type] > accessLevelPriority[existing.access_type]) {
              acc[person.user_id] = person;
            }
            return acc;
          }, {} as Record<string, typeof allAccess[0]>)
        );

        // Enrich with user emails
        const enrichedPeople: PersonWithAccess[] = await Promise.all(
          uniqueAccess.map(async (person) => {
            const { data: email } = await supabase.rpc('get_user_email', {
              user_id: person.user_id
            });
            return {
              user_id: person.user_id,
              email: email || 'Unknown',
              name: null,
              access_type: person.access_type,
              granted_at: person.granted_at,
              can_revoke: true, // Owner can revoke all access
            };
          })
        );

        return {
          isOwner: true,
          accessLevel: 'owner' as AccessLevel,
          shareLinks: shareLinks as ShareLink[] || [],
          coachAccess: null,
          isManager: false,
          isPeer: false,
          peopleWithAccess: enrichedPeople,
        };
      }

      // Not owner - check other access types
      if (!effectiveCallOwnerId) {
        return {
          isOwner: false,
          accessLevel: null,
          shareLinks: [],
          coachAccess: null,
          isManager: false,
          isPeer: false,
          peopleWithAccess: [],
        };
      }

      // Check coach access
      const coachAccessResult = await checkCoachAccess(callId, effectiveCallOwnerId, userId);
      if (coachAccessResult.hasAccess) {
        return {
          isOwner: false,
          accessLevel: 'coach' as AccessLevel,
          shareLinks: [],
          coachAccess: coachAccessResult,
          isManager: false,
          isPeer: false,
          peopleWithAccess: [],
        };
      }

      // Check manager access
      const hasManagerAccess = await checkManagerAccess(effectiveCallOwnerId, userId);
      if (hasManagerAccess) {
        return {
          isOwner: false,
          accessLevel: 'manager' as AccessLevel,
          shareLinks: [],
          coachAccess: null,
          isManager: true,
          isPeer: false,
          peopleWithAccess: [],
        };
      }

      // Check peer access
      const hasPeerAccess = await checkPeerAccess(callId, effectiveCallOwnerId, userId);
      if (hasPeerAccess) {
        return {
          isOwner: false,
          accessLevel: 'peer' as AccessLevel,
          shareLinks: [],
          coachAccess: null,
          isManager: false,
          isPeer: true,
          peopleWithAccess: [],
        };
      }

      // Check shared link access (user has viewed via a share link)
      const { data: accessedViaLink } = await supabase
        .from("call_share_access_log")
        .select(`
          id,
          share_link:call_share_links!inner(
            call_recording_id,
            status
          )
        `)
        .eq("accessed_by_user_id", userId)
        .eq("share_link.call_recording_id", callId)
        .eq("share_link.status", "active")
        .limit(1);

      if (accessedViaLink?.length) {
        return {
          isOwner: false,
          accessLevel: 'shared_link' as AccessLevel,
          shareLinks: [],
          coachAccess: null,
          isManager: false,
          isPeer: false,
          peopleWithAccess: [],
        };
      }

      // No access
      return {
        isOwner: false,
        accessLevel: null,
        shareLinks: [],
        coachAccess: null,
        isManager: false,
        isPeer: false,
        peopleWithAccess: [],
      };
    },
    enabled: enabled && !!callId && !!userId,
  });

  // Compute sharing status
  const sharingStatus: SharingStatus = useMemo(() => {
    if (!accessData) {
      return {
        hasShareLinks: false,
        shareLinkCount: 0,
        sharedWithCoach: false,
        coachCount: 0,
        visibleToTeam: false,
        visibleToManager: false,
      };
    }

    const activeLinks = (accessData.shareLinks || []).filter((l: ShareLink) => l.status === 'active');
    const coaches = accessData.peopleWithAccess.filter(p => p.access_type === 'coach');
    const managers = accessData.peopleWithAccess.filter(p => p.access_type === 'manager');
    const peers = accessData.peopleWithAccess.filter(p => p.access_type === 'peer');

    return {
      hasShareLinks: activeLinks.length > 0,
      shareLinkCount: activeLinks.length,
      sharedWithCoach: coaches.length > 0,
      coachCount: coaches.length,
      visibleToTeam: peers.length > 0,
      visibleToManager: managers.length > 0,
    };
  }, [accessData]);

  // Build access info
  const accessInfo: CallAccessInfo | null = useMemo(() => {
    if (!accessData || !accessData.accessLevel) {
      return null;
    }

    const isOwner = accessData.accessLevel === 'owner';
    const isCoach = accessData.accessLevel === 'coach';
    const isManager = accessData.accessLevel === 'manager';
    const isPeer = accessData.accessLevel === 'peer';
    const isSharedLink = accessData.accessLevel === 'shared_link';

    return {
      accessLevel: accessData.accessLevel,
      canEdit: isOwner,
      canDelete: isOwner,
      canShare: isOwner,
      canAddNotes: isOwner || isCoach || isManager,
      sharedBy: null, // Could be enriched if needed
      sharedVia: isCoach ? 'coach' : isManager ? 'manager' : isPeer ? 'team' : isSharedLink ? 'link' : undefined,
    };
  }, [accessData]);

  return {
    // Access checks
    canAccess: !!accessData?.accessLevel,
    accessLevel: accessData?.accessLevel || null,
    accessInfo,
    // Sharing status
    sharingStatus,
    // People with access
    peopleWithAccess: accessData?.peopleWithAccess || [],
    // Loading state
    isLoading,
    // Helpers
    isOwner: accessData?.isOwner || false,
    isCoach: accessData?.accessLevel === 'coach',
    isManager: accessData?.accessLevel === 'manager',
    isPeer: accessData?.accessLevel === 'peer',
    isSharedLink: accessData?.accessLevel === 'shared_link',
  };
}

// ============================================================================
// Hook: useCallSharingStatus
// ============================================================================

/**
 * Lightweight hook for just checking sharing status of a call
 * Used in list views where we don't need full access control data
 */
interface UseCallSharingStatusOptions {
  callId: number | string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseCallSharingStatusResult {
  sharingStatus: SharingStatus;
  isLoading: boolean;
}

export function useCallSharingStatus(options: UseCallSharingStatusOptions): UseCallSharingStatusResult {
  const { callId, userId, enabled = true } = options;

  const { data: sharingStatus, isLoading } = useQuery({
    queryKey: queryKeys.sharing.links(callId!),
    queryFn: async (): Promise<SharingStatus> => {
      if (!callId || !userId) {
        return {
          hasShareLinks: false,
          shareLinkCount: 0,
          sharedWithCoach: false,
          coachCount: 0,
          visibleToTeam: false,
          visibleToManager: false,
        };
      }

      // Count active share links
      const { count: shareLinkCount } = await supabase
        .from("call_share_links")
        .select("*", { count: 'exact', head: true })
        .eq("call_recording_id", callId)
        .eq("user_id", userId)
        .eq("status", "active");

      // Count coaches with access
      const { data: coachRelationships } = await supabase
        .from("coach_relationships")
        .select("id")
        .eq("coachee_user_id", userId)
        .eq("status", "active");

      // Check if visible to manager
      const { data: ownerMembership } = await supabase
        .from("team_memberships")
        .select("manager_membership_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // Check if shared with peers
      const { count: peerShareCount } = await supabase
        .from("team_shares")
        .select("*", { count: 'exact', head: true })
        .eq("owner_user_id", userId);

      return {
        hasShareLinks: (shareLinkCount || 0) > 0,
        shareLinkCount: shareLinkCount || 0,
        sharedWithCoach: (coachRelationships?.length || 0) > 0,
        coachCount: coachRelationships?.length || 0,
        visibleToTeam: (peerShareCount || 0) > 0,
        visibleToManager: !!ownerMembership?.manager_membership_id,
      };
    },
    enabled: enabled && !!callId && !!userId,
  });

  return {
    sharingStatus: sharingStatus || {
      hasShareLinks: false,
      shareLinkCount: 0,
      sharedWithCoach: false,
      coachCount: 0,
      visibleToTeam: false,
      visibleToManager: false,
    },
    isLoading,
  };
}
