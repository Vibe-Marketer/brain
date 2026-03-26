/**
 * Shared helper functions for team hierarchy hooks.
 * Extracted from useTeamHierarchy.ts to avoid a 1,200-line monolith.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TeamMembershipWithUser, OrgChartNode } from "@/types/sharing";

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
export function generateInviteToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Calculates invite expiration date (7 days from now)
 */
export function getInviteExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

/**
 * Batch-fetch user profiles (email + display_name) for a set of user IDs.
 * Returns a Map<userId, { email, display_name }> so callers can do O(1) lookups.
 * This replaces the previous pattern of calling supabase.rpc('get_user_email')
 * once per user — which caused N+1 API calls.
 */
export async function batchFetchUserProfiles(
  userIds: string[]
): Promise<Map<string, { email: string; display_name: string | null }>> {
  const profileMap = new Map<string, { email: string; display_name: string | null }>();
  if (!userIds.length) return profileMap;

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, email, display_name')
    .in('user_id', userIds);

  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, {
      email: p.email || '',
      display_name: p.display_name || null,
    });
  }
  return profileMap;
}

/**
 * Builds org chart tree from flat membership list
 */
export function buildOrgChart(members: TeamMembershipWithUser[]): OrgChartNode[] {
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
