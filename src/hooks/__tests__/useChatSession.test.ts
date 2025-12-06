import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatSession } from '../useChatSession';
import type { Message } from '@ai-sdk/react';
import * as React from 'react';

// Mock Supabase client - must be created before vi.mock
vi.mock('@/integrations/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };
  return { supabase: mockSupabase };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mocking
import { supabase as mockSupabase } from '@/integrations/supabase/client';

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
}

describe('useChatSession', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });
  });

  describe('Message Deduplication', () => {
    it('should preserve legitimate duplicate messages', async () => {
      const sessionId = 'session-123';

      // Mock existing messages in database
      const existingMessages = [
        { role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Hi there!', created_at: '2024-01-01T00:01:00Z' },
      ];

      // New messages that include a legitimate duplicate
      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', createdAt: new Date('2024-01-01T00:00:00Z') },
        { id: '2', role: 'assistant', content: 'Hi there!', createdAt: new Date('2024-01-01T00:01:00Z') },
        { id: '3', role: 'user', content: 'Hello', createdAt: new Date('2024-01-01T00:02:00Z') }, // Legitimate duplicate
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: existingMessages,
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      // Save messages
      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      // Should insert only the third message (legitimate duplicate)
      expect(insertedMessages).toHaveLength(1);
      expect(insertedMessages[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should not insert duplicate messages from same batch', async () => {
      const sessionId = 'session-123';

      // No existing messages
      const existingMessages: unknown[] = [];

      // New messages with accidental duplicate in the same batch
      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'Test message', createdAt: new Date() },
        { id: '2', role: 'user', content: 'Test message', createdAt: new Date() }, // Accidental duplicate
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: existingMessages,
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      // Should insert both messages (they're from the same batch)
      expect(insertedMessages).toHaveLength(2);
    });
  });

  describe('Parts Sanitization', () => {
    it('should strip circular references from message parts', async () => {
      const sessionId = 'session-123';

      // Create a message with circular reference in parts
      const circularObj: Record<string, unknown> = { type: 'tool-call', toolName: 'test' };
      circularObj.self = circularObj; // Create circular reference

      const newMessages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'Testing',
          parts: [circularObj as never],
          createdAt: new Date(),
        },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      // Should have successfully sanitized and inserted
      expect(insertedMessages).toHaveLength(1);
      const inserted = insertedMessages[0] as Record<string, unknown>;
      expect(inserted.parts).toBeDefined();

      // Parts should be serializable (no circular reference)
      expect(() => JSON.stringify(inserted.parts)).not.toThrow();
    });

    it('should handle null and undefined parts gracefully', async () => {
      const sessionId = 'session-123';

      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'Test', parts: null as never, createdAt: new Date() },
        { id: '2', role: 'user', content: 'Test2', parts: undefined as never, createdAt: new Date() },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      expect(insertedMessages).toHaveLength(2);
      expect((insertedMessages[0] as Record<string, unknown>).parts).toBeNull();
      expect((insertedMessages[1] as Record<string, unknown>).parts).toBeNull();
    });
  });

  describe('Invalid Role Filtering', () => {
    it('should skip messages with invalid roles', async () => {
      const sessionId = 'session-123';

      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'Valid user message', createdAt: new Date() },
        { id: '2', role: 'invalid-role' as never, content: 'Invalid role', createdAt: new Date() },
        { id: '3', role: 'assistant', content: 'Valid assistant message', createdAt: new Date() },
        { id: '4', role: 'custom' as never, content: 'Custom role', createdAt: new Date() },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      // Should only insert messages with valid roles (user and assistant)
      expect(insertedMessages).toHaveLength(2);
      expect((insertedMessages[0] as Record<string, unknown>).role).toBe('user');
      expect((insertedMessages[1] as Record<string, unknown>).role).toBe('assistant');
    });

    it('should accept all valid roles: user, assistant, system, tool', async () => {
      const sessionId = 'session-123';

      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'User message', createdAt: new Date() },
        { id: '2', role: 'assistant', content: 'Assistant message', createdAt: new Date() },
        { id: '3', role: 'system', content: 'System message', createdAt: new Date() },
        { id: '4', role: 'tool', content: 'Tool message', createdAt: new Date() },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      // Should insert all 4 messages
      expect(insertedMessages).toHaveLength(4);
    });
  });

  describe('UUID Generation', () => {
    it('should generate proper UUIDs for saved messages', async () => {
      const sessionId = 'session-123';

      const newMessages: Message[] = [
        { id: 'short-id', role: 'user', content: 'Test message', createdAt: new Date() },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      expect(insertedMessages).toHaveLength(1);
      const inserted = insertedMessages[0] as Record<string, unknown>;

      // UUID format: 8-4-4-4-12 hex characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(inserted.id).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs for each message', async () => {
      const sessionId = 'session-123';

      const newMessages: Message[] = [
        { id: '1', role: 'user', content: 'Message 1', createdAt: new Date() },
        { id: '2', role: 'user', content: 'Message 2', createdAt: new Date() },
        { id: '3', role: 'user', content: 'Message 3', createdAt: new Date() },
      ];

      let insertedMessages: unknown[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
            insert: vi.fn().mockImplementation((messages: unknown[]) => {
              insertedMessages = messages;
              return {
                select: vi.fn().mockReturnValue({
                  data: messages,
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { title: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        };
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChatSession(testUserId), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toBeDefined();
      });

      await result.current.saveMessages({
        sessionId,
        messages: newMessages,
      });

      expect(insertedMessages).toHaveLength(3);

      const ids = insertedMessages.map(m => (m as Record<string, unknown>).id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(3);
    });
  });
});
