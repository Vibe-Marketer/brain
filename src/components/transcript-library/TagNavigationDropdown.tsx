import { RiFolderOpenLine, RiArrowDownSLine, RiSettingsLine, RiCloseCircleLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  description: string | null;
}

interface TagNavigationDropdownProps {
  selectedTag: string | null;
  tags: Tag[];
  onTagSelect: (id: string | null) => void;
  onManageTags: () => void;
  callCounts?: Record<string, number>;
}

export function TagNavigationDropdown({
  selectedTag,
  tags,
  onTagSelect,
  onManageTags,
  callCounts = {},
}: TagNavigationDropdownProps) {
  const currentTag = selectedTag
    ? tags.find((t) => t.id === selectedTag)
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="hollow"
          className="gap-2 h-9 px-3 border-dashed hover:bg-accent"
        >
          <RiFolderOpenLine className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {currentTag?.name || "All Calls"}
          </span>
          <RiArrowDownSLine className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="max-h-80">
          <div className="space-y-1">
            {/* All Transcripts */}
            <button
              onClick={() => onTagSelect(null)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                selectedTag === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <RiFolderOpenLine className="h-4 w-4" />
                All Transcripts
              </span>
              {callCounts["all"] !== undefined && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  {callCounts["all"]}
                </Badge>
              )}
            </button>

            {/* Separator */}
            {tags.length > 0 && (
              <div className="my-2 border-t" />
            )}

            {/* Tags */}
            {tags.map((tag) => {
              const isSkipTag = tag.name === 'SKIP';
              const TagIcon = isSkipTag ? RiCloseCircleLine : RiFolderOpenLine;
              const iconClasses = isSkipTag
                ? "h-4 w-4 flex-shrink-0 text-destructive"
                : "h-4 w-4 flex-shrink-0";

              return (
                <button
                  key={tag.id}
                  onClick={() => onTagSelect(tag.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                    selectedTag === tag.id
                      ? isSkipTag
                        ? "bg-destructive/10 text-destructive font-medium"
                        : "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <TagIcon className={iconClasses} />
                    <span className="truncate">{tag.name}</span>
                  </span>
                  {callCounts[tag.id] !== undefined && (
                    <Badge
                      variant={isSkipTag ? "destructive" : "secondary"}
                      className="h-5 px-2 text-xs ml-2"
                    >
                      {callCounts[tag.id]}
                    </Badge>
                  )}
                </button>
              );
            })}

            {/* Manage Tags Link */}
            <div className="mt-2 pt-2 border-t">
              <button
                onClick={onManageTags}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <RiSettingsLine className="h-4 w-4" />
                Manage Tags...
              </button>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Backward compatibility export
export const CategoryNavigationDropdown = TagNavigationDropdown;
