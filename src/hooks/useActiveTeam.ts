import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamContextStore, TEAM_CONTEXT_UPDATED_KEY } from '@/stores/teamContextStore';
import { toast } from 'sonner';

/**
 * Query key for active team - scoped to avoid conflicts
 */
const ACTIVE_TEAM_QUERY_KEY = ['user-settings', 'active-team'] as const;

interface UseActiveTeamResult {
  activeTeamId: string | null;
  isLoading: boolean;
  isPersonalWorkspace: boolean;
  switchTeam: (teamId: string | null) => Promise<void>;
  switchToPersonal: () => Promise<void>;
}

/**
 * Hook for managing active team context with database persistence.
 * 
 * - Loads active team from user_settings on mount
 * - Syncs changes to database
 * - Provides switchTeam/switchToPersonal actions
 * 
 * Note: Database column active_team_id must exist in user_settings table.
 * See migration 20260129000002_add_active_team_id.sql
 */
export function useActiveTeam(): UseActiveTeamResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { 
    activeTeamId, 
    isLoading: storeLoading, 
    isInitialized,
    setActiveTeamId,
    initialize,
    setError 
  } = useTeamContextStore();

  // Query to load active team from database on mount
  const { data: dbActiveTeamId, isLoading: queryLoading } = useQuery({
    queryKey: ACTIVE_TEAM_QUERY_KEY,
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Note: active_team_id column added via migration 20260129000002
      // TypeScript types will need regeneration with `supabase gen types typescript`
      const { data, error } = await supabase
        .from('user_settings')
        .select('active_team_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading active team:', error);
        return null;
      }
      
      // Type assertion needed until types are regenerated
      const settings = data as { active_team_id?: string | null } | null;
      return settings?.active_team_id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Initialize store from database when query completes
  useEffect(() => {
    if (!queryLoading && user?.id && !isInitialized) {
      initialize(dbActiveTeamId ?? null);
    }
  }, [queryLoading, dbActiveTeamId, user?.id, isInitialized, initialize]);

  // Listen for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === TEAM_CONTEXT_UPDATED_KEY) {
        // Another tab changed team context - refetch from database
        queryClient.invalidateQueries({ queryKey: ACTIVE_TEAM_QUERY_KEY });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [queryClient]);

  // Mutation to persist team change to database
  const switchTeamMutation = useMutation({
    mutationFn: async (teamId: string | null) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Note: active_team_id column added via migration 20260129000002
      // TypeScript types need regeneration with `supabase gen types typescript`
      // Until then, we use type assertions to work with the new column
      
      // Check if user_settings row exists
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Build the update/insert data with the new active_team_id column
      // The column exists in DB but TypeScript doesn't know about it yet
      const settingsData = {
        user_id: user.id,
        active_team_id: teamId,
        updated_at: new Date().toISOString(),
      };
      
      if (existing) {
        // Update existing row
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase
          .from('user_settings') as any)
          .update(settingsData)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Insert new row
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase
          .from('user_settings') as any)
          .insert(settingsData);
        
        if (error) throw error;
      }
      
      return teamId;
    },
    onSuccess: (teamId) => {
      setActiveTeamId(teamId);
      queryClient.invalidateQueries({ queryKey: ACTIVE_TEAM_QUERY_KEY });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to switch team';
      toast.error(message);
      setError(message);
    },
  });

  const switchTeam = useCallback(async (teamId: string | null) => {
    await switchTeamMutation.mutateAsync(teamId);
  }, [switchTeamMutation]);

  const switchToPersonal = useCallback(async () => {
    await switchTeamMutation.mutateAsync(null);
  }, [switchTeamMutation]);

  return {
    activeTeamId,
    isLoading: storeLoading || queryLoading,
    isPersonalWorkspace: activeTeamId === null,
    switchTeam,
    switchToPersonal,
  };
}
