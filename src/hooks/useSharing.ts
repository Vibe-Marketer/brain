import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import {
  ShareLink,
  ShareAccessLog,
  ShareAccessLogWithUser,
  CreateShareLinkInput,
  SharingStatus,
} from "@/types/sharing";

interface UseSharingOptions {
  callId: number | string | null;
  userId?: string;
  enabled?: boolean;
}

interface UseSharingResult {
  // Queries
  shareLinks: ShareLink[];
  isLoadingLinks: boolean;
  sharingStatus: SharingStatus;
  // Mutations
  createShareLink: (input: CreateShareLinkInput) => Promise<ShareLink>;
  revokeShareLink: (linkId: string) => Promise<void>;
  isCreating: boolean;
  isRevoking: boolean;
  // Access log helpers
  getAccessLog: (linkId: string) => Promise<ShareAccessLogWithUser[]>;
}

/**
 * Generates a cryptographically secure 32-character URL-safe token
 */
function generateShareToken(): string {
  const array = new Uint8Array(24); // 24 bytes = 32 base64 chars
  crypto.getRandomValues(array);
  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Hook for managing single call share links
 *
 * Provides functionality to:
 * - Create shareable links for individual calls
 * - Revoke existing share links
 * - View access logs for share links
 * - Check sharing status of a call
 */
export function useSharing(options: UseSharingOptions): UseSharingResult {
  const { callId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Fetch all share links for a call
  const { data: shareLinks, isLoading: isLoadingLinks } = useQuery({
    queryKey: queryKeys.sharing.links(callId!),
    queryFn: async () => {
      if (!callId || !userId) return [];

      const { data, error } = await supabase
        .from("call_share_links")
        .select("*")
        .eq("call_recording_id", callId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching share links", error);
        throw error;
      }

      return data as ShareLink[];
    },
    enabled: enabled && !!callId && !!userId,
  });

  // Calculate sharing status from share links
  const sharingStatus: SharingStatus = {
    hasShareLinks: (shareLinks?.filter(l => l.status === 'active').length ?? 0) > 0,
    shareLinkCount: shareLinks?.filter(l => l.status === 'active').length ?? 0,
    visibleToTeam: false,
    visibleToManager: false,
  };

  // Create share link mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateShareLinkInput): Promise<ShareLink> => {
      if (!userId) {
        throw new Error("User ID is required to create share link");
      }

      const shareToken = generateShareToken();

      const { data, error } = await supabase
        .from("call_share_links")
        .insert({
          call_recording_id: input.call_recording_id,
          user_id: userId,
          created_by_user_id: userId,
          share_token: shareToken,
          recipient_email: input.recipient_email || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating share link", error);
        throw error;
      }

      logger.info("Share link created", {
        linkId: data.id,
        callId: input.call_recording_id
      });

      return data as ShareLink;
    },
    onSuccess: (data) => {
      // Invalidate share links query to refresh the list
      queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.links(data.call_recording_id)
      });
    },
  });

  // Revoke share link mutation
  const revokeMutation = useMutation({
    mutationFn: async (linkId: string): Promise<void> => {
      const { error } = await supabase
        .from("call_share_links")
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq("id", linkId);

      if (error) {
        logger.error("Error revoking share link", error);
        throw error;
      }

      logger.info("Share link revoked", { linkId });
    },
    onSuccess: () => {
      // Invalidate share links query to refresh the list
      if (callId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.sharing.links(callId)
        });
      }
    },
  });

  // Get access log for a specific share link
  const getAccessLog = async (linkId: string): Promise<ShareAccessLogWithUser[]> => {
    const { data, error } = await supabase
      .from("call_share_access_log")
      .select(`
        *,
        accessed_by:auth.users(email, raw_user_meta_data)
      `)
      .eq("share_link_id", linkId)
      .order("accessed_at", { ascending: false });

    if (error) {
      logger.error("Error fetching access log", error);
      throw error;
    }

    // Transform to include user info
    return (data || []).map((log: ShareAccessLog & { accessed_by?: { email: string; raw_user_meta_data?: { name?: string } } }) => ({
      ...log,
      user_email: log.accessed_by?.email || null,
      user_name: log.accessed_by?.raw_user_meta_data?.name || null,
    }));
  };

  return {
    // Queries
    shareLinks: shareLinks || [],
    isLoadingLinks,
    sharingStatus,
    // Mutations
    createShareLink: createMutation.mutateAsync,
    revokeShareLink: revokeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isRevoking: revokeMutation.isPending,
    // Access log
    getAccessLog,
  };
}

