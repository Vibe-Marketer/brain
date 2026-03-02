import { useState } from 'react';
import { 
  RiFolderLine, 
  RiFolder2Line, 
  RiFolder3Line, 
  RiFolderChartLine,
  RiFolderHistoryLine,
  RiFolderKeyholeLine,
  RiFolderLockLine,
  RiFolderMusicLine,
  RiFolderOpenLine,
  RiFolderShieldLine,
  RiFolderUserLine,
  RiFolderVideoLine,
  RiFolderZipLine,
  RiHomeLine,
  RiUserLine,
  RiTeamLine,
  RiCustomerService2Line,
  RiBriefcaseLine,
  RiLightbulbLine,
  RiStarLine,
  RiFlagLine,
  RiPriceTag3Line,
  RiArchiveLine,
  RiInboxLine,
  RiArrowDownSLine
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const COMMON_ICONS = [
  { id: 'folder', icon: RiFolderLine },
  { id: 'folder-2', icon: RiFolder2Line },
  { id: 'folder-3', icon: RiFolder3Line },
  { id: 'briefcase', icon: RiBriefcaseLine },
  { id: 'home', icon: RiHomeLine },
  { id: 'user', icon: RiUserLine },
  { id: 'team', icon: RiTeamLine },
  { id: 'star', icon: RiStarLine },
  { id: 'lightbulb', icon: RiLightbulbLine },
  { id: 'flag', icon: RiFlagLine },
];

const MORE_ICONS = [
  { id: 'folder-chart', icon: RiFolderChartLine },
  { id: 'folder-history', icon: RiFolderHistoryLine },
  { id: 'folder-keyhole', icon: RiFolderKeyholeLine },
  { id: 'folder-lock', icon: RiFolderLockLine },
  { id: 'folder-music', icon: RiFolderMusicLine },
  { id: 'folder-open', icon: RiFolderOpenLine },
  { id: 'folder-shield', icon: RiFolderShieldLine },
  { id: 'folder-user', icon: RiFolderUserLine },
  { id: 'folder-video', icon: RiFolderVideoLine },
  { id: 'folder-zip', icon: RiFolderZipLine },
  { id: 'customer-service', icon: RiCustomerService2Line },
  { id: 'price-tag', icon: RiPriceTag3Line },
  { id: 'archive', icon: RiArchiveLine },
  { id: 'inbox', icon: RiInboxLine },
];

interface IconPickerInlineProps {
  value: string; // The ID of the icon
  onChange: (iconId: string) => void;
  className?: string;
}

export function IconPickerInline({ value, onChange, className }: IconPickerInlineProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleIconSelect = (iconId: string) => {
    onChange(iconId);
    setPopoverOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {/* Quick icon buttons */}
      {COMMON_ICONS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleIconSelect(item.id)}
            className={cn(
              "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded transition-all",
              "hover:bg-muted border border-transparent",
              value === item.id && "border-primary bg-primary/10 text-primary scale-105"
            )}
            title={item.id}
          >
            <Icon size={18} />
          </button>
        );
      })}

      {/* More button with popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 px-2 flex-shrink-0 flex items-center gap-1 rounded text-xs",
              "bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            )}
          >
            More
            <RiArrowDownSLine className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-48 p-2 border border-border bg-popover shadow-md overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <div className="grid grid-cols-4 gap-1">
            {MORE_ICONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleIconSelect(item.id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded transition-all",
                    "hover:bg-muted",
                    value === item.id && "bg-primary/10 text-primary"
                  )}
                  title={item.id}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function getIconById(id: string) {
  const item = [...COMMON_ICONS, ...MORE_ICONS].find(i => i.id === id);
  return item ? item.icon : RiFolderLine;
}
