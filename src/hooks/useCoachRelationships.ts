import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import {
  CoachRelationship,
  CoachRelationshipWithUsers,
  CoachShare,
  CoachShareWithDetails,
  CoachNote,
  RelationshipStatus,
  ShareType,
  ConfigureCoachSharingInput,
} from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface UseCoachRelationshipsOptions {
  userId?: string;
  enabled?: boolean;
}

interface UseCoachRelationshipsResult {
  // Queries
  relationships: CoachRelationshipWithUsers[];
  asCoach: CoachRelationshipWithUsers[];
  asCoachee: CoachRelationshipWithUsers[];
  isLoading: boolean;
  // Mutations
  inviteCoach: (email: string, message?: string) => Promise<CoachRelationship>;
  inviteCoachee: () => Promise<{ invite_token: string; invite_url: string }>;
  acceptInvite: (token: string) => Promise<CoachRelationship>;
  updateStatus: (relationshipId: string, status: RelationshipStatus) => Promise<void>;
  endRelationship: (relationshipId: string) => Promise<void>;
  isInviting: boolean;
  isUpdating: boolean;
}

interface UseCoachSharesOptions {
  relationshipId: string | null;
  enabled?: boolean;
}

interface UseCoachSharesResult {
  shares: CoachShareWithDetails[];
  isLoading: boolean;
  addShare: (input: { share_type: ShareType; folder_id?: string; tag_id?: string }) => Promise<CoachShare>;
  removeShare: (shareId: string) => Promise<void>;
  configureSharing: (input: ConfigureCoachSharingInput) => Promise<void>;
  isUpdating: boolean;
}

interface UseCoacheesOptions {
  userId?: string;
  enabled?: boolean;
}

interface CoacheeWithCalls {
  relationship: CoachRelationshipWithUsers;
  callCount: number;
}

interface UseCoacheesResult {
  coachees: CoacheeWithCalls[];
  isLoading: boolean;
  refetch: () => void;
}

interface UseSharedCallsOptions {
  userId?: string;
  coacheeId?: string;
  enabled?: boolean;
}

interface SharedCall {
  recording_id: number;
  call_name: string;
  recording_start_time: string;
  duration: string | null;
  coachee_email: string;
  coachee_name?: string | null;
  relationship_id: string;
}

interface UseSharedCallsResult {
  sharedCalls: SharedCall[];
  isLoading: boolean;
  refetch: () => void;
}

