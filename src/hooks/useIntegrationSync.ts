import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";

export type IntegrationPlatform = "fathom" | "google_meet" | "zoom";

export interface IntegrationStatus {
  platform: IntegrationPlatform;
  connected: boolean;
  lastSyncAt: string | null;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;
  email?: string;
}

interface UserSettings {
  user_id: string;
  fathom_api_key: string | null;
  oauth_access_token: string | null;
  oauth_token_expires: number | null;
  google_oauth_access_token: string | null;
  google_oauth_token_expires: number | null;
  google_oauth_email: string | null;
  google_last_poll_at: string | null;
}

interface UseIntegrationSyncReturn {
  integrations: IntegrationStatus[];
  isLoading: boolean;
  error: string | null;
  refreshIntegrations: () => Promise<void>;
  triggerManualSync: (platform: IntegrationPlatform) => Promise<void>;
}

export function useIntegrationSync(): UseIntegrationSyncReturn {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingPlatforms, setSyncingPlatforms] = useState<Set<IntegrationPlatform>>(new Set());

  const loadIntegrations = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        setIntegrations([]);
        setIsLoading(false);
        return;
      }

      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select(`
          user_id,
          fathom_api_key,
          oauth_access_token,
          oauth_token_expires,
          google_oauth_access_token,
          google_oauth_token_expires,
          google_oauth_email,
          google_last_poll_at
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const now = Date.now();
      const result: IntegrationStatus[] = [];

      // Check Fathom connection (API key or OAuth)
      const fathomConnected = !!(
        settings?.fathom_api_key ||
        (settings?.oauth_access_token && settings?.oauth_token_expires && settings.oauth_token_expires > now)
      );

      result.push({
        platform: "fathom",
        connected: fathomConnected,
        lastSyncAt: null, // Fathom doesn't have a centralized poll time
        syncStatus: syncingPlatforms.has("fathom") ? "syncing" : "idle",
        email: undefined,
      });

      // Check Google Meet connection
      const googleConnected = !!(
        settings?.google_oauth_access_token &&
        settings?.google_oauth_token_expires &&
        settings.google_oauth_token_expires > now
      );

      result.push({
        platform: "google_meet",
        connected: googleConnected,
        lastSyncAt: (settings as UserSettings)?.google_last_poll_at || null,
        syncStatus: syncingPlatforms.has("google_meet") ? "syncing" : "idle",
        email: (settings as UserSettings)?.google_oauth_email || undefined,
      });

      // Zoom - coming soon
      result.push({
        platform: "zoom",
        connected: false,
        lastSyncAt: null,
        syncStatus: "idle",
        email: undefined,
      });

      setIntegrations(result);
      setError(null);
    } catch (err) {
      logger.error("Failed to load integrations", err);
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setIsLoading(false);
    }
  }, [syncingPlatforms]);

  const refreshIntegrations = useCallback(async () => {
    setIsLoading(true);
    await loadIntegrations();
  }, [loadIntegrations]);

  const triggerManualSync = useCallback(async (platform: IntegrationPlatform) => {
    if (platform === "zoom") {
      toast.info("Zoom integration coming soon");
      return;
    }

    setSyncingPlatforms(prev => new Set([...prev, platform]));

    try {
      if (platform === "google_meet") {
        // Trigger google-poll-sync for this user
        const { error: invokeError } = await supabase.functions.invoke("google-poll-sync", {
          body: {},
        });

        if (invokeError) {
          throw invokeError;
        }

        toast.success("Google Meet sync triggered");
      } else if (platform === "fathom") {
        // For Fathom, we don't have a background poll - users use the SyncTab
        toast.info("Use the date picker above to fetch Fathom meetings");
      }
    } catch (err) {
      logger.error(`Manual sync failed for ${platform}`, err);
      toast.error(`Failed to trigger ${platform} sync`);

      // Mark as error state
      setIntegrations(prev =>
        prev.map(i =>
          i.platform === platform
            ? { ...i, syncStatus: "error" as const, syncError: err instanceof Error ? err.message : "Unknown error" }
            : i
        )
      );
    } finally {
      setSyncingPlatforms(prev => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });

      // Refresh to get updated last sync time
      await loadIntegrations();
    }
  }, [loadIntegrations]);

  // Initial load
  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Subscribe to user_settings changes for real-time updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      channel = supabase
        .channel(`integration_status_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_settings",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refresh integrations when user_settings changes
            loadIntegrations();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadIntegrations]);

  // Check for pending OAuth completion on mount
  useEffect(() => {
    const pendingPlatform = sessionStorage.getItem('pendingOAuthPlatform');
    if (pendingPlatform) {
      sessionStorage.removeItem('pendingOAuthPlatform');
      // Refresh integrations after OAuth redirect
      setTimeout(() => {
        loadIntegrations();
      }, 1000);
    }
  }, [loadIntegrations]);

  return {
    integrations,
    isLoading,
    error,
    refreshIntegrations,
    triggerManualSync,
  };
}
