import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useContentLibraryStore } from '../contentLibraryStore';
import type {
  ContentLibraryItem,
  Template,
  ContentLibraryFilters,
  TemplateFilters,
} from '@/types/content-library';

// Mock the API functions
vi.mock('@/lib/content-library', () => ({
  fetchContentItems: vi.fn(),
  saveContent: vi.fn(),
  deleteContent: vi.fn(),
  incrementUsageCount: vi.fn(),
  getAllTags: vi.fn(),
}));

vi.mock('@/lib/templates', () => ({
  fetchTemplates: vi.fn(),
  fetchSharedTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  incrementTemplateUsageCount: vi.fn(),
}));

// Import mocked functions for manipulation
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

const mockFetchContentItems = vi.mocked(fetchContentItems);
const mockSaveContent = vi.mocked(saveContent);
const mockDeleteContent = vi.mocked(deleteContent);
const mockIncrementUsageCount = vi.mocked(incrementUsageCount);
const mockGetAllTags = vi.mocked(getAllTags);
const mockFetchTemplates = vi.mocked(fetchTemplates);
const mockFetchSharedTemplates = vi.mocked(fetchSharedTemplates);
const mockSaveTemplate = vi.mocked(saveTemplate);
const mockDeleteTemplate = vi.mocked(deleteTemplate);
const mockIncrementTemplateUsageCount = vi.mocked(incrementTemplateUsageCount);

// Mock data
const mockContentItem: ContentLibraryItem = {
  id: 'item-1',
  user_id: 'user-1',
  team_id: null,
  content_type: 'email',
  title: 'Test Email',
  content: 'Test content',
  tags: ['follow-up', 'sales'],
  metadata: {},
  usage_count: 5,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
};

const mockTemplate: Template = {
  id: 'template-1',
  user_id: 'user-1',
  team_id: null,
  name: 'Test Template',
  description: 'A test template',
  template_content: 'Hello {{firstName}}!',
  variables: [{ name: 'firstName', required: true }],
  content_type: 'email',
  is_shared: false,
  usage_count: 3,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
};

