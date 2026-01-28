import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";
import {
  RiSendPlaneFill,
  RiFilterLine,
  RiCalendarLine,
  RiUser3Line,
  RiFolder3Line,
  RiCloseLine,
  RiAddLine,
  RiAtLine,
  RiVideoLine,
  RiUploadCloud2Line,
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/chat/chat-container";
import {
  ChatInnerCard,
  ChatInnerCardContent,
  ChatInnerCardInputArea,
  ChatInnerCardHeader,
} from "@/components/chat/chat-main-card";
import { ChatWelcome } from "@/components/chat/chat-welcome";
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
} from "@/components/chat/prompt-input";
import { ModelSelector } from "@/components/chat/model-selector";
import { UserMessage, AssistantMessage, extractSourcesFromParts, citationSourcesToSourceData } from "@/components/chat/message";
import { ScrollButton } from "@/components/chat/scroll-button";
import { ThinkingLoader, Loader } from "@/components/chat/loader";
import { ChatSkeleton, ChatLoading } from "@/components/chat/chat-skeleton";
import { Sources, SourceList } from "@/components/chat/source";
import { ToolCalls } from "@/components/chat/tool-call";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useChatSession } from "@/hooks/useChatSession";
import { useMentions } from "@/hooks/useMentions";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getUserFriendlyError, ErrorContexts } from "@/lib/user-friendly-errors";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

// Helper to detect rate limit errors
function isRateLimitError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  );
}

// Helper to detect streaming interruption errors (network/connection issues)
function isStreamingInterruptionError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : '';

  return (
    // Abort errors (timeout or manual abort)
    errorName === 'aborterror' ||
    errorMessage.includes('aborted') ||
    // Network errors
    errorMessage.includes('network') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('socket') ||
    // Stream errors
    errorMessage.includes('stream') ||
    errorMessage.includes('readable') ||
    // Generic fetch failures
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('load failed')
  );
}

// Helper to extract retry-after seconds from error (default to 30 seconds if not specified)
function extractRetryAfterSeconds(error: unknown): number {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Try to extract retry-after from various formats
  // e.g., "retry after 30 seconds", "retry-after: 30", "wait 30s"
  const patterns = [
    /retry[- ]?after[:\s]+(\d+)/i,
    /wait\s+(\d+)\s*s/i,
    /(\d+)\s*seconds?/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      if (!isNaN(seconds) && seconds > 0 && seconds <= 300) { // Cap at 5 minutes
        return seconds;
      }
    }
  }

  // Default to 30 seconds if no retry-after specified
  return 30;
}

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
  newSession?: boolean;
  initialContext?: ContextAttachment[];
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
  state?: "pending" | "running" | "success" | "error";
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
  if (!message?.parts || !Array.isArray(message.parts)) return "";
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part?.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join("");
}

