import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { RiSendPlaneFill, RiFilterLine, RiCalendarLine, RiUser3Line, RiFolder3Line, RiCloseLine, RiAddLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ChatContainer,
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/chat/chat-container';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/chat/prompt-input';
import { UserMessage, AssistantMessage } from '@/components/chat/message';
import { ScrollButton } from '@/components/chat/scroll-button';
import { ThinkingLoader } from '@/components/chat/loader';
import { Sources } from '@/components/chat/source';
import { ToolCalls } from '@/components/chat/tool-call';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ChatFilters {
  dateStart?: Date;
  dateEnd?: Date;
  speakers: string[];
  categories: string[];
  recordingIds: number[];
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

export default function Chat() {
  const { session } = useAuth();
  const [filters, setFilters] = React.useState<ChatFilters>({
    speakers: [],
    categories: [],
    recordingIds: [],
  });
  const [availableSpeakers, setAvailableSpeakers] = React.useState<Speaker[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<Category[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);

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
    }

    fetchFilterOptions();
  }, [session]);

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
  });

  const hasActiveFilters = filters.dateStart || filters.dateEnd || filters.speakers.length > 0 || filters.categories.length > 0;

  const clearFilters = () => {
    setFilters({
      speakers: [],
      categories: [],
      recordingIds: [],
    });
  };

  const toggleSpeaker = (speaker: string) => {
    setFilters(prev => ({
      ...prev,
      speakers: prev.speakers.includes(speaker)
        ? prev.speakers.filter(s => s !== speaker)
        : [...prev.speakers, speaker],
    }));
  };

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const startNewChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col bg-viewport">
      {/* Header with filters */}
      <div className="flex items-center justify-between border-b border-cb-border-primary bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="font-montserrat text-lg font-extrabold uppercase text-cb-ink-primary">
            AI Chat
          </h1>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs"
              >
                <RiCloseLine className="h-3 w-3" />
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={startNewChat}
            className="gap-1"
          >
            <RiAddLine className="h-4 w-4" />
            New Chat
          </Button>

          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveFilters ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
              >
                <RiFilterLine className="h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4">
                <h3 className="font-montserrat text-sm font-bold uppercase text-cb-ink-primary mb-3">
                  Filter Transcripts
                </h3>

                {/* Date Range */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-cb-ink-muted uppercase mb-2 block">
                    Date Range
                  </label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <RiCalendarLine className="mr-2 h-4 w-4" />
                          {filters.dateStart ? format(filters.dateStart, 'MMM d, yyyy') : 'Start date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateStart}
                          onSelect={(date) => setFilters(prev => ({ ...prev, dateStart: date }))}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                          <RiCalendarLine className="mr-2 h-4 w-4" />
                          {filters.dateEnd ? format(filters.dateEnd, 'MMM d, yyyy') : 'End date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateEnd}
                          onSelect={(date) => setFilters(prev => ({ ...prev, dateEnd: date }))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                              ? 'bg-cb-vibe-green/10 text-cb-ink-primary'
                              : 'hover:bg-cb-ink-subtle/5 text-cb-ink-secondary'
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
                <div>
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
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="px-4 py-4 max-w-3xl mx-auto">
            {/* Welcome message when empty */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-cb-vibe-green/10 flex items-center justify-center mb-4">
                  <RiSendPlaneFill className="h-8 w-8 text-cb-vibe-green" />
                </div>
                <h2 className="font-montserrat text-xl font-extrabold uppercase text-cb-ink-primary mb-2">
                  Chat with your transcripts
                </h2>
                <p className="text-cb-ink-secondary max-w-md mb-6">
                  Ask questions about your meeting transcripts. I can search across all your calls,
                  find specific discussions, and help you uncover insights.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange({ target: { value: 'What were the main objections in my recent sales calls?' } } as any)}
                  >
                    Sales objections
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange({ target: { value: 'Summarize my calls from last week' } } as any)}
                  >
                    Weekly summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange({ target: { value: 'What topics came up most frequently?' } } as any)}
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
                // Extract tool calls from parts if available
                const toolParts = message.parts?.filter((p: any) => p.type === 'tool-call' || p.type === 'tool-result') || [];
                // Extract sources from tool results
                const sources = toolParts
                  .filter((p: any) => p.type === 'tool-result' && p.result?.results)
                  .flatMap((p: any) => p.result.results || [])
                  .slice(0, 5);

                return (
                  <div key={message.id} className="space-y-2">
                    {toolParts.length > 0 && <ToolCalls parts={toolParts} />}
                    <AssistantMessage markdown>
                      {message.content}
                    </AssistantMessage>
                    {sources.length > 0 && (
                      <Sources
                        sources={sources.map((s: any, i: number) => ({
                          id: `${message.id}-source-${i}`,
                          recording_id: s.recording_id,
                          chunk_text: s.text,
                          speaker_name: s.speaker,
                          call_date: s.call_date,
                          call_title: s.call_title,
                          similarity_score: parseFloat(s.relevance) / 100,
                        }))}
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

      {/* Input area */}
      <div className="border-t border-cb-border-primary bg-card px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            value={input}
            onValueChange={(value) => handleInputChange({ target: { value } } as any)}
            onSubmit={() => handleSubmit()}
            isLoading={isLoading}
          >
            <PromptInputTextarea
              placeholder="Ask about your transcripts..."
              disabled={isLoading}
            />
            <PromptInputActions>
              <div className="flex-1" />
              <PromptInputAction tooltip="Send message">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isLoading}
                  className="gap-1"
                >
                  <RiSendPlaneFill className="h-4 w-4" />
                  Send
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
