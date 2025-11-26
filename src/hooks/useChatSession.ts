import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
        .order('last_message_at', { ascending: false, nullsFirst: false });

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

      // Get existing message IDs to avoid duplicates
      const { data: existingMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', sessionId);

      const existingIds = new Set(existingMessages?.map((m) => m.id) || []);

      // Filter out messages that already exist
      const newMessages = messages.filter((msg) => !existingIds.has(msg.id));

      if (newMessages.length === 0) return;

      // Convert AI SDK messages to database format
      const messagesToInsert = newMessages.map((msg) => ({
        id: msg.id,
        session_id: sessionId,
        user_id: userId,
        role: msg.role,
        content: msg.content,
        parts: msg.parts || null,
        model: msg.role === 'assistant' ? model : null,
        created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
      }));

      const { error } = await supabase.from('chat_messages').insert(messagesToInsert);

      if (error) throw error;

      // If this is the first message, auto-generate title from user's message
      const firstUserMessage = newMessages.find((m) => m.role === 'user');
      if (firstUserMessage) {
        const session = sessions.find((s) => s.id === sessionId);
        if (session && !session.title) {
          const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
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