interface UseCoachNotesOptions {
  callId: number | string | null;
  relationshipId: string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseCoachNotesResult {
  note: CoachNote | null;
  isLoading: boolean;
  saveNote: (noteText: string) => Promise<CoachNote>;
  deleteNote: () => Promise<void>;
  isSaving: boolean;
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
 * Calculates invite expiration date (30 days from now)
 */
function getInviteExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

// ============================================================================
// Main Hook: useCoachRelationships
// ============================================================================

/**
 * Hook for managing coach relationships
 *
 * Provides functionality to:
 * - List all coach/coachee relationships
 * - Invite coaches or coachees
 * - Accept invites
 * - Update relationship status (pause, resume)
 * - End relationships
 */
export function useCoachRelationships(options: UseCoachRelationshipsOptions): UseCoachRelationshipsResult {
  const { userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch all relationships for current user
  const { data: relationships, isLoading } = useQuery({
    queryKey: queryKeys.coaches.relationships(),
    queryFn: async () => {
      if (!userId) return [];

      // Fetch relationships where user is coach or coachee
      const { data, error } = await supabase
        .from("coach_relationships")
        .select("*")
        .or(`coach_user_id.eq.${userId},coachee_user_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching coach relationships", error);
        throw error;
      }

      // Enrich with user emails (would be better with a join/view in production)
      const enrichedData = await Promise.all(
        (data || []).map(async (rel: CoachRelationship) => {
          const enriched: CoachRelationshipWithUsers = { ...rel };

          // Get coach email
          const { data: coachData } = await supabase.rpc('get_user_email', {
            user_id: rel.coach_user_id
          });
          enriched.coach_email = coachData || null;

          // Get coachee email
          const { data: coacheeData } = await supabase.rpc('get_user_email', {
            user_id: rel.coachee_user_id
          });
          enriched.coachee_email = coacheeData || null;

          return enriched;
        })
      );

      return enrichedData;
    },
    enabled: enabled && !!userId,
  });

  // Filter relationships by role
  const asCoach = relationships?.filter(r => r.coach_user_id === userId) || [];
  const asCoachee = relationships?.filter(r => r.coachee_user_id === userId) || [];

  // Invite coach mutation (coachee invites a coach)
  const inviteCoachMutation = useMutation({
    mutationFn: async ({ email, message }: { email: string; message?: string }): Promise<CoachRelationship> => {
      if (!userId) {
        throw new Error("User ID is required to invite coach");
      }

      // Check if relationship already exists
      const { data: existing } = await supabase
        .from("coach_relationships")
        .select("id, status")
        .eq("coachee_user_id", userId)
        .ilike("coach_user_id", `%`) // Will check coach email separately
        .single();

      if (existing && existing.status === 'active') {
        throw new Error("You already have an active relationship with this coach");
      }

      // Generate invite token and expiration
      const inviteToken = generateInviteToken();
      const inviteExpiresAt = getInviteExpiration();

      // Create pending relationship in database
      const { data, error } = await supabase
        .from("coach_relationships")
        .insert({
          coach_user_id: userId, // Placeholder - will be updated when coach accepts
          coachee_user_id: userId,
          status: 'pending',
          invited_by: 'coachee',
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating coach invite", error);
        throw error;
      }

      logger.info("Coach invite created", { relationshipId: data.id, email });

      // Send invitation email via edge function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("No active session");
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/send-coach-invite`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coach_email: email,
            invite_token: inviteToken,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error("Error sending coach invite email", errorData);
          throw new Error(errorData.error || "Failed to send invitation email");
        }

        const emailResult = await response.json();
        logger.info("Coach invite email sent", { messageId: emailResult.message_id });
      } catch (emailError) {
        // Log the email error but don't fail the entire operation
        // The relationship is created, user can retry sending the email
        logger.error("Failed to send coach invite email", emailError);
        throw new Error("Invitation created but email failed to send. Please try again.");
      }

      return data as CoachRelationship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.relationships() });
    },
  });

  // Invite coachee mutation (coach generates an invite link)
  const inviteCoacheeMutation = useMutation({
    mutationFn: async (): Promise<{ invite_token: string; invite_url: string }> => {
      if (!userId) {
        throw new Error("User ID is required to invite coachee");
      }

      const inviteToken = generateInviteToken();
      const inviteExpiresAt = getInviteExpiration();

      const { data, error } = await supabase
        .from("coach_relationships")
        .insert({
          coach_user_id: userId,
          coachee_user_id: userId, // Placeholder - will be updated when coachee accepts
          status: 'pending',
          invited_by: 'coach',
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating coachee invite", error);
        throw error;
      }

      const inviteUrl = `${window.location.origin}/coach/join/${inviteToken}`;

      logger.info("Coachee invite created", { relationshipId: data.id });

      return { invite_token: inviteToken, invite_url: inviteUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.relationships() });
    },
  });

