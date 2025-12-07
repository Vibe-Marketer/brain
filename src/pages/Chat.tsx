import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { RiSendPlaneFill, RiFilterLine, RiCalendarLine, RiUser3Line, RiFolder3Line, RiCloseLine, RiAddLine, RiMenuLine, RiAtLine, RiVideoLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { CallDetailDialog } from '@/components/CallDetailDialog';
import { Meeting } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/chat/chat-container';
import {
  ChatOuterCard,
  ChatInnerCard,
  ChatInnerCardContent,
  ChatInnerCardInputArea,
  ChatInnerCardHeader,
} from '@/components/chat/chat-main-card';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputContextBar,
  PromptInputFooter,
  PromptInputFooterLeft,
  PromptInputFooterRight,
  PromptInputHintBar,
  KeyboardHint,
  type ContextAttachment,
} from '@/components/chat/prompt-input';
import { ModelSelector } from '@/components/chat/model-selector';
import { UserMessage, AssistantMessage } from '@/components/chat/message';
import { ScrollButton } from '@/components/chat/scroll-button';
import { ThinkingLoader } from '@/components/chat/loader';
import { Sources } from '@/components/chat/source';
import { ToolCalls } from '@/components/chat/tool-call';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useChatSession } from '@/hooks/useChatSession';
import { useMentions } from '@/hooks/useMentions';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ChatFilters {
  dateStart?: Date;
  dateEnd?: Date;
  speakers: string[];
  categories: string[];
  recordingIds: number[];
}

interface ChatLocationState {
  prefilter?: {
    recordingIds?: number[];
  };
  callTitle?: string;
}

interface Speaker {
  speaker_name: string;
  speaker_email: string;
  call_count: number;
}

interface Category {
  category: string;
  call_count: number;
}

interface Call {
  recording_id: number;
  title: string;
  created_at: string;
}

interface ToolCallPart {
  type: string;
  toolName: string;
  toolCallId: string;
  state?: 'pending' | 'running' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: Record<string, unknown> & {
    results?: Array<{
      recording_id: number;
      text: string;
      speaker: string;
      call_date: string;
      call_title: string;
      relevance: string;
    }>;
  };
  error?: string;
}

