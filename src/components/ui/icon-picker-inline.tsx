import { useState, useMemo } from 'react';
import { 
  RiFolderLine,
  RiArrowDownSLine,
  RiSearchLine
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FOLDER_ICON_OPTIONS } from '@/lib/folder-icons';
import { Input } from './input';

interface IconPickerInlineProps {
  value: string; // The ID of the icon
  onChange: (iconId: string) => void;
  className?: string;
}

// Show first 10 icons as quick picks
const QUICK_ICONS = FOLDER_ICON_OPTIONS.slice(0, 10);

export function IconPickerInline({ value, onChange, className }: IconPickerInlineProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search) return FOLDER_ICON_OPTIONS;
    const lowerSearch = search.toLowerCase();
    return FOLDER_ICON_OPTIONS.filter(
      opt => opt.label.toLowerCase().includes(lowerSearch) || 
             opt.id.toLowerCase().includes(lowerSearch) ||
             opt.category.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  // Group by category for the popover
  const groupedIcons = useMemo(() => {
    const groups: Record<string, typeof FOLDER_ICON_OPTIONS> = {};
    filteredIcons.forEach(icon => {
      if (!groups[icon.category]) groups[icon.category] = [];
      groups[icon.category].push(icon);
    });
    return groups;
  }, [filteredIcons]);

  const handleIconSelect = (iconId: string) => {
    onChange(iconId);
    setPopoverOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {/* Quick icon buttons */}
      {QUICK_ICONS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleIconSelect(item.id)}
            className={cn(
              "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded transition-all",
              "hover:bg-muted border border-transparent",
              value === item.id && "border-vibe-orange bg-vibe-orange/10 text-vibe-orange scale-105"
            )}
            title={item.label}
          >
            <Icon className="w-[18px] h-[18px]" />
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
          className="w-72 p-3 border border-border bg-popover shadow-md overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <div className="space-y-3">
            <div className="relative">
              <RiSearchLine className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search icons..."
                className="pl-7 h-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-4 custom-scrollbar">
              {Object.entries(groupedIcons).map(([category, icons]) => (
                <div key={category} className="space-y-1.5">
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-1">
                    {category}
                  </h4>
                  <div className="grid grid-cols-6 gap-0.5">
                    {icons.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleIconSelect(item.id)}
                          className={cn(
                            "w-9 h-9 flex items-center justify-center rounded transition-all",
                            "hover:bg-muted",
                            value === item.id && "bg-vibe-orange/10 text-vibe-orange"
                          )}
                          title={item.label}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredIcons.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No icons found
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function getIconById(id: string) {
  const item = FOLDER_ICON_OPTIONS.find(i => i.id === id);
  return item ? item.icon : RiFolderLine;
}