  // Accept invite mutation
  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string): Promise<CoachRelationship> => {
      if (!userId) {
        throw new Error("User ID is required to accept invite");
      }

      // Find the relationship by token
      const { data: relationship, error: findError } = await supabase
        .from("coach_relationships")
        .select("*")
        .eq("invite_token", token)
        .eq("status", "pending")
        .single();

      if (findError || !relationship) {
        throw new Error("Invalid or expired invite");
      }

      // Check if invite expired
      if (relationship.invite_expires_at && new Date(relationship.invite_expires_at) < new Date()) {
        throw new Error("This invite has expired");
      }

      // Update the relationship
      const updateData: Partial<CoachRelationship> = {
        status: 'active' as RelationshipStatus,
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      };

      // Set the correct user ID based on who invited
      if (relationship.invited_by === 'coach') {
        updateData.coachee_user_id = userId;
      } else {
        updateData.coach_user_id = userId;
      }

      const { data, error } = await supabase
        .from("coach_relationships")
        .update(updateData)
        .eq("id", relationship.id)
        .select()
        .single();

      if (error) {
        logger.error("Error accepting coach invite", error);
        throw error;
      }

      logger.info("Coach invite accepted", { relationshipId: data.id });

      return data as CoachRelationship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.relationships() });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ relationshipId, status }: { relationshipId: string; status: RelationshipStatus }): Promise<void> => {
      const { error } = await supabase
        .from("coach_relationships")
        .update({ status })
        .eq("id", relationshipId);

      if (error) {
        logger.error("Error updating relationship status", error);
        throw error;
      }

      logger.info("Relationship status updated", { relationshipId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.relationships() });
    },
  });

  // End relationship mutation
  const endRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string): Promise<void> => {
      const { error } = await supabase
        .from("coach_relationships")
        .update({
          status: 'revoked' as RelationshipStatus,
          ended_at: new Date().toISOString(),
        })
        .eq("id", relationshipId);

      if (error) {
        logger.error("Error ending relationship", error);
        throw error;
      }

      logger.info("Relationship ended", { relationshipId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.relationships() });
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.coachees() });
    },
  });

  return {
    // Queries
    relationships: relationships || [],
    asCoach,
    asCoachee,
    isLoading,
    // Mutations
    inviteCoach: (email: string, message?: string) => inviteCoachMutation.mutateAsync({ email, message }),
    inviteCoachee: () => inviteCoacheeMutation.mutateAsync(),
    acceptInvite: acceptInviteMutation.mutateAsync,
    updateStatus: (relationshipId: string, status: RelationshipStatus) =>
      updateStatusMutation.mutateAsync({ relationshipId, status }),
    endRelationship: endRelationshipMutation.mutateAsync,
    isInviting: inviteCoachMutation.isPending || inviteCoacheeMutation.isPending,
    isUpdating: updateStatusMutation.isPending || endRelationshipMutation.isPending,
  };
}

// ============================================================================
// Hook: useCoachShares
// ============================================================================

/**
 * Hook for managing sharing rules within a coach relationship
 */
export function useCoachShares(options: UseCoachSharesOptions): UseCoachSharesResult {
  const { relationshipId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch shares for a relationship
  const { data: shares, isLoading } = useQuery({
    queryKey: queryKeys.coaches.shares(relationshipId!),
    queryFn: async () => {
      if (!relationshipId) return [];

      const { data, error } = await supabase
        .from("coach_shares")
        .select(`
          *,
          folders:folder_id(name),
          transcript_tags:tag_id(name)
        `)
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching coach shares", error);
        throw error;
      }

      // Transform to include folder/tag names
      return (data || []).map((share: CoachShare & { folders?: { name: string }; transcript_tags?: { name: string } }) => ({
        ...share,
        folder_name: share.folders?.name || null,
        tag_name: share.transcript_tags?.name || null,
      })) as CoachShareWithDetails[];
    },
    enabled: enabled && !!relationshipId,
  });

  // Add share mutation
  const addShareMutation = useMutation({
    mutationFn: async (input: { share_type: ShareType; folder_id?: string; tag_id?: string }): Promise<CoachShare> => {
      if (!relationshipId) {
        throw new Error("Relationship ID is required");
      }

      const { data, error } = await supabase
        .from("coach_shares")
        .insert({
          relationship_id: relationshipId,
          share_type: input.share_type,
          folder_id: input.folder_id || null,
          tag_id: input.tag_id || null,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error adding coach share", error);
        throw error;
      }

      logger.info("Coach share added", { shareId: data.id });

      return data as CoachShare;
    },
    onSuccess: () => {
      if (relationshipId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches.shares(relationshipId) });
      }
    },
  });

  // Remove share mutation
  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string): Promise<void> => {
      const { error } = await supabase
        .from("coach_shares")
        .delete()
        .eq("id", shareId);

      if (error) {
        logger.error("Error removing coach share", error);
        throw error;
      }

      logger.info("Coach share removed", { shareId });
    },
    onSuccess: () => {
      if (relationshipId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches.shares(relationshipId) });
      }
    },
  });

  // Configure sharing (replace all shares with new configuration)
  const configureSharingMutation = useMutation({
    mutationFn: async (input: ConfigureCoachSharingInput): Promise<void> => {
      // Delete existing shares
      await supabase
        .from("coach_shares")
        .delete()
        .eq("relationship_id", input.relationship_id);

      // If sharing all, create single 'all' share
      if (input.share_type === 'all') {
        await supabase
          .from("coach_shares")
          .insert({
            relationship_id: input.relationship_id,
            share_type: 'all',
          });
      } else {
        // Create folder shares
        if (input.folder_ids?.length) {
          const folderShares = input.folder_ids.map(folder_id => ({
            relationship_id: input.relationship_id,
            share_type: 'folder' as ShareType,
            folder_id,
          }));
          await supabase.from("coach_shares").insert(folderShares);
        }

        // Create tag shares
        if (input.tag_ids?.length) {
          const tagShares = input.tag_ids.map(tag_id => ({
            relationship_id: input.relationship_id,
            share_type: 'tag' as ShareType,
            tag_id,
          }));
          await supabase.from("coach_shares").insert(tagShares);
        }
      }

      logger.info("Coach sharing configured", { relationshipId: input.relationship_id });
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.shares(input.relationship_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.coaches.sharedCalls() });
    },
  });

  return {
    shares: shares || [],
    isLoading,
    addShare: addShareMutation.mutateAsync,
    removeShare: removeShareMutation.mutateAsync,
    configureSharing: configureSharingMutation.mutateAsync,
    isUpdating: addShareMutation.isPending || removeShareMutation.isPending || configureSharingMutation.isPending,
  };
}

