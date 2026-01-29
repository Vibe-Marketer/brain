/**
 * useSyncSourceFilter - Manages sync source filter preferences with database persistence
 *
 * This hook handles which integration sources are enabled for viewing on the Sync page.
 * Filter preferences are stored in user_settings.sync_source_filter column.
 *
 * - NULL in database = all connected platforms enabled (default behavior)
 * - Array in database = only those platforms enabled
 * - New integrations are auto-enabled when connected
 * - At least one source must remain enabled (prevents disabling all)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";
import type { IntegrationPlatform } from "./useIntegrationSync";

export interface UseSyncSourceFilterReturn {
  /** Currently enabled platform strings */
  enabledSources: string[];
  /** True during initial load */
  isLoading: boolean;
  /** Toggle a single source. Returns false if prevented (would disable all). */
  toggleSource: (platform: string, enabled: boolean) => Promise<boolean>;
  /** Bulk update all enabled sources */
  setEnabledSources: (platforms: string[]) => Promise<void>;
}

interface UseSyncSourceFilterProps {
  /** Currently connected platforms from useIntegrationSync */
  connectedPlatforms: IntegrationPlatform[];
}

export function useSyncSourceFilter({
  connectedPlatforms,
}: UseSyncSourceFilterProps): UseSyncSourceFilterReturn {
  const [enabledSources, setEnabledSourcesState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const previousConnectedRef = useRef<string[]>([]);

  // Load filter preferences from database
  const loadFilterPreferences = useCallback(async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        setEnabledSourcesState([]);
        setIsLoading(false);
        return;
      }

      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select("sync_source_filter")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const savedFilter = settings?.sync_source_filter;

      if (savedFilter && Array.isArray(savedFilter) && savedFilter.length > 0) {
        // Intersect saved filter with currently connected platforms
        // This handles the case where a user disconnects an integration
        const validSources = savedFilter.filter((platform) =>
          connectedPlatforms.includes(platform as IntegrationPlatform)
        );

        // If intersection results in empty, fall back to all connected
        if (validSources.length > 0) {
          setEnabledSourcesState(validSources);
        } else {
          setEnabledSourcesState([...connectedPlatforms]);
        }
      } else {
        // NULL or empty = all connected platforms enabled (default)
        setEnabledSourcesState([...connectedPlatforms]);
      }

      hasLoadedRef.current = true;
    } catch (err) {
      logger.error("Failed to load sync source filter preferences", err);
      // Fall back to all connected platforms on error
      setEnabledSourcesState([...connectedPlatforms]);
    } finally {
      setIsLoading(false);
    }
  }, [connectedPlatforms]);

  // Save filter preferences to database
  const saveFilterPreferences = useCallback(
    async (platforms: string[]): Promise<void> => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user) {
          return;
        }

        // If all connected platforms are enabled, save NULL (default behavior)
        // This allows new integrations to be auto-enabled
        const allEnabled =
          platforms.length === connectedPlatforms.length &&
          connectedPlatforms.every((p) => platforms.includes(p));

        const filterValue = allEnabled ? null : platforms;

        const { error: upsertError } = await supabase
          .from("user_settings")
          .upsert(
            {
              user_id: user.id,
              sync_source_filter: filterValue,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          throw upsertError;
        }
      } catch (err) {
        logger.error("Failed to save sync source filter preferences", err);
        toast.error("Failed to save filter preferences");
        throw err;
      }
    },
    [connectedPlatforms]
  );

  // Toggle a single source
  const toggleSource = useCallback(
    async (platform: string, enabled: boolean): Promise<boolean> => {
      // Calculate new enabled sources
      let newEnabled: string[];
      if (enabled) {
        newEnabled = [...enabledSources, platform];
      } else {
        newEnabled = enabledSources.filter((p) => p !== platform);
      }

      // Prevent disabling all sources
      if (newEnabled.length === 0) {
        toast.error("At least one source must be enabled");
        return false;
      }

      // Optimistic update
      setEnabledSourcesState(newEnabled);

      try {
        await saveFilterPreferences(newEnabled);
        return true;
      } catch {
        // Rollback on error
        setEnabledSourcesState(enabledSources);
        return false;
      }
    },
    [enabledSources, saveFilterPreferences]
  );

  // Bulk update enabled sources
  const setEnabledSources = useCallback(
    async (platforms: string[]): Promise<void> => {
      if (platforms.length === 0) {
        toast.error("At least one source must be enabled");
        return;
      }

      const previousEnabled = enabledSources;
      setEnabledSourcesState(platforms);

      try {
        await saveFilterPreferences(platforms);
      } catch {
        // Rollback on error
        setEnabledSourcesState(previousEnabled);
      }
    },
    [enabledSources, saveFilterPreferences]
  );

  // Initial load when connected platforms are available
  useEffect(() => {
    if (connectedPlatforms.length > 0) {
      loadFilterPreferences();
    } else {
      // No connected platforms - set empty and stop loading
      setEnabledSourcesState([]);
      setIsLoading(false);
    }
  }, [connectedPlatforms, loadFilterPreferences]);

  // Auto-enable newly connected integrations
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const previousConnected = previousConnectedRef.current;
    const newlyConnected = connectedPlatforms.filter(
      (p) => !previousConnected.includes(p)
    );

    if (newlyConnected.length > 0) {
      // Add newly connected platforms to enabled sources
      const updatedEnabled = [...new Set([...enabledSources, ...newlyConnected])];
      setEnabledSourcesState(updatedEnabled);

      // Save to database (don't await - fire and forget)
      saveFilterPreferences(updatedEnabled).catch(() => {
        // Error already logged in saveFilterPreferences
      });
    }

    // Also handle disconnected platforms - remove from enabled
    const disconnected = previousConnected.filter(
      (p) => !connectedPlatforms.includes(p as IntegrationPlatform)
    );

    if (disconnected.length > 0) {
      const filtered = enabledSources.filter((p) => !disconnected.includes(p));
      // Ensure at least one remains enabled
      if (filtered.length > 0) {
        setEnabledSourcesState(filtered);
        saveFilterPreferences(filtered).catch(() => {});
      }
    }

    previousConnectedRef.current = [...connectedPlatforms];
  }, [connectedPlatforms, enabledSources, saveFilterPreferences]);

  return {
    enabledSources,
    isLoading,
    toggleSource,
    setEnabledSources,
  };
}
