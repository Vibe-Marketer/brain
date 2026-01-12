import { create } from 'zustand';
import type {
  ContentItem,
  ContentItemInput,
  ContentItemFilters,
  ContentItemType,
  ContentItemStatus,
} from '@/types/content-hub';
import {
  fetchContentItems,
  fetchPosts as fetchPostsLib,
  fetchEmails as fetchEmailsLib,
  createContentItem,
  updateContentItem,
  deleteContentItem,
  markAsUsed,
  markAsDraft,
} from '@/lib/content-items';

/**
 * Content Items Store State
 */
interface ContentItemsState {
  // Content items by type
  posts: ContentItem[];
  emails: ContentItem[];

  // Loading and error state
  itemsLoading: boolean;
  itemsError: string | null;

  // Filters
  filters: ContentItemFilters;
}

/**
 * Content Items Store Actions
 */
interface ContentItemsActions {
  // Fetch actions
  fetchPosts: (filters?: Omit<ContentItemFilters, 'content_type'>) => Promise<void>;
  fetchEmails: (filters?: Omit<ContentItemFilters, 'content_type'>) => Promise<void>;
  fetchAll: (filters?: ContentItemFilters) => Promise<void>;

  // CRUD actions
  addItem: (input: ContentItemInput) => Promise<ContentItem | null>;
  updateItem: (id: string, updates: Partial<Omit<ContentItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<ContentItem | null>;
  removeItem: (id: string) => Promise<boolean>;

  // Status actions
  markItemAsUsed: (id: string) => Promise<void>;
  markItemAsDraft: (id: string) => Promise<void>;

  // Filter actions
  updateFilters: (filters: Partial<ContentItemFilters>) => void;
  clearFilters: () => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state for the content items store
 */
const initialState: ContentItemsState = {
  posts: [],
  emails: [],
  itemsLoading: false,
  itemsError: null,
  filters: {},
};

/**
 * Content Items Zustand Store
 *
 * Manages state for content items (posts and emails).
 * Provides CRUD operations with optimistic updates.
 */
export const useContentItemsStore = create<ContentItemsState & ContentItemsActions>(
  (set, get) => ({
    // Initial state
    ...initialState,

    // Fetch posts
    fetchPosts: async (filters?: Omit<ContentItemFilters, 'content_type'>) => {
      const effectiveFilters = filters ?? get().filters;

      set({ itemsLoading: true, itemsError: null });

      const { data, error } = await fetchPostsLib(effectiveFilters);

      if (error) {
        set({
          itemsLoading: false,
          itemsError: error.message,
        });
        return;
      }

      set({
        posts: data || [],
        itemsLoading: false,
        itemsError: null,
      });
    },

    // Fetch emails
    fetchEmails: async (filters?: Omit<ContentItemFilters, 'content_type'>) => {
      const effectiveFilters = filters ?? get().filters;

      set({ itemsLoading: true, itemsError: null });

      const { data, error } = await fetchEmailsLib(effectiveFilters);

      if (error) {
        set({
          itemsLoading: false,
          itemsError: error.message,
        });
        return;
      }

      set({
        emails: data || [],
        itemsLoading: false,
        itemsError: null,
      });
    },

    // Fetch both posts and emails
    fetchAll: async (filters?: ContentItemFilters) => {
      const effectiveFilters = filters ?? get().filters;

      set({ itemsLoading: true, itemsError: null });

      // Fetch both types in parallel
      const [postsResult, emailsResult] = await Promise.all([
        fetchPostsLib(effectiveFilters),
        fetchEmailsLib(effectiveFilters),
      ]);

      if (postsResult.error) {
        set({
          itemsLoading: false,
          itemsError: postsResult.error.message,
        });
        return;
      }

      if (emailsResult.error) {
        set({
          itemsLoading: false,
          itemsError: emailsResult.error.message,
        });
        return;
      }

      set({
        posts: postsResult.data || [],
        emails: emailsResult.data || [],
        itemsLoading: false,
        itemsError: null,
      });
    },

    // Add new content item
    addItem: async (input: ContentItemInput) => {
      // Optimistic update - add a temporary item with a placeholder ID
      const tempId = `temp-${Date.now()}`;
      const tempItem: ContentItem = {
        id: tempId,
        user_id: '', // Will be set by database
        hook_id: input.hook_id || null,
        content_type: input.content_type,
        content_text: input.content_text,
        email_subject: input.email_subject || null,
        status: input.status || 'draft',
        used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to appropriate list based on type
      if (input.content_type === 'post') {
        set((state) => ({
          posts: [tempItem, ...state.posts],
        }));
      } else {
        set((state) => ({
          emails: [tempItem, ...state.emails],
        }));
      }

      const { data, error } = await createContentItem(input);

      if (error) {
        // Rollback optimistic update
        if (input.content_type === 'post') {
          set((state) => ({
            posts: state.posts.filter((item) => item.id !== tempId),
            itemsError: error.message,
          }));
        } else {
          set((state) => ({
            emails: state.emails.filter((item) => item.id !== tempId),
            itemsError: error.message,
          }));
        }
        return null;
      }

      // Replace temp item with real item
      if (input.content_type === 'post') {
        set((state) => ({
          posts: state.posts.map((item) =>
            item.id === tempId ? data! : item
          ),
          itemsError: null,
        }));
      } else {
        set((state) => ({
          emails: state.emails.map((item) =>
            item.id === tempId ? data! : item
          ),
          itemsError: null,
        }));
      }

      return data;
    },

    // Update content item
    updateItem: async (id: string, updates: Partial<Omit<ContentItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      // Find item in either list
      const existingPost = get().posts.find((item) => item.id === id);
      const existingEmail = get().emails.find((item) => item.id === id);
      const existingItem = existingPost || existingEmail;
      const isPost = !!existingPost;

      if (!existingItem) {
        set({ itemsError: 'Content item not found' });
        return null;
      }

      // Optimistic update
      const previousItem = { ...existingItem };
      const updatedItem = { ...existingItem, ...updates, updated_at: new Date().toISOString() };

      if (isPost) {
        set((state) => ({
          posts: state.posts.map((item) =>
            item.id === id ? updatedItem : item
          ),
        }));
      } else {
        set((state) => ({
          emails: state.emails.map((item) =>
            item.id === id ? updatedItem : item
          ),
        }));
      }

      const { data, error } = await updateContentItem(id, updates);

      if (error) {
        // Rollback optimistic update
        if (isPost) {
          set((state) => ({
            posts: state.posts.map((item) =>
              item.id === id ? previousItem : item
            ),
            itemsError: error.message,
          }));
        } else {
          set((state) => ({
            emails: state.emails.map((item) =>
              item.id === id ? previousItem : item
            ),
            itemsError: error.message,
          }));
        }
        return null;
      }

      // Update with server response
      if (isPost) {
        set((state) => ({
          posts: state.posts.map((item) =>
            item.id === id ? data! : item
          ),
          itemsError: null,
        }));
      } else {
        set((state) => ({
          emails: state.emails.map((item) =>
            item.id === id ? data! : item
          ),
          itemsError: null,
        }));
      }

      return data;
    },

    // Remove content item
    removeItem: async (id: string) => {
      // Find item in either list
      const existingPost = get().posts.find((item) => item.id === id);
      const existingEmail = get().emails.find((item) => item.id === id);
      const isPost = !!existingPost;

      // Optimistic update - store previous state for rollback
      const previousPosts = get().posts;
      const previousEmails = get().emails;

      if (isPost) {
        set((state) => ({
          posts: state.posts.filter((item) => item.id !== id),
        }));
      } else {
        set((state) => ({
          emails: state.emails.filter((item) => item.id !== id),
        }));
      }

      const { error } = await deleteContentItem(id);

      if (error) {
        // Rollback optimistic update
        set({
          posts: previousPosts,
          emails: previousEmails,
          itemsError: error.message,
        });
        return false;
      }

      return true;
    },

    // Mark item as used
    markItemAsUsed: async (id: string) => {
      // Find item in either list
      const existingPost = get().posts.find((item) => item.id === id);
      const existingEmail = get().emails.find((item) => item.id === id);
      const isPost = !!existingPost;

      // Optimistic update
      const now = new Date().toISOString();
      if (isPost) {
        set((state) => ({
          posts: state.posts.map((item) =>
            item.id === id
              ? { ...item, status: 'used' as ContentItemStatus, used_at: now }
              : item
          ),
        }));
      } else {
        set((state) => ({
          emails: state.emails.map((item) =>
            item.id === id
              ? { ...item, status: 'used' as ContentItemStatus, used_at: now }
              : item
          ),
        }));
      }

      const { error } = await markAsUsed(id);

      if (error) {
        // Rollback on error
        if (isPost) {
          set((state) => ({
            posts: state.posts.map((item) =>
              item.id === id
                ? { ...item, status: 'draft' as ContentItemStatus, used_at: null }
                : item
            ),
          }));
        } else {
          set((state) => ({
            emails: state.emails.map((item) =>
              item.id === id
                ? { ...item, status: 'draft' as ContentItemStatus, used_at: null }
                : item
            ),
          }));
        }
      }
    },

    // Mark item as draft
    markItemAsDraft: async (id: string) => {
      // Find item in either list
      const existingPost = get().posts.find((item) => item.id === id);
      const existingEmail = get().emails.find((item) => item.id === id);
      const isPost = !!existingPost;

      // Store previous state for rollback
      const previousStatus = existingPost?.status || existingEmail?.status;
      const previousUsedAt = existingPost?.used_at || existingEmail?.used_at;

      // Optimistic update
      if (isPost) {
        set((state) => ({
          posts: state.posts.map((item) =>
            item.id === id
              ? { ...item, status: 'draft' as ContentItemStatus, used_at: null }
              : item
          ),
        }));
      } else {
        set((state) => ({
          emails: state.emails.map((item) =>
            item.id === id
              ? { ...item, status: 'draft' as ContentItemStatus, used_at: null }
              : item
          ),
        }));
      }

      const { error } = await markAsDraft(id);

      if (error) {
        // Rollback on error
        if (isPost) {
          set((state) => ({
            posts: state.posts.map((item) =>
              item.id === id
                ? { ...item, status: previousStatus as ContentItemStatus, used_at: previousUsedAt }
                : item
            ),
          }));
        } else {
          set((state) => ({
            emails: state.emails.map((item) =>
              item.id === id
                ? { ...item, status: previousStatus as ContentItemStatus, used_at: previousUsedAt }
                : item
            ),
          }));
        }
      }
    },

    // Update filters
    updateFilters: (filters: Partial<ContentItemFilters>) => {
      set((state) => ({
        filters: { ...state.filters, ...filters },
      }));
    },

    // Clear filters
    clearFilters: () => {
      set({ filters: {} });
    },

    // Reset to initial state
    reset: () => {
      set(initialState);
    },
  })
);

/**
 * Selector hooks for common use cases
 */
export const usePosts = () =>
  useContentItemsStore((state) => state.posts);

export const useEmails = () =>
  useContentItemsStore((state) => state.emails);

export const usePostsLoading = () =>
  useContentItemsStore((state) => state.itemsLoading);

export const useEmailsLoading = () =>
  useContentItemsStore((state) => state.itemsLoading);

export const useItemsError = () =>
  useContentItemsStore((state) => state.itemsError);

export const useItemFilters = () =>
  useContentItemsStore((state) => state.filters);
