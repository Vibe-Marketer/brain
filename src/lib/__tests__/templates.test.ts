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
      neq: vi.fn().mockReturnThis(),
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
import {
  fetchTemplates,
  fetchPersonalTemplates,
  fetchSharedTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  incrementTemplateUsageCount,
  TemplateError,
} from '../templates';

describe('Template CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTemplates', () => {
    it('should fetch all templates without filters', async () => {
      const mockData = [
        {
          id: '1',
          user_id: 'test-user-id',
          team_id: null,
          name: 'Test Template',
          description: 'A test template',
          template_content: 'Hello {{name}}',
          variables: [{ name: 'name', required: true }],
          content_type: 'email',
          is_shared: false,
          usage_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      const mockFrom = vi.fn().mockReturnValue(chainMock);

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await fetchTemplates(undefined, true, 'test-bank-id');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].name).toBe('Test Template');
      expect(mockFrom).toHaveBeenCalledWith('templates');
    });

    it('should filter by content_type', async () => {
      const mockEq = vi.fn().mockReturnThis();
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockEq.mockImplementation(() => chainMock);

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchTemplates({ content_type: 'email' }, true, 'test-bank-id');

      expect(mockEq).toHaveBeenCalledWith('bank_id', 'test-bank-id');
      expect(mockEq).toHaveBeenCalledWith('content_type', 'email');
    });

    it('should filter by is_shared', async () => {
      const mockEq = vi.fn().mockReturnThis();
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockEq.mockImplementation(() => chainMock);

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchTemplates({ is_shared: true }, true, 'test-bank-id');

      expect(mockEq).toHaveBeenCalledWith('is_shared', true);
    });

    it('should apply search filter', async () => {
      const mockOr = vi.fn().mockResolvedValue({ data: [], error: null });
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        or: mockOr,
      };

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchTemplates({ search: 'test' }, true, 'test-bank-id');

      expect(mockOr).toHaveBeenCalledWith('name.ilike.%test%,description.ilike.%test%');
    });

    it('should fetch only personal templates when includeShared is false', async () => {
      // Create a thenable chain mock that tracks all calls
      const mockEq = vi.fn();
      const chainMock: Record<string, any> = {
        select: vi.fn(),
        eq: mockEq,
        order: vi.fn(),
        then: vi.fn((resolve: (val: any) => void) => resolve({ data: [], error: null })),
      };
      // All methods return chainMock so chaining continues
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchTemplates({}, false, 'test-bank-id');

      expect(mockEq).toHaveBeenCalledWith('bank_id', 'test-bank-id');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('should handle database errors', async () => {
      const mockError = { code: 'PGRST123', message: 'Database error' };

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      const result = await fetchTemplates(undefined, true, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST123');
      expect(result.data).toBeNull();
    });

    it('should parse variables from JSONB', async () => {
      const mockData = [
        {
          id: '1',
          user_id: 'test-user-id',
          team_id: null,
          name: 'Test',
          description: null,
          template_content: 'Hello {{name}}',
          variables: [
            { name: 'name', required: true },
            { name: 'company', required: false, defaultValue: 'Acme' },
          ],
          content_type: 'email',
          is_shared: false,
          usage_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      const result = await fetchTemplates(undefined, true, 'test-bank-id');

      expect(result.data?.[0].variables).toHaveLength(2);
      expect(result.data?.[0].variables[0]).toEqual({ name: 'name', required: true });
    });

    it('should handle null or invalid variables', async () => {
      const mockData = [
        {
          id: '1',
          user_id: 'test-user-id',
          team_id: null,
          name: 'Test',
          description: null,
          template_content: 'Hello',
          variables: null,
          content_type: 'email',
          is_shared: false,
          usage_count: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      const result = await fetchTemplates(undefined, true, 'test-bank-id');

      expect(result.data?.[0].variables).toEqual([]);
    });
  });

  describe('fetchPersonalTemplates', () => {
    it('should call fetchTemplates with includeShared=false', async () => {
      const mockEq = vi.fn();
      const chainMock: Record<string, any> = {
        select: vi.fn(),
        eq: mockEq,
        order: vi.fn(),
        then: vi.fn((resolve: (val: any) => void) => resolve({ data: [], error: null })),
      };
      chainMock.select.mockReturnValue(chainMock);
      chainMock.eq.mockReturnValue(chainMock);
      chainMock.order.mockReturnValue(chainMock);

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchPersonalTemplates(undefined, 'test-bank-id');

      expect(mockEq).toHaveBeenCalledWith('bank_id', 'test-bank-id');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });

  describe('fetchSharedTemplates', () => {
    it('should fetch only shared templates from other users', async () => {
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(chainMock as any);

      await fetchSharedTemplates(undefined, 'test-bank-id');

      expect(chainMock.eq).toHaveBeenCalledWith('bank_id', 'test-bank-id');
      expect(chainMock.eq).toHaveBeenCalledWith('is_shared', true);
      expect(chainMock.neq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });

  describe('saveTemplate', () => {
    it('should save template with required fields', async () => {
      const input = {
        name: 'Test Template',
        description: 'A test template',
        template_content: 'Hello {{name}}',
        variables: [{ name: 'name', required: true }],
        content_type: 'email' as const,
        is_shared: false,
      };

      const mockInsertedData = {
        id: 'new-id',
        user_id: 'test-user-id',
        team_id: null,
        ...input,
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

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Test Template');
    });

    it('should reject empty name', async () => {
      const input = {
        name: '',
        template_content: 'Test content',
        content_type: 'email' as const,
      };

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Name is required');
      expect(result.data).toBeNull();
    });

    it('should reject empty template_content', async () => {
      const input = {
        name: 'Test Template',
        template_content: '',
        content_type: 'email' as const,
      };

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template content is required');
      expect(result.data).toBeNull();
    });

    it('should reject name over 255 characters', async () => {
      const input = {
        name: 'a'.repeat(256),
        template_content: 'Test content',
        content_type: 'email' as const,
      };

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Name must be 255 characters or less');
    });

    it('should reject template_content over 50000 characters', async () => {
      const input = {
        name: 'Test Template',
        template_content: 'a'.repeat(50001),
        content_type: 'email' as const,
      };

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template content must be 50,000 characters or less');
    });

    it('should handle database errors on save', async () => {
      const input = {
        name: 'Test Template',
        template_content: 'Test content',
        content_type: 'email' as const,
      };

      const mockError = { code: 'PGRST123', message: 'Insert failed' };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      } as any);

      const result = await saveTemplate(input, 'test-bank-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST123');
    });
  });

  describe('updateTemplate', () => {
    it('should update template by id', async () => {
      const updatedData = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        name: 'Updated Template',
        description: 'Updated description',
        template_content: 'Updated content',
        variables: [],
        content_type: 'email',
        is_shared: true,
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

      const result = await updateTemplate('test-id', { name: 'Updated Template' });

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Updated Template');
    });

    it('should reject empty id', async () => {
      const result = await updateTemplate('', { name: 'Test' });

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template ID is required');
    });

    it('should validate name length on update', async () => {
      const result = await updateTemplate('test-id', { name: 'a'.repeat(256) });

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Name must be 255 characters or less');
    });

    it('should validate template_content length on update', async () => {
      const result = await updateTemplate('test-id', { template_content: 'a'.repeat(50001) });

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template content must be 50,000 characters or less');
    });

    it('should handle database errors on update', async () => {
      const mockError = { code: 'PGRST123', message: 'Update failed' };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            }),
          }),
        }),
      } as any);

      const result = await updateTemplate('test-id', { name: 'Test' });

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST123');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template by id', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await deleteTemplate('test-id');

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ success: true });
    });

    it('should reject empty id', async () => {
      const result = await deleteTemplate('');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template ID is required');
    });

    it('should handle database errors on delete', async () => {
      const mockError = { code: 'PGRST123', message: 'Delete failed' };

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: mockError }),
        }),
      } as any);

      const result = await deleteTemplate('test-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST123');
    });
  });

  describe('getTemplateById', () => {
    it('should fetch template by id', async () => {
      const mockData = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        name: 'Test Template',
        description: 'A test template',
        template_content: 'Hello {{name}}',
        variables: [{ name: 'name', required: true }],
        content_type: 'email',
        is_shared: false,
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

      const result = await getTemplateById('test-id');

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Test Template');
    });

    it('should reject empty id', async () => {
      const result = await getTemplateById('');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template ID is required');
    });

    it('should handle database errors', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      } as any);

      const result = await getTemplateById('test-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST116');
    });
  });

  describe('incrementTemplateUsageCount', () => {
    it('should increment usage count', async () => {
      const mockCurrent = { usage_count: 5 };
      const mockUpdated = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        name: 'Test',
        description: null,
        template_content: 'Test content',
        variables: [],
        content_type: 'email',
        is_shared: false,
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

      const result = await incrementTemplateUsageCount('test-id');

      expect(result.error).toBeNull();
      expect(result.data?.usage_count).toBe(6);
    });

    it('should reject empty id', async () => {
      const result = await incrementTemplateUsageCount('');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.message).toBe('Template ID is required');
    });

    it('should handle fetch error', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      } as any);

      const result = await incrementTemplateUsageCount('test-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST116');
    });

    it('should handle update error', async () => {
      const mockCurrent = { usage_count: 5 };
      const mockError = { code: 'PGRST123', message: 'Update failed' };

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
                single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
              }),
            }),
          }),
        });

      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await incrementTemplateUsageCount('test-id');

      expect(result.error).toBeInstanceOf(TemplateError);
      expect(result.error?.code).toBe('PGRST123');
    });

    it('should handle null usage count', async () => {
      const mockCurrent = { usage_count: null };
      const mockUpdated = {
        id: 'test-id',
        user_id: 'test-user-id',
        team_id: null,
        name: 'Test',
        description: null,
        template_content: 'Test content',
        variables: [],
        content_type: 'email',
        is_shared: false,
        usage_count: 1,
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

      const result = await incrementTemplateUsageCount('test-id');

      expect(result.error).toBeNull();
      expect(result.data?.usage_count).toBe(1);
    });
  });

  describe('TemplateError', () => {
    it('should create error with message', () => {
      const error = new TemplateError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('TemplateError');
    });

    it('should create error with code and cause', () => {
      const cause = new Error('Original error');
      const error = new TemplateError('Test error', 'ERR_CODE', cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('ERR_CODE');
      expect(error.cause).toBe(cause);
    });
  });
});