// Helper to extract text content from message parts
function getMessageTextContent(message: UIMessage): string {
  if (!message?.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

// Helper to extract tool invocations from message parts
// AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
function getToolInvocations(message: UIMessage): ToolCallPart[] {
  if (!message?.parts || !Array.isArray(message.parts)) return [];

  const toolParts: ToolCallPart[] = [];

  for (const part of message.parts) {
    if (!part || typeof part.type !== 'string') continue;
    // AI SDK v5 tool parts have type like 'tool-searchTranscripts', 'tool-getCallDetails', etc.
    // Also handle 'dynamic-tool' for dynamic tools
    if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
      const toolPart = part as {
        type: string;
        toolCallId: string;
        toolName?: string; // Present for dynamic-tool type
        state: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };

      // Extract tool name from type (e.g., 'tool-searchTranscripts' -> 'searchTranscripts')
      // For dynamic-tool, use the toolName property
      const toolName = part.type === 'dynamic-tool'
        ? toolPart.toolName || 'unknown'
        : toolPart.type.replace('tool-', '');

      // Map AI SDK v5 states to our UI states
      // AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
      let state: 'pending' | 'running' | 'success' | 'error' = 'pending';
      if (toolPart.state === 'input-streaming') {
        state = 'running';
      } else if (toolPart.state === 'input-available') {
        state = 'running'; // Still running, waiting for output
      } else if (toolPart.state === 'output-available') {
        state = 'success';
      } else if (toolPart.state === 'output-error') {
        state = 'error';
      }

      toolParts.push({
        type: toolPart.state === 'output-available' ? 'tool-result' : 'tool-call',
        toolName,
        toolCallId: toolPart.toolCallId,
        state,
        args: toolPart.input as Record<string, unknown>,
        result: toolPart.state === 'output-available'
          ? toolPart.output as Record<string, unknown>
          : undefined,
        error: toolPart.errorText,
      });
    }
  }

  return toolParts;
}

export default function Chat() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [filters, setFilters] = React.useState<ChatFilters>({
    speakers: [],
    categories: [],
    recordingIds: [],
  });
  const [availableSpeakers, setAvailableSpeakers] = React.useState<Speaker[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<Category[]>([]);
  const [availableCalls, setAvailableCalls] = React.useState<Call[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(sessionId || null);

  // Input state - managed locally (AI SDK v5 doesn't manage input)
  const [input, setInput] = React.useState('');

  // Selected model state - format: 'provider/model-name' (e.g., 'openai/gpt-4o-mini')
  // Default to GPT-4o-mini - reliable, fast, economical with excellent tool calling
  const [selectedModel, setSelectedModel] = React.useState<string>('openai/gpt-4o-mini');

  // CallDetailDialog state for viewing sources
  const [selectedCall, setSelectedCall] = React.useState<Meeting | null>(null);
  const [showCallDialog, setShowCallDialog] = React.useState(false);

  // Context attachments state (calls attached via "+ Add context")
  const [contextAttachments, setContextAttachments] = React.useState<ContextAttachment[]>([]);

  // Ref to track current session ID for async callbacks (avoids stale closure)
  const currentSessionIdRef = React.useRef<string | null>(currentSessionId);
  React.useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Textarea ref for mentions
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Chat session management
  const {
    sessions,
    fetchMessages,
    createSession,
    saveMessages,
    deleteSession,
    togglePin,
    toggleArchive,
  } = useChatSession(session?.user?.id);

  // Build filter object for API - memoized to avoid unnecessary transport recreation
  const apiFilters = React.useMemo(() => ({
    date_start: filters.dateStart?.toISOString(),
    date_end: filters.dateEnd?.toISOString(),
    speakers: filters.speakers.length > 0 ? filters.speakers : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    recording_ids: filters.recordingIds.length > 0 ? filters.recordingIds : undefined,
  }), [filters]);

  // Use refs for values that change frequently but shouldn't recreate transport
  // This prevents infinite re-render loops when sessionId/model/filters change
  const apiFiltersRef = React.useRef(apiFilters);
  const selectedModelRef = React.useRef(selectedModel);
  React.useEffect(() => { apiFiltersRef.current = apiFilters; }, [apiFilters]);
  React.useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);

  // Create transport instance - ONLY recreate when auth token changes
  // Other values (filters, model, sessionId) are read from refs at request time
  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
      // Use a function to get current values at request time from refs
      // This prevents transport recreation when these values change
      body: {
        get filters() { return apiFiltersRef.current; },
        get model() { return selectedModelRef.current; },
        get sessionId() { return currentSessionIdRef.current; },
      },
    });
   
  }, [session?.access_token]); // ONLY depend on auth token - refs handle the rest

  // Use the AI SDK v5 chat hook
  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
  } = useChat({
    transport,
  });

  // Ref to track messages for async callbacks
  const messagesRef = React.useRef<typeof messages>([]);
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Debounced message save function - prevents rapid duplicate inserts
  // 500ms delay chosen to batch rapid message updates (typing indicators, streaming)
  // while still feeling responsive to user
  const debouncedSaveMessages = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    return (msgs: typeof messages, sessionId: string, model: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          // Convert UIMessage to the format expected by saveMessages (keep parts for tool calls)
          const messagesToSave = msgs.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: getMessageTextContent(m),
            parts: m.parts,
          }));

          await saveMessages({
            sessionId,
            messages: messagesToSave,
            model,
          });
        } catch (err) {
          console.error('Failed to save messages:', err);
        }
      }, 500);
    };
  }, [saveMessages]);

  // Cleanup debounce timeout on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Cancel any pending saves when component unmounts
      const cleanup = debouncedSaveMessages as unknown as { cancel?: () => void };
      if (cleanup.cancel) cleanup.cancel();
    };
  }, [debouncedSaveMessages]);

  // Save messages when they change and status becomes ready (debounced)
  React.useEffect(() => {
    const sessionIdToSave = currentSessionIdRef.current;
    if (status === 'ready' && sessionIdToSave && session?.user?.id && messages.length > 0) {
      debouncedSaveMessages(messages, sessionIdToSave, selectedModel);
    }
  }, [status, messages, session?.user?.id, debouncedSaveMessages, selectedModel]);

  // Fetch available filters on mount
  React.useEffect(() => {
    async function fetchFilterOptions() {
      if (!session?.access_token) return;

      // Fetch speakers
      const { data: speakers } = await supabase.rpc('get_user_speakers', {
        p_user_id: session.user.id,
      });
      if (speakers) setAvailableSpeakers(speakers);

      // Fetch categories
      const { data: categories } = await supabase.rpc('get_user_categories', {
        p_user_id: session.user.id,
      });
      if (categories) setAvailableCategories(categories);

      // Fetch recent calls
      const { data: calls } = await supabase
        .from('fathom_calls')
        .select('recording_id, title, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (calls) setAvailableCalls(calls);
    }

    fetchFilterOptions();
  }, [session]);

  // Handle incoming location state for pre-filtering
  React.useEffect(() => {
    const state = location.state as ChatLocationState | undefined;
    if (state?.prefilter?.recordingIds?.length) {
      setFilters(prev => ({
        ...prev,
        recordingIds: state.prefilter!.recordingIds!,
      }));
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atomically load session data (filters + messages) to prevent race conditions
  // CRITICAL: Filters must be loaded BEFORE messages to ensure transport has correct config
  // This prevents a 10-20ms race where messages load with stale/default filters
  React.useEffect(() => {
    async function loadSession() {
      // Clear state atomically when no session selected
      if (!sessionId) {
        setCurrentSessionId(null);
        currentSessionIdRef.current = null;
        setMessages([]);
        setFilters({
          speakers: [],
          categories: [],
          recordingIds: [],
        });
        return;
      }

      try {
        // STEP 1: Load filters FIRST (before messages)
        // This ensures the transport is configured with correct filters when messages arrive
        const sessionMeta = sessions.find((s) => s.id === sessionId);
        if (sessionMeta) {
          const nextFilters: ChatFilters = {
            dateStart: sessionMeta.filter_date_start ? new Date(sessionMeta.filter_date_start) : undefined,
            dateEnd: sessionMeta.filter_date_end ? new Date(sessionMeta.filter_date_end) : undefined,
            speakers: sessionMeta.filter_speakers || [],
            categories: sessionMeta.filter_categories || [],
            recordingIds: sessionMeta.filter_recording_ids || [],
          };

          setFilters((prev) => {
            const prevJson = JSON.stringify(prev);
            const nextJson = JSON.stringify(nextFilters);
            return prevJson === nextJson ? prev : nextFilters;
          });
        }

        // STEP 2: Load messages (transport now uses correct filters from step 1)
        const loadedMessages = await fetchMessages(sessionId);
        console.log(`Loaded ${loadedMessages.length} messages for session ${sessionId}`);

        // Convert loaded messages to UIMessage format
        const uiMessages: UIMessage[] = loadedMessages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          parts: m.parts && Array.isArray(m.parts) && m.parts.length > 0
            ? m.parts as unknown as UIMessage['parts']
            : [{ type: 'text' as const, text: m.content || '' }],
        }));

        // STEP 3: Update UI state atomically
        setMessages(uiMessages);
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
      } catch (err) {
        console.error('Failed to load session:', err);
      }
    }

    loadSession();
  }, [sessionId, sessions, fetchMessages, setMessages]);

  // Create a new session with current filters
  const createNewSession = React.useCallback(async () => {
    const newSession = await createSession({
      filter_date_start: filters.dateStart,
      filter_date_end: filters.dateEnd,
      filter_speakers: filters.speakers,
      filter_categories: filters.categories,
      filter_recording_ids: filters.recordingIds,
    });
    return newSession;
  }, [createSession, filters]);

  // Handle new chat creation
  const handleNewChat = React.useCallback(async () => {
    try {
      const newSession = await createNewSession();
      navigate(`/chat/${newSession.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, [createNewSession, navigate]);

  // Handle session selection
  const handleSessionSelect = React.useCallback((selectedSessionId: string) => {
    navigate(`/chat/${selectedSessionId}`);
    setShowSidebar(false);
  }, [navigate]);

  // Handle session deletion
  const handleDeleteSession = React.useCallback(async (sessionIdToDelete: string) => {
    try {
      await deleteSession(sessionIdToDelete);
      if (sessionIdToDelete === currentSessionId) {
        navigate('/chat');
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [deleteSession, currentSessionId, navigate]);

  // Handle toggle pin
  const handleTogglePin = React.useCallback(async (sessionId: string, isPinned: boolean) => {
    try {
      await togglePin({ sessionId, isPinned });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }, [togglePin]);

  // Handle toggle archive
  const handleToggleArchive = React.useCallback(async (sessionId: string, isArchived: boolean) => {
    try {
      await toggleArchive({ sessionId, isArchived });
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  }, [toggleArchive]);

  // Handle chat submission
  const handleChatSubmit = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    let inputToSubmit = input;

    // If there are context attachments, add them as @mentions
    if (contextAttachments.length > 0) {
      const attachmentMentions = contextAttachments
        .map(a => `@[${a.title}](recording:${a.id})`)
        .join(' ');
      inputToSubmit = `[Context: ${attachmentMentions}]\n\n${input}`;
      setContextAttachments([]);
    }

    if (!inputToSubmit || !inputToSubmit.trim()) return;

    // Create session if it doesn't exist
    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse && session?.user?.id) {
      try {
        const newSession = await createNewSession();
        sessionIdToUse = newSession.id;
        currentSessionIdRef.current = newSession.id;
        setCurrentSessionId(newSession.id);
        navigate(`/chat/${newSession.id}`, { replace: true });
      } catch (err) {
        console.error('Failed to create session:', err);
        return;
      }
    }

    // Send message using AI SDK v5
    sendMessage({ text: inputToSubmit });
    setInput(''); // Clear input after sending
  }, [input, currentSessionId, session?.user?.id, createNewSession, navigate, sendMessage, contextAttachments]);

  // Handle suggestion clicks
  const handleSuggestionClick = React.useCallback(async (text: string) => {
    // Create session if needed first
    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse && session?.user?.id) {
      try {
        const newSession = await createNewSession();
        sessionIdToUse = newSession.id;
        currentSessionIdRef.current = newSession.id;
        setCurrentSessionId(newSession.id);
        navigate(`/chat/${newSession.id}`, { replace: true });
      } catch (err) {
        console.error('Failed to create session:', err);
        return;
      }
    }

    // Send the suggestion directly
    sendMessage({ text });
  }, [currentSessionId, session?.user?.id, createNewSession, navigate, sendMessage]);

  // Handler to view a call from a source citation
  const handleViewCall = React.useCallback(async (recordingId: number) => {
    if (!session?.user?.id) {
      console.error('No user session');
      return;
    }

    try {
      // Use composite key (recording_id, user_id) for the lookup
      const { data: callData, error } = await supabase
        .from('fathom_calls')
        .select('*')
        .eq('recording_id', recordingId)
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Failed to fetch call:', error);
        return;
      }

      setSelectedCall(callData as unknown as Meeting);
      setShowCallDialog(true);
    } catch (err) {
      console.error('Error fetching call:', err);
    }
  }, [session?.user?.id]);

  const hasActiveFilters = filters.dateStart || filters.dateEnd || filters.speakers.length > 0 || filters.categories.length > 0 || filters.recordingIds.length > 0;

  const clearFilters = React.useCallback(() => {
    setFilters({
      speakers: [],
      categories: [],
      recordingIds: [],
    });
  }, []);

  const toggleSpeaker = React.useCallback((speaker: string) => {
    setFilters(prev => ({
      ...prev,
      speakers: prev.speakers.includes(speaker)
        ? prev.speakers.filter(s => s !== speaker)
        : [...prev.speakers, speaker],
    }));
  }, []);

  const toggleCategory = React.useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const toggleCall = React.useCallback((recordingId: number) => {
    setFilters(prev => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds.filter(id => id !== recordingId)
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  // Handle call selection from mentions
  const handleMentionCallSelect = React.useCallback((recordingId: number) => {
    setFilters(prev => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  // Handle removing a context attachment (stable callback for PromptInputContextBar)
  const handleRemoveAttachment = React.useCallback((id: number) => {
    setContextAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Handle adding a call as context attachment (stable callback for PromptInputContextBar)
  const handleAddCall = React.useCallback((call: { recording_id: number; title: string; created_at: string }) => {
    setContextAttachments(prev => [
      ...prev,
      {
        type: 'call' as const,
        id: call.recording_id,
        title: call.title,
        date: call.created_at,
      },
    ]);
  }, []);

  // Use mentions hook for @ mention functionality
  const {
    showMentions,
    filteredCalls,
    handleInputChangeWithMentions,
    handleMentionSelect,
  } = useMentions({
    availableCalls,
    input,
    onInputChange: setInput,
    onCallSelect: handleMentionCallSelect,
    textareaRef,
  });

  // Compute loading state from status
  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <>
      {/* Mobile sidebar overlay backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* BG-CARD-MAIN: Browser window container */}
      <ChatOuterCard>
          {/* SIDEBAR */}
          <div
            className={`
              ${showSidebar ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden'}
              md:block md:relative md:shadow-none
              w-[280px] flex-shrink-0 transition-all duration-200
            `}
          >
            <ChatSidebar
              sessions={sessions}
              activeSessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
            />
          </div>

          {/* BG-CARD-INNER: Chat interface */}
          <ChatInnerCard>
            {/* Header */}
            <ChatInnerCardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                {/* Mobile menu toggle */}
                <Button
                  variant="hollow"
                  size="sm"
                  className="md:hidden h-8 w-8 p-0"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  <RiMenuLine className="h-5 w-5" />
                </Button>
                {hasActiveFilters && (
                  <div className="hidden md:flex items-center gap-2">
                    {filters.dateStart && (
                      <Badge variant="secondary" className="gap-1">
                        <RiCalendarLine className="h-3 w-3" />
                        {format(filters.dateStart, 'MMM d')}
                        {filters.dateEnd && ` - ${format(filters.dateEnd, 'MMM d')}`}
                      </Badge>
                    )}
                    {filters.speakers.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiUser3Line className="h-3 w-3" />
                        {filters.speakers.length} speaker{filters.speakers.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {filters.categories.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiFolder3Line className="h-3 w-3" />
                        {filters.categories.length} categor{filters.categories.length > 1 ? 'ies' : 'y'}
                      </Badge>
                    )}
                    {filters.recordingIds.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiVideoLine className="h-3 w-3" />
                        {filters.recordingIds.length} call{filters.recordingIds.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={clearFilters}
                      className="h-6 px-2 text-xs"
                    >
                      <RiCloseLine className="h-3 w-3" />
                      Clear
                    </Button>
                  </div>
                )}
                {/* Mobile filter indicator */}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="md:hidden">
                    Filtered
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={handleNewChat}
                  className="gap-1 h-8 px-2 md:px-3"
                >
                  <RiAddLine className="h-4 w-4" />
                  <span className="hidden md:inline">New Chat</span>
                </Button>

                <Popover open={showFilters} onOpenChange={setShowFilters}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={hasActiveFilters ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1 h-8 px-2 md:px-3"
                    >
                      <RiFilterLine className="h-4 w-4" />
                      <span className="hidden md:inline">Filters</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4">
                      <h3 className="font-display text-sm font-bold uppercase text-cb-ink mb-3">
                        Filter Transcripts
                      </h3>

                      {/* Date Range */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-cb-ink-muted uppercase mb-2 block">
                          Date Range
                        </label>
                        <DateRangePicker
                          dateRange={{ from: filters.dateStart, to: filters.dateEnd }}
                          onDateRangeChange={(range) => {
                            setFilters(prev => ({
                              ...prev,
                              dateStart: range?.from,
                              dateEnd: range?.to,
                            }));
                          }}
                          placeholder="Select date range"
                          showQuickSelect={true}
                          numberOfMonths={2}
                          disableFuture={false}
                          triggerClassName="w-full"
                        />
                      </div>

                      <Separator className="my-4" />

                      {/* Speakers */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-cb-ink-muted uppercase mb-2 block">
                          Speakers ({availableSpeakers.length})
                        </label>
                        <ScrollArea className="h-32">
                          <div className="space-y-1">
                            {availableSpeakers.map((speaker) => (
                              <button
                                key={speaker.speaker_email || speaker.speaker_name}
                                onClick={() => toggleSpeaker(speaker.speaker_name)}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                                  filters.speakers.includes(speaker.speaker_name)
                                    ? 'bg-vibe-orange/10 text-cb-ink'
                                    : 'hover:bg-cb-hover text-cb-ink-soft'
                                }`}
                              >
                                <span className="truncate">{speaker.speaker_name}</span>
                                <span className="text-xs text-cb-ink-muted">{speaker.call_count} calls</span>
                              </button>
                            ))}
                            {availableSpeakers.length === 0 && (
                              <p className="text-sm text-cb-ink-muted py-2">No speakers indexed yet</p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      <Separator className="my-4" />

                      {/* Categories */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-cb-ink-muted uppercase mb-2 block">
                          Categories ({availableCategories.length})
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {availableCategories.map((cat) => (
                            <Badge
                              key={cat.category}
                              variant={filters.categories.includes(cat.category) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => toggleCategory(cat.category)}
                            >
                              {cat.category} ({cat.call_count})
                            </Badge>
                          ))}
                          {availableCategories.length === 0 && (
                            <p className="text-sm text-cb-ink-muted py-2">No categories indexed yet</p>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Specific Calls */}
                      <div>
                        <label className="text-xs font-medium text-cb-ink-muted uppercase mb-2 block">
                          Specific Calls ({availableCalls.length})
                        </label>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2 pr-4">
                            {availableCalls.map((call) => (
                              <div
                                key={call.recording_id}
                                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-cb-hover transition-colors"
                              >
                                <Checkbox
                                  id={`call-${call.recording_id}`}
                                  checked={filters.recordingIds.includes(call.recording_id)}
                                  onCheckedChange={() => toggleCall(call.recording_id)}
                                  className="mt-0.5"
                                />
                                <label
                                  htmlFor={`call-${call.recording_id}`}
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  <div className="text-cb-ink font-medium truncate">
                                    {call.title || 'Untitled Call'}
                                  </div>
                                  <div className="text-xs text-cb-ink-muted">
                                    {format(new Date(call.created_at), 'MMM d, yyyy')}
                                  </div>
                                </label>
                              </div>
                            ))}
                            {availableCalls.length === 0 && (
                              <p className="text-sm text-cb-ink-muted py-2">No calls found</p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            </ChatInnerCardHeader>

            {/* Chat content area */}
            <ChatInnerCardContent>
            <ChatContainerRoot className="h-full">
              <ChatContainerContent className="px-4 py-0">
                {/* Welcome/Empty State */}
                {messages.length === 0 && (
                  <ChatWelcome
                    userName={session?.user?.user_metadata?.full_name?.split(' ')[0]}
                    subtitle="Search across all your calls, find specific discussions, and uncover insights."
                    onSuggestionClick={handleSuggestionClick}
                  />
                )}

                {/* Messages */}
                {messages.map((message) => {
                  if (message.role === 'user') {
                    const textContent = getMessageTextContent(message);
                    return (
                      <UserMessage key={message.id}>
                        {textContent}
                      </UserMessage>
                    );
                  }

                  if (message.role === 'assistant') {
                    const toolParts = getToolInvocations(message);
                    const textContent = getMessageTextContent(message);

                    // Extract sources from tool results
                    const sources: Array<{
                      recording_id: number;
                      text: string;
                      speaker: string;
                      call_date: string;
                      call_title: string;
                      relevance: string;
                    }> = [];

                    toolParts.forEach((p) => {
                      if (p.type === 'tool-result' && p.result) {
                        if (p.result.results && Array.isArray(p.result.results)) {
                          sources.push(...p.result.results);
                        } else if (p.result.recording_id && p.result.title && !p.result.error) {
                          sources.push({
                            recording_id: p.result.recording_id as number,
                            text: (p.result.summary as string) || '',
                            speaker: (p.result.recorded_by as string) || '',
                            call_date: (p.result.date as string) || '',
                            call_title: (p.result.title as string) || '',
                            relevance: '100',
                          });
                        }
                      }
                    });

                    const uniqueSources = sources
                      .filter((s, i, arr) => arr.findIndex(x => x.recording_id === s.recording_id) === i)
                      .slice(0, 5);

                    const hasContent = textContent.trim().length > 0;
                    const isThinking = !hasContent && toolParts.length > 0;

                    return (
                      <div key={message.id} className="space-y-2">
                        {toolParts.length > 0 && <ToolCalls parts={toolParts} />}
                        {hasContent ? (
                          <AssistantMessage markdown>
                            {textContent}
                          </AssistantMessage>
                        ) : isThinking ? (
                          <AssistantMessage>
                            <ThinkingLoader />
                          </AssistantMessage>
                        ) : null}
                        {uniqueSources.length > 0 && (
                          <Sources
                            sources={uniqueSources.map((s, i) => ({
                              id: `${message.id}-source-${i}`,
                              recording_id: s.recording_id,
                              chunk_text: s.text,
                              speaker_name: s.speaker,
                              call_date: s.call_date,
                              call_title: s.call_title,
                              similarity_score: parseFloat(s.relevance) / 100,
                            }))}
                            onViewCall={handleViewCall}
                            className="ml-11"
                          />
                        )}
                      </div>
                    );
                  }

                  return null;
                })}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="ml-11">
                    <ThinkingLoader />
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-red-600 dark:text-red-400">
                    <p className="text-sm">Error: {error.message}</p>
                  </div>
                )}
              </ChatContainerContent>
              <ChatContainerScrollAnchor />
              <ScrollButton className="shadow-lg" />
            </ChatContainerRoot>
            </ChatInnerCardContent>

            {/* Input area */}
            <ChatInnerCardInputArea>
            <div className="relative w-full">
              {/* Mentions popover */}
              {showMentions && filteredCalls.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-lg border border-cb-border shadow-lg max-h-64 overflow-y-auto z-50">
                  <div className="p-2">
                    <div className="text-xs font-medium text-cb-ink-muted uppercase mb-2 px-2">
                      <RiAtLine className="inline h-3 w-3 mr-1" />
                      Mention a call
                    </div>
                    <div className="space-y-1">
                      {filteredCalls.map((call) => (
                        <button
                          key={call.recording_id}
                          onClick={() => handleMentionSelect(call)}
                          className="w-full flex items-start gap-2 rounded-md px-2 py-2 hover:bg-cb-hover transition-colors text-left"
                        >
                          <RiVideoLine className="h-4 w-4 text-cb-ink-muted flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-cb-ink font-medium truncate">
                              {call.title || 'Untitled Call'}
                            </div>
                            <div className="text-xs text-cb-ink-muted">
                              {format(new Date(call.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <PromptInput
                value={input}
                onValueChange={handleInputChangeWithMentions}
                onSubmit={() => handleChatSubmit()}
                isLoading={isLoading}
              >
                {/* Context Bar with call attachments */}
                <PromptInputContextBar
                  attachments={contextAttachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  availableCalls={availableCalls}
                  onAddCall={handleAddCall}
                />

                {/* Main textarea */}
                <PromptInputTextarea
                  ref={textareaRef}
                  placeholder="Ask about your transcripts... (type @ to mention a call)"
                  disabled={isLoading}
                  className="px-4 py-2"
                />

                {/* Footer with model selector and submit */}
                <PromptInputFooter>
                  <PromptInputFooterLeft>
                    <ModelSelector
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    />
                  </PromptInputFooterLeft>
                  <PromptInputFooterRight>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!input || !input.trim() || isLoading}
                      className="gap-1"
                    >
                      <RiSendPlaneFill className="h-4 w-4" />
                      Send
                    </Button>
                  </PromptInputFooterRight>
                </PromptInputFooter>
              </PromptInput>

              {/* Keyboard Hint Bar */}
              <PromptInputHintBar>
                <KeyboardHint label="Send with" shortcut="Enter" />
                <KeyboardHint label="New line" shortcut="Shift+Enter" />
              </PromptInputHintBar>
            </div>
            </ChatInnerCardInputArea>
          </ChatInnerCard>
        </ChatOuterCard>

      {/* Call Detail Dialog */}
      <CallDetailDialog
        call={selectedCall}
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
      />
    </>
  );
}
