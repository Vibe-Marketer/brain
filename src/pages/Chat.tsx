/**
 * Chat - Main chat page component
 * 
 * Orchestrates chat functionality using extracted hooks and components.
 * Thin orchestration layer that coordinates:
 * - AI SDK v5 chat hook
 * - Session management
 * - Filter state
 * - Streaming state
 * - UI components
 */

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";
import {
  RiFilterLine,
  RiCalendarLine,
  RiUser3Line,
  RiFolder3Line,
  RiCloseLine,
  RiAddLine,
  RiVideoLine,
  RiChat3Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import { Meeting } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  ChatInnerCard,
  ChatInnerCardContent,
  ChatInnerCardInputArea,
  ChatInnerCardHeader,
} from "@/components/chat/chat-main-card";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInputArea } from "@/components/chat/ChatInputArea";
import { ChatFilterPopover } from "@/components/chat/ChatFilterPopover";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useChatSession } from "@/hooks/useChatSession";
import { useMentions } from "@/hooks/useMentions";
import { useChatFilters } from "@/hooks/useChatFilters";
import { useFolders } from "@/hooks/useFolders";
import {
  useChatStreaming,
  isRateLimitError,
  isStreamingInterruptionError,
  extractRetryAfterSeconds,
  throttledErrorLog,
} from "@/hooks/useChatStreaming";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getUserFriendlyError, ErrorContexts } from "@/lib/user-friendly-errors";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type { ChatLocationState, ChatSpeaker, ChatCategory, ChatCall } from "@/types/chat";
import { getMessageTextContent } from "@/types/chat";

// ==================== Component ====================