describe('contentLibraryStore', () => {
  // Reset store state and mocks before each test
  beforeEach(() => {
    act(() => {
      useContentLibraryStore.getState().reset();
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useContentLibraryStore.getState();

      expect(state.items).toEqual([]);
      expect(state.itemsLoading).toBe(false);
      expect(state.itemsError).toBeNull();
      expect(state.templates).toEqual([]);
      expect(state.sharedTemplates).toEqual([]);
      expect(state.templatesLoading).toBe(false);
      expect(state.templatesError).toBeNull();
      expect(state.filters).toEqual({});
      expect(state.templateFilters).toEqual({});
      expect(state.availableTags).toEqual([]);
      expect(state.tagsLoading).toBe(false);
    });
  });

  describe('fetchItems', () => {
    it('should fetch content items successfully', async () => {
      mockFetchContentItems.mockResolvedValue({
        data: [mockContentItem],
        error: null,
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchItems();
      });

      const state = useContentLibraryStore.getState();
      expect(state.items).toEqual([mockContentItem]);
      expect(state.itemsLoading).toBe(false);
      expect(state.itemsError).toBeNull();
    });

    it('should set loading state while fetching', async () => {
      let resolvePromise: (value: { data: ContentLibraryItem[]; error: null }) => void;
      const pendingPromise = new Promise<{ data: ContentLibraryItem[]; error: null }>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchContentItems.mockReturnValue(pendingPromise);

      act(() => {
        useContentLibraryStore.getState().fetchItems();
      });

      expect(useContentLibraryStore.getState().itemsLoading).toBe(true);

      await act(async () => {
        resolvePromise!({ data: [], error: null });
      });

      expect(useContentLibraryStore.getState().itemsLoading).toBe(false);
    });

    it('should handle fetch error', async () => {
      mockFetchContentItems.mockResolvedValue({
        data: null,
        error: { message: 'Network error', name: 'ContentLibraryError' } as Error,
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchItems();
      });

      const state = useContentLibraryStore.getState();
      expect(state.items).toEqual([]);
      expect(state.itemsLoading).toBe(false);
      expect(state.itemsError).toBe('Network error');
    });

    it('should use current filters when fetching', async () => {
      const filters: ContentLibraryFilters = {
        content_type: 'email',
        tags: ['follow-up'],
      };

      mockFetchContentItems.mockResolvedValue({ data: [], error: null });

      act(() => {
        useContentLibraryStore.setState({ filters });
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchItems();
      });

      expect(mockFetchContentItems).toHaveBeenCalledWith(filters);
    });

    it('should use provided filters over store filters', async () => {
      const storeFilters: ContentLibraryFilters = { content_type: 'email' };
      const providedFilters: ContentLibraryFilters = { content_type: 'social' };

      mockFetchContentItems.mockResolvedValue({ data: [], error: null });

      act(() => {
        useContentLibraryStore.setState({ filters: storeFilters });
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchItems(providedFilters);
      });

      expect(mockFetchContentItems).toHaveBeenCalledWith(providedFilters);
    });
  });

  describe('saveContentItem', () => {
    it('should save content with optimistic update', async () => {
      const newItem = { ...mockContentItem, id: 'new-item-id' };
      mockSaveContent.mockResolvedValue({ data: newItem, error: null });
      mockGetAllTags.mockResolvedValue({ data: ['follow-up'], error: null });

      const input = {
        content_type: 'email' as const,
        title: 'New Email',
        content: 'New content',
        tags: ['follow-up'],
      };

      let result: ContentLibraryItem | null = null;
      await act(async () => {
        result = await useContentLibraryStore.getState().saveContentItem(input);
      });

      const state = useContentLibraryStore.getState();
      expect(result).toEqual(newItem);
      expect(state.items).toContainEqual(newItem);
      expect(state.itemsError).toBeNull();
    });

    it('should rollback optimistic update on error', async () => {
      mockSaveContent.mockResolvedValue({
        data: null,
        error: { message: 'Save failed', name: 'ContentLibraryError' } as Error,
      });

      const input = {
        content_type: 'email' as const,
        title: 'New Email',
        content: 'New content',
      };

      let result: ContentLibraryItem | null = null;
      await act(async () => {
        result = await useContentLibraryStore.getState().saveContentItem(input);
      });

      const state = useContentLibraryStore.getState();
      expect(result).toBeNull();
      expect(state.items).toEqual([]);
      expect(state.itemsError).toBe('Save failed');
    });
  });

  describe('deleteItem', () => {
    it('should delete item with optimistic update', async () => {
      mockDeleteContent.mockResolvedValue({ data: { success: true }, error: null });

      act(() => {
        useContentLibraryStore.setState({ items: [mockContentItem] });
      });

      let result: boolean;
      await act(async () => {
        result = await useContentLibraryStore.getState().deleteItem('item-1');
      });

      expect(result!).toBe(true);
      expect(useContentLibraryStore.getState().items).toEqual([]);
    });

    it('should rollback optimistic delete on error', async () => {
      mockDeleteContent.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed', name: 'ContentLibraryError' } as Error,
      });

      act(() => {
        useContentLibraryStore.setState({ items: [mockContentItem] });
      });

      let result: boolean;
      await act(async () => {
        result = await useContentLibraryStore.getState().deleteItem('item-1');
      });

      expect(result!).toBe(false);
      expect(useContentLibraryStore.getState().items).toEqual([mockContentItem]);
      expect(useContentLibraryStore.getState().itemsError).toBe('Delete failed');
    });
  });

  describe('incrementItemUsage', () => {
    it('should increment usage count with optimistic update', async () => {
      mockIncrementUsageCount.mockResolvedValue({
        data: { ...mockContentItem, usage_count: 6 },
        error: null,
      });

      act(() => {
        useContentLibraryStore.setState({ items: [mockContentItem] });
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementItemUsage('item-1');
      });

      const state = useContentLibraryStore.getState();
      expect(state.items[0].usage_count).toBe(6);
    });

    it('should rollback usage increment on error', async () => {
      mockIncrementUsageCount.mockResolvedValue({
        data: null,
        error: { message: 'Increment failed', name: 'ContentLibraryError' } as Error,
      });

      act(() => {
        useContentLibraryStore.setState({ items: [mockContentItem] });
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementItemUsage('item-1');
      });

      // After rollback, should return to original count
      expect(useContentLibraryStore.getState().items[0].usage_count).toBe(5);
    });
  });

  describe('fetchAllTemplates', () => {
    it('should fetch templates and shared templates', async () => {
      const sharedTemplate = { ...mockTemplate, id: 'shared-1', is_shared: true };
      mockFetchTemplates.mockResolvedValue({ data: [mockTemplate], error: null });
      mockFetchSharedTemplates.mockResolvedValue({ data: [sharedTemplate], error: null });

      await act(async () => {
        await useContentLibraryStore.getState().fetchAllTemplates();
      });

      const state = useContentLibraryStore.getState();
      expect(state.templates).toEqual([mockTemplate]);
      expect(state.sharedTemplates).toEqual([sharedTemplate]);
      expect(state.templatesLoading).toBe(false);
      expect(state.templatesError).toBeNull();
    });

    it('should handle fetch error', async () => {
      mockFetchTemplates.mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch', name: 'TemplateError' } as Error,
      });
      mockFetchSharedTemplates.mockResolvedValue({ data: [], error: null });

      await act(async () => {
        await useContentLibraryStore.getState().fetchAllTemplates();
      });

      const state = useContentLibraryStore.getState();
      expect(state.templatesLoading).toBe(false);
      expect(state.templatesError).toBe('Failed to fetch');
    });

    it('should use template filters when fetching', async () => {
      const filters: TemplateFilters = { content_type: 'email' };
      mockFetchTemplates.mockResolvedValue({ data: [], error: null });
      mockFetchSharedTemplates.mockResolvedValue({ data: [], error: null });

      act(() => {
        useContentLibraryStore.setState({ templateFilters: filters });
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchAllTemplates();
      });

      expect(mockFetchTemplates).toHaveBeenCalledWith(filters, true);
      expect(mockFetchSharedTemplates).toHaveBeenCalledWith(filters);
    });
  });

  describe('saveNewTemplate', () => {
    it('should save template with optimistic update', async () => {
      const newTemplate = { ...mockTemplate, id: 'new-template-id' };
      mockSaveTemplate.mockResolvedValue({ data: newTemplate, error: null });

      const input = {
        name: 'New Template',
        template_content: 'Hello!',
        content_type: 'email' as const,
      };

      let result: Template | null = null;
      await act(async () => {
        result = await useContentLibraryStore.getState().saveNewTemplate(input);
      });

      expect(result).toEqual(newTemplate);
      expect(useContentLibraryStore.getState().templates).toContainEqual(newTemplate);
    });

    it('should rollback optimistic update on error', async () => {
      mockSaveTemplate.mockResolvedValue({
        data: null,
        error: { message: 'Save failed', name: 'TemplateError' } as Error,
      });

      const input = {
        name: 'New Template',
        template_content: 'Hello!',
        content_type: 'email' as const,
      };

      let result: Template | null = null;
      await act(async () => {
        result = await useContentLibraryStore.getState().saveNewTemplate(input);
      });

      expect(result).toBeNull();
      expect(useContentLibraryStore.getState().templates).toEqual([]);
      expect(useContentLibraryStore.getState().templatesError).toBe('Save failed');
    });
  });

  describe('deleteTemplateItem', () => {
    it('should delete template with optimistic update', async () => {
      mockDeleteTemplate.mockResolvedValue({ data: { success: true }, error: null });

      act(() => {
        useContentLibraryStore.setState({ templates: [mockTemplate] });
      });

      let result: boolean;
      await act(async () => {
        result = await useContentLibraryStore.getState().deleteTemplateItem('template-1');
      });

      expect(result!).toBe(true);
      expect(useContentLibraryStore.getState().templates).toEqual([]);
    });

    it('should rollback optimistic delete on error', async () => {
      mockDeleteTemplate.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed', name: 'TemplateError' } as Error,
      });

      act(() => {
        useContentLibraryStore.setState({ templates: [mockTemplate] });
      });

      let result: boolean;
      await act(async () => {
        result = await useContentLibraryStore.getState().deleteTemplateItem('template-1');
      });

      expect(result!).toBe(false);
      expect(useContentLibraryStore.getState().templates).toEqual([mockTemplate]);
    });
  });

  describe('incrementTemplateUsage', () => {
    it('should increment template usage count', async () => {
      mockIncrementTemplateUsageCount.mockResolvedValue({
        data: { ...mockTemplate, usage_count: 4 },
        error: null,
      });

      act(() => {
        useContentLibraryStore.setState({ templates: [mockTemplate] });
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementTemplateUsage('template-1');
      });

      expect(useContentLibraryStore.getState().templates[0].usage_count).toBe(4);
    });

    it('should also increment in shared templates if present', async () => {
      const sharedTemplate = { ...mockTemplate, id: 'shared-1', usage_count: 10 };
      mockIncrementTemplateUsageCount.mockResolvedValue({
        data: { ...sharedTemplate, usage_count: 11 },
        error: null,
      });

      act(() => {
        useContentLibraryStore.setState({ sharedTemplates: [sharedTemplate] });
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementTemplateUsage('shared-1');
      });

      expect(useContentLibraryStore.getState().sharedTemplates[0].usage_count).toBe(11);
    });
  });

  describe('filter actions', () => {
    it('should update filters', () => {
      act(() => {
        useContentLibraryStore.getState().updateFilters({ content_type: 'email' });
      });

      expect(useContentLibraryStore.getState().filters).toEqual({
        content_type: 'email',
      });
    });

    it('should merge filters with existing', () => {
      act(() => {
        useContentLibraryStore.setState({ filters: { content_type: 'email' } });
        useContentLibraryStore.getState().updateFilters({ tags: ['test'] });
      });

      expect(useContentLibraryStore.getState().filters).toEqual({
        content_type: 'email',
        tags: ['test'],
      });
    });

    it('should clear filters', () => {
      act(() => {
        useContentLibraryStore.setState({
          filters: { content_type: 'email', tags: ['test'] },
        });
        useContentLibraryStore.getState().clearFilters();
      });

      expect(useContentLibraryStore.getState().filters).toEqual({});
    });

    it('should update template filters', () => {
      act(() => {
        useContentLibraryStore.getState().updateTemplateFilters({
          content_type: 'social',
          is_shared: true,
        });
      });

      expect(useContentLibraryStore.getState().templateFilters).toEqual({
        content_type: 'social',
        is_shared: true,
      });
    });

    it('should clear template filters', () => {
      act(() => {
        useContentLibraryStore.setState({
          templateFilters: { content_type: 'email' },
        });
        useContentLibraryStore.getState().clearTemplateFilters();
      });

      expect(useContentLibraryStore.getState().templateFilters).toEqual({});
    });
  });

  describe('fetchTags', () => {
    it('should fetch available tags', async () => {
      mockGetAllTags.mockResolvedValue({
        data: ['follow-up', 'sales', 'marketing'],
        error: null,
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchTags();
      });

      const state = useContentLibraryStore.getState();
      expect(state.availableTags).toEqual(['follow-up', 'sales', 'marketing']);
      expect(state.tagsLoading).toBe(false);
    });

    it('should handle fetch tags error gracefully', async () => {
      mockGetAllTags.mockResolvedValue({
        data: null,
        error: { message: 'Failed', name: 'ContentLibraryError' } as Error,
      });

      await act(async () => {
        await useContentLibraryStore.getState().fetchTags();
      });

      const state = useContentLibraryStore.getState();
      expect(state.availableTags).toEqual([]);
      expect(state.tagsLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      act(() => {
        useContentLibraryStore.setState({
          items: [mockContentItem],
          itemsLoading: true,
          itemsError: 'Some error',
          templates: [mockTemplate],
          sharedTemplates: [mockTemplate],
          templatesLoading: true,
          templatesError: 'Template error',
          filters: { content_type: 'email' },
          templateFilters: { is_shared: true },
          availableTags: ['tag1', 'tag2'],
          tagsLoading: true,
        });
      });

      act(() => {
        useContentLibraryStore.getState().reset();
      });

      const state = useContentLibraryStore.getState();
      expect(state.items).toEqual([]);
      expect(state.itemsLoading).toBe(false);
      expect(state.itemsError).toBeNull();
      expect(state.templates).toEqual([]);
      expect(state.sharedTemplates).toEqual([]);
      expect(state.templatesLoading).toBe(false);
      expect(state.templatesError).toBeNull();
      expect(state.filters).toEqual({});
      expect(state.templateFilters).toEqual({});
      expect(state.availableTags).toEqual([]);
      expect(state.tagsLoading).toBe(false);
    });
  });

  describe('typical workflow', () => {
    it('should handle complete content management flow', async () => {
      // 1. Fetch existing items
      mockFetchContentItems.mockResolvedValue({ data: [mockContentItem], error: null });
      mockGetAllTags.mockResolvedValue({ data: ['follow-up'], error: null });

      await act(async () => {
        await useContentLibraryStore.getState().fetchItems();
      });

      expect(useContentLibraryStore.getState().items).toHaveLength(1);

      // 2. Save new content
      const newItem = { ...mockContentItem, id: 'new-item', title: 'New Email' };
      mockSaveContent.mockResolvedValue({ data: newItem, error: null });

      await act(async () => {
        await useContentLibraryStore.getState().saveContentItem({
          content_type: 'email',
          title: 'New Email',
          content: 'Content',
          tags: ['follow-up'],
        });
      });

      expect(useContentLibraryStore.getState().items).toHaveLength(2);

      // 3. Use content (increment usage)
      mockIncrementUsageCount.mockResolvedValue({
        data: { ...newItem, usage_count: 1 },
        error: null,
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementItemUsage('new-item');
      });

      const updatedItem = useContentLibraryStore
        .getState()
        .items.find((i) => i.id === 'new-item');
      expect(updatedItem?.usage_count).toBe(1);

      // 4. Apply filter
      act(() => {
        useContentLibraryStore.getState().updateFilters({ content_type: 'email' });
      });

      expect(useContentLibraryStore.getState().filters.content_type).toBe('email');

      // 5. Delete content
      mockDeleteContent.mockResolvedValue({ data: { success: true }, error: null });

      await act(async () => {
        await useContentLibraryStore.getState().deleteItem('new-item');
      });

      expect(useContentLibraryStore.getState().items).toHaveLength(1);
    });

    it('should handle template workflow', async () => {
      // 1. Fetch templates
      mockFetchTemplates.mockResolvedValue({ data: [mockTemplate], error: null });
      mockFetchSharedTemplates.mockResolvedValue({ data: [], error: null });

      await act(async () => {
        await useContentLibraryStore.getState().fetchAllTemplates();
      });

      expect(useContentLibraryStore.getState().templates).toHaveLength(1);

      // 2. Save new template
      const newTemplate = { ...mockTemplate, id: 'new-template', name: 'New Template' };
      mockSaveTemplate.mockResolvedValue({ data: newTemplate, error: null });

      await act(async () => {
        await useContentLibraryStore.getState().saveNewTemplate({
          name: 'New Template',
          template_content: 'Hello!',
          content_type: 'email',
        });
      });

      expect(useContentLibraryStore.getState().templates).toHaveLength(2);

      // 3. Use template
      mockIncrementTemplateUsageCount.mockResolvedValue({
        data: { ...newTemplate, usage_count: 1 },
        error: null,
      });

      await act(async () => {
        await useContentLibraryStore.getState().incrementTemplateUsage('new-template');
      });

      // 4. Delete template
      mockDeleteTemplate.mockResolvedValue({ data: { success: true }, error: null });

      await act(async () => {
        await useContentLibraryStore.getState().deleteTemplateItem('new-template');
      });

      expect(useContentLibraryStore.getState().templates).toHaveLength(1);
    });
  });
});
