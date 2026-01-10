import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { requireUser } from '@/lib/auth-utils';
import {
  fetchContentItems,
  saveContent,
  updateContent,
  deleteContent,
  incrementUsageCount,
  getContentById,
  getAllTags,
  ContentLibraryError,
} from '../content-library';

describe('Content Library CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchContentItems', () => {
    it('should fetch all content items without filters', async () => {
      const mockData = [
        {
          id: '1',
          user_id: 'test-user-id',
          team_id: null,
          content_type: 'email',
          title: 'Test Email',
          content: 'Test content',
          tags: ['sales'],
          metadata: {},
          usage_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await fetchContentItems();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith('content_library');
    });

    it('should filter by content_type', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        eq: mockEq,
      } as any);

      await fetchContentItems({ content_type: 'email' });

      expect(mockEq).toHaveBeenCalledWith('content_type', 'email');
    });

    it('should filter by tags', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockContains = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder,
        contains: mockContains,
      } as any);

      await fetchContentItems({ tags: ['sales', 'follow-up'] });

      expect(mockContains).toHaveBeenCalledWith('tags', ['sales', 'follow-up']);
    });

    it('should handle database errors', async () => {
      const mockError = { code: 'PGRST123', message: 'Database error' };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      } as any);

      const result = await fetchContentItems();

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.code).toBe('PGRST123');
      expect(result.data).toBeNull();
    });
  });

  describe('saveContent', () => {
    it('should save content with required fields', async () => {
      const input = {
        content_type: 'email' as const,
        title: 'Test Email',
        content: 'Test content body',
        tags: ['sales'],
      };

      const mockInsertedData = {
        id: 'new-id',
        user_id: 'test-user-id',
        team_id: null,
        ...input,
        metadata: {},
        usage_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockInsertedData, error: null }),
          }),
        }),
      } as any);

      const result = await saveContent(input);

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockInsertedData);
    });

    it('should reject empty title', async () => {
      const input = {
        content_type: 'email' as const,
        title: '',
        content: 'Test content',
      };

      const result = await saveContent(input);

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Title is required');
      expect(result.data).toBeNull();
    });

    it('should reject empty content', async () => {
      const input = {
        content_type: 'email' as const,
        title: 'Test Title',
        content: '',
      };

      const result = await saveContent(input);

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content is required');
      expect(result.data).toBeNull();
    });

    it('should reject title over 255 characters', async () => {
      const input = {
        content_type: 'email' as const,
        title: 'a'.repeat(256),
        content: 'Test content',
      };

      const result = await saveContent(input);

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Title must be 255 characters or less');
    });

    it('should reject content over 50000 characters', async () => {
      const input = {
        content_type: 'email' as const,
        title: 'Test Title',
        content: 'a'.repeat(50001),
      };

      const result = await saveContent(input);

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content must be 50,000 characters or less');
    });
  });

  describe('updateContent', () => {
    it('should update content by id', async () => {
      const updatedData = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        content_type: 'email',
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated'],
        metadata: {},
        usage_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedData, error: null }),
            }),
          }),
        }),
      } as any);

      const result = await updateContent('test-id', { title: 'Updated Title' });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(updatedData);
    });

    it('should reject empty id', async () => {
      const result = await updateContent('', { title: 'Test' });

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content ID is required');
    });

    it('should validate title length on update', async () => {
      const result = await updateContent('test-id', { title: 'a'.repeat(256) });

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Title must be 255 characters or less');
    });
  });

  describe('deleteContent', () => {
    it('should delete content by id', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await deleteContent('test-id');

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ success: true });
    });

    it('should reject empty id', async () => {
      const result = await deleteContent('');

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content ID is required');
    });

    it('should handle database errors on delete', async () => {
      const mockError = { code: 'PGRST123', message: 'Delete failed' };

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: mockError }),
        }),
      } as any);

      const result = await deleteContent('test-id');

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.code).toBe('PGRST123');
    });
  });

  describe('incrementUsageCount', () => {
    it('should increment usage count', async () => {
      const mockCurrent = { usage_count: 5 };
      const mockUpdated = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        content_type: 'email',
        title: 'Test',
        content: 'Test content',
        tags: [],
        metadata: {},
        usage_count: 6,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCurrent, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
              }),
            }),
          }),
        });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await incrementUsageCount('test-id');

      expect(result.error).toBeNull();
      expect(result.data?.usage_count).toBe(6);
    });

    it('should reject empty id', async () => {
      const result = await incrementUsageCount('');

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content ID is required');
    });
  });

  describe('getContentById', () => {
    it('should fetch content by id', async () => {
      const mockData = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        content_type: 'email',
        title: 'Test',
        content: 'Test content',
        tags: [],
        metadata: {},
        usage_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      } as any);

      const result = await getContentById('test-id');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockData);
    });

    it('should reject empty id', async () => {
      const result = await getContentById('');

      expect(result.error).toBeInstanceOf(ContentLibraryError);
      expect(result.error?.message).toBe('Content ID is required');
    });
  });

  describe('getAllTags', () => {
    it('should return unique sorted tags', async () => {
      const mockData = [
        { tags: ['sales', 'follow-up'] },
        { tags: ['sales', 'marketing'] },
        { tags: ['follow-up', 'email'] },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any);

      const result = await getAllTags();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(['email', 'follow-up', 'marketing', 'sales']);
    });

    it('should handle empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      const result = await getAllTags();

      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });

    it('should handle items with no tags', async () => {
      const mockData = [
        { tags: null },
        { tags: [] },
        { tags: ['sales'] },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any);

      const result = await getAllTags();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(['sales']);
    });
  });

  describe('ContentLibraryError', () => {
    it('should create error with message', () => {
      const error = new ContentLibraryError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ContentLibraryError');
    });

    it('should create error with code and cause', () => {
      const cause = new Error('Original error');
      const error = new ContentLibraryError('Test error', 'ERR_CODE', cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('ERR_CODE');
      expect(error.cause).toBe(cause);
    });
  });
});