export default function Chat() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();

  // Chat endpoint configuration
  const chatEndpoint = 'chat-stream';
  const chatBasePath = '/chat';

  // --- Layout State ---
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const [showFilters, setShowFilters] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);

  // --- Session State ---
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    sessionId || null
  );
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [selectedModel, setSelectedModel] = React.useState<string>("openai/gpt-4o-mini");

  // --- Auth State ---
  const { user } = useAuth();

  // --- Filter State (extracted hook) ---
  const filterState = useChatFilters({
    initialLocationState: location.state as ChatLocationState | undefined,
  });

  // --- Streaming State (extracted hook) ---
  const streamingState = useChatStreaming();

  // --- Available filter options ---
  const [availableSpeakers, setAvailableSpeakers] = React.useState<ChatSpeaker[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<ChatCategory[]>([]);
  const [availableCalls, setAvailableCalls] = React.useState<ChatCall[]>([]);
  
  // --- Folders for filter ---
  const { folders } = useFolders();

  // --- CallDetailDialog state ---
  const [selectedCall, setSelectedCall] = React.useState<Meeting | null>(null);
  const [showCallDialog, setShowCallDialog] = React.useState(false);

  // --- Refs for async callbacks ---
  const currentSessionIdRef = React.useRef<string | null>(currentSessionId);
  React.useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const handleRetryRef = React.useRef<() => void>(() => {});
  const messagesRef = React.useRef<UIMessage[]>([]);

  // --- Chat Session Management ---
  const {
    sessions,
    fetchMessages,
    createSession,
    saveMessages,
    deleteSession,
    togglePin,
    toggleArchive,
  } = useChatSession(session?.user?.id);

  const sessionsRef = React.useRef(sessions);
  React.useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // --- Load user's preferred model ---
  React.useEffect(() => {
    async function loadModelPreference() {
      if (!user?.id) return;
      const { data: settings } = await supabase
        .from("user_settings")
        .select("ai_model_preset")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.ai_model_preset) {
        let modelId = settings.ai_model_preset;
        if (modelId === 'fast') modelId = 'openai/gpt-4o-mini';
        else if (modelId === 'quality') modelId = 'openai/gpt-4.1';
        else if (modelId === 'best') modelId = 'anthropic/claude-3-5-sonnet';
        setSelectedModel(modelId);
      }
    }
    loadModelPreference();
  }, [user?.id]);

  // --- Transport creation ---
  const transport = React.useMemo(() => {
    if (!session?.access_token) {
      logger.warn('Transport creation blocked: No valid auth token');
      return null;
    }

    const customFetch: typeof fetch = async (url, options) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        Sentry.captureException(error, {
          tags: { component: 'Chat', action: 'fetch_chat_stream' },
          extra: { url, model: selectedModel, sessionId: currentSessionId },
        });
        throw error;
      }
    };

    return new DefaultChatTransport({
      api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${chatEndpoint}`,
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        filters: filterState.apiFilters,
        model: selectedModel,
        sessionId: currentSessionId,
      },
      fetch: customFetch,
    });
  }, [session?.access_token, filterState.apiFilters, selectedModel, currentSessionId]);

  // --- AI SDK v5 Chat Hook ---
  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: transport || undefined,
  });

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- Computed State ---
  const isChatReady = !!session?.access_token && !!transport;
  const isLoading = status === "submitted" || status === "streaming" || streamingState.isReconnecting;

  // --- Error Handling Effect ---
  React.useEffect(() => {
    if (!error) {
      streamingState.handledErrorRef.current = null;
      return;
    }

    if (streamingState.handledErrorRef.current === error) return;
    streamingState.handledErrorRef.current = error;

    throttledErrorLog('general', '[Chat] Error occurred:', error.message);

    if (isRateLimitError(error)) {
      const retryAfterSeconds = extractRetryAfterSeconds(error);
      const cooldownEnd = Date.now() + retryAfterSeconds * 1000;
      streamingState.setRateLimitCooldown(cooldownEnd, retryAfterSeconds);
      streamingState.resetReconnectionState();
      toast.error(`Rate limit exceeded. Please wait ${retryAfterSeconds} seconds.`, {
        duration: retryAfterSeconds * 1000,
        id: 'rate-limit-toast',
      });
      return;
    }

    if (isStreamingInterruptionError(error) && streamingState.lastUserMessageRef.current) {
      const lastMsg = messagesRef.current[messagesRef.current.length - 1];
      if (lastMsg?.role === 'assistant') {
        streamingState.setIncompleteMessageIds((prev) => new Set(prev).add(lastMsg.id));
      }
      toast.error('Connection lost. Click Retry to continue.', {
        id: 'streaming-error-toast',
        duration: 10000,
        action: { label: 'Retry', onClick: () => handleRetryRef.current() },
      });
      return;
    }

    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
    if (lastMsg?.role === 'assistant' && getMessageTextContent(lastMsg).trim().length > 0) {
      streamingState.setIncompleteMessageIds((prev) => new Set(prev).add(lastMsg.id));
    }

    const friendlyError = getUserFriendlyError(error, ErrorContexts.CHAT);
    if (friendlyError.title === 'Session Expired') {
      supabase.auth.getSession().then(({ data: { session: refreshedSession }, error: refreshError }) => {
        if (refreshError || !refreshedSession) {
          toast.error(friendlyError.message);
          setTimeout(() => navigate('/login', { replace: true }), 2000);
        } else {
          toast.info('Session refreshed - please try again');
        }
      });
    } else if (streamingState.lastUserMessageRef.current) {
      toast.error(friendlyError.message, {
        id: 'streaming-error-toast',
        duration: 10000,
        action: { label: 'Retry', onClick: () => handleRetryRef.current() },
      });
    } else {
      toast.error(friendlyError.message);
    }
  }, [error, navigate, streamingState]);

  // --- Rate limit countdown effect ---
  React.useEffect(() => {
    if (streamingState.rateLimitCooldownEnd === null) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((streamingState.rateLimitCooldownEnd! - Date.now()) / 1000));
      if (remaining <= 0) {
        streamingState.clearRateLimitCooldown();
        toast.success('You can send messages again.', { duration: 3000 });
      }
    };

    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [streamingState.rateLimitCooldownEnd, streamingState]);

  // --- Reset streaming state on success ---
  React.useEffect(() => {
    if (status === 'ready' && streamingState.reconnectAttemptsRef.current > 0) {
      streamingState.resetReconnectionState();
      toast.dismiss('reconnect-toast');
      toast.success('Connection restored!', { duration: 2000 });
    }
    if (status === 'ready' && streamingState.incompleteMessageIds.size > 0 && streamingState.reconnectAttemptsRef.current === 0) {
      streamingState.setIncompleteMessageIds(new Set());
    }
  }, [status, streamingState]);

  // --- Debounced message save ---
  const debouncedSaveMessages = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (msgs: UIMessage[], sessionId: string, model: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const messagesToSave = msgs.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: getMessageTextContent(m),
            parts: m.parts,
          }));
          await saveMessages({ sessionId, messages: messagesToSave, model });
        } catch (err) {
          logger.error("Failed to save messages:", err);
        }
      }, 500);
    };
  }, [saveMessages]);

  React.useEffect(() => {
    const sessionIdToSave = currentSessionIdRef.current;
    if (status === "ready" && sessionIdToSave && session?.user?.id && messages.length > 0) {
      debouncedSaveMessages(messages, sessionIdToSave, selectedModel);
    }
  }, [status, messages, session?.user?.id, debouncedSaveMessages, selectedModel]);

  // --- Fetch filter options on mount ---
  React.useEffect(() => {
    let isMounted = true;
    async function fetchFilterOptions() {
      if (!session?.access_token) return;
      try {
        const { data: speakers } = await supabase.rpc("get_user_speakers", { p_user_id: session.user.id });
        if (isMounted && speakers) setAvailableSpeakers(speakers);

        const { data: categories } = await supabase.rpc("get_user_categories", { p_user_id: session.user.id });
        if (isMounted && categories) setAvailableCategories(categories);

        const { data: calls } = await supabase
          .from("fathom_calls")
          .select("recording_id, title, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(30);
        if (isMounted && calls) setAvailableCalls(calls);
      } catch (error) {
        if (isMounted) logger.error("Failed to fetch filter options:", error);
      }
    }
    fetchFilterOptions();
    return () => { isMounted = false; };
  }, [session]);

  // --- Load session data ---
  React.useEffect(() => {
    let isMounted = true;
    async function loadSession() {
      if (!sessionId) {
        if (isMounted) {
          setCurrentSessionId(null);
          setMessages([]);
          setIsLoadingMessages(false);
          filterState.setFilters({ speakers: [], categories: [], recordingIds: [], folderIds: [] });
        }
        return;
      }

      setIsLoadingMessages(true);
      try {
        const sessionMeta = sessionsRef.current.find((s) => s.id === sessionId);
        if (sessionMeta && isMounted) {
          filterState.setFilters({
            dateStart: sessionMeta.filter_date_start ? new Date(sessionMeta.filter_date_start) : undefined,
            dateEnd: sessionMeta.filter_date_end ? new Date(sessionMeta.filter_date_end) : undefined,
            speakers: sessionMeta.filter_speakers || [],
            categories: sessionMeta.filter_categories || [],
            recordingIds: sessionMeta.filter_recording_ids || [],
            folderIds: sessionMeta.filter_folder_ids || [],
          });
        }

        const locationState = location.state as ChatLocationState | undefined;
        if (locationState?.initialContext) {
          filterState.setContextAttachments(locationState.initialContext);
        }

        if (locationState?.newSession) {
          setCurrentSessionId(sessionId);
          currentSessionIdRef.current = sessionId;
          setIsLoadingMessages(false);
          navigate(location.pathname, { replace: true, state: { ...locationState, newSession: undefined } });
          return;
        }

        const loadedMessages = await fetchMessages(sessionId);
        if (!isMounted) return;

        const uiMessages: UIMessage[] = loadedMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts && Array.isArray(m.parts) && m.parts.length > 0
            ? (m.parts as unknown as UIMessage["parts"])
            : [{ type: "text" as const, text: m.content || "" }],
        }));

        setMessages(uiMessages);
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        setIsLoadingMessages(false);
      } catch (err) {
        if (isMounted) {
          logger.error("Failed to load session:", err);
          setIsLoadingMessages(false);
        }
      }
    }
    loadSession();
    return () => { isMounted = false; };
  }, [sessionId, fetchMessages, setMessages, filterState, location, navigate]);

  // --- Session handlers ---
  const createNewSession = React.useCallback(async () => {
    return createSession({
      filter_date_start: filterState.filters.dateStart,
      filter_date_end: filterState.filters.dateEnd,
      filter_speakers: filterState.filters.speakers,
      filter_categories: filterState.filters.categories,
      filter_recording_ids: filterState.filters.recordingIds,
    });
  }, [createSession, filterState.filters]);

  const handleNewChat = React.useCallback(async () => {
    try {
      const newSession = await createNewSession();
      navigate(`${chatBasePath}/${newSession.id}`);
    } catch (err) {
      logger.error("Failed to create session:", err);
    }
  }, [createNewSession, navigate]);

  const handleSessionSelect = React.useCallback((selectedSessionId: string) => {
    navigate(`${chatBasePath}/${selectedSessionId}`);
    setShowSidebar(false);
  }, [navigate]);

  const handleDeleteSession = React.useCallback(async (sessionIdToDelete: string) => {
    try {
      await deleteSession(sessionIdToDelete);
      if (sessionIdToDelete === currentSessionId) navigate(chatBasePath);
    } catch (err) {
      logger.error("Failed to delete session:", err);
    }
  }, [deleteSession, currentSessionId, navigate]);

  const handleTogglePin = React.useCallback(async (sid: string, isPinned: boolean) => {
    try { await togglePin({ sessionId: sid, isPinned }); } catch (err) { logger.error("Failed to toggle pin:", err); }
  }, [togglePin]);

  const handleToggleArchive = React.useCallback(async (sid: string, isArchived: boolean) => {
    try { await toggleArchive({ sessionId: sid, isArchived }); } catch (err) { logger.error("Failed to toggle archive:", err); }
  }, [toggleArchive]);

  // --- Chat submission ---
  const handleChatSubmit = React.useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isChatReady) {
      toast.error('Your session has expired. Please sign in again.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }
    if (streamingState.isRateLimited) {
      toast.error(`Please wait ${streamingState.rateLimitSeconds} seconds.`, { id: 'rate-limit-warning' });
      return;
    }

    let inputToSubmit = input;
    if (filterState.contextAttachments.length > 0) {
      const attachmentMentions = filterState.contextAttachments.map((a) => `@[${a.title}](recording:${a.id})`).join(" ");
      inputToSubmit = `[Context: ${attachmentMentions}]\n\n${input}`;
      filterState.setContextAttachments([]);
    }
    if (!inputToSubmit?.trim()) return;

    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse && session?.user?.id) {
      try {
        const newSession = await createNewSession();
        sessionIdToUse = newSession.id;
        currentSessionIdRef.current = newSession.id;
        setCurrentSessionId(newSession.id);
        navigate(`${chatBasePath}/${newSession.id}`, { replace: true, state: { newSession: true } });
      } catch (err) {
        logger.error("Failed to create session:", err);
        toast.error('Failed to create chat session.');
        return;
      }
    }

    streamingState.lastUserMessageRef.current = inputToSubmit;
    sendMessage({ text: inputToSubmit });
    setInput("");
  }, [input, currentSessionId, session?.user?.id, createNewSession, navigate, sendMessage, filterState, isChatReady, streamingState]);

  const handleSuggestionClick = React.useCallback(async (text: string) => {
    if (!isChatReady) {
      toast.error('Your session has expired. Please sign in again.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }
    if (streamingState.isRateLimited) {
      toast.error(`Please wait ${streamingState.rateLimitSeconds} seconds.`, { id: 'rate-limit-warning' });
      return;
    }

    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse && session?.user?.id) {
      try {
        const newSession = await createNewSession();
        sessionIdToUse = newSession.id;
        currentSessionIdRef.current = newSession.id;
        setCurrentSessionId(newSession.id);
        navigate(`${chatBasePath}/${newSession.id}`, { replace: true, state: { newSession: true } });
      } catch (err) {
        logger.error("Failed to create session:", err);
        toast.error('Failed to create chat session.');
        return;
      }
    }

    streamingState.lastUserMessageRef.current = text;
    sendMessage({ text });
  }, [currentSessionId, session?.user?.id, createNewSession, navigate, sendMessage, isChatReady, streamingState]);

  // --- Retry handler ---
  const handleRetry = React.useCallback(() => {
    const lastUserMessage = streamingState.lastUserMessageRef.current;
    if (!lastUserMessage) {
      toast.error('No message to retry.');
      return;
    }
    if (!isChatReady) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }

    if (streamingState.reconnectTimeoutRef.current) {
      clearTimeout(streamingState.reconnectTimeoutRef.current);
      streamingState.reconnectTimeoutRef.current = null;
    }

    setMessages((prev) => prev.filter((m) => !streamingState.incompleteMessageIds.has(m.id)));
    streamingState.resetReconnectionState();
    toast.dismiss('streaming-error-toast');

    sendMessage({ text: lastUserMessage });
  }, [isChatReady, sendMessage, setMessages, streamingState]);

  React.useEffect(() => {
    handleRetryRef.current = handleRetry;
  }, [handleRetry]);

  // --- View call handler ---
  const handleViewCall = React.useCallback(async (recordingId: number) => {
    if (!session?.user?.id) return;
    try {
      const { data: callData, error } = await supabase
        .from("fathom_calls")
        .select("*")
        .eq("recording_id", recordingId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error || !callData) {
        toast.error("Call not found");
        return;
      }
      setSelectedCall(callData as unknown as Meeting);
      setShowCallDialog(true);
    } catch (err) {
      toast.error("Failed to load call details");
    }
  }, [session?.user?.id]);

  // --- Mentions hook ---
  const { showMentions, filteredCalls, handleInputChangeWithMentions, handleMentionSelect } = useMentions({
    availableCalls,
    input,
    onInputChange: setInput,
    onCallSelect: filterState.addRecordingId,
    textareaRef,
  });

  // --- Close mobile overlays when breakpoint changes ---
  React.useEffect(() => {
    if (!isMobile) setShowSidebar(false);
  }, [isMobile]);

  // ==================== RENDER ====================

  return (
    <>
      {/* Mobile Chat Sessions overlay */}
      {isMobile && showSidebar && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowSidebar(false)} />
          <div className={cn("fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col", "animate-in slide-in-from-left duration-300")}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-sm font-semibold">Chat Sessions</span>
              <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)} className="text-muted-foreground h-8 w-8">
                <RiCloseLine className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatSidebar sessions={sessions} activeSessionId={currentSessionId} onSessionSelect={(id) => { handleSessionSelect(id); setShowSidebar(false); }} onNewChat={() => { handleNewChat(); setShowSidebar(false); }} onDeleteSession={handleDeleteSession} onTogglePin={handleTogglePin} onToggleArchive={handleToggleArchive} />
            </div>
          </div>
        </>
      )}

      {/* AppShell with ChatSidebar */}
      <AppShell config={{ secondaryPane: <ChatSidebar sessions={sessions} activeSessionId={currentSessionId} onSessionSelect={handleSessionSelect} onNewChat={handleNewChat} onDeleteSession={handleDeleteSession} onTogglePin={handleTogglePin} onToggleArchive={handleToggleArchive} /> }}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0">
                <RiChat3Line className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">AI Chat</h2>
                <p className="text-xs text-ink-muted">Ask questions about your calls</p>
              </div>
            </div>
          </header>

          {/* Main Chat Content */}
          <ChatInnerCard className="min-w-0 flex-1 relative z-0 transition-all duration-300">
            <ChatInnerCardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  {isMobile && (
                    <Button variant="hollow" className="h-8 w-8 p-0" onClick={() => setShowSidebar(true)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                    </Button>
                  )}
                  {filterState.hasActiveFilters && (
                    <div className="hidden md:flex items-center gap-2">
                      {filterState.filters.dateStart && <Badge variant="secondary" className="gap-1"><RiCalendarLine className="h-3 w-3" />{format(filterState.filters.dateStart, "MMM d")}{filterState.filters.dateEnd && ` - ${format(filterState.filters.dateEnd, "MMM d")}`}</Badge>}
                      {filterState.filters.speakers.length > 0 && <Badge variant="secondary" className="gap-1"><RiUser3Line className="h-3 w-3" />{filterState.filters.speakers.length} speaker{filterState.filters.speakers.length > 1 ? "s" : ""}</Badge>}
                      {filterState.filters.categories.length > 0 && <Badge variant="secondary" className="gap-1"><RiFolder3Line className="h-3 w-3" />{filterState.filters.categories.length} categor{filterState.filters.categories.length > 1 ? "ies" : "y"}</Badge>}
                      {filterState.filters.folderIds.map((folderId) => {
                        const folder = folders.find((f) => f.id === folderId);
                        return folder ? (
                          <Badge key={folderId} variant="secondary" className="gap-1 pr-1">
                            <RiFolder3Line className="h-3 w-3" style={{ color: folder.color || '#6B7280' }} />
                            <span className="max-w-[100px] truncate">{folder.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); filterState.toggleFolder(folderId); }}
                              className="ml-1 hover:bg-muted rounded p-0.5 transition-colors"
                              aria-label={`Remove ${folder.name} folder filter`}
                            >
                              <RiCloseLine className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                      {filterState.filters.recordingIds.length > 0 && <Badge variant="secondary" className="gap-1"><RiVideoLine className="h-3 w-3" />{filterState.filters.recordingIds.length} call{filterState.filters.recordingIds.length > 1 ? "s" : ""}</Badge>}
                      <Button variant="hollow" size="sm" onClick={filterState.clearFilters} className="h-6 px-2 text-xs"><RiCloseLine className="h-3 w-3" />Clear</Button>
                    </div>
                  )}
                  {filterState.hasActiveFilters && <Badge variant="secondary" className="md:hidden">Filtered</Badge>}
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button variant="hollow" size="sm" onClick={handleNewChat} className="gap-1 h-8 px-2 md:px-3"><RiAddLine className="h-4 w-4" /><span className="hidden md:inline">New Chat</span></Button>
                  <Popover open={showFilters} onOpenChange={setShowFilters}>
                    <PopoverTrigger asChild>
                      <Button variant={filterState.hasActiveFilters ? "default" : "outline"} size="sm" className="gap-1 h-8 px-2 md:px-3"><RiFilterLine className="h-4 w-4" /><span className="hidden md:inline">Filters</span></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <ChatFilterPopover filters={filterState.filters} setFilters={filterState.setFilters} availableSpeakers={availableSpeakers} availableCategories={availableCategories} availableFolders={folders} availableCalls={availableCalls} toggleSpeaker={filterState.toggleSpeaker} toggleCategory={filterState.toggleCategory} toggleFolder={filterState.toggleFolder} toggleCall={filterState.toggleCall} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </ChatInnerCardHeader>

            <ChatInnerCardContent>
              <ChatMessageList messages={messages} isLoadingMessages={isLoadingMessages} isLoading={isLoading} isChatReady={isChatReady} userName={session?.user?.user_metadata?.full_name?.split(" ")[0]} hasTranscripts={availableCalls.length > 0} incompleteMessageIds={streamingState.incompleteMessageIds} onCallClick={handleViewCall} onRetry={handleRetry} onSuggestionClick={handleSuggestionClick} onNavigateToTranscripts={() => navigate('/transcripts')} />
            </ChatInnerCardContent>

            <ChatInnerCardInputArea>
              <ChatInputArea input={input} onInputChange={handleInputChangeWithMentions} onSubmit={handleChatSubmit} isLoading={isLoading} isChatReady={isChatReady} isRateLimited={streamingState.isRateLimited} rateLimitSeconds={streamingState.rateLimitSeconds} isReconnecting={streamingState.isReconnecting} reconnectAttemptDisplay={streamingState.reconnectAttemptDisplay} maxReconnectAttempts={streamingState.MAX_RECONNECT_ATTEMPTS} selectedModel={selectedModel} onModelChange={setSelectedModel} contextAttachments={filterState.contextAttachments} onRemoveAttachment={filterState.removeAttachment} availableCalls={availableCalls} onAddCall={filterState.addCallAttachment} showMentions={showMentions} filteredCalls={filteredCalls} onMentionSelect={handleMentionSelect} textareaRef={textareaRef} />
            </ChatInnerCardInputArea>
          </ChatInnerCard>
        </div>
      </AppShell>

      {/* Call Detail Dialog */}
      <CallDetailDialog call={selectedCall} open={showCallDialog} onOpenChange={setShowCallDialog} />
    </>
  );
}
