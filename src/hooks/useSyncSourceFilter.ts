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
  
  // Track loading state to prevent re-fetching
  const hasLoadedFromDbRef = useRef(false);
  const isLoadingRef = useRef(false);
  const previousConnectedRef = useRef<string[]>([]);
  // Store the raw DB value to apply when connectedPlatforms arrives
  const savedFilterRef = useRef<string[] | null>(null);

  // Load filter preferences from database - only once
  const loadFilterPreferences = useCallback(async () => {
    // Prevent concurrent or duplicate loads
    if (isLoadingRef.current || hasLoadedFromDbRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    
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
      
      // Store the raw DB value
      if (savedFilter && Array.isArray(savedFilter) && savedFilter.length > 0) {
        savedFilterRef.current = savedFilter;
      } else {
        savedFilterRef.current = null; // NULL means "all enabled"
      }

      hasLoadedFromDbRef.current = true;
      
      // Apply the filter with current connectedPlatforms
      applyFilter(connectedPlatforms);
      
    } catch (err) {
      logger.error("Failed to load sync source filter preferences", err);
      // Fall back to all connected platforms on error
      setEnabledSourcesState([...connectedPlatforms]);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [connectedPlatforms]);

  // Apply saved filter to current connected platforms
  const applyFilter = useCallback((platforms: IntegrationPlatform[]) => {
    if (platforms.length === 0) {
      setEnabledSourcesState([]);
      return;
    }
    
    const savedFilter = savedFilterRef.current;
    
    if (savedFilter && savedFilter.length > 0) {
      // Intersect saved filter with currently connected platforms
      const validSources = savedFilter.filter((platform) =>
        platforms.includes(platform as IntegrationPlatform)
      );

      // If intersection results in empty, fall back to all connected
      if (validSources.length > 0) {
        setEnabledSourcesState(validSources);
      } else {
        setEnabledSourcesState([...platforms]);
      }
    } else {
      // NULL or empty = all connected platforms enabled (default)
      setEnabledSourcesState([...platforms]);
    }
  }, []);

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
        
        // Update our ref to match what we're saving
        savedFilterRef.current = filterValue;

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
        
        logger.debug("Saved sync source filter", { filterValue });
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

  // Initial load - only fetch from DB once
  useEffect(() => {
    if (!hasLoadedFromDbRef.current && !isLoadingRef.current) {
      loadFilterPreferences();
    }
  }, [loadFilterPreferences]);

  // When connectedPlatforms changes AFTER initial load, re-apply filter
  useEffect(() => {
    // Skip if we haven't loaded from DB yet
    if (!hasLoadedFromDbRef.current) {
      return;
    }
    
    // Skip if platforms haven't actually changed (compare values, not reference)
    const prevSorted = [...previousConnectedRef.current].sort().join(",");
    const currSorted = [...connectedPlatforms].sort().join(",");
    
    if (prevSorted === currSorted) {
      return;
    }

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

    // Handle disconnected platforms - remove from enabled
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

  // Initialize previousConnectedRef when connectedPlatforms first arrives
  useEffect(() => {
    if (connectedPlatforms.length > 0 && previousConnectedRef.current.length === 0) {
      previousConnectedRef.current = [...connectedPlatforms];
    }
  }, [connectedPlatforms]);

  return {
    enabledSources,
    isLoading,
    toggleSource,
    setEnabledSources,
  };
}
