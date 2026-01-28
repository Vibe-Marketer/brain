import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Message } from '@ai-sdk/react';

interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  filter_date_start: string | null;
  filter_date_end: string | null;
  filter_speakers: string[];
  filter_categories: string[];
  filter_recording_ids: number[];
  is_archived: boolean;
  is_pinned: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessagePart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  parts: MessagePart[] | null;
  model: string | null;
  finish_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  created_at: string;
}

interface CreateSessionParams {
  title?: string;
  filter_date_start?: Date;
  filter_date_end?: Date;
  filter_speakers?: string[];
  filter_categories?: string[];
  filter_recording_ids?: number[];
}

interface SaveMessagesParams {
  sessionId: string;
  messages: Message[];
  model?: string;
}

interface UpdateSessionTitleParams {
  sessionId: string;
  title: string;
}

interface TogglePinParams {
  sessionId: string;
  isPinned: boolean;
}

interface ToggleArchiveParams {
  sessionId: string;
  isArchived: boolean;
}

export function useChatSession(userId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch all sessions for the user
  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useQuery({
    queryKey: ['chat-sessions', userId],
    queryFn: async (): Promise<ChatSession[]> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false }); // Sort by updated_at so newest/active chats are first

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch messages for a specific session - memoized for stable reference
  const fetchMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Convert database messages to AI SDK Message format
    return (data || []).map((msg: ChatMessage) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content || '',
      parts: msg.parts,
      createdAt: new Date(msg.created_at),
    }));
  }, []);

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (params: CreateSessionParams): Promise<ChatSession> => {
      if (!userId) throw new Error('User ID is required');

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          title: params.title || null,
          filter_date_start: params.filter_date_start?.toISOString() || null,
          filter_date_end: params.filter_date_end?.toISOString() || null,
          filter_speakers: params.filter_speakers || [],
          filter_categories: params.filter_categories || [],
          filter_recording_ids: params.filter_recording_ids || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create chat session');
    },
  });

  // Save messages to session
  const saveMessagesMutation = useMutation({
    mutationFn: async ({ sessionId, messages, model }: SaveMessagesParams) => {
      if (!userId) throw new Error('User ID is required');

      // Guard against undefined or empty messages
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logger.debug('No messages to save (empty or undefined)');
        return;
      }

      // Get existing messages to check for duplicates by content hash
      // (AI SDK uses short random IDs that aren't valid UUIDs)
      const { data: existingMessages } = await supabase
        .from('chat_messages')
        .select('content, role, created_at')
        .eq('session_id', sessionId);

      // Build occurrence counts so we allow legitimate repeated messages
      const existingCounts = new Map<string, number>();
      existingMessages?.forEach((m) => {
        const key = `${m.role}:${m.content ?? ''}`;
        existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
      });

      const seenCounts = new Map<string, number>();
      const newMessages = messages.filter((msg) => {
        const key = `${msg.role}:${typeof msg.content === 'string' ? msg.content : ''}`;
        const nextCount = (seenCounts.get(key) ?? 0) + 1;
        seenCounts.set(key, nextCount);
        const existingCount = existingCounts.get(key) ?? 0;
        return nextCount > existingCount;
      });

      if (newMessages.length === 0) return;

      // Convert AI SDK messages to database format with proper UUIDs
      // Sanitize parts to ensure JSON-serializable (remove functions, circular refs)
      const sanitizeParts = (parts: unknown): unknown => {
        if (!parts) return null;
        try {
          // Round-trip through JSON to strip non-serializable data
          return JSON.parse(JSON.stringify(parts));
        } catch {
          logger.warn('Failed to serialize message parts, skipping');
          return null;
        }
      };

      // Valid roles per database constraint
      const validRoles = ['user', 'assistant', 'system', 'tool'] as const;

      const messagesToInsert = newMessages
        .filter((msg) => {
          // Skip messages with invalid roles
          if (!validRoles.includes(msg.role as typeof validRoles[number])) {
            logger.warn('Skipping message with invalid role:', msg.role);
            return false;
          }
          return true;
        })
        .map((msg) => ({
          id: crypto.randomUUID(), // Generate proper UUID instead of using AI SDK's short ID
          session_id: sessionId,
          user_id: userId,
          role: msg.role as string,
          content: typeof msg.content === 'string' ? msg.content : '', // Ensure content is a string
          parts: sanitizeParts(msg.parts),
          model: msg.role === 'assistant' ? (model || null) : null,
          created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
        }));

      if (messagesToInsert.length === 0) {
        logger.debug('No valid messages to insert');
        return;
      }

      logger.debug('Saving messages:', messagesToInsert.length);

      const { error, data } = await supabase.from('chat_messages').insert(messagesToInsert).select();

      if (error) {
        logger.error('Supabase insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Failed to save messages: ${error.message}`);
      }

      logger.debug('Saved messages successfully:', data?.length);

      // Note: message_count, last_message_at, and updated_at are handled by database trigger
      // We only need to update the title here if this is the first user message
      const firstUserMessage = newMessages.find((m) => m.role === 'user');

      if (firstUserMessage) {
        // Check if session already has a title by querying the database directly
        // (avoid using sessions array which may have stale data)
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('title')
          .eq('id', sessionId)
          .single();

        if (sessionData && !sessionData.title && typeof firstUserMessage.content === 'string') {
          // Clean up content for title generation
          let cleanContent = firstUserMessage.content.trim();

          // Remove [Context: @[call](recording:id) ...] prefix if present
          cleanContent = cleanContent.replace(/^\[Context:\s*@\[.*?\]\(recording:\d+\)(?:\s+@\[.*?\]\(recording:\d+\))*\]\s*\n\n/, '');

          // Remove potential leading special chars or tool artifacts
          cleanContent = cleanContent.replace(/^[^a-zA-Z0-9]+/, '');

          // If content is empty or too short after cleaning, fallback to "New Chat"
          if (cleanContent.length < 2) {
            cleanContent = "New Chat";
          }

          const title = cleanContent.slice(0, 50) + (cleanContent.length > 50 ? '...' : '');
          await supabase
            .from('chat_sessions')
            .update({ title })
            .eq('id', sessionId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save messages');
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
      toast.success('Chat session deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete session');
    },
  });

  // Update session title
  const updateTitleMutation = useMutation({
    mutationFn: async ({ sessionId, title }: UpdateSessionTitleParams) => {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update title');
    },
  });

  // Toggle pin status
  const togglePinMutation = useMutation({
    mutationFn: async ({ sessionId, isPinned }: TogglePinParams) => {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ is_pinned: isPinned })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update pin status');
    },
  });

  // Toggle archive status
  const toggleArchiveMutation = useMutation({
    mutationFn: async ({ sessionId, isArchived }: ToggleArchiveParams) => {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ is_archived: isArchived })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update archive status');
    },
  });

  return {
    sessions,
    isLoadingSessions,
    sessionsError,
    fetchMessages,
    createSession: createSessionMutation.mutateAsync,
    saveMessages: saveMessagesMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    updateTitle: updateTitleMutation.mutateAsync,
    togglePin: togglePinMutation.mutateAsync,
    toggleArchive: toggleArchiveMutation.mutateAsync,
  };
}
