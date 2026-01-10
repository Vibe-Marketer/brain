import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-processing preferences stored in user_profiles.auto_processing_preferences
 */
export interface AutoProcessingPreferences {
  autoProcessingTitleGeneration: boolean;
  autoProcessingTagging: boolean;
}

/**
 * Default preferences for new users or when preferences haven't been loaded
 */
const DEFAULT_PREFERENCES: AutoProcessingPreferences = {
  autoProcessingTitleGeneration: false,
  autoProcessingTagging: false,
};

/**
 * localStorage key for triggering cross-tab synchronization
 */
export const PREFERENCES_UPDATED_KEY = 'preferences-updated';

interface PreferencesState {
  // State
  preferences: AutoProcessingPreferences;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  loadPreferences: () => Promise<void>;
  updatePreference: <K extends keyof AutoProcessingPreferences>(
    key: K,
    value: AutoProcessingPreferences[K]
  ) => Promise<void>;
  resetError: () => void;
}

/**
 * Preferences Store
 * Manages auto-processing preferences with database persistence
 * Preferences are stored in user_profiles.auto_processing_preferences JSONB column
 */
export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  // Initial state
  preferences: DEFAULT_PREFERENCES,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Load preferences from database
  loadPreferences: async () => {
    const { isLoading } = get();

    // Prevent concurrent loads
    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // User not authenticated - use defaults
        set({
          preferences: DEFAULT_PREFERENCES,
          isLoading: false,
          isInitialized: true
        });
        return;
      }

      // Fetch user profile with preferences
      // Note: auto_processing_preferences column added via migration
      // TypeScript types will be updated in subtask-2-2
      const { data, error } = await supabase
        .from('user_profiles')
        .select('auto_processing_preferences')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Handle case where profile doesn't exist yet (new user)
        if (error.code === 'PGRST116') {
          set({
            preferences: DEFAULT_PREFERENCES,
            isLoading: false,
            isInitialized: true
          });
          return;
        }
        throw error;
      }

      // Parse preferences from JSONB column
      // Type assertion needed until types.ts is updated (subtask-2-2)
      const profileData = data as { auto_processing_preferences?: AutoProcessingPreferences | null } | null;
      const storedPreferences = profileData?.auto_processing_preferences;

      set({
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...storedPreferences,
        },
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load preferences';
      set({
        error: errorMessage,
        isLoading: false,
        isInitialized: true
      });
    }
  },

  // Update a single preference with optimistic update
  updatePreference: async (key, value) => {
    const { preferences } = get();

    // Optimistic update - update local state immediately
    const previousPreferences = { ...preferences };
    const newPreferences = { ...preferences, [key]: value };

    set({ preferences: newPreferences, error: null });

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Revert optimistic update if not authenticated
        set({
          preferences: previousPreferences,
          error: 'Not authenticated'
        });
        return;
      }

      // Update database
      // Note: Using type assertion until types.ts is updated (subtask-2-2)
      const updatePayload = {
        auto_processing_preferences: newPreferences,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('user_profiles')
        .update(updatePayload as Record<string, unknown>)
        .eq('user_id', user.id);

      if (error) {
        // Revert optimistic update on error
        set({
          preferences: previousPreferences,
          error: error.message
        });
        return;
      }

      // Trigger cross-tab synchronization
      localStorage.setItem(PREFERENCES_UPDATED_KEY, Date.now().toString());
    } catch (error) {
      // Revert optimistic update on error
      const errorMessage = error instanceof Error ? error.message : 'Failed to save preference';
      set({
        preferences: previousPreferences,
        error: errorMessage
      });
    }
  },

  // Reset error state
  resetError: () => {
    set({ error: null });
  },
}));

/**
 * Cross-tab synchronization using storage events
 *
 * When one tab updates preferences, it sets PREFERENCES_UPDATED_KEY in localStorage.
 * The 'storage' event fires in all OTHER tabs (not the tab that made the change).
 * This listener reloads preferences from the database to sync the change.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === PREFERENCES_UPDATED_KEY) {
      // Another tab updated preferences - reload from database
      usePreferencesStore.getState().loadPreferences();
    }
  });
}
