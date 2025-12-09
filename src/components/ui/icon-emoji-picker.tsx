import { useState, useMemo } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import * as RemixIcon from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Comprehensive list of Remix Icons suitable for folders
const FOLDER_ICON_OPTIONS = [
  // Basic folders
  { id: 'folder', label: 'Folder', icon: RemixIcon.RiFolderLine, category: 'folders' },
  { id: 'folder-2', label: 'Folder 2', icon: RemixIcon.RiFolder2Line, category: 'folders' },
  { id: 'folder-3', label: 'Folder 3', icon: RemixIcon.RiFolder3Line, category: 'folders' },
  { id: 'folder-open', label: 'Folder Open', icon: RemixIcon.RiFolderOpenLine, category: 'folders' },
  { id: 'folder-add', label: 'Folder Add', icon: RemixIcon.RiFolderAddLine, category: 'folders' },
  { id: 'folder-download', label: 'Folder Download', icon: RemixIcon.RiFolderDownloadLine, category: 'folders' },
  { id: 'folder-upload', label: 'Folder Upload', icon: RemixIcon.RiFolderUploadLine, category: 'folders' },
  { id: 'folder-lock', label: 'Folder Lock', icon: RemixIcon.RiFolderLockLine, category: 'folders' },
  { id: 'folder-shared', label: 'Folder Shared', icon: RemixIcon.RiFolderSharedLine, category: 'folders' },
  { id: 'folder-user', label: 'Folder User', icon: RemixIcon.RiFolderUserLine, category: 'folders' },

  // Business & Work
  { id: 'briefcase', label: 'Briefcase', icon: RemixIcon.RiBriefcaseLine, category: 'business' },
  { id: 'briefcase-2', label: 'Briefcase 2', icon: RemixIcon.RiBriefcase2Line, category: 'business' },
  { id: 'building', label: 'Building', icon: RemixIcon.RiBuildingLine, category: 'business' },
  { id: 'building-2', label: 'Building 2', icon: RemixIcon.RiBuilding2Line, category: 'business' },
  { id: 'store', label: 'Store', icon: RemixIcon.RiStoreLine, category: 'business' },
  { id: 'bank', label: 'Bank', icon: RemixIcon.RiBankLine, category: 'business' },
  { id: 'government', label: 'Government', icon: RemixIcon.RiGovernmentLine, category: 'business' },
  { id: 'presentation', label: 'Presentation', icon: RemixIcon.RiSlideshowLine, category: 'business' },
  { id: 'calendar', label: 'Calendar', icon: RemixIcon.RiCalendarLine, category: 'business' },
  { id: 'calendar-event', label: 'Calendar Event', icon: RemixIcon.RiCalendarEventLine, category: 'business' },

  // Documents & Files
  { id: 'file', label: 'File', icon: RemixIcon.RiFileLine, category: 'documents' },
  { id: 'file-text', label: 'File Text', icon: RemixIcon.RiFileTextLine, category: 'documents' },
  { id: 'file-list', label: 'File List', icon: RemixIcon.RiFileList2Line, category: 'documents' },
  { id: 'file-copy', label: 'File Copy', icon: RemixIcon.RiFileCopyLine, category: 'documents' },
  { id: 'clipboard', label: 'Clipboard', icon: RemixIcon.RiClipboardLine, category: 'documents' },
  { id: 'article', label: 'Article', icon: RemixIcon.RiArticleLine, category: 'documents' },
  { id: 'newspaper', label: 'Newspaper', icon: RemixIcon.RiNewspaperLine, category: 'documents' },
  { id: 'book-open', label: 'Book Open', icon: RemixIcon.RiBookOpenLine, category: 'documents' },
  { id: 'draft', label: 'Draft', icon: RemixIcon.RiDraftLine, category: 'documents' },
  { id: 'bill', label: 'Bill', icon: RemixIcon.RiBillLine, category: 'documents' },

  // Organization & Storage
  { id: 'archive', label: 'Archive', icon: RemixIcon.RiArchiveLine, category: 'organization' },
  { id: 'inbox', label: 'Inbox', icon: RemixIcon.RiInboxLine, category: 'organization' },
  { id: 'inbox-archive', label: 'Inbox Archive', icon: RemixIcon.RiInboxArchiveLine, category: 'organization' },
  { id: 'database', label: 'Database', icon: RemixIcon.RiDatabase2Line, category: 'organization' },
  { id: 'hard-drive', label: 'Hard Drive', icon: RemixIcon.RiHardDriveLine, category: 'organization' },
  { id: 'sd-card', label: 'SD Card', icon: RemixIcon.RiSdCardLine, category: 'organization' },
  { id: 'stack', label: 'Stack', icon: RemixIcon.RiStackLine, category: 'organization' },
  { id: 'layout', label: 'Layout', icon: RemixIcon.RiLayoutLine, category: 'organization' },
  { id: 'dashboard', label: 'Dashboard', icon: RemixIcon.RiDashboardLine, category: 'organization' },
  { id: 'apps', label: 'Apps', icon: RemixIcon.RiAppsLine, category: 'organization' },

  // Markers & Tags
  { id: 'bookmark', label: 'Bookmark', icon: RemixIcon.RiBookmarkLine, category: 'markers' },
  { id: 'bookmark-2', label: 'Bookmark 2', icon: RemixIcon.RiBookmark2Line, category: 'markers' },
  { id: 'flag', label: 'Flag', icon: RemixIcon.RiFlagLine, category: 'markers' },
  { id: 'flag-2', label: 'Flag 2', icon: RemixIcon.RiFlag2Line, category: 'markers' },
  { id: 'price-tag', label: 'Tag', icon: RemixIcon.RiPriceTag3Line, category: 'markers' },
  { id: 'star', label: 'Star', icon: RemixIcon.RiStarLine, category: 'markers' },
  { id: 'heart', label: 'Heart', icon: RemixIcon.RiHeartLine, category: 'markers' },
  { id: 'award', label: 'Award', icon: RemixIcon.RiAwardLine, category: 'markers' },
  { id: 'medal', label: 'Medal', icon: RemixIcon.RiMedalLine, category: 'markers' },
  { id: 'trophy', label: 'Trophy', icon: RemixIcon.RiTrophyLine, category: 'markers' },

  // People & Communication
  { id: 'user', label: 'User', icon: RemixIcon.RiUserLine, category: 'people' },
  { id: 'group', label: 'Group', icon: RemixIcon.RiGroupLine, category: 'people' },
  { id: 'team', label: 'Team', icon: RemixIcon.RiTeamLine, category: 'people' },
  { id: 'contacts', label: 'Contacts', icon: RemixIcon.RiContactsLine, category: 'people' },
  { id: 'chat', label: 'Chat', icon: RemixIcon.RiChat1Line, category: 'people' },
  { id: 'message', label: 'Message', icon: RemixIcon.RiMessage2Line, category: 'people' },
  { id: 'mail', label: 'Mail', icon: RemixIcon.RiMailLine, category: 'people' },
  { id: 'phone', label: 'Phone', icon: RemixIcon.RiPhoneLine, category: 'people' },
  { id: 'video', label: 'Video', icon: RemixIcon.RiVideoChatLine, category: 'people' },
  { id: 'mic', label: 'Microphone', icon: RemixIcon.RiMicLine, category: 'people' },

  // Ideas & Creativity
  { id: 'lightbulb', label: 'Lightbulb', icon: RemixIcon.RiLightbulbLine, category: 'ideas' },
  { id: 'flashlight', label: 'Flashlight', icon: RemixIcon.RiFlashlightLine, category: 'ideas' },
  { id: 'magic', label: 'Magic', icon: RemixIcon.RiMagicLine, category: 'ideas' },
  { id: 'palette', label: 'Palette', icon: RemixIcon.RiPaletteLine, category: 'ideas' },
  { id: 'pencil', label: 'Pencil', icon: RemixIcon.RiPencilLine, category: 'ideas' },
  { id: 'paint-brush', label: 'Paint Brush', icon: RemixIcon.RiBrush2Line, category: 'ideas' },
  { id: 'compasses', label: 'Compasses', icon: RemixIcon.RiCompassesLine, category: 'ideas' },
  { id: 'ruler', label: 'Ruler', icon: RemixIcon.RiRulerLine, category: 'ideas' },
  { id: 'scissors', label: 'Scissors', icon: RemixIcon.RiScissorsLine, category: 'ideas' },
  { id: 'puzzle', label: 'Puzzle', icon: RemixIcon.RiPuzzleLine, category: 'ideas' },

  // Data & Analytics
  { id: 'line-chart', label: 'Line Chart', icon: RemixIcon.RiLineChartLine, category: 'data' },
  { id: 'bar-chart', label: 'Bar Chart', icon: RemixIcon.RiBarChartLine, category: 'data' },
  { id: 'pie-chart', label: 'Pie Chart', icon: RemixIcon.RiPieChartLine, category: 'data' },
  { id: 'funds', label: 'Funds', icon: RemixIcon.RiFundsLine, category: 'data' },
  { id: 'stock', label: 'Stock', icon: RemixIcon.RiStockLine, category: 'data' },
  { id: 'percent', label: 'Percent', icon: RemixIcon.RiPercentLine, category: 'data' },
  { id: 'calculator', label: 'Calculator', icon: RemixIcon.RiCalculatorLine, category: 'data' },
  { id: 'filter', label: 'Filter', icon: RemixIcon.RiFilterLine, category: 'data' },
  { id: 'search', label: 'Search', icon: RemixIcon.RiSearchLine, category: 'data' },
  { id: 'eye', label: 'Eye', icon: RemixIcon.RiEyeLine, category: 'data' },

  // Security & Privacy
  { id: 'lock', label: 'Lock', icon: RemixIcon.RiLockLine, category: 'security' },
  { id: 'unlock', label: 'Unlock', icon: RemixIcon.RiLockUnlockLine, category: 'security' },
  { id: 'key', label: 'Key', icon: RemixIcon.RiKey2Line, category: 'security' },
  { id: 'shield', label: 'Shield', icon: RemixIcon.RiShieldLine, category: 'security' },
  { id: 'shield-check', label: 'Shield Check', icon: RemixIcon.RiShieldCheckLine, category: 'security' },
  { id: 'shield-star', label: 'Shield Star', icon: RemixIcon.RiShieldStarLine, category: 'security' },
  { id: 'safe', label: 'Safe', icon: RemixIcon.RiSafe2Line, category: 'security' },
  { id: 'fingerprint', label: 'Fingerprint', icon: RemixIcon.RiFingerprintLine, category: 'security' },
  { id: 'spy', label: 'Spy', icon: RemixIcon.RiSpyLine, category: 'security' },
  { id: 'alarm-warning', label: 'Warning', icon: RemixIcon.RiAlarmWarningLine, category: 'security' },

  // Nature & Weather
  { id: 'sun', label: 'Sun', icon: RemixIcon.RiSunLine, category: 'nature' },
  { id: 'moon', label: 'Moon', icon: RemixIcon.RiMoonLine, category: 'nature' },
  { id: 'cloud', label: 'Cloud', icon: RemixIcon.RiCloudLine, category: 'nature' },
  { id: 'drop', label: 'Drop', icon: RemixIcon.RiDropLine, category: 'nature' },
  { id: 'fire', label: 'Fire', icon: RemixIcon.RiFireLine, category: 'nature' },
  { id: 'plant', label: 'Plant', icon: RemixIcon.RiPlantLine, category: 'nature' },
  { id: 'leaf', label: 'Leaf', icon: RemixIcon.RiLeafLine, category: 'nature' },
  { id: 'flower', label: 'Flower', icon: RemixIcon.RiFlowerLine, category: 'nature' },
  { id: 'earth', label: 'Earth', icon: RemixIcon.RiEarthLine, category: 'nature' },
  { id: 'rainbow', label: 'Rainbow', icon: RemixIcon.RiRainbowLine, category: 'nature' },

  // Misc
  { id: 'home', label: 'Home', icon: RemixIcon.RiHomeLine, category: 'misc' },
  { id: 'settings', label: 'Settings', icon: RemixIcon.RiSettings3Line, category: 'misc' },
  { id: 'tools', label: 'Tools', icon: RemixIcon.RiToolsLine, category: 'misc' },
  { id: 'hammer', label: 'Hammer', icon: RemixIcon.RiHammerLine, category: 'misc' },
  { id: 'rocket', label: 'Rocket', icon: RemixIcon.RiRocketLine, category: 'misc' },
  { id: 'plane', label: 'Plane', icon: RemixIcon.RiPlaneLine, category: 'misc' },
  { id: 'car', label: 'Car', icon: RemixIcon.RiCarLine, category: 'misc' },
  { id: 'shopping-bag', label: 'Shopping Bag', icon: RemixIcon.RiShoppingBagLine, category: 'misc' },
  { id: 'gift', label: 'Gift', icon: RemixIcon.RiGiftLine, category: 'misc' },
  { id: 'cake', label: 'Cake', icon: RemixIcon.RiCake2Line, category: 'misc' },
];

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
      <div className="flex items-center gap-3 p-3 rounded-lg border border-cb-border bg-cb-card">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-cb-hover"
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
        <div className="text-sm text-cb-ink-soft">
          {isEmoji ? 'Emoji selected' : selectedIcon?.label || 'Select an icon or emoji'}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'icons' | 'emoji')}>
        <TabsList className="w-full">
          <TabsTrigger value="icons" className="flex-1 uppercase">ICONS</TabsTrigger>
          <TabsTrigger value="emoji" className="flex-1 uppercase">EMOJI</TabsTrigger>
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
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  selectedCategory === category.id
                    ? 'bg-cb-ink text-cb-paper'
                    : 'bg-cb-hover text-cb-ink-soft hover:bg-cb-border'
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
                      'flex items-center justify-center p-2 rounded-md transition-colors',
                      isSelected
                        ? 'bg-cb-ink text-cb-paper'
                        : 'hover:bg-cb-hover text-cb-ink-muted'
                    )}
                    title={icon.label}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="text-center text-sm text-cb-ink-muted py-8">
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

// Export the icon options for use elsewhere
export { FOLDER_ICON_OPTIONS };