// ============================================================================
// Hook: useCoachees
// ============================================================================

/**
 * Hook for coaches to view their coachees
 */
export function useCoachees(options: UseCoacheesOptions): UseCoacheesResult {
  const { userId, enabled = true } = options;

  const { data: coachees, isLoading, refetch } = useQuery({
    queryKey: queryKeys.coaches.coachees(),
    queryFn: async () => {
      if (!userId) return [];

      // Get active relationships where user is coach
      const { data: relationships, error } = await supabase
        .from("coach_relationships")
        .select("*")
        .eq("coach_user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching coachees", error);
        throw error;
      }

      // Enrich with call counts and user info
      const enriched = await Promise.all(
        (relationships || []).map(async (rel: CoachRelationship) => {
          // Get coachee email
          const { data: coacheeEmail } = await supabase.rpc('get_user_email', {
            user_id: rel.coachee_user_id
          });

          // Get shared call count (simplified - would need proper sharing rule evaluation)
          const { count } = await supabase
            .from("fathom_calls")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", rel.coachee_user_id);

          return {
            relationship: {
              ...rel,
              coachee_email: coacheeEmail || null,
            } as CoachRelationshipWithUsers,
            callCount: count || 0,
          };
        })
      );

      return enriched;
    },
    enabled: enabled && !!userId,
  });

  return {
    coachees: coachees || [],
    isLoading,
    refetch,
  };
}

// ============================================================================
// Hook: useSharedCalls
// ============================================================================

/**
 * Hook for coaches to view calls shared with them
 */
