import { useState, useCallback, useEffect } from "react";
import { RiBookmarkLine, RiCloseLine, RiCheckLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import type { ContentType, ContentMetadata } from "@/types/content-library";
import { normalizeTags, addTag, removeTag, getTagSuggestions } from "@/lib/tag-utils";

/**
 * Content types with labels for display
 */
const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social Post" },
  { value: "testimonial", label: "Testimonial" },
  { value: "insight", label: "Insight" },
  { value: "other", label: "Other" },
];

/**
 * Generate a default title from content
 */
function generateDefaultTitle(content: string, maxLength: number = 50): string {
  if (!content || content.trim().length === 0) {
    return "Untitled Content";
  }

  // Take first line or first X characters
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  // Truncate at word boundary
  const truncated = firstLine.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength / 2) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

interface SaveContentButtonProps {
  /**
   * The content to save
   */
  content: string;
  /**
   * Optional metadata to attach (e.g., source, meeting_id)
   */
  metadata?: ContentMetadata;
  /**
   * Variant for button styling
   */
  variant?: "ghost" | "outline" | "default";
  /**
   * Size for button styling
   */
  size?: "icon" | "icon-sm" | "sm" | "default";
  /**
   * Additional CSS class for the button
   */
  className?: string;
  /**
   * Callback after successful save
   */
  onSaved?: () => void;
}

/**
 * Save Content Button
 *
 * A button that opens a dialog to save AI-generated content to the library.
 * Pre-fills the content and allows users to set title, type, and tags.
 */
export function SaveContentButton({
  content,
  metadata,
  variant = "ghost",
  size = "icon-sm",
  className,
  onSaved,
}: SaveContentButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("other");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Store
  const saveContentItem = useContentLibraryStore((state) => state.saveContentItem);
  const availableTags = useContentLibraryStore((state) => state.availableTags);
  const fetchTags = useContentLibraryStore((state) => state.fetchTags);

  // Fetch available tags when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      fetchTags();
    }
  }, [isDialogOpen, fetchTags]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setTitle(generateDefaultTitle(content));
      setContentType(inferContentType(content, metadata));
      setTags([]);
      setTagInput("");
      setIsSaved(false);
    }
  }, [isDialogOpen, content, metadata]);

  /**
   * Infer content type from content/metadata
   */
  function inferContentType(content: string, metadata?: ContentMetadata): ContentType {
    // Check metadata source first
    if (metadata?.source) {
      const source = metadata.source.toLowerCase();
      if (source.includes("email") || source.includes("follow_up")) {
        return "email";
      }
      if (source.includes("social") || source.includes("post")) {
        return "social";
      }
      if (source.includes("testimonial")) {
        return "testimonial";
      }
      if (source.includes("insight") || source.includes("summary")) {
        return "insight";
      }
    }

    // Try to infer from content
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes("subject:") || lowerContent.includes("dear ") || lowerContent.includes("hi ") && lowerContent.includes("regards")) {
      return "email";
    }
    if (lowerContent.includes("#") && (lowerContent.includes("instagram") || lowerContent.includes("twitter") || lowerContent.includes("linkedin"))) {
      return "social";
    }

    return "other";
  }

  /**
   * Handle adding a tag
   */
  const handleAddTag = useCallback(
    (tag: string) => {
      const newTags = addTag(tags, tag);
      setTags(newTags);
      setTagInput("");
      setShowTagSuggestions(false);
    },
    [tags]
  );

  /**
   * Handle removing a tag
   */
  const handleRemoveTag = useCallback(
    (tag: string) => {
      const newTags = removeTag(tags, tag);
      setTags(newTags);
    },
    [tags]
  );

  /**
   * Handle tag input key events
   */
  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        handleAddTag(tagInput.trim());
      } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
        // Remove last tag on backspace when input is empty
        handleRemoveTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setShowTagSuggestions(false);
      }
    },
    [tagInput, tags, handleAddTag, handleRemoveTag]
  );

  /**
   * Get tag suggestions
   */
  const tagSuggestions = tagInput
    ? getTagSuggestions(tagInput, availableTags, { limit: 5 })
    : [];

  /**
   * Handle save
   */
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await saveContentItem({
        title: title.trim(),
        content,
        content_type: contentType,
        tags: normalizeTags(tags),
        metadata: metadata || {},
      });

      if (result) {
        setIsSaved(true);
        toast.success("Content saved to library");
        onSaved?.();

        // Close dialog after brief success state
        setTimeout(() => {
          setIsDialogOpen(false);
        }, 1000);
      } else {
        toast.error("Failed to save content");
      }
    } catch (error) {
      toast.error("Failed to save content");
    } finally {
      setIsSaving(false);
    }
  };

  // Don't render if no content
  if (!content || content.trim().length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        className={className}
        title="Save to library"
      >
        <RiBookmarkLine className="h-4 w-4" />
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Save to Library</DialogTitle>
            <DialogDescription>
              Save this content to your library for later use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="save-title">Title</Label>
              <Input
                id="save-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this content"
                maxLength={255}
              />
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <Label htmlFor="save-type">Content Type</Label>
              <Select
                value={contentType}
                onValueChange={(value) => setContentType(value as ContentType)}
              >
                <SelectTrigger id="save-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="save-tags">Tags</Label>
              <div className="relative">
                <div className="flex flex-wrap items-center gap-1 p-2 border rounded-md bg-background min-h-[40px]">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      >
                        <RiCloseLine className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    id="save-tags"
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(e.target.value.length > 0);
                    }}
                    onKeyDown={handleTagInputKeyDown}
                    onFocus={() => setShowTagSuggestions(tagInput.length > 0)}
                    onBlur={() => {
                      // Delay hiding to allow click on suggestions
                      setTimeout(() => setShowTagSuggestions(false), 200);
                    }}
                    placeholder={tags.length === 0 ? "Add tags..." : ""}
                    className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm"
                  />
                </div>

                {/* Tag suggestions dropdown */}
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 py-1">
                    {tagSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleAddTag(suggestion)}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter to add a tag, Backspace to remove the last one
              </p>
            </div>

            {/* Content Preview */}
            <div className="space-y-2">
              <Label>Content Preview</Label>
              <div className="p-3 bg-muted rounded-md max-h-32 overflow-y-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {content}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="hollow"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isSaved || !title.trim()}
            >
              {isSaved ? (
                <>
                  <RiCheckLine className="h-4 w-4 mr-1" />
                  Saved
                </>
              ) : isSaving ? (
                "Saving..."
              ) : (
                "Save to Library"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SaveContentButton;
