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
  SharedCallStatus,
  SharedCallPayload,
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
  const { callId: rawCallId, userId, enabled = true } = options;
  const queryClient = useQueryClient();

  // Normalize callId to number to prevent query key type mismatches
  const callId = rawCallId !== null && rawCallId !== undefined
    ? (typeof rawCallId === 'string' ? parseInt(rawCallId, 10) : rawCallId)
    : null;

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
      // Optimistically add the new link to the cache so it appears instantly
      queryClient.setQueryData(
        queryKeys.sharing.links(callId!),
        (old: ShareLink[] | undefined) => [data, ...(old || [])]
      );
      // Also invalidate to ensure consistency with server
      queryClient.invalidateQueries({
        queryKey: queryKeys.sharing.links(callId!)
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
 *
 * Phase 32: returns a discriminated union over the share-call Edge Function
 * response matrix. Each `status` value maps to a specific render branch in
 * SharedCallView.tsx — no auto-redirect to /login.
 */
interface UseSharedCallOptions {
  token: string | null;
  userId?: string;
}

export interface UseSharedCallResult {
  data: SharedCallStatus;
  refetch: () => void;
}

export function useSharedCall(options: UseSharedCallOptions): UseSharedCallResult {
  const { token, userId } = options;

  const { data, isLoading, refetch } = useQuery<SharedCallStatus>({
    queryKey: queryKeys.sharing.byToken(token!),
    queryFn: async (): Promise<SharedCallStatus> => {
      if (!token) {
        return { status: 'not-found' };
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Attach JWT when the user is authenticated so the backend probe can
      // resolve currentUserEmail / currentUserId for wrong-recipient detection.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const logAccess = userId ? '&log_access=true' : '';

      const fetchUrl = `${supabaseUrl}/functions/v1/share-call?token=${encodeURIComponent(token)}${logAccess}`;
      const headers: Record<string, string> = {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      let res: Response;
      try {
        res = await fetch(fetchUrl, { headers });
      } catch (networkErr) {
        logger.error('Share link fetch network failure', { token, error: networkErr });
        return { status: 'error', message: 'Network error' };
      }

      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      // Map HTTP code + error code to discriminated union variants.
      if (res.ok) {
        if (body.is_public_view === true) {
          return {
            status: 'public-view',
            inviter_name: String(body.inviter_name ?? 'Someone'),
            call_title: String(body.call_title ?? 'An untitled call'),
            recipient_email: (body.recipient_email as string | null) ?? null,
            recipient_masked: (body.recipient_masked as string | null) ?? null,
          };
        }
        if (body.is_valid === true && body.call) {
          return {
            status: 'ok',
            shareLink: body.share_link as ShareLink,
            call: body.call as SharedCallPayload,
          };
        }
        // Unexpected 200 shape — treat as error so the UI shows something useful.
        logger.error('Share link fetch unexpected 200 shape', { token, body });
        return { status: 'error', message: 'Unexpected response shape' };
      }

      // Error path — discriminate by `code` field.
      const code = body.code as string | undefined;
      if (res.status === 403 && code === 'WRONG_RECIPIENT') {
        return {
          status: 'wrong-recipient',
          recipient_masked: (body.recipient_masked as string | null) ?? null,
        };
      }
      if (res.status === 403 && code === 'LINK_REVOKED') {
        return {
          status: 'revoked',
          shareLink: body.share_link as Pick<ShareLink, 'id' | 'status' | 'revoked_at'>,
        };
      }
      if (res.status === 404 && (code === 'LINK_NOT_FOUND' || code === 'CALL_NOT_FOUND')) {
        return { status: 'not-found' };
      }

      logger.error('Share link fetch failed', { token, status: res.status, body });
      return {
        status: 'error',
        message: typeof body.error === 'string' ? (body.error as string) : 'Unknown error',
      };
    },
    enabled: !!token,
  });

  const resolved: SharedCallStatus = isLoading
    ? { status: 'loading' }
    : data ?? { status: 'loading' };

  return {
    data: resolved,
    refetch,
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

      // Batch-fetch user profiles in a single query (fixes N+1)
      const logUserIds = Array.from(
        new Set((data || []).map((log: ShareAccessLog) => log.accessed_by_user_id).filter(Boolean))
      );
      const profileMap = new Map<string, { email: string; display_name: string | null }>();
      if (logUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, email, display_name')
          .in('user_id', logUserIds);
        for (const p of profiles ?? []) {
          profileMap.set(p.user_id, { email: p.email || '', display_name: p.display_name || null });
        }
      }

      const logsWithUsers = (data || []).map((log: ShareAccessLog) => ({
        ...log,
        user_email: profileMap.get(log.accessed_by_user_id)?.email || null,
        user_name: profileMap.get(log.accessed_by_user_id)?.display_name || null,
      } as ShareAccessLogWithUser));

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
