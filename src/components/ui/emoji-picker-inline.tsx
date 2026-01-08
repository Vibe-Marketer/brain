import { useState } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { RiArrowDownSLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Common folder-related emojis for quick selection (10 to fit in one row)
const COMMON_EMOJIS = ['📁', '📂', '💼', '📋', '🎯', '⭐', '💡', '🔥', '✅', '📌'];

interface EmojiPickerInlineProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPickerInline({ value, onChange, className }: EmojiPickerInlineProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Get recent emojis from localStorage
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recent-folder-emojis');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Combine recent + common, dedupe, limit to 10 (fits in dialog width)
  const quickEmojis = [...new Set([...recentEmojis, ...COMMON_EMOJIS])].slice(0, 10);

  const handleEmojiSelect = (emoji: string) => {
    onChange(emoji);

    // Update recent emojis
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 6);
    setRecentEmojis(updated);
    try {
      localStorage.setItem('recent-folder-emojis', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const handlePickerSelect = (emojiData: EmojiClickData) => {
    handleEmojiSelect(emojiData.emoji);
    setPopoverOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-0.5 flex-nowrap", className)}>
      {/* Quick emoji buttons */}
      {quickEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleEmojiSelect(emoji)}
          className={cn(
            "w-7 h-7 flex-shrink-0 flex items-center justify-center rounded text-base transition-all",
            "hover:bg-cb-hover border border-transparent",
            value === emoji && "border-cb-ink bg-cb-hover scale-105"
          )}
          title={emoji}
        >
          {emoji}
        </button>
      ))}

      {/* More button with popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-7 px-2 flex-shrink-0 flex items-center gap-0.5 rounded text-xs",
              "bg-cb-hover hover:bg-cb-border text-cb-ink-soft transition-colors"
            )}
          >
            More
            <RiArrowDownSLine className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-0"
          align="end"
          sideOffset={4}
        >
          <EmojiPicker
            onEmojiClick={handlePickerSelect}
            theme={Theme.AUTO}
            width={320}
            height={400}
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis={true}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