export function useSharedCalls(options: UseSharedCallsOptions): UseSharedCallsResult {
  const { userId, coacheeId, enabled = true } = options;

  const { data: sharedCalls, isLoading, refetch } = useQuery({
    queryKey: queryKeys.coaches.sharedCalls({ coacheeId }),
    queryFn: async () => {
      if (!userId) return [];

      // Get active relationships where user is coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_relationships")
        .select("*")
        .eq("coach_user_id", userId)
        .eq("status", "active");

      if (relError) {
        logger.error("Error fetching coach relationships for shared calls", relError);
        throw relError;
      }

      if (!relationships?.length) return [];

      // Filter by specific coachee if provided
      const filteredRels = coacheeId
        ? relationships.filter(r => r.coachee_user_id === coacheeId)
        : relationships;

      // Get calls for each coachee based on sharing rules
      const allCalls: SharedCall[] = [];

      for (const rel of filteredRels) {
        // Get sharing rules for this relationship
        const { data: shares } = await supabase
          .from("coach_shares")
          .select("*")
          .eq("relationship_id", rel.id);

        if (!shares?.length) continue;

        // Check if sharing all
        const sharingAll = shares.some(s => s.share_type === 'all');

        const callsQuery = supabase
          .from("fathom_calls")
          .select("recording_id, call_name, recording_start_time, duration")
          .eq("user_id", rel.coachee_user_id)
          .order("recording_start_time", { ascending: false });

        if (!sharingAll) {
          // Build folder/tag filter
          const folderIds = shares.filter(s => s.share_type === 'folder').map(s => s.folder_id);
          const tagIds = shares.filter(s => s.share_type === 'tag').map(s => s.tag_id);

          // For now, get all calls - proper filtering would need folder/tag assignments
          // This is simplified for MVP
        }

        const { data: calls, error: callsError } = await callsQuery.limit(100);

        if (callsError) {
          logger.error("Error fetching shared calls", callsError);
          continue;
        }

        // Get coachee email
        const { data: coacheeEmail } = await supabase.rpc('get_user_email', {
          user_id: rel.coachee_user_id
        });

        // Add coachee info to each call
        const enrichedCalls: SharedCall[] = (calls || []).map(call => ({
          ...call,
          coachee_email: coacheeEmail || '',
          coachee_name: null,
          relationship_id: rel.id,
        }));

        allCalls.push(...enrichedCalls);
      }

      // Sort by date
      allCalls.sort((a, b) =>
        new Date(b.recording_start_time).getTime() - new Date(a.recording_start_time).getTime()
      );

      return allCalls;
    },
    enabled: enabled && !!userId,
  });

  return {
    sharedCalls: sharedCalls || [],
    isLoading,
    refetch,
  };
}

// ============================================================================
// Hook: useCoachNotes
// ============================================================================

/**
 * Hook for managing coach notes on a specific call
 */
export function useCoachNotes(options: UseCoachNotesOptions): UseCoachNotesResult {
  const { callId, relationshipId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch note for this call
  const { data: note, isLoading } = useQuery({
    queryKey: queryKeys.coaches.notes(callId!),
    queryFn: async () => {
      if (!callId || !relationshipId) return null;

      const { data, error } = await supabase
        .from("coach_notes")
        .select("*")
        .eq("relationship_id", relationshipId)
        .eq("call_recording_id", callId)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching coach note", error);
        throw error;
      }

      return data as CoachNote | null;
    },
    enabled: enabled && !!callId && !!relationshipId,
  });

  // Save note mutation (create or update)
  const saveNoteMutation = useMutation({
    mutationFn: async (noteText: string): Promise<CoachNote> => {
      if (!callId || !relationshipId || !userId) {
        throw new Error("Call ID, Relationship ID, and User ID are required");
      }

      // Get the coachee user_id from the relationship for the composite FK
      const { data: relationship, error: relError } = await supabase
        .from("coach_relationships")
        .select("coachee_user_id")
        .eq("id", relationshipId)
        .single();

      if (relError || !relationship) {
        throw new Error("Relationship not found");
      }

      if (note) {
        // Update existing note
        const { data, error } = await supabase
          .from("coach_notes")
          .update({
            note: noteText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.id)
          .select()
          .single();

        if (error) {
          logger.error("Error updating coach note", error);
          throw error;
        }

        logger.info("Coach note updated", { noteId: data.id });
        return data as CoachNote;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from("coach_notes")
          .insert({
            relationship_id: relationshipId,
            call_recording_id: Number(callId),
            user_id: relationship.coachee_user_id, // For composite FK to fathom_calls
            note: noteText,
          })
          .select()
          .single();

        if (error) {
          logger.error("Error creating coach note", error);
          throw error;
        }

        logger.info("Coach note created", { noteId: data.id });
        return data as CoachNote;
      }
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches.notes(callId) });
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
        .from("coach_notes")
        .delete()
        .eq("id", note.id);

      if (error) {
        logger.error("Error deleting coach note", error);
        throw error;
      }

      logger.info("Coach note deleted", { noteId: note.id });
    },
    onSuccess: () => {
      if (callId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.coaches.notes(callId) });
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
