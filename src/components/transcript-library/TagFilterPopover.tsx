import { RiPriceTag3Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { FilterButton } from "./FilterButton";
import { logger } from "@/lib/logger";

interface TagFilterPopoverProps {
  selectedTags?: string[];
  tags: any[];
  onTagsChange: (tags: string[]) => void;
}

export function TagFilterPopover({
  selectedTags = [],
  tags,
  onTagsChange,
}: TagFilterPopoverProps) {
  const handleTagToggle = (tagId: string, checked: boolean) => {
    if (checked) {
      onTagsChange([...selectedTags, tagId]);
    } else {
      onTagsChange(selectedTags.filter((id) => id !== tagId));
    }
  };

  const handleCreateTag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('tagName') as string;

    if (!name?.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("call_tags")
        .insert({ name: name.trim(), user_id: user.id });

      if (error) throw error;

      e.currentTarget.reset();
    } catch (error) {
      logger.error("Error creating tag", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiPriceTag3Line className="h-3.5 w-3.5" />}
          label="Tag"
          count={selectedTags.length}
          active={selectedTags.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-card" align="start">
        <div className="space-y-0">
          <div className="p-4 pb-3">
            <div className="text-sm font-medium">Select Tags</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto px-2 pb-2">
            {tags.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center px-2">
                No tags yet. Add one below.
              </div>
            ) : (
              <div className="space-y-2 px-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={(checked) => handleTagToggle(tag.id, !!checked)}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tag.description}
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t p-3">
            <form onSubmit={handleCreateTag} className="flex gap-2">
              <Input
                name="tagName"
                placeholder="New tag name"
                className="h-8 text-xs flex-1"
                maxLength={50}
                required
              />
              <Button type="submit" size="sm" className="h-8 text-xs">
                Add
              </Button>
            </form>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Keep backward-compatible export
export const CategoryFilterPopover = TagFilterPopover;
