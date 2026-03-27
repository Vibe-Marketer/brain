import { RiPriceTag3Line, RiPriceTagLine } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionButton } from "./ActionButton";

interface TagDropdownProps {
  tags: Array<{ id: string; name: string }>;
  onTag?: (tagId: string) => void;
  onRemoveTag?: () => void;
  onCreateNewTag?: () => void;
}

export function TagDropdown({
  tags,
  onTag,
  onRemoveTag,
  onCreateNewTag,
}: TagDropdownProps) {
  if (!onTag) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={RiPriceTag3Line} label="Tag" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="bg-background border-border z-50 min-w-[200px]">
        {onRemoveTag && (
          <>
            <DropdownMenuItem
              onClick={onRemoveTag}
              className="gap-2 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10"
            >
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                <RiPriceTagLine className="h-3.5 w-3.5" />
              </div>
              <span>Remove Tag</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {tags && tags.length > 0 ? (
          tags.map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              onClick={() => onTag(tag.id)}
              className="gap-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
            >
              <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <RiPriceTag3Line className="h-3.5 w-3.5" />
              </div>
              <span>{tag.name}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="gap-2">
            <div className="p-1.5 rounded-md bg-muted">
              <RiPriceTag3Line className="h-3.5 w-3.5" />
            </div>
            <span>No tags available</span>
          </DropdownMenuItem>
        )}

        {onCreateNewTag && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateNewTag}
              className="gap-2 cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-muted transition-colors">
                <RiPriceTag3Line className="h-3.5 w-3.5" />
              </div>
              <span>Create New Tag</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Keep backward-compatible export
export const CategorizeDropdown = TagDropdown;