// Helper to extract tool invocations from message parts
// AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
function getToolInvocations(message: UIMessage): ToolCallPart[] {
  if (!message?.parts || !Array.isArray(message.parts)) return [];

  const toolParts: ToolCallPart[] = [];

  for (const part of message.parts) {
    if (!part || typeof part.type !== "string") continue;
    // AI SDK v5 tool parts have type like 'tool-searchTranscripts', 'tool-getCallDetails', etc.
    // Also handle 'dynamic-tool' for dynamic tools
    if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
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
      const toolName =
        part.type === "dynamic-tool"
          ? toolPart.toolName || "unknown"
          : toolPart.type.replace("tool-", "");

      // Map AI SDK v5 states to our UI states
      // AI SDK v5 states: 'input-streaming', 'input-available', 'output-available', 'output-error'
      let state: "pending" | "running" | "success" | "error" = "pending";
      if (toolPart.state === "input-streaming") {
        state = "running";
      } else if (toolPart.state === "input-available") {
        state = "running"; // Still running, waiting for output
      } else if (toolPart.state === "output-available") {
        state = "success";
      } else if (toolPart.state === "output-error") {
        state = "error";
      }

      toolParts.push({
        type:
          toolPart.state === "output-available" ? "tool-result" : "tool-call",
        toolName,
        toolCallId: toolPart.toolCallId,
        state,
        args: toolPart.input as Record<string, unknown>,
        result:
          toolPart.state === "output-available"
            ? (toolPart.output as Record<string, unknown>)
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

  // Detect /chat2 path to use v2 backend (chat-stream-v2)
  const isV2 = location.pathname.startsWith('/chat2');
  const chatEndpoint = isV2 ? 'chat-stream-v2' : 'chat-stream';
  const chatBasePath = isV2 ? '/chat2' : '/chat';

  // Filter state - Initialize from location state if available (prevents race condition)
  const [filters, setFilters] = React.useState<ChatFilters>(() => {
    const state = location.state as ChatLocationState | undefined;
    if (state?.prefilter) {
      return {
        dateStart: undefined,
        dateEnd: undefined,
        speakers: [],
        categories: [],
        recordingIds: state.prefilter.recordingIds || [],
      };
    }
    return {
      dateStart: undefined,
      dateEnd: undefined,
      speakers: [],
      categories: [],
      recordingIds: [],
    };
  });
  const [availableSpeakers, setAvailableSpeakers] = React.useState<Speaker[]>(
    []
  );
  const [availableCategories, setAvailableCategories] = React.useState<
    Category[]
  >([]);
  const [availableCalls, setAvailableCalls] = React.useState<Call[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);

  // --- Layout State ---
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    sessionId || null
  );

  // Loading state for fetching chat messages from database
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);

  // Input state - managed locally (AI SDK v5 doesn't manage input)
  const [input, setInput] = React.useState("");

  // Selected model state - format: 'provider/model-name' (e.g., 'openai/gpt-4o-mini')
  // Default to GPT-4o-mini - reliable, fast, economical with excellent tool calling
  const [selectedModel, setSelectedModel] =
    React.useState<string>("openai/gpt-4o-mini");

  const { user } = useAuth();

  // Load user's preferred model from settings
  React.useEffect(() => {
    async function loadModelPreference() {
      if (!user?.id) return;
      
      const { data: settings } = await supabase
        .from("user_settings")
        .select("ai_model_preset")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.ai_model_preset) {
        // Trust the setting directly, only fallback if it's a truly legacy value (e.g. "fast")
        // The ModelSelector will handle showing/hiding it, but we should respect the saved ID.
        let modelId = settings.ai_model_preset;
        
        // Simple legacy mapping for very old values
        if (modelId === 'fast') modelId = 'openai/gpt-4o-mini';
        else if (modelId === 'quality') modelId = 'openai/gpt-4.1';
        else if (modelId === 'best') modelId = 'anthropic/claude-3-5-sonnet'; 
        
        setSelectedModel(modelId);
      }
    }

    loadModelPreference();
  }, [user?.id]);

  // CallDetailDialog state for viewing sources
  const [selectedCall, setSelectedCall] = React.useState<Meeting | null>(null);
  const [showCallDialog, setShowCallDialog] = React.useState(false);

  // Context attachments state (calls attached via "+ Add context")
  const [contextAttachments, setContextAttachments] = React.useState<
    ContextAttachment[]
  >(() => {
    // Initialize from location state if available
    const state = location.state as ChatLocationState | undefined;
    if (state?.initialContext) {
      return state.initialContext;
    }
    return [];
  });

  // Rate limit cooldown state
  const [rateLimitCooldownEnd, setRateLimitCooldownEnd] = React.useState<number | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = React.useState<number>(0);
  const rateLimitToastIdRef = React.useRef<string | number | null>(null);

  // Streaming reconnection state
  const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const lastUserMessageRef = React.useRef<string | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const BASE_RECONNECT_DELAY = 1000; // 1 second base delay

  // Track incomplete assistant messages (streaming failed mid-response)
  const [incompleteMessageIds, setIncompleteMessageIds] = React.useState<Set<string>>(new Set());

  // Ref to hold retry handler (avoids circular dependency with error effect)
  const handleRetryRef = React.useRef<() => void>(() => {});

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

  // Ref to track sessions for async callbacks (avoids stale closure and infinite re-renders)
  // React Query returns a new array reference on each query, so we use a ref to break the dependency cycle
  const sessionsRef = React.useRef(sessions);
  React.useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Build filter object for API - memoized to avoid unnecessary transport recreation
  const apiFilters = React.useMemo(
    () => ({
      date_start: filters.dateStart?.toISOString(),
      date_end: filters.dateEnd?.toISOString(),
      speakers: filters.speakers.length > 0 ? filters.speakers : undefined,
      categories:
        filters.categories.length > 0 ? filters.categories : undefined,
      recording_ids:
        filters.recordingIds.length > 0 ? filters.recordingIds : undefined,
    }),
    [filters]
  );

  // Use refs for values that change frequently but shouldn't recreate transport
  // This prevents infinite re-render loops when sessionId/model/filters change
  const apiFiltersRef = React.useRef(apiFilters);
  const selectedModelRef = React.useRef(selectedModel);
  React.useEffect(() => {
    apiFiltersRef.current = apiFilters;
  }, [apiFilters]);
  React.useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  // Create transport instance - recreate when auth token or critical values change
  const transport = React.useMemo(() => {
    // Guard: Don't create transport without valid auth token
    if (!session?.access_token) {
      logger.warn('Transport creation blocked: No valid auth token');
      return null;
    }

    logger.debug('[Chat] Creating transport with:', {
      model: selectedModel,
      sessionId: currentSessionId,
      hasFilters: !!apiFilters,
    });

    // Custom fetch with extended timeout for mobile networks
    const customFetch: typeof fetch = async (url, options) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      try {
        logger.debug('[Chat] Making request to:', url);
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        logger.debug('[Chat] Response status:', response.status);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        logger.error('[Chat] Fetch error:', error);

        // Capture to Sentry for remote debugging
        Sentry.captureException(error, {
          tags: {
            component: 'Chat',
            action: 'fetch_chat_stream',
          },
          extra: {
            url,
            model: selectedModel,
            sessionId: currentSessionId,
            hasFilters: !!apiFilters,
          },
        });

        throw error;
      }
    };

    return new DefaultChatTransport({
      api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${chatEndpoint}`,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      // Pass values directly as static object (simplest approach)
      body: {
        filters: apiFilters,
        model: selectedModel,
        sessionId: currentSessionId,
      },
      fetch: customFetch,
    });
  }, [session?.access_token, apiFilters, selectedModel, currentSessionId, chatEndpoint]);

  // Use the AI SDK v5 chat hook
  // Note: useChat can handle null transport - it won't make requests without a valid transport
  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: transport || undefined, // Convert null to undefined for type safety
  });

  // Check if chat is ready (valid session + transport)
  const isChatReady = !!session?.access_token && !!transport;

  // Check if rate limited (cooldown is active)
  const isRateLimited = rateLimitCooldownEnd !== null && Date.now() < rateLimitCooldownEnd;

  // Monitor for auth errors, rate limits, streaming interruption, and trigger re-login/reconnect
  React.useEffect(() => {
    if (error) {
      logger.error('[Chat] Error occurred:', error.message);

      // Check for rate limit error first
      if (isRateLimitError(error)) {
        const retryAfterSeconds = extractRetryAfterSeconds(error);
        const cooldownEnd = Date.now() + retryAfterSeconds * 1000;

        setRateLimitCooldownEnd(cooldownEnd);
        setRateLimitSeconds(retryAfterSeconds);

        // Reset reconnection state on rate limit
        setReconnectAttempts(0);
        setIsReconnecting(false);

        // Show initial toast with countdown
        const toastId = toast.error(
          `Rate limit exceeded. Please wait ${retryAfterSeconds} seconds before trying again.`,
          {
            duration: retryAfterSeconds * 1000,
            id: 'rate-limit-toast',
          }
        );
        rateLimitToastIdRef.current = toastId;

        return;
      }

      // Check for streaming interruption error (network/connection issues)
      if (isStreamingInterruptionError(error) && lastUserMessageRef.current) {
        // Mark the last assistant message as incomplete (preserve partial content)
        const currentMessages = messagesRef.current;
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg?.role === 'assistant') {
          setIncompleteMessageIds((prev) => new Set(prev).add(lastMsg.id));
        }

        const currentAttempts = reconnectAttempts + 1;

        if (currentAttempts <= MAX_RECONNECT_ATTEMPTS) {
          setReconnectAttempts(currentAttempts);
          setIsReconnecting(true);

          // Exponential backoff: 1s, 2s, 4s
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, currentAttempts - 1);

          logger.debug(`[Chat] Streaming interrupted, attempting reconnect ${currentAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

          toast.loading(
            `Connection interrupted. Reconnecting (attempt ${currentAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
            { id: 'reconnect-toast', duration: delay + 2000 }
          );

          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // Schedule reconnect attempt
          reconnectTimeoutRef.current = setTimeout(() => {
            const messageToRetry = lastUserMessageRef.current;
            if (messageToRetry && isChatReady) {
              logger.debug('[Chat] Retrying message after streaming interruption');
              sendMessage({ text: messageToRetry });
            }
            setIsReconnecting(false);
          }, delay);

          return;
        } else {
          // Max reconnect attempts reached — show actionable toast with retry
          logger.debug('[Chat] Max reconnect attempts reached');
          setReconnectAttempts(0);
          setIsReconnecting(false);

          toast.dismiss('reconnect-toast');
          toast.error(
            'Connection lost. Your partial response has been saved.',
            {
              id: 'streaming-error-toast',
              duration: 10000,
              action: {
                label: 'Retry',
                onClick: () => handleRetryRef.current(),
              },
            }
          );
          return;
        }
      }

      // For non-streaming errors that still have a partial assistant message,
      // mark the last assistant message as incomplete
      const currentMessages = messagesRef.current;
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg?.role === 'assistant' && getMessageTextContent(lastMsg).trim().length > 0) {
        setIncompleteMessageIds((prev) => new Set(prev).add(lastMsg.id));
      }

      // Get user-friendly error
      const friendlyError = getUserFriendlyError(error, ErrorContexts.CHAT);

      // Check if it's an auth error
      if (friendlyError.title === 'Session Expired') {
        logger.debug('[Chat] Auth error detected, attempting to refresh session...');

        // Try to refresh the session
        supabase.auth.getSession().then(({ data: { session: refreshedSession }, error: refreshError }) => {
          if (refreshError || !refreshedSession) {
            logger.error('[Chat] Session refresh failed, redirecting to login');
            toast.error(friendlyError.message);
            // Session is truly dead - redirect to login
            setTimeout(() => navigate('/login', { replace: true }), 2000);
          } else {
            logger.debug('[Chat] Session refreshed successfully');
            toast.info('Session refreshed - please try again');
          }
        });
      } else {
        // Show user-friendly error for non-auth errors
        // Include retry action if we have a message to retry
        if (lastUserMessageRef.current) {
          toast.error(friendlyError.message, {
            id: 'streaming-error-toast',
            duration: 10000,
            action: {
              label: 'Retry',
              onClick: () => handleRetryRef.current(),
            },
          });
        } else {
          toast.error(friendlyError.message);
        }
      }
    }
  }, [error, navigate, reconnectAttempts, isChatReady, sendMessage]);

  // Rate limit countdown timer - updates the toast message
  React.useEffect(() => {
    if (rateLimitCooldownEnd === null) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitCooldownEnd - Date.now()) / 1000));
      setRateLimitSeconds(remaining);

      if (remaining <= 0) {
        // Cooldown complete
        setRateLimitCooldownEnd(null);
        setRateLimitSeconds(0);

        // Dismiss the rate limit toast and show success
        if (rateLimitToastIdRef.current) {
          toast.dismiss(rateLimitToastIdRef.current);
          rateLimitToastIdRef.current = null;
        }
        toast.success('You can send messages again.', { duration: 3000 });
      } else {
        // Update the toast with remaining time
        toast.error(
          `Rate limit exceeded. Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before trying again.`,
          {
            id: 'rate-limit-toast',
            duration: remaining * 1000,
          }
        );
      }
    };

    // Initial update
    updateCountdown();

    // Set up interval for countdown
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [rateLimitCooldownEnd]);

  // Reset reconnection state and incomplete markers when streaming completes successfully
  React.useEffect(() => {
    if (status === 'ready' && reconnectAttempts > 0) {
      logger.debug('[Chat] Streaming completed successfully, resetting reconnection state');
      setReconnectAttempts(0);
      setIsReconnecting(false);
      setIncompleteMessageIds(new Set());
      lastUserMessageRef.current = null;
      toast.dismiss('reconnect-toast');
      toast.dismiss('streaming-error-toast');
      toast.success('Connection restored!', { duration: 2000 });
    }
    // Also clear incomplete markers when new streaming completes without reconnect
    if (status === 'ready' && incompleteMessageIds.size > 0 && reconnectAttempts === 0) {
      setIncompleteMessageIds(new Set());
    }
  }, [status, reconnectAttempts, incompleteMessageIds.size]);

  // Cleanup reconnect timeout on unmount
  React.useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

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
          const messagesToSave = msgs.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: getMessageTextContent(m),
            parts: m.parts,
          }));

          await saveMessages({
            sessionId,
            messages: messagesToSave,
            model,
          });
        } catch (err) {
          logger.error("Failed to save messages:", err);
        }
      }, 500);
    };
  }, [saveMessages]);

  // Cleanup debounce timeout on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Cancel any pending saves when component unmounts
      const cleanup = debouncedSaveMessages as unknown as {
        cancel?: () => void;
      };
      if (cleanup.cancel) cleanup.cancel();
    };
  }, [debouncedSaveMessages]);

  // Save messages when they change and status becomes ready (debounced)
  React.useEffect(() => {
    const sessionIdToSave = currentSessionIdRef.current;
    if (
      status === "ready" &&
      sessionIdToSave &&
      session?.user?.id &&
      messages.length > 0
    ) {
      debouncedSaveMessages(messages, sessionIdToSave, selectedModel);
    }
  }, [
    status,
    messages,
    session?.user?.id,
    debouncedSaveMessages,
    selectedModel,
  ]);

  // Cleanup empty sessions after workflow errors
  // If status becomes "error" and the session has no messages, delete it
  React.useEffect(() => {
    const sessionIdToCheck = currentSessionIdRef.current;
    if (
      status === "error" &&
      sessionIdToCheck &&
      messages.length === 0
    ) {
      logger.debug('[Chat] Workflow error with empty session, cleaning up:', sessionIdToCheck);
      // Delete the empty session after a short delay to allow error handling
      setTimeout(async () => {
        try {
          await deleteSession(sessionIdToCheck);
          // Navigate away from deleted session
          navigate(chatBasePath, { replace: true });
        } catch (err) {
          logger.error('[Chat] Failed to cleanup empty session:', err);
        }
      }, 1000);
    }
  }, [status, messages.length, deleteSession, navigate]);

  // Fetch available filters on mount
  React.useEffect(() => {
    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true;

    async function fetchFilterOptions() {
      if (!session?.access_token) return;

      try {
        // Fetch speakers
        const { data: speakers } = await supabase.rpc("get_user_speakers", {
          p_user_id: session.user.id,
        });
        if (isMounted && speakers) setAvailableSpeakers(speakers);

        // Fetch categories
        const { data: categories } = await supabase.rpc("get_user_categories", {
          p_user_id: session.user.id,
        });
        if (isMounted && categories) setAvailableCategories(categories);

        // Fetch recent calls
        const { data: calls } = await supabase
          .from("fathom_calls")
          .select("recording_id, title, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(30);
        if (isMounted && calls) setAvailableCalls(calls);
      } catch (error) {
        // Only log errors if component is still mounted (ignore abort errors)
        if (isMounted) {
          logger.error("Failed to fetch filter options:", error);
        }
      }
    }

    fetchFilterOptions();

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMounted = false;
    };
  }, [session]);

  // Atomically load session data (filters + messages) to prevent race conditions
  // CRITICAL: Filters must be loaded BEFORE messages to ensure transport has correct config
  // This prevents a 10-20ms race where messages load with stale/default filters
  React.useEffect(() => {
    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true;

    async function loadSession() {
      // Clear state atomically when no session selected
      if (!sessionId) {
        if (isMounted) {
          setCurrentSessionId(null);
          currentSessionIdRef.current = null;
          setMessages([]);
          setIsLoadingMessages(false);
          setFilters({
            speakers: [],
            categories: [],
            recordingIds: [],
          });
        }
        return;
      }

      // Set loading state when starting to load a session
      setIsLoadingMessages(true);

      try {
        // STEP 1: Load filters FIRST (before messages)
        // This ensures the transport is configured with correct filters when messages arrive
        // Use sessionsRef.current to avoid infinite re-render loop (React Query returns new array ref each query)
        const sessionMeta = sessionsRef.current.find((s) => s.id === sessionId);
        if (sessionMeta && isMounted) {
          const nextFilters: ChatFilters = {
            dateStart: sessionMeta.filter_date_start
              ? new Date(sessionMeta.filter_date_start)
              : undefined,
            dateEnd: sessionMeta.filter_date_end
              ? new Date(sessionMeta.filter_date_end)
              : undefined,
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

        // Initialize filters from location state if present (and not already set)
        const locationState = location.state as ChatLocationState | undefined;
        
        // Handle visual context attachments from location state
        if (locationState?.initialContext) {
          setContextAttachments(prev => {
             const prevJson = JSON.stringify(prev);
             const nextJson = JSON.stringify(locationState.initialContext);
             return prevJson === nextJson ? prev : locationState.initialContext || [];
          });
        }

        if (locationState?.prefilter?.recordingIds) {
          setFilters((prev) => {
            // Only update if actually different to avoid cycles
            if (JSON.stringify(prev.recordingIds) !== JSON.stringify(locationState.prefilter!.recordingIds)) {
               return {
                ...prev,
                recordingIds: locationState.prefilter!.recordingIds || [],
              };
            }
            return prev;
          });
        }

        // Check if this is a newly created session (passed via navigation state)
        // If so, we skip fetching messages from DB to avoid overwriting the optimistic local state
        // with an empty array from the DB (race condition fix)
        if (locationState?.newSession) {
          logger.debug(
            "New session detected, skipping initial DB fetch to preserve optimistic state"
          );

          // Still need to set the session ID refs
          setCurrentSessionId(sessionId);
          currentSessionIdRef.current = sessionId;
          setIsLoadingMessages(false);

          // Ensure filters are saved to the new session if they exist
          // This relies on saveMessages also saving session metadata, or a separate update

          // Clear the newSession flag so subsequent refreshes/navigation work normally
          // We use replace to update state without adding a new history entry
          navigate(location.pathname, {
            replace: true,
            state: { ...locationState, newSession: undefined },
          });
          return;
        }

        const loadedMessages = await fetchMessages(sessionId);

        // Only update state if still mounted
        if (!isMounted) return;

        logger.debug(
          `Loaded ${loadedMessages.length} messages for session ${sessionId}`
        );

        // Convert loaded messages to UIMessage format
        const uiMessages: UIMessage[] = loadedMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts:
            m.parts && Array.isArray(m.parts) && m.parts.length > 0
              ? (m.parts as unknown as UIMessage["parts"])
              : [{ type: "text" as const, text: m.content || "" }],
        }));

        // STEP 3: Update UI state atomically
        setMessages(uiMessages);
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        setIsLoadingMessages(false);
      } catch (err) {
        // Only log errors if component is still mounted
        if (isMounted) {
          logger.error("Failed to load session:", err);
          setIsLoadingMessages(false);
        }
      }
    }

    loadSession();

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMounted = false;
    };
    // NOTE: sessions intentionally excluded - using sessionsRef.current to break React Query infinite loop
  }, [sessionId, fetchMessages, setMessages]);

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
      navigate(`${chatBasePath}/${newSession.id}`);
    } catch (err) {
      logger.error("Failed to create session:", err);
    }
  }, [createNewSession, navigate, chatBasePath]);

  // Handle session selection
  const handleSessionSelect = React.useCallback(
    (selectedSessionId: string) => {
      navigate(`${chatBasePath}/${selectedSessionId}`);
      setShowSidebar(false);
    },
    [navigate, chatBasePath]
  );

  // Handle session deletion
  const handleDeleteSession = React.useCallback(
    async (sessionIdToDelete: string) => {
      try {
        await deleteSession(sessionIdToDelete);
        if (sessionIdToDelete === currentSessionId) {
          navigate(chatBasePath);
        }
      } catch (err) {
        logger.error("Failed to delete session:", err);
      }
    },
    [deleteSession, currentSessionId, navigate, chatBasePath]
  );

  // Handle toggle pin
  const handleTogglePin = React.useCallback(
    async (sessionId: string, isPinned: boolean) => {
      try {
        await togglePin({ sessionId, isPinned });
      } catch (err) {
        logger.error("Failed to toggle pin:", err);
      }
    },
    [togglePin]
  );

  // Handle toggle archive
  const handleToggleArchive = React.useCallback(
    async (sessionId: string, isArchived: boolean) => {
      try {
        await toggleArchive({ sessionId, isArchived });
      } catch (err) {
        logger.error("Failed to toggle archive:", err);
      }
    },
    [toggleArchive]
  );

  // Handle chat submission
  const handleChatSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // CRITICAL: Check if chat is ready before attempting to send
      if (!isChatReady) {
        logger.warn('[Chat] Attempted to send message without valid session/transport');
        toast.error('Your session has expired. Please sign in again to continue.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      // Check for rate limit cooldown
      if (isRateLimited && rateLimitSeconds > 0) {
        toast.error(
          `Please wait ${rateLimitSeconds} second${rateLimitSeconds !== 1 ? 's' : ''} before sending another message.`,
          { id: 'rate-limit-warning' }
        );
        return;
      }

      let inputToSubmit = input;

      // If there are context attachments, add them as @mentions
      if (contextAttachments.length > 0) {
        const attachmentMentions = contextAttachments
          .map((a) => `@[${a.title}](recording:${a.id})`)
          .join(" ");
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
          // Pass newSession: true to prevent loadSession from overwriting our optimistic message
          navigate(`${chatBasePath}/${newSession.id}`, {
            replace: true,
            state: { newSession: true }
          });
        } catch (err) {
          logger.error("Failed to create session:", err);
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
      }

      // Track the message for potential reconnection
      lastUserMessageRef.current = inputToSubmit;

      // Send message using AI SDK v5
      sendMessage({ text: inputToSubmit });
      setInput(""); // Clear input after sending
    },
    [
      input,
      currentSessionId,
      session?.user?.id,
      createNewSession,
      navigate,
      sendMessage,
      contextAttachments,
      isChatReady,
      isRateLimited,
      rateLimitSeconds,
      chatBasePath,
    ]
  );

  // Handle suggestion clicks
  const handleSuggestionClick = React.useCallback(
    async (text: string) => {
      // CRITICAL: Check if chat is ready before attempting to send
      if (!isChatReady) {
        logger.warn('[Chat] Attempted to send suggestion without valid session/transport');
        toast.error('Your session has expired. Please sign in again to continue.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      // Check for rate limit cooldown
      if (isRateLimited && rateLimitSeconds > 0) {
        toast.error(
          `Please wait ${rateLimitSeconds} second${rateLimitSeconds !== 1 ? 's' : ''} before sending another message.`,
          { id: 'rate-limit-warning' }
        );
        return;
      }

      // Create session if needed first
      let sessionIdToUse = currentSessionId;
      if (!sessionIdToUse && session?.user?.id) {
        try {
          const newSession = await createNewSession();
          sessionIdToUse = newSession.id;
          currentSessionIdRef.current = newSession.id;
          setCurrentSessionId(newSession.id);
          // Pass newSession: true to prevent loadSession from overwriting our optimistic message
          navigate(`${chatBasePath}/${newSession.id}`, {
            replace: true,
            state: { newSession: true }
          });
        } catch (err) {
          logger.error("Failed to create session:", err);
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
      }

      // Track the message for potential reconnection
      lastUserMessageRef.current = text;

      // Send the suggestion directly
      sendMessage({ text });
    },
    [
      currentSessionId,
      session?.user?.id,
      createNewSession,
      navigate,
      sendMessage,
      isChatReady,
      isRateLimited,
      rateLimitSeconds,
      chatBasePath,
    ]
  );

  // Handle retry after streaming failure
  // Removes the incomplete assistant message, then resends the last user message
  const handleRetry = React.useCallback(() => {
    const lastUserMessage = lastUserMessageRef.current;
    if (!lastUserMessage) {
      toast.error('No message to retry.');
      return;
    }

    if (!isChatReady) {
      toast.error('Your session has expired. Please sign in again to continue.');
      return;
    }

    // Remove incomplete assistant messages from the conversation
    setMessages((prev) => {
      const cleaned = prev.filter((m) => !incompleteMessageIds.has(m.id));
      return cleaned;
    });
    setIncompleteMessageIds(new Set());

    // Reset reconnection state
    setReconnectAttempts(0);
    setIsReconnecting(false);

    // Dismiss any existing error/reconnect toasts
    toast.dismiss('reconnect-toast');
    toast.dismiss('streaming-error-toast');

    // Resend the message
    logger.debug('[Chat] Retrying message:', lastUserMessage);
    sendMessage({ text: lastUserMessage });
  }, [isChatReady, sendMessage, setMessages, incompleteMessageIds]);

  // Keep retry ref in sync
  React.useEffect(() => {
    handleRetryRef.current = handleRetry;
  }, [handleRetry]);

  // Handler to view a call from a source citation
  const handleViewCall = React.useCallback(
    async (recordingId: number) => {
      if (!session?.user?.id) {
        logger.error("No user session");
        return;
      }

      try {
        // Use composite key (recording_id, user_id) for the lookup
        const { data: callData, error } = await supabase
          .from("fathom_calls")
          .select("*")
          .eq("recording_id", recordingId)
          .eq("user_id", session.user.id)
          .single();

        if (error) {
          logger.error("Failed to fetch call:", error);
          return;
        }

        setSelectedCall(callData as unknown as Meeting);
        setShowCallDialog(true);
      } catch (err) {
        logger.error("Error fetching call:", err);
      }
    },
    [session?.user?.id]
  );

  const hasActiveFilters =
    filters.dateStart ||
    filters.dateEnd ||
    filters.speakers.length > 0 ||
    filters.categories.length > 0 ||
    filters.recordingIds.length > 0;

  const clearFilters = React.useCallback(() => {
    setFilters({
      speakers: [],
      categories: [],
      recordingIds: [],
    });
  }, []);

  const toggleSpeaker = React.useCallback((speaker: string) => {
    setFilters((prev) => ({
      ...prev,
      speakers: prev.speakers.includes(speaker)
        ? prev.speakers.filter((s) => s !== speaker)
        : [...prev.speakers, speaker],
    }));
  }, []);

  const toggleCategory = React.useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const toggleCall = React.useCallback((recordingId: number) => {
    setFilters((prev) => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds.filter((id) => id !== recordingId)
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  // Handle call selection from mentions
  const handleMentionCallSelect = React.useCallback((recordingId: number) => {
    setFilters((prev) => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  // Handle removing a context attachment (stable callback for PromptInputContextBar)
  const handleRemoveAttachment = React.useCallback((id: number) => {
    setContextAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Handle adding a call as context attachment (stable callback for PromptInputContextBar)
  const handleAddCall = React.useCallback(
    (call: { recording_id: number; title: string; created_at: string }) => {
      setContextAttachments((prev) => [
        ...prev,
        {
          type: "call" as const,
          id: call.recording_id,
          title: call.title,
          date: call.created_at,
        },
      ]);
    },
    []
  );

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

  // Compute loading state from status (includes reconnecting state)
  const isLoading = status === "submitted" || status === "streaming" || isReconnecting;

  // Close mobile overlays when breakpoint changes away from mobile
  React.useEffect(() => {
    if (!isMobile) {
      setShowSidebar(false);
    }
  }, [isMobile]);

  return (
    <>
      {/* Mobile Chat Sessions overlay */}
      {isMobile && showSidebar && (
        <>
          {/* Mobile overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowSidebar(false)}
          />

          <div
            className={cn(
              "fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
              "animate-in slide-in-from-left duration-300"
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-sm font-semibold">Chat Sessions</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatSidebar
                sessions={sessions}
                activeSessionId={currentSessionId}
                onSessionSelect={(id) => {
                  handleSessionSelect(id);
                  setShowSidebar(false);
                }}
                onNewChat={() => {
                  handleNewChat();
                  setShowSidebar(false);
                }}
                onDeleteSession={handleDeleteSession}
                onTogglePin={handleTogglePin}
                onToggleArchive={handleToggleArchive}
              />
            </div>
          </div>
        </>
      )}

      {/* AppShell with ChatSidebar as secondaryPane */}
      <AppShell
        config={{
          secondaryPane: (
            <ChatSidebar
              sessions={sessions}
              activeSessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
            />
          )
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header - standardized detail pane pattern */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <RiChat3Line className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-ink">
                    AI Chat
                  </h2>
                  {isV2 && (
                    <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:border-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                      v2 backend
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted">
                  Ask questions about your calls
                </p>
              </div>
            </div>
          </header>

          {/* Main Chat Content */}
          <ChatInnerCard className="min-w-0 flex-1 relative z-0 transition-all duration-300">
          {/* Header */}
          <ChatInnerCardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                {/* Mobile chat sessions toggle */}
                {isMobile && (
                  <Button
                    variant="hollow"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowSidebar(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2"/>
                      <path d="M9 3v18"/>
                    </svg>
                  </Button>
                )}
                {hasActiveFilters && (
                  <div className="hidden md:flex items-center gap-2">
                    {filters.dateStart && (
                      <Badge variant="secondary" className="gap-1">
                        <RiCalendarLine className="h-3 w-3" />
                        {format(filters.dateStart, "MMM d")}
                        {filters.dateEnd &&
                          ` - ${format(filters.dateEnd, "MMM d")}`}
                      </Badge>
                    )}
                    {filters.speakers.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiUser3Line className="h-3 w-3" />
                        {filters.speakers.length} speaker
                        {filters.speakers.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {filters.categories.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiFolder3Line className="h-3 w-3" />
                        {filters.categories.length} categor
                        {filters.categories.length > 1 ? "ies" : "y"}
                      </Badge>
                    )}
                    {filters.recordingIds.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <RiVideoLine className="h-3 w-3" />
                        {filters.recordingIds.length} call
                        {filters.recordingIds.length > 1 ? "s" : ""}
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
                      variant={hasActiveFilters ? "default" : "outline"}
                      size="sm"
                      className="gap-1 h-8 px-2 md:px-3"
                    >
                      <RiFilterLine className="h-4 w-4" />
                      <span className="hidden md:inline">Filters</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4">
                      <h3 className="font-display text-sm font-bold uppercase text-ink mb-3">
                        Filter Transcripts
                      </h3>

                      {/* Date Range */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
                          Date Range
                        </label>
                        <DateRangePicker
                          dateRange={{
                            from: filters.dateStart,
                            to: filters.dateEnd,
                          }}
                          onDateRangeChange={(range) => {
                            setFilters((prev) => ({
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
                        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
                          Speakers ({availableSpeakers.length})
                        </label>
                        <ScrollArea className="h-32">
                          <div className="space-y-1">
                            {availableSpeakers.map((speaker) => (
                              <button
                                key={
                                  speaker.speaker_email || speaker.speaker_name
                                }
                                onClick={() =>
                                  toggleSpeaker(speaker.speaker_name)
                                }
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                                  filters.speakers.includes(
                                    speaker.speaker_name
                                  )
                                    ? "bg-vibe-orange/10 text-ink"
                                    : "hover:bg-hover text-ink-soft"
                                }`}
                              >
                                <span className="truncate">
                                  {speaker.speaker_name}
                                </span>
                                <span className="text-xs text-ink-muted">
                                  {speaker.call_count} calls
                                </span>
                              </button>
                            ))}
                            {availableSpeakers.length === 0 && (
                              <p className="text-sm text-ink-muted py-2">
                                No speakers indexed yet
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      <Separator className="my-4" />

                      {/* Categories */}
                      <div className="mb-4">
                        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
                          Categories ({availableCategories.length})
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {availableCategories.map((cat) => (
                            <Badge
                              key={cat.category}
                              variant={
                                filters.categories.includes(cat.category)
                                  ? "default"
                                  : "outline"
                              }
                              className="cursor-pointer"
                              onClick={() => toggleCategory(cat.category)}
                            >
                              {cat.category} ({cat.call_count})
                            </Badge>
                          ))}
                          {availableCategories.length === 0 && (
                            <p className="text-sm text-ink-muted py-2">
                              No categories indexed yet
                            </p>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Specific Calls */}
                      <div>
                        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
                          Specific Calls ({availableCalls.length})
                        </label>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2 pr-4">
                            {availableCalls.map((call) => (
                              <div
                                key={call.recording_id}
                                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-hover transition-colors"
                              >
                                <Checkbox
                                  id={`call-${call.recording_id}`}
                                  checked={filters.recordingIds.includes(
                                    call.recording_id
                                  )}
                                  onCheckedChange={() =>
                                    toggleCall(call.recording_id)
                                  }
                                  className="mt-0.5"
                                />
                                <label
                                  htmlFor={`call-${call.recording_id}`}
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  <div className="text-ink font-medium truncate">
                                    {call.title || "Untitled Call"}
                                  </div>
                                  <div className="text-xs text-ink-muted">
                                    {format(
                                      new Date(call.created_at),
                                      "MMM d, yyyy"
                                    )}
                                  </div>
                                </label>
                              </div>
                            ))}
                            {availableCalls.length === 0 && (
                              <p className="text-sm text-ink-muted py-2">
                                No calls found
                              </p>
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
                {/* Loading skeleton while fetching chat history */}
                {isLoadingMessages && (
                  <ChatLoading />
                )}

                {/* Welcome/Empty State */}
                {!isLoadingMessages && messages.length === 0 && (
                  availableCalls.length === 0 ? (
                    // Empty transcript database - show onboarding message
                    <ChatWelcome
                      userName={
                        session?.user?.user_metadata?.full_name?.split(" ")[0]
                      }
                      greeting="Upload transcripts to start chatting"
                      subtitle="Once you have meeting transcripts, you can search, analyze, and get insights from your calls."
                      suggestions={[]}
                      quickActions={[
                        {
                          id: 'upload-transcripts',
                          label: 'Upload Transcripts',
                          icon: <RiUploadCloud2Line className="h-4 w-4" />,
                          onClick: () => navigate('/transcripts'),
                        },
                      ]}
                    />
                  ) : (
                    // Normal state - user has transcripts
                    <ChatWelcome
                      userName={
                        session?.user?.user_metadata?.full_name?.split(" ")[0]
                      }
                      subtitle="Search across all your calls, find specific discussions, and uncover insights."
                      onSuggestionClick={handleSuggestionClick}
                    />
                  )
                )}

                {/* Messages */}
                {!isLoadingMessages && messages.map((message) => {
                  if (message.role === "user") {
                    const textContent = getMessageTextContent(message);
                    return (
                      <UserMessage key={message.id}>{textContent}</UserMessage>
                    );
                  }

                  if (message.role === "assistant") {
                    const toolParts = getToolInvocations(message);
                    const textContent = getMessageTextContent(message);

                    // Extract citation sources from tool result parts
                    const citationSources = extractSourcesFromParts(
                      toolParts.filter((p) => p.type === "tool-result" && p.result)
                    );
                    const sourceDataList = citationSourcesToSourceData(citationSources, message.id);

                    const hasContent = textContent.trim().length > 0;
                    const isThinking = !hasContent && toolParts.length > 0;
                    const hasCitations = citationSources.length > 0;

                    return (
                      <div key={message.id} className="space-y-2">
                        {toolParts.length > 0 && (
                          <ToolCalls parts={toolParts} />
                        )}
                        {hasContent ? (
                          <AssistantMessage
                            markdown
                            showSaveButton
                            saveMetadata={{ source: 'chat', generated_at: new Date().toISOString() }}
                            citations={hasCitations ? citationSources : undefined}
                            onCitationClick={handleViewCall}
                          >
                            {textContent}
                          </AssistantMessage>
                        ) : isThinking ? (
                          <AssistantMessage>
                            <ThinkingLoader />
                          </AssistantMessage>
                        ) : null}
                        {hasCitations ? (
                          <SourceList
                            sources={sourceDataList}
                            indices={citationSources.map((s) => s.index)}
                            onSourceClick={handleViewCall}
                            className="ml-0"
                          />
                        ) : null}
                      </div>
                    );
                  }

                  return null;
                })}

                {/* Loading indicator - only show if not already showing a tool/thinking state in last message */}
                {isLoading && (
                  (() => {
                    const lastMsg = messages[messages.length - 1];
                    const isLastMsgThinking = lastMsg?.role === 'assistant' && !getMessageTextContent(lastMsg).trim() && getToolInvocations(lastMsg).length > 0;
                    
                    if (isLastMsgThinking) return null;
                    
                    return (
                      <div className="ml-11">
                         <ThinkingLoader />
                      </div>
                    );
                  })()
                )}

                {/* Session invalid warning - only show if NOT loading */}
                {!isChatReady && !isLoading && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-yellow-700 dark:text-yellow-400">
                    <p className="text-sm font-medium">Session not ready</p>
                    <p className="text-xs mt-1">Please sign in to use chat features.</p>
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
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-lg border border-border shadow-lg max-h-64 overflow-y-auto z-50">
                  <div className="p-2">
                    <div className="text-xs font-medium text-ink-muted uppercase mb-2 px-2">
                      <RiAtLine className="inline h-3 w-3 mr-1" />
                      Mention a call
                    </div>
                    <div className="space-y-1">
                      {filteredCalls.map((call) => (
                        <button
                          key={call.recording_id}
                          onClick={() => handleMentionSelect(call)}
                          className="w-full flex items-start gap-2 rounded-md px-2 py-2 hover:bg-hover transition-colors text-left"
                        >
                          <RiVideoLine className="h-4 w-4 text-ink-muted flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-ink font-medium truncate">
                              {call.title || "Untitled Call"}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {format(new Date(call.created_at), "MMM d, yyyy")}
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
                  placeholder={
                    !isChatReady
                      ? "Chat unavailable - please sign in"
                      : isRateLimited
                      ? `Rate limited - please wait ${rateLimitSeconds}s...`
                      : isReconnecting
                      ? `Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
                      : "Ask about your transcripts... (type @ to mention a call)"
                  }
                  disabled={isLoading || !isChatReady || isRateLimited || isReconnecting}
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
                      disabled={!input || !input.trim() || isLoading || !isChatReady || isRateLimited || isReconnecting}
                      className="gap-1"
                    >
                      <RiSendPlaneFill className="h-4 w-4" />
                      {isRateLimited ? `Wait ${rateLimitSeconds}s` : isReconnecting ? 'Reconnecting...' : 'Send'}
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
        </div>
      </AppShell>

      {/* Call Detail Dialog */}
      <CallDetailDialog
        call={selectedCall}
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
      />
    </>
  );
}
