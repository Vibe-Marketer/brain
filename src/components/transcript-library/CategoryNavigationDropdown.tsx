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

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface CategoryNavigationDropdownProps {
  selectedCategory: string | null;
  categories: Category[];
  onCategorySelect: (id: string | null) => void;
  onManageCategories: () => void;
  callCounts?: Record<string, number>;
}

export function CategoryNavigationDropdown({
  selectedCategory,
  categories,
  onCategorySelect,
  onManageCategories,
  callCounts = {},
}: CategoryNavigationDropdownProps) {
  const currentCategory = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
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
            {currentCategory?.name || "All Calls"}
          </span>
          <RiArrowDownSLine className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="max-h-80">
          <div className="space-y-1">
            {/* All Transcripts */}
            <button
              onClick={() => onCategorySelect(null)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                selectedCategory === null
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
            {categories.length > 0 && (
              <div className="my-2 border-t" />
            )}

            {/* Categories */}
            {categories.map((category) => {
              const isSkipCategory = category.name === 'SKIP';
              const CategoryIcon = isSkipCategory ? RiCloseCircleLine : RiFolderOpenLine;
              const iconClasses = isSkipCategory 
                ? "h-4 w-4 flex-shrink-0 text-destructive" 
                : "h-4 w-4 flex-shrink-0";
              
              return (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                    selectedCategory === category.id
                      ? isSkipCategory
                        ? "bg-destructive/10 text-destructive font-medium"
                        : "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <CategoryIcon className={iconClasses} />
                    <span className="truncate">{category.name}</span>
                  </span>
                  {callCounts[category.id] !== undefined && (
                    <Badge 
                      variant={isSkipCategory ? "destructive" : "secondary"} 
                      className="h-5 px-2 text-xs ml-2"
                    >
                      {callCounts[category.id]}
                    </Badge>
                  )}
                </button>
              );
            })}

            {/* Manage Categories Link */}
            <div className="mt-2 pt-2 border-t">
              <button
                onClick={onManageCategories}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <RiSettingsLine className="h-4 w-4" />
                Manage Categories...
              </button>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
