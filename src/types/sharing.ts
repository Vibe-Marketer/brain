/**
 * Sharing Types
 * Used throughout the application for type-safe sharing data handling
 * Covers: Single Call Share, Coach Access, and Team Access features
 */

// ============================================================================
// Enums and Status Types
// ============================================================================

export type ShareLinkStatus = 'active' | 'revoked';

export type RelationshipStatus = 'pending' | 'active' | 'paused' | 'revoked';

export type InvitedBy = 'coach' | 'coachee';

export type ShareType = 'folder' | 'tag' | 'all';

export type TeamRole = 'admin' | 'manager' | 'member';

export type MembershipStatus = 'pending' | 'active' | 'removed';

export type AccessLevel = 'owner' | 'coach' | 'manager' | 'peer' | 'shared_link';

// ============================================================================
// Single Call Share Types
// ============================================================================

export interface ShareLink {
  id: string;
  call_recording_id: number;
  user_id: string;
  created_by_user_id: string;
  share_token: string;
  recipient_email?: string | null;
  status: ShareLinkStatus;
  created_at: string;
  revoked_at?: string | null;
}

export interface ShareAccessLog {
  id: string;
  share_link_id: string;
  accessed_by_user_id: string;
  accessed_at: string;
  ip_address?: string | null;
}

export interface ShareAccessLogWithUser extends ShareAccessLog {
  user_email?: string | null;
  user_name?: string | null;
}

// ============================================================================
// Coach Access Types
// ============================================================================

export interface CoachRelationship {
  id: string;
  coach_user_id: string;
  coachee_user_id: string;
  status: RelationshipStatus;
  invited_by?: InvitedBy | null;
  invite_token?: string | null;
  invite_expires_at?: string | null;
  created_at: string;
  accepted_at?: string | null;
  ended_at?: string | null;
}

export interface CoachRelationshipWithUsers extends CoachRelationship {
  coach_email?: string | null;
  coach_name?: string | null;
  coachee_email?: string | null;
  coachee_name?: string | null;
}

export interface CoachShare {
  id: string;
  relationship_id: string;
  share_type: ShareType;
  folder_id?: string | null;
  tag_id?: string | null;
  created_at: string;
}

export interface CoachShareWithDetails extends CoachShare {
  folder_name?: string | null;
  tag_name?: string | null;
}

export interface CoachNote {
  id: string;
  relationship_id: string;
  call_recording_id: number;
  user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Team Access Types
// ============================================================================

export interface Team {
  id: string;
  name: string;
  owner_user_id: string;
  admin_sees_all: boolean;
  domain_auto_join?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamWithOwner extends Team {
  owner_email?: string | null;
  owner_name?: string | null;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  manager_membership_id?: string | null;
  status: MembershipStatus;
  invite_token?: string | null;
  invite_expires_at?: string | null;
  invited_by_user_id?: string | null;
  created_at: string;
  joined_at?: string | null;
}

export interface TeamMembershipWithUser extends TeamMembership {
  user_email?: string | null;
  user_name?: string | null;
  manager_name?: string | null;
}

export interface TeamShare {
  id: string;
  team_id: string;
  owner_user_id: string;
  recipient_user_id: string;
  share_type: ShareType;
  folder_id?: string | null;
  tag_id?: string | null;
  created_at: string;
}

export interface TeamShareWithDetails extends TeamShare {
  owner_name?: string | null;
  recipient_name?: string | null;
  folder_name?: string | null;
  tag_name?: string | null;
}

export interface ManagerNote {
  id: string;
  manager_user_id: string;
  call_recording_id: number;
  user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Composite Types for UI Display
// ============================================================================

export interface SharingStatus {
  hasShareLinks: boolean;
  shareLinkCount: number;
  sharedWithCoach: boolean;
  coachCount: number;
  visibleToTeam: boolean;
  visibleToManager: boolean;
}

export interface CallAccessInfo {
  accessLevel: AccessLevel;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canAddNotes: boolean;
  sharedBy?: string | null;
  sharedVia?: 'link' | 'coach' | 'team' | 'manager';
}

export interface PersonWithAccess {
  user_id: string;
  email: string;
  name?: string | null;
  access_type: AccessLevel;
  granted_at: string;
  can_revoke: boolean;
}

// ============================================================================
// Form/Input Types
// ============================================================================

export interface CreateShareLinkInput {
  call_recording_id: number;
  recipient_email?: string;
}

export interface CreateCoachInviteInput {
  email: string;
  message?: string;
}

export interface ConfigureCoachSharingInput {
  relationship_id: string;
  share_type: ShareType;
  folder_ids?: string[];
  tag_ids?: string[];
}

export interface CreateTeamInput {
  name: string;
  admin_sees_all?: boolean;
  domain_auto_join?: string;
}

export interface InviteTeamMemberInput {
  email: string;
  role?: TeamRole;
  reports_to_me?: boolean;
}

export interface UpdateTeamMemberInput {
  role?: TeamRole;
  manager_membership_id?: string | null;
}

// ============================================================================
// Org Chart Types
// ============================================================================

export interface OrgChartNode {
  membership: TeamMembershipWithUser;
  children: OrgChartNode[];
}

export interface OrgChart {
  team: Team;
  root_nodes: OrgChartNode[];
  total_members: number;
}
