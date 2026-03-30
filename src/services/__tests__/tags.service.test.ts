import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };
  return { supabase: mockSupabase };
});

// Import after mocking
import { supabase } from '@/integrations/supabase/client';
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getTagCounts,
  getTagRules,
} from '../tags.service';

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

describe('tags.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTags', () => {
    it('should return tags for an organization', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Important', color: '#FF0000', description: null, is_system: false },
        { id: 'tag-2', name: 'Follow Up', color: '#00FF00', description: 'Needs follow up', is_system: false },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
          }),
        }),
      });

      const result = await getTags('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Important');
      expect(result[1].name).toBe('Follow Up');
      expect(mockSupabase.from).toHaveBeenCalledWith('call_tags');
    });

    it('should throw error on failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Network error' },
            }),
          }),
        }),
      });

      await expect(getTags('org-1')).rejects.toThrow('Failed to fetch tags: Network error');
    });
  });

  describe('createTag', () => {
    it('should create and return a tag', async () => {
      const newTag = {
        id: 'tag-new',
        name: 'Urgent',
        color: '#FF0000',
        description: null,
        is_system: false,
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newTag, error: null }),
          }),
        }),
      });

      const result = await createTag('org-1', { name: 'Urgent', color: '#FF0000' });

      expect(result.id).toBe('tag-new');
      expect(result.name).toBe('Urgent');
      expect(result.color).toBe('#FF0000');
    });

    it('should throw error on creation failure', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Duplicate tag name' },
            }),
          }),
        }),
      });

      await expect(
        createTag('org-1', { name: 'Existing' })
      ).rejects.toThrow('Failed to create tag: Duplicate tag name');
    });

    it('should pass organization_id in the insert payload', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'tag-x', name: 'Test', color: null, description: null, is_system: false },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: insertMock });

      await createTag('org-123', { name: 'Test' });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          is_system: false,
          organization_id: 'org-123',
        })
      );
    });
  });

  describe('updateTag', () => {
    it('should update a tag', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: eqMock }),
      });

      await expect(updateTag('tag-1', { name: 'Renamed' })).resolves.toBeUndefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('call_tags');
    });

    it('should throw error on update failure', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Permission denied' },
          }),
        }),
      });

      await expect(
        updateTag('tag-1', { name: 'Forbidden' })
      ).rejects.toThrow('Failed to update tag: Permission denied');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await expect(deleteTag('tag-1')).resolves.toBeUndefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('call_tags');
    });

    it('should throw error on deletion failure', async () => {
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Foreign key constraint' },
          }),
        }),
      });

      await expect(deleteTag('tag-1')).rejects.toThrow(
        'Failed to delete tag: Foreign key constraint'
      );
    });
  });

  describe('getTagCounts', () => {
    it('should return correct counts per tag', async () => {
      const assignments = [
        { tag_id: 'tag-1' },
        { tag_id: 'tag-1' },
        { tag_id: 'tag-1' },
        { tag_id: 'tag-2' },
        { tag_id: 'tag-2' },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: assignments, error: null }),
      });

      const counts = await getTagCounts('org-1');

      expect(counts['tag-1']).toBe(3);
      expect(counts['tag-2']).toBe(2);
    });

    it('should return empty object when no assignments', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const counts = await getTagCounts('org-1');
      expect(counts).toEqual({});
    });

    it('should throw error on failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' },
        }),
      });

      await expect(getTagCounts('org-1')).rejects.toThrow(
        'Failed to fetch tag counts: Connection failed'
      );
    });
  });

  describe('getTagRules', () => {
    it('should return rules for an organization', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Sales calls',
          description: 'Auto-tag sales calls',
          rule_type: 'title_contains',
          conditions: { contains: 'sales' },
          tag_id: 'tag-1',
          folder_id: null,
          priority: 1,
          is_active: true,
          times_applied: 5,
          last_applied_at: '2024-01-15T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'rule-2',
          name: 'Support calls',
          description: null,
          rule_type: 'title_contains',
          conditions: { contains: 'support' },
          tag_id: 'tag-2',
          folder_id: 'f-1',
          priority: 2,
          is_active: true,
          times_applied: null,
          last_applied_at: null,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
        }),
      });

      const rules = await getTagRules('org-1');

      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('Sales calls');
      expect(rules[0].conditions).toEqual({ contains: 'sales' });
      expect(rules[1].folder_id).toBe('f-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('tag_rules');
    });

    it('should throw error on failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Table not found' },
          }),
        }),
      });

      await expect(getTagRules('org-1')).rejects.toThrow(
        'Failed to fetch tag rules: Table not found'
      );
    });
  });
});
