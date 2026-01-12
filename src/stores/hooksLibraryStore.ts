import { create } from 'zustand';
import type {
  Hook,
  HookInput,
  HookFilters,
  HookStatus,
  EmotionCategory,
} from '@/types/content-hub';
import {
  fetchHooks,
  createHook,
  batchCreateHooks,
  updateHook,
  deleteHook,
  toggleHookStar,
  updateHookStatus,
} from '@/lib/hooks-library';

/**
 * Hooks Library Store State
 */
interface HooksLibraryState {
  // Hooks
  hooks: Hook[];
  hooksLoading: boolean;
  hooksError: string | null;

  // Filters
  filters: HookFilters;

  // Available topic hints for autocomplete
  availableTopicHints: string[];
  topicHintsLoading: boolean;
}

/**
 * Hooks Library Store Actions
 */
interface HooksLibraryActions {
  // Hook actions
  fetchHooks: (filters?: HookFilters) => Promise<void>;
  addHook: (input: HookInput) => Promise<Hook | null>;
  batchAddHooks: (inputs: HookInput[]) => Promise<Hook[] | null>;
  updateHook: (id: string, updates: Partial<Omit<Hook, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<Hook | null>;
  removeHook: (id: string) => Promise<boolean>;
  toggleStar: (id: string) => Promise<void>;
  updateStatus: (id: string, status: HookStatus) => Promise<void>;

  // Filter actions
  updateFilters: (filters: Partial<HookFilters>) => void;
  clearFilters: () => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state for the hooks library store
 */
const initialState: HooksLibraryState = {
  hooks: [],
  hooksLoading: false,
  hooksError: null,
  filters: {},
  availableTopicHints: [],
  topicHintsLoading: false,
};

/**
 * Hooks Library Zustand Store
 *
 * Manages state for hooks library items.
 * Provides CRUD operations with optimistic updates and rollback on error.
 */
export const useHooksLibraryStore = create<HooksLibraryState & HooksLibraryActions>(
  (set, get) => ({
    // Initial state
    ...initialState,

    // Hook actions
    fetchHooks: async (filters?: HookFilters) => {
      const effectiveFilters = filters ?? get().filters;

      set({ hooksLoading: true, hooksError: null });

      const { data, error } = await fetchHooks(effectiveFilters);

      if (error) {
        set({
          hooksLoading: false,
          hooksError: error.message,
        });
        return;
      }

      // Extract unique topic hints from fetched hooks
      const topicHints = new Set<string>();
      (data || []).forEach((hook) => {
        if (hook.topic_hint) {
          topicHints.add(hook.topic_hint);
        }
      });

      set({
        hooks: data || [],
        hooksLoading: false,
        hooksError: null,
        availableTopicHints: Array.from(topicHints).sort(),
      });
    },

    addHook: async (input: HookInput) => {
      // Optimistic update - add a temporary hook with a placeholder ID
      const tempId = `temp-${Date.now()}`;
      const tempHook: Hook = {
        id: tempId,
        user_id: '', // Will be set by database
        recording_id: input.recording_id || null,
        hook_text: input.hook_text,
        insight_ids: input.insight_ids || [],
        emotion_category: input.emotion_category || null,
        virality_score: input.virality_score || null,
        topic_hint: input.topic_hint || null,
        is_starred: input.is_starred || false,
        status: input.status || 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((state) => ({
        hooks: [tempHook, ...state.hooks],
      }));

      const { data, error } = await createHook(input);

      if (error) {
        // Rollback optimistic update
        set((state) => ({
          hooks: state.hooks.filter((hook) => hook.id !== tempId),
          hooksError: error.message,
        }));
        return null;
      }

      // Replace temp hook with real hook
      set((state) => ({
        hooks: state.hooks.map((hook) =>
          hook.id === tempId ? data! : hook
        ),
        hooksError: null,
      }));

      // Update topic hints if new topic was added
      if (data?.topic_hint) {
        set((state) => {
          const hints = new Set(state.availableTopicHints);
          hints.add(data.topic_hint!);
          return { availableTopicHints: Array.from(hints).sort() };
        });
      }

      return data;
    },

    batchAddHooks: async (inputs: HookInput[]) => {
      if (!inputs || inputs.length === 0) {
        return [];
      }

      // Optimistic update - add temporary hooks
      const tempHooks: Hook[] = inputs.map((input, index) => ({
        id: `temp-${Date.now()}-${index}`,
        user_id: '',
        recording_id: input.recording_id || null,
        hook_text: input.hook_text,
        insight_ids: input.insight_ids || [],
        emotion_category: input.emotion_category || null,
        virality_score: input.virality_score || null,
        topic_hint: input.topic_hint || null,
        is_starred: input.is_starred || false,
        status: input.status || 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const tempIds = tempHooks.map((h) => h.id);

      set((state) => ({
        hooks: [...tempHooks, ...state.hooks],
      }));

      const { data, error } = await batchCreateHooks(inputs);

      if (error) {
        // Rollback optimistic update
        set((state) => ({
          hooks: state.hooks.filter((hook) => !tempIds.includes(hook.id)),
          hooksError: error.message,
        }));
        return null;
      }

      // Remove temp hooks and add real hooks
      set((state) => {
        const filteredHooks = state.hooks.filter((hook) => !tempIds.includes(hook.id));
        return {
          hooks: [...(data || []), ...filteredHooks],
          hooksError: null,
        };
      });

      // Update topic hints for new hooks
      if (data && data.length > 0) {
        set((state) => {
          const hints = new Set(state.availableTopicHints);
          data.forEach((hook) => {
            if (hook.topic_hint) {
              hints.add(hook.topic_hint);
            }
          });
          return { availableTopicHints: Array.from(hints).sort() };
        });
      }

      return data;
    },

    updateHook: async (id: string, updates: Partial<Omit<Hook, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      // Store previous state for rollback
      const previousHooks = get().hooks;
      const previousHook = previousHooks.find((h) => h.id === id);

      if (!previousHook) {
        set({ hooksError: 'Hook not found' });
        return null;
      }

      // Optimistic update
      set((state) => ({
        hooks: state.hooks.map((hook) =>
          hook.id === id
            ? { ...hook, ...updates, updated_at: new Date().toISOString() }
            : hook
        ),
      }));

      const { data, error } = await updateHook(id, updates);

      if (error) {
        // Rollback optimistic update
        set({
          hooks: previousHooks,
          hooksError: error.message,
        });
        return null;
      }

      // Update with server response
      set((state) => ({
        hooks: state.hooks.map((hook) =>
          hook.id === id ? data! : hook
        ),
        hooksError: null,
      }));

      // Update topic hints if topic was changed
      if (data?.topic_hint && data.topic_hint !== previousHook.topic_hint) {
        set((state) => {
          const hints = new Set(state.availableTopicHints);
          hints.add(data.topic_hint!);
          return { availableTopicHints: Array.from(hints).sort() };
        });
      }

      return data;
    },

    removeHook: async (id: string) => {
      // Store previous state for rollback
      const previousHooks = get().hooks;

      // Optimistic update - remove hook from list
      set((state) => ({
        hooks: state.hooks.filter((hook) => hook.id !== id),
      }));

      const { error } = await deleteHook(id);

      if (error) {
        // Rollback optimistic update
        set({
          hooks: previousHooks,
          hooksError: error.message,
        });
        return false;
      }

      return true;
    },

    toggleStar: async (id: string) => {
      // Store previous state for rollback
      const previousHooks = get().hooks;
      const hook = previousHooks.find((h) => h.id === id);

      if (!hook) {
        return;
      }

      // Optimistic update - toggle is_starred
      set((state) => ({
        hooks: state.hooks.map((h) =>
          h.id === id ? { ...h, is_starred: !h.is_starred } : h
        ),
      }));

      const { error } = await toggleHookStar(id);

      if (error) {
        // Rollback optimistic update
        set({
          hooks: previousHooks,
          hooksError: error.message,
        });
      }
    },

    updateStatus: async (id: string, status: HookStatus) => {
      // Store previous state for rollback
      const previousHooks = get().hooks;
      const hook = previousHooks.find((h) => h.id === id);

      if (!hook) {
        return;
      }

      // Optimistic update - update status
      set((state) => ({
        hooks: state.hooks.map((h) =>
          h.id === id ? { ...h, status, updated_at: new Date().toISOString() } : h
        ),
      }));

      const { error } = await updateHookStatus(id, status);

      if (error) {
        // Rollback optimistic update
        set({
          hooks: previousHooks,
          hooksError: error.message,
        });
      }
    },

    // Filter actions
    updateFilters: (filters: Partial<HookFilters>) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
      }));
    },

    clearFilters: () => {
      set({ filters: {} });
    },

    // Reset
    reset: () => {
      set(initialState);
    },
  })
);

/**
 * Selector hooks for common use cases
 */
export const useHooks = () =>
  useHooksLibraryStore((state) => state.hooks);

export const useHooksLoading = () =>
  useHooksLibraryStore((state) => state.hooksLoading);

export const useHooksError = () =>
  useHooksLibraryStore((state) => state.hooksError);

export const useHookFilters = () =>
  useHooksLibraryStore((state) => state.filters);

export const useStarredHooks = () =>
  useHooksLibraryStore((state) => state.hooks.filter((hook) => hook.is_starred));

export const useHooksByStatus = (status: HookStatus) =>
  useHooksLibraryStore((state) => state.hooks.filter((hook) => hook.status === status));

export const useHooksByEmotion = (emotion: EmotionCategory) =>
  useHooksLibraryStore((state) => state.hooks.filter((hook) => hook.emotion_category === emotion));

export const useAvailableTopicHints = () =>
  useHooksLibraryStore((state) => state.availableTopicHints);
