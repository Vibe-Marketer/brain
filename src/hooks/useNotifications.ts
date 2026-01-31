import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { requireUser } from "@/lib/auth-utils";

/**
 * Notification type
 */
export type NotificationType = "health_alert" | "system" | "info";

/**
 * Health alert metadata
 */
export interface HealthAlertMetadata {
  contact_id: string;
  contact_name: string | null;
  contact_email: string;
  days_since_seen: number | null;
  threshold_days: number;
}

/**
 * User notification
 */
export interface UserNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: HealthAlertMetadata | Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Hook for managing user notifications
 * Provides CRUD operations for the notification bell and panel
 */
export function useNotifications() {
  const queryClient = useQueryClient();

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Fetch all notifications for the current user
   */
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const user = await requireUser();

      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as UserNotification[];
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });

  /**
   * Count of unread notifications
   */
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  /**
   * Mark a notification as read
   */
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list() });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData<UserNotification[]>(
        queryKeys.notifications.list()
      );

      // Optimistically update
      if (previousNotifications) {
        queryClient.setQueryData<UserNotification[]>(
          queryKeys.notifications.list(),
          previousNotifications.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      }

      return { previousNotifications };
    },
    onError: (error, _notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previousNotifications);
      }
      logger.error("Error marking notification as read", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  /**
   * Mark all notifications as read
   */
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const user = await requireUser();
      
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) throw error;
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list() });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData<UserNotification[]>(
        queryKeys.notifications.list()
      );

      // Optimistically update all as read
      if (previousNotifications) {
        const now = new Date().toISOString();
        queryClient.setQueryData<UserNotification[]>(
          queryKeys.notifications.list(),
          previousNotifications.map((n) => ({
            ...n,
            read_at: n.read_at || now,
          }))
        );
      }

      return { previousNotifications };
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previousNotifications);
      }
      logger.error("Error marking all notifications as read", error);
      toast.error("Failed to mark notifications as read");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  /**
   * Delete a notification
   */
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list() });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData<UserNotification[]>(
        queryKeys.notifications.list()
      );

      // Optimistically remove
      if (previousNotifications) {
        queryClient.setQueryData<UserNotification[]>(
          queryKeys.notifications.list(),
          previousNotifications.filter((n) => n.id !== notificationId)
        );
      }

      return { previousNotifications };
    },
    onError: (error, _notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKeys.notifications.list(), context.previousNotifications);
      }
      logger.error("Error deleting notification", error);
      toast.error("Failed to delete notification");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Data
    notifications,
    unreadCount,
    
    // Loading state
    isLoading,
    
    // Mutations
    markAsRead: (id: string) => markAsReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllAsReadMutation.mutateAsync(),
    deleteNotification: (id: string) => deleteNotificationMutation.mutateAsync(id),
    
    // Loading states for mutations
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    
    // Utilities
    refetch,
  };
}