/**
 * Hook for accessing a shared call via share token
 * Used on the SharedCallView page
 */
interface UseSharedCallOptions {
  token: string | null;
  userId?: string;
}

interface SharedCallData {
  shareLink: ShareLink | null;
  call: {
    recording_id: number;
    call_name: string;
    recorded_by_email: string;
    recording_start_time: string;
    duration: string | null;
    full_transcript: string | null;
  } | null;
  isValid: boolean;
  isRevoked: boolean;
}

interface UseSharedCallResult {
  data: SharedCallData | null;
  isLoading: boolean;
  error: Error | null;
  logAccess: () => Promise<void>;
}

export function useSharedCall(options: UseSharedCallOptions): UseSharedCallResult {
  const { token, userId } = options;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.sharing.byToken(token!),
    queryFn: async (): Promise<SharedCallData> => {
      if (!token) {
        return { shareLink: null, call: null, isValid: false, isRevoked: false };
      }

      // Fetch share link by token
      const { data: shareLink, error: linkError } = await supabase
        .from("call_share_links")
        .select("*")
        .eq("share_token", token)
        .single();

      if (linkError || !shareLink) {
        logger.error("Share link not found", { token, error: linkError });
        return { shareLink: null, call: null, isValid: false, isRevoked: false };
      }

      // Check if revoked
      if (shareLink.status === 'revoked') {
        return {
          shareLink: shareLink as ShareLink,
          call: null,
          isValid: false,
          isRevoked: true
        };
      }

      // Fetch the call data
      const { data: call, error: callError } = await supabase
        .from("fathom_calls")
        .select(`
          recording_id,
          call_name,
          recorded_by_email,
          recording_start_time,
          duration,
          full_transcript
        `)
        .eq("recording_id", shareLink.call_recording_id)
        .eq("user_id", shareLink.user_id)
        .single();

      if (callError) {
        logger.error("Error fetching shared call", callError);
        return {
          shareLink: shareLink as ShareLink,
          call: null,
          isValid: false,
          isRevoked: false
        };
      }

      return {
        shareLink: shareLink as ShareLink,
        call,
        isValid: true,
        isRevoked: false,
      };
    },
    enabled: !!token,
  });

  // Log access when a user views the shared call
  const logAccess = async (): Promise<void> => {
    if (!token || !userId || !data?.shareLink) return;

    const { error } = await supabase
      .from("call_share_access_log")
      .insert({
        share_link_id: data.shareLink.id,
        accessed_by_user_id: userId,
      });

    if (error) {
      // Don't throw - access logging shouldn't block the user
      logger.error("Error logging share access", error);
    } else {
      logger.info("Share access logged", {
        linkId: data.shareLink.id,
        userId
      });
    }
  };

  return {
    data: data || null,
    isLoading,
    error: error as Error | null,
    logAccess,
  };
}

/**
 * Hook for fetching access log with user details
 * Used in AccessLogViewer component
 */
interface UseAccessLogOptions {
  linkId: string | null;
  enabled?: boolean;
}

interface UseAccessLogResult {
  accessLog: ShareAccessLogWithUser[];
  isLoading: boolean;
  refetch: () => void;
}

export function useAccessLog(options: UseAccessLogOptions): UseAccessLogResult {
  const { linkId, enabled = true } = options;

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.sharing.accessLog(linkId!),
    queryFn: async (): Promise<ShareAccessLogWithUser[]> => {
      if (!linkId) return [];

      const { data, error } = await supabase
        .from("call_share_access_log")
        .select("*")
        .eq("share_link_id", linkId)
        .order("accessed_at", { ascending: false });

      if (error) {
        logger.error("Error fetching access log", error);
        throw error;
      }

      // For each log entry, fetch user info
      const logsWithUsers = await Promise.all(
        (data || []).map(async (log: ShareAccessLog) => {
          const { data: userData } = await supabase.rpc('get_user_email', {
            user_id: log.accessed_by_user_id
          });

          return {
            ...log,
            user_email: userData || null,
            user_name: null, // Could be enhanced with profile lookup
          } as ShareAccessLogWithUser;
        })
      );

      return logsWithUsers;
    },
    enabled: enabled && !!linkId,
  });

  return {
    accessLog: data || [],
    isLoading,
    refetch,
  };
}
