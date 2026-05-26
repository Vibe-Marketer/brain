/**
 * IntegrationsRealtimeProvider — mounts the single authoritative realtime
 * channel pair for the integrations snapshot.
 *
 * Before this provider existed, every consumer of `useIntegrationSync` opened
 * its own pair of Supabase realtime channels (`integration_status_<userId>`
 * and `integration_sources_<userId>`). On a page with nine consumers that's
 * eighteen open channels doing the same job. This component mounts exactly
 * once near AppShell and invalidates the shared TanStack Query cache key on
 * any user_settings or import_sources change for the signed-in user.
 *
 * Renders `null` until the user is authenticated, so we never leak a
 * connection during the unauthenticated landing pages.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-config";

export function IntegrationsRealtimeProvider({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactNode {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
    };

    const settingsChannel = supabase
      .channel(`integration_status_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      .subscribe();

    const sourcesChannel = supabase
      .channel(`integration_sources_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "import_sources",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(sourcesChannel);
    };
  }, [userId, queryClient]);

  return children ?? null;
}
