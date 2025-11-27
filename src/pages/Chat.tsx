import * as React from 'react';
import { useChat } from '@ai-sdk/react';
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
  ChatContainer,
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/chat/chat-container';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputContextBar,
  PromptInputFooter,
  PromptInputFooterLeft,
  PromptInputFooterRight,
  PromptInputHintBar,
  KeyboardHint,
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

// Helper to create a fake change event for the AI SDK's handleInputChange
const createInputChangeEvent = (value: string): React.ChangeEvent<HTMLTextAreaElement> => ({
  target: { value } as HTMLTextAreaElement,
} as React.ChangeEvent<HTMLTextAreaElement>);

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
  const [isLoadingSession, setIsLoadingSession] = React.useState(false);

  // CallDetailDialog state for viewing sources
  const [selectedCall, setSelectedCall] = React.useState<Meeting | null>(null);
  const [showCallDialog, setShowCallDialog] = React.useState(false);

  // Ref to track current session ID for async callbacks (avoids stale closure)
  const currentSessionIdRef = React.useRef<string | null>(currentSessionId);
  React.useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Ref to track messages for async callbacks (avoids stale closure in onFinish)
  const messagesRef = React.useRef<typeof messages>([]);

  // Textarea ref for mentions
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Chat session management
  const {
    sessions,
    isLoadingSessions,
    fetchMessages,
    createSession,
    saveMessages,
    deleteSession,
    togglePin,
    toggleArchive,
  } = useChatSession(session?.user?.id);

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

  // Handle incoming location state for pre-filtering (e.g., from CallDetailDialog)
  // This intentionally runs only once on mount to process initial navigation state
  React.useEffect(() => {
    const state = location.state as ChatLocationState | undefined;
    if (state?.prefilter?.recordingIds?.length) {
      setFilters(prev => ({
        ...prev,
        recordingIds: state.prefilter!.recordingIds!,
      }));
      // Clear the location state to prevent re-applying on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build filter object for API
  const apiFilters = React.useMemo(() => ({
    date_start: filters.dateStart?.toISOString(),
    date_end: filters.dateEnd?.toISOString(),
    speakers: filters.speakers.length > 0 ? filters.speakers : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    recording_ids: filters.recordingIds.length > 0 ? filters.recordingIds : undefined,
  }), [filters]);

  // Use the AI SDK chat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    streamProtocol: 'data',
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-stream`,
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: {
      filters: apiFilters,
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
    onFinish: async (message) => {
      // Save messages to database after AI response completes
      // Use messagesRef to get current messages (avoids stale closure)
      // Include the finished message in case ref is slightly behind
      const sessionIdToSave = currentSessionIdRef.current;
      if (sessionIdToSave && session?.user?.id) {
        try {
          // Get current messages from ref and ensure the finished message is included
          const currentMessages = messagesRef.current;
          const hasFinishedMessage = currentMessages.some(m => m.id === message.id);
          const messagesToSave = hasFinishedMessage
            ? currentMessages
            : [...currentMessages, message];

          await saveMessages({
            sessionId: sessionIdToSave,
            messages: messagesToSave,
            model: 'gpt-4o',
          });
        } catch (err) {
          console.error('Failed to save messages:', err);
        }
      }
    },
  });

  // Keep messagesRef in sync with messages (for use in async callbacks)
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load session messages when sessionId changes
  React.useEffect(() => {
    async function loadSessionMessages() {
      if (!sessionId) {
        setCurrentSessionId(null);
        currentSessionIdRef.current = null;
        setMessages([]);
        return;
      }

      setIsLoadingSession(true);
      try {
        const loadedMessages = await fetchMessages(sessionId);
        console.log(`Loaded ${loadedMessages.length} messages for session ${sessionId}`);
        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
      } catch (err) {
        console.error('Failed to load session messages:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }

    loadSessionMessages();
  }, [sessionId, fetchMessages, setMessages]);

  // Create a new session with current filters (shared logic)
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
    setShowSidebar(false); // Close sidebar on mobile after selection
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

  // Save user message to database after submission
  const handleChatSubmit = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Don't submit if input is empty
    if (!input.trim()) return;

    // Create session if it doesn't exist BEFORE submitting
    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse && session?.user?.id) {
      try {
        const newSession = await createNewSession();
        sessionIdToUse = newSession.id;
        // Update both state and ref (ref is immediate, state is async)
        currentSessionIdRef.current = newSession.id;
        setCurrentSessionId(newSession.id);
        navigate(`/chat/${newSession.id}`, { replace: true });
      } catch (err) {
        console.error('Failed to create session:', err);
        return;
      }
    }

    // Call the original handleSubmit which will add the user message and trigger the AI
    handleSubmit(e);
  }, [input, currentSessionId, session?.user?.id, createNewSession, navigate, handleSubmit]);

  // Handle suggestion clicks - sets input AND submits
  const handleSuggestionClick = React.useCallback((text: string) => {
    handleInputChange(createInputChangeEvent(text));
    // Use requestAnimationFrame to ensure state update completes before submit
    requestAnimationFrame(() => {
      handleChatSubmit();
    });
  }, [handleInputChange, handleChatSubmit]);

  // Handler to view a call from a source citation
  const handleViewCall = React.useCallback(async (recordingId: number) => {
    try {
      const { data: callData, error } = await supabase
        .from('fathom_calls')
        .select('*')
        .eq('recording_id', recordingId)
        .single();

      if (error) {
        console.error('Failed to fetch call:', error);
        return;
      }

      setSelectedCall(callData as Meeting);
      setShowCallDialog(true);
    } catch (err) {
      console.error('Error fetching call:', err);
    }
  }, []);

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

  // Handle call selection from mentions (adds to filter)
  const handleMentionCallSelect = React.useCallback((recordingId: number) => {
    setFilters(prev => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds
        : [...prev.recordingIds, recordingId],
    }));
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
    onInputChange: (value) => handleInputChange(createInputChangeEvent(value)),
    onCallSelect: handleMentionCallSelect,
    textareaRef,
  });

  return (
    <div className="flex h-[calc(100vh-52px)] bg-viewport">
      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown as overlay when toggled */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 md:z-auto
        w-80 flex-shrink-0
        transform transition-transform duration-200 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:block
      `}>
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

      {/* Main chat area */}
      <div className="flex flex-1 flex-col w-full">
      {/* Header with filters */}
      <div className="flex items-center justify-between border-b border-cb-border bg-card px-2 md:px-4 py-3">
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
          <h1 className="font-display text-base md:text-lg font-extrabold uppercase text-cb-ink">
            AI Chat
          </h1>
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
                              ? 'bg-vibe-green/10 text-cb-ink'
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

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="px-4 md:px-6 py-4">
            {/* Welcome message when empty */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-vibe-green/10 flex items-center justify-center mb-4">
                  <RiSendPlaneFill className="h-8 w-8 text-vibe-green" />
                </div>
                <h2 className="font-display text-xl font-extrabold uppercase text-cb-ink mb-2">
                  Chat with your transcripts
                </h2>
                <p className="text-cb-ink-soft max-w-md mb-6">
                  Ask questions about your meeting transcripts. I can search across all your calls,
                  find specific discussions, and help you uncover insights.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick('What were the main objections in my recent sales calls?')}
                  >
                    Sales objections
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick('Summarize my calls from last week')}
                  >
                    Weekly summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick('What topics came up most frequently?')}
                  >
                    Common topics
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => {
              if (message.role === 'user') {
                return (
                  <UserMessage key={message.id}>
                    {message.content}
                  </UserMessage>
                );
              }

              if (message.role === 'assistant') {
                // Convert AI SDK v3.x toolInvocations to our ToolCallPart format
                // v3.x uses toolInvocations with state: 'partial-call' | 'call' | 'result'
                const toolParts: ToolCallPart[] = (message.toolInvocations || []).map((invocation) => {
                  // Map v3.x state to our component state
                  let state: 'pending' | 'running' | 'success' | 'error' = 'pending';
                  if (invocation.state === 'partial-call') {
                    state = 'running';
                  } else if (invocation.state === 'call') {
                    state = 'running';
                  } else if (invocation.state === 'result') {
                    state = 'success';
                  }

                  return {
                    type: invocation.state === 'result' ? 'tool-result' : 'tool-call',
                    toolName: invocation.toolName,
                    toolCallId: invocation.toolCallId,
                    state,
                    args: invocation.args as Record<string, unknown>,
                    result: invocation.state === 'result' ? invocation.result as Record<string, unknown> : undefined,
                  };
                });

                // Extract sources from tool results - handle both searchTranscripts (results array)
                // and getCallDetails (single call object with recording_id)
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
                    // Handle searchTranscripts results array
                    if (p.result.results && Array.isArray(p.result.results)) {
                      sources.push(...p.result.results);
                    }
                    // Handle getCallDetails single result (has recording_id and title at top level)
                    else if (p.result.recording_id && p.result.title && !p.result.error) {
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

                // Dedupe by recording_id and limit to 5
                const uniqueSources = sources
                  .filter((s, i, arr) => arr.findIndex(x => x.recording_id === s.recording_id) === i)
                  .slice(0, 5);

                // Determine if we should show content or loading state
                const hasContent = message.content && message.content.trim().length > 0;
                const isThinking = !hasContent && toolParts.length > 0;

                return (
                  <div key={message.id} className="space-y-2">
                    {toolParts.length > 0 && <ToolCalls parts={toolParts} />}
                    {hasContent ? (
                      <AssistantMessage markdown>
                        {message.content}
                      </AssistantMessage>
                    ) : isThinking ? (
                      <AssistantMessage isLoading />
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
      </div>

      {/* Input area - Kortex-style centered container */}
      <div className="border-t border-cb-border bg-card px-4 py-4">
        <div className="relative w-full max-w-[800px] mx-auto">
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
            {/* Kortex-style Context Bar */}
            <PromptInputContextBar
              onAddContext={() => {
                // TODO: Open context/attachment picker
                console.log('Add context clicked');
              }}
            />

            {/* Main textarea */}
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ask about your transcripts... (type @ to mention a call)"
              disabled={isLoading}
              className="px-4 py-2"
            />

            {/* Kortex-style Footer with model selector and submit */}
            <PromptInputFooter>
              <PromptInputFooterLeft>
                <ModelSelector
                  value="gpt-4o"
                  onValueChange={(modelId) => {
                    // TODO: Handle model change
                    console.log('Model changed:', modelId);
                  }}
                />
              </PromptInputFooterLeft>
              <PromptInputFooterRight>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isLoading}
                  className="gap-1"
                >
                  <RiSendPlaneFill className="h-4 w-4" />
                  Send
                </Button>
              </PromptInputFooterRight>
            </PromptInputFooter>
          </PromptInput>

          {/* Kortex-style Keyboard Hint Bar */}
          <PromptInputHintBar>
            <KeyboardHint label="Send with" shortcut="Enter" />
            <KeyboardHint label="New line" shortcut="Shift+Enter" />
          </PromptInputHintBar>
        </div>
      </div>
      </div>

      {/* Call Detail Dialog for viewing source citations */}
      <CallDetailDialog
        call={selectedCall}
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
      />
    </div>
  );
}
