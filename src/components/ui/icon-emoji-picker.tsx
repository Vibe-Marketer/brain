import { useState, useMemo } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import * as RemixIcon from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Import utilities from centralized location to avoid Fast Refresh warnings
import {
  FOLDER_ICON_OPTIONS,
  FOLDER_COLORS,
  isEmojiIcon,
  getIconComponent,
} from '@/lib/folder-icons';

// Re-export utilities for consumers that import from this file
export { FOLDER_ICON_OPTIONS, FOLDER_COLORS, isEmojiIcon, getIconComponent };

const ICON_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'folders', label: 'Folders' },
  { id: 'business', label: 'Business' },
  { id: 'documents', label: 'Documents' },
  { id: 'organization', label: 'Organization' },
  { id: 'markers', label: 'Markers' },
  { id: 'people', label: 'People' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'data', label: 'Data' },
  { id: 'security', label: 'Security' },
  { id: 'nature', label: 'Nature' },
  { id: 'misc', label: 'Misc' },
];

interface IconEmojiPickerProps {
  value: string;
  onChange: (value: string) => void;
  color?: string;
}

export function IconEmojiPicker({ value, onChange, color = '#6B7280' }: IconEmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<'icons' | 'emoji'>('icons');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Filter icons by search and category
  const filteredIcons = useMemo(() => {
    let icons = FOLDER_ICON_OPTIONS;

    if (selectedCategory !== 'all') {
      icons = icons.filter(icon => icon.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      icons = icons.filter(icon =>
        icon.label.toLowerCase().includes(query) ||
        icon.id.toLowerCase().includes(query) ||
        icon.category.toLowerCase().includes(query)
      );
    }

    return icons;
  }, [searchQuery, selectedCategory]);

  // Check if current value is an emoji (starts with emoji character or is more than one character and not in icon list)
  const isEmoji = useMemo(() => {
    if (!value) return false;
    return !FOLDER_ICON_OPTIONS.some(icon => icon.id === value);
  }, [value]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji);
  };

  const handleIconClick = (iconId: string) => {
    onChange(iconId);
  };

  // Get the icon component for preview
  const selectedIcon = FOLDER_ICON_OPTIONS.find(icon => icon.id === value);
  const SelectedIconComponent = selectedIcon?.icon;

  return (
    <div className="space-y-3">
      {/* Preview of selected icon/emoji */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-cb-card">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-hover"
          style={{ color }}
        >
          {isEmoji ? (
            <span className="text-2xl">{value}</span>
          ) : SelectedIconComponent ? (
            <SelectedIconComponent className="h-6 w-6" />
          ) : (
            <RemixIcon.RiFolderLine className="h-6 w-6" />
          )}
        </div>
        <div className="text-sm text-ink-soft">
          {isEmoji ? 'Emoji selected' : selectedIcon?.label || 'Select an icon or emoji'}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'icons' | 'emoji')}>
        <TabsList>
          <TabsTrigger value="icons">ICONS</TabsTrigger>
          <TabsTrigger value="emoji">EMOJI</TabsTrigger>
        </TabsList>

        <TabsContent value="icons" className="mt-3 space-y-3">
          {/* Search */}
          <Input
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />

          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {ICON_CATEGORIES.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors border',
                  selectedCategory === category.id
                    ? 'border-cb-ink bg-hover text-ink font-medium'
                    : 'border-transparent bg-hover/50 text-ink-soft hover:bg-hover hover:border-border'
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Icon grid */}
          <ScrollArea className="h-[200px]">
            <div className="grid grid-cols-8 gap-1">
              {filteredIcons.map(icon => {
                const IconComponent = icon.icon;
                const isSelected = value === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => handleIconClick(icon.id)}
                    className={cn(
                      'flex items-center justify-center p-2 rounded-md transition-colors border',
                      isSelected
                        ? 'border-cb-ink bg-hover text-ink'
                        : 'border-transparent hover:bg-hover hover:border-border text-ink-muted'
                    )}
                    title={icon.label}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="text-center text-sm text-ink-muted py-8">
                No icons found
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="emoji" className="mt-3">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.AUTO}
            width="100%"
            height={300}
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
