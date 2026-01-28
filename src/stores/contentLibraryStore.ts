import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  ContentLibraryItem,
  ContentLibraryInput,
  ContentLibraryFilters,
  Template,
  TemplateInput,
  TemplateFilters,
} from '@/types/content-library';
import {
  fetchContentItems,
  saveContent,
  deleteContent,
  incrementUsageCount,
  getAllTags,
} from '@/lib/content-library';
import {
  fetchTemplates,
  fetchSharedTemplates,
  saveTemplate,
  deleteTemplate,
  incrementTemplateUsageCount,
} from '@/lib/templates';

/**
 * Content Library Store State
 */
interface ContentLibraryState {
  // Content library items
  items: ContentLibraryItem[];
  itemsLoading: boolean;
  itemsError: string | null;

  // Templates
  templates: Template[];
  sharedTemplates: Template[];
  templatesLoading: boolean;
  templatesError: string | null;

  // Filters for content library
  filters: ContentLibraryFilters;

  // Template filters
  templateFilters: TemplateFilters;

  // Available tags for autocomplete
  availableTags: string[];
  tagsLoading: boolean;
}

/**
 * Content Library Store Actions
 */
interface ContentLibraryActions {
  // Content library actions
  fetchItems: (filters?: ContentLibraryFilters) => Promise<void>;
  saveContentItem: (input: ContentLibraryInput) => Promise<ContentLibraryItem | null>;
  deleteItem: (id: string) => Promise<boolean>;
  incrementItemUsage: (id: string) => Promise<void>;

  // Template actions
  fetchAllTemplates: (filters?: TemplateFilters) => Promise<void>;
  saveNewTemplate: (input: TemplateInput) => Promise<Template | null>;
  deleteTemplateItem: (id: string) => Promise<boolean>;
  incrementTemplateUsage: (id: string) => Promise<void>;

  // Filter actions
  updateFilters: (filters: Partial<ContentLibraryFilters>) => void;
  clearFilters: () => void;
  updateTemplateFilters: (filters: Partial<TemplateFilters>) => void;
  clearTemplateFilters: () => void;

  // Tags
  fetchTags: () => Promise<void>;

  // Reset
  reset: () => void;
}

/**
 * Initial state for the content library store
 */
const initialState: ContentLibraryState = {
  items: [],
  itemsLoading: false,
  itemsError: null,
  templates: [],
  sharedTemplates: [],
  templatesLoading: false,
  templatesError: null,
  filters: {},
  templateFilters: {},
  availableTags: [],
  tagsLoading: false,
};

/**
 * Content Library Zustand Store
 *
 * Manages state for content library items and templates.
 * Provides CRUD operations with optimistic updates where appropriate.
 */
