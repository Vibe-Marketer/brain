import { useState } from "react";
import {
  RiPriceTagLine,
  RiAddLine,
  RiCloseLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCalls: any[];
  onSaveTags: (tags: string[]) => void;
}

export function TagManagementDialog({
  open,
  onOpenChange,
  selectedCalls,
  onSaveTags,
}: TagManagementDialogProps) {
  const [customTag, setCustomTag] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get unique existing tags from selected calls
  const existingTags = Array.from(
    new Set(
      selectedCalls
        .flatMap((call) => call.auto_tags || [])
        .filter((tag) => tag)
    )
  );

  const handleAddCustomTag = () => {
    const trimmed = customTag.trim().toUpperCase();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleToggleExistingTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSave = () => {
    onSaveTags(selectedTags);
    setSelectedTags([]);
    setCustomTag("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Add or modify tags for {selectedCalls.length} selected call
            {selectedCalls.length > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing tags from selected calls */}
          {existingTags.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Current Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {existingTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer h-6 px-2 text-xs"
                    onClick={() => handleToggleExistingTag(tag)}
                  >
                    <RiPriceTagLine className="h-2.5 w-2.5 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Selected/New tags */}
          {selectedTags.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Tags to Apply
              </Label>
              <ScrollArea className="max-h-[120px]">
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="default"
                      className="h-6 px-2 text-xs"
                    >
                      <RiPriceTagLine className="h-2.5 w-2.5 mr-1" />
                      {tag}
                      <Button
                        variant="hollow"
                        size="icon-sm"
                        className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <RiCloseLine className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Add custom tag */}
          <div>
            <Label htmlFor="custom-tag" className="text-sm font-medium mb-2 block">
              Add Custom Tag
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-tag"
                placeholder="Enter tag name..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleAddCustomTag}
                disabled={!customTag.trim()}
                size="sm"
              >
                <RiAddLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => {
              setSelectedTags([]);
              setCustomTag("");
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
