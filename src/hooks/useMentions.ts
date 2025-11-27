import * as React from 'react';

interface Call {
  recording_id: number;
  title: string;
  created_at: string;
}

interface UseMentionsOptions {
  availableCalls: Call[];
  input: string;
  onInputChange: (value: string) => void;
  onCallSelect?: (recordingId: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  maxResults?: number;
}

interface UseMentionsReturn {
  showMentions: boolean;
  mentionSearch: string;
  filteredCalls: Call[];
  handleInputChangeWithMentions: (value: string) => void;
  handleMentionSelect: (call: Call) => void;
  closeMentions: () => void;
}

/**
 * Hook for handling @mention functionality in chat input
 * Detects @ symbols in input and shows a searchable list of calls
 */
export function useMentions({
  availableCalls,
  input,
  onInputChange,
  onCallSelect,
  textareaRef,
  maxResults = 10,
}: UseMentionsOptions): UseMentionsReturn {
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionSearch, setMentionSearch] = React.useState('');
  const [mentionTriggerPos, setMentionTriggerPos] = React.useState<number | null>(null);

  // Handle @ mention detection in input
  const handleInputChangeWithMentions = React.useCallback((value: string) => {
    onInputChange(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's text after @ (search query)
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Only show mentions if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const isValidTrigger = charBeforeAt === ' ' || charBeforeAt === '\n';

      // And not followed by whitespace (user is still typing)
      const hasNoSpaceAfterAt = !textAfterAt.includes(' ') && !textAfterAt.includes('\n');

      if (isValidTrigger && hasNoSpaceAfterAt) {
        setMentionTriggerPos(lastAtIndex);
        setMentionSearch(textAfterAt);
        setShowMentions(true);
        return;
      }
    }

    // Hide mentions if conditions not met
    setShowMentions(false);
    setMentionTriggerPos(null);
    setMentionSearch('');
  }, [onInputChange, textareaRef]);

  // Handle mention selection
  const handleMentionSelect = React.useCallback((call: Call) => {
    if (mentionTriggerPos === null) return;

    // Replace @search with @[Title](recording:id)
    const mentionText = `@[${call.title}](recording:${call.recording_id})`;
    const beforeMention = input.slice(0, mentionTriggerPos);
    const afterMention = input.slice(mentionTriggerPos + mentionSearch.length + 1); // +1 for @

    const newInput = beforeMention + mentionText + ' ' + afterMention;
    onInputChange(newInput);

    // Notify parent of call selection (for filtering)
    onCallSelect?.(call.recording_id);

    // Close mentions
    setShowMentions(false);
    setMentionTriggerPos(null);
    setMentionSearch('');

    // Focus back on textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [input, mentionTriggerPos, mentionSearch, onInputChange, onCallSelect, textareaRef]);

  // Close mentions manually
  const closeMentions = React.useCallback(() => {
    setShowMentions(false);
    setMentionTriggerPos(null);
    setMentionSearch('');
  }, []);

  // Filter calls based on search
  const filteredCalls = React.useMemo(() => {
    if (!mentionSearch) return availableCalls.slice(0, maxResults);

    const search = mentionSearch.toLowerCase();
    return availableCalls
      .filter(call => call.title.toLowerCase().includes(search))
      .slice(0, maxResults);
  }, [availableCalls, mentionSearch, maxResults]);

  return {
    showMentions,
    mentionSearch,
    filteredCalls,
    handleInputChangeWithMentions,
    handleMentionSelect,
    closeMentions,
  };
}