export const useContentLibraryStore = create<ContentLibraryState & ContentLibraryActions>(
  (set, get) => ({
    // Initial state
    ...initialState,

    // Content library actions
    fetchItems: async (filters?: ContentLibraryFilters) => {
      const effectiveFilters = filters ?? get().filters;

      set({ itemsLoading: true, itemsError: null });

      const { data, error } = await fetchContentItems(effectiveFilters);

      if (error) {
        set({
          itemsLoading: false,
          itemsError: error.message,
        });
        return;
      }

      set({
        items: data || [],
        itemsLoading: false,
        itemsError: null,
      });
    },

    saveContentItem: async (input: ContentLibraryInput) => {
      // Optimistic update - add a temporary item with a placeholder ID
      const tempId = `temp-${Date.now()}`;
      const tempItem: ContentLibraryItem = {
        id: tempId,
        user_id: '', // Will be set by database
        team_id: input.team_id || null,
        content_type: input.content_type,
        title: input.title,
        content: input.content,
        tags: input.tags || [],
        metadata: input.metadata || {},
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((state) => ({
        items: [tempItem, ...state.items],
      }));

      const { data, error } = await saveContent(input);

      if (error) {
        // Rollback optimistic update
        set((state) => ({
          items: state.items.filter((item) => item.id !== tempId),
          itemsError: error.message,
        }));
        toast.error("Couldn't save content item. Please try again.");
        return null;
      }

      // Replace temp item with real item
      set((state) => ({
        items: state.items.map((item) =>
          item.id === tempId ? data! : item
        ),
        itemsError: null,
      }));

      // Refresh tags if new tags were added
      if (input.tags && input.tags.length > 0) {
        get().fetchTags();
      }

      return data;
    },

    deleteItem: async (id: string) => {
      // Optimistic update - remove item from list
      const previousItems = get().items;
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));

      const { error } = await deleteContent(id);

      if (error) {
        // Rollback optimistic update
        set({
          items: previousItems,
          itemsError: error.message,
        });
        toast.error("Couldn't delete item. Please try again.");
        return false;
      }

      return true;
    },

    incrementItemUsage: async (id: string) => {
      // Optimistic update - increment usage count
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? { ...item, usage_count: item.usage_count + 1 }
            : item
        ),
      }));

      const { error } = await incrementUsageCount(id);

      if (error) {
        // Rollback on error - decrement usage count
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, usage_count: Math.max(0, item.usage_count - 1) }
              : item
          ),
        }));
        toast.error("Couldn't update usage count.");
      }
    },

    // Template actions
    fetchAllTemplates: async (filters?: TemplateFilters) => {
      const effectiveFilters = filters ?? get().templateFilters;

      set({ templatesLoading: true, templatesError: null });

      // Fetch both personal+team templates and shared templates in parallel
      const [templatesResult, sharedResult] = await Promise.all([
        fetchTemplates(effectiveFilters, true),
        fetchSharedTemplates(effectiveFilters),
      ]);

      if (templatesResult.error) {
        set({
          templatesLoading: false,
          templatesError: templatesResult.error.message,
        });
        return;
      }

      set({
        templates: templatesResult.data || [],
        sharedTemplates: sharedResult.data || [],
        templatesLoading: false,
        templatesError: null,
      });
    },

    saveNewTemplate: async (input: TemplateInput) => {
      // Optimistic update - add a temporary template
      const tempId = `temp-${Date.now()}`;
      const tempTemplate: Template = {
        id: tempId,
        user_id: '', // Will be set by database
        team_id: input.team_id || null,
        name: input.name,
        description: input.description || null,
        template_content: input.template_content,
        variables: input.variables || [],
        content_type: input.content_type,
        is_shared: input.is_shared || false,
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((state) => ({
        templates: [tempTemplate, ...state.templates],
      }));

      const { data, error } = await saveTemplate(input);

      if (error) {
        // Rollback optimistic update
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== tempId),
          templatesError: error.message,
        }));
        toast.error("Couldn't save template. Please try again.");
        return null;
      }

      // Replace temp template with real template
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === tempId ? data! : t
        ),
        templatesError: null,
      }));

      return data;
    },

    deleteTemplateItem: async (id: string) => {
      // Optimistic update - remove template from list
      const previousTemplates = get().templates;
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));

      const { error } = await deleteTemplate(id);

      if (error) {
        // Rollback optimistic update
        set({
          templates: previousTemplates,
          templatesError: error.message,
        });
        toast.error("Couldn't delete template. Please try again.");
        return false;
      }

      return true;
    },

    incrementTemplateUsage: async (id: string) => {
      // Optimistic update - increment usage count in both lists
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === id ? { ...t, usage_count: t.usage_count + 1 } : t
        ),
        sharedTemplates: state.sharedTemplates.map((t) =>
          t.id === id ? { ...t, usage_count: t.usage_count + 1 } : t
        ),
      }));

      const { error } = await incrementTemplateUsageCount(id);

      if (error) {
        // Rollback on error
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? { ...t, usage_count: Math.max(0, t.usage_count - 1) }
              : t
          ),
          sharedTemplates: state.sharedTemplates.map((t) =>
            t.id === id
              ? { ...t, usage_count: Math.max(0, t.usage_count - 1) }
              : t
          ),
        }));
        toast.error("Couldn't update template usage.");
      }
    },

    // Filter actions
    updateFilters: (filters: Partial<ContentLibraryFilters>) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
      }));
    },

    clearFilters: () => {
      set({ filters: {} });
    },

    updateTemplateFilters: (filters: Partial<TemplateFilters>) => {
      set((state) => ({
        templateFilters: { ...state.templateFilters, ...filters },
      }));
    },

    clearTemplateFilters: () => {
      set({ templateFilters: {} });
    },

    // Tags
    fetchTags: async () => {
      set({ tagsLoading: true });

      const { data, error } = await getAllTags();

      if (error) {
        set({ tagsLoading: false });
        toast.error("Couldn't load tags.");
        return;
      }

      set({
        availableTags: data || [],
        tagsLoading: false,
      });
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
export const useContentItems = () =>
  useContentLibraryStore((state) => state.items);

export const useContentItemsLoading = () =>
  useContentLibraryStore((state) => state.itemsLoading);

export const useContentItemsError = () =>
  useContentLibraryStore((state) => state.itemsError);

export const useTemplates = () =>
  useContentLibraryStore((state) => state.templates);

export const useSharedTemplates = () =>
  useContentLibraryStore((state) => state.sharedTemplates);

export const useTemplatesLoading = () =>
  useContentLibraryStore((state) => state.templatesLoading);

export const useTemplatesError = () =>
  useContentLibraryStore((state) => state.templatesError);

export const useContentFilters = () =>
  useContentLibraryStore((state) => state.filters);

export const useTemplateFilters = () =>
  useContentLibraryStore((state) => state.templateFilters);

export const useAvailableTags = () =>
  useContentLibraryStore((state) => state.availableTags);
