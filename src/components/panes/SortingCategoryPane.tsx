/**
 * Sorting Category Pane (2nd Pane)
 *
 * Displays a list of sorting/tagging categories for multi-pane navigation.
 * Categories: Folders, Tags, Rules, Recurring Titles
 *
 * ## Design Specification
 *
 * - **Position**: 2nd pane in the multi-pane layout (after sidebar)
 * - **Width**: 260px (fixed)
 * - **Purpose**: Category selection to trigger 3rd pane management view
 * - **Pattern**: Microsoft Loop-inspired navigation
 *
 * @pattern sorting-category-pane
 * @see docs/planning/sorting-tagging-pane-allocation.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { SelectionButton } from "@/components/ui/selection-button";
import {
  RiFolderLine,
  RiPriceTag3Line,
  RiSettings3Line,
  RiRepeatLine,
  RiOrganizationChart,
  RiLightbulbLine,
} from "@remixicon/react";

export type SortingCategory = "folders" | "tags" | "rules" | "recurring";

interface CategoryItem {
  id: SortingCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SORTING_CATEGORIES_BASE: CategoryItem[] = [
  {
    id: "folders",
    label: "Folders",
    description: "Manage folder hierarchy",
    icon: RiFolderLine,
  },
  {
    id: "tags",
    label: "Tags",
    description: "View and edit call tags",
    icon: RiPriceTag3Line,
  },
  {
    id: "rules",
    label: "Rules",
    description: "Configure auto-sorting",
    icon: RiSettings3Line,
  },
  {
    id: "recurring",
    label: "Recurring Titles",
    description: "Create rules from patterns",
    icon: RiRepeatLine,
  },
];



/** Contextual tips that change based on selected category */
const QUICK_TIPS: Record<SortingCategory, string> = {
  folders:
    "Folders organize calls for browsing. They don't affect AI analysis.",
  tags: "Tags classify calls and control AI behavior. System tags cannot be modified.",
  rules:
    "Rules automatically tag and sort incoming calls. Higher priority rules run first.",
  recurring:
    "Recurring titles show your most common calls. Create rules to automate sorting.",
};

interface SortingCategoryPaneProps {
  /** Currently selected category ID */
  selectedCategory: SortingCategory | null;
  /** Callback when a category is clicked */
  onCategorySelect: (category: SortingCategory) => void;
  /** Optional counts per category */
  categoryCounts?: Partial<Record<SortingCategory, number>>;
  /** Additional CSS classes */
  className?: string;
}

export function SortingCategoryPane({
  selectedCategory,
  onCategorySelect,
  categoryCounts = {},
  className,
}: SortingCategoryPaneProps) {
  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Refs for category buttons to enable focus management
  const buttonRefs = React.useRef<Map<SortingCategory, HTMLButtonElement>>(
    new Map()
  );

  // Focus a category by index (wraps around)
  const focusCategoryByIndex = React.useCallback((index: number) => {
    const categoryIds = SORTING_CATEGORIES_BASE.map((c) => c.id);
    const wrappedIndex =
      ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
    const categoryId = categoryIds[wrappedIndex];
    const button = buttonRefs.current.get(categoryId);
    button?.focus();
  }, []);

  // Keyboard navigation handler for individual items
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: SortingCategory) => {
      const currentIndex = SORTING_CATEGORIES_BASE.findIndex(
        (c) => c.id === categoryId
      );

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          onCategorySelect(categoryId);
          break;
        case "ArrowDown":
          event.preventDefault();
          focusCategoryByIndex(currentIndex + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusCategoryByIndex(currentIndex - 1);
          break;
        case "Home":
          event.preventDefault();
          focusCategoryByIndex(0);
          break;
        case "End":
          event.preventDefault();
          focusCategoryByIndex(SORTING_CATEGORIES_BASE.length - 1);
          break;
      }
    },
    [onCategorySelect, focusCategoryByIndex]
  );

  // Get current quick tip based on selected category
  const currentTip = selectedCategory
    ? QUICK_TIPS[selectedCategory]
    : QUICK_TIPS.folders;

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        // Pane enter animation (slide + fade)
        "transition-all duration-500 ease-in-out",
        isMounted
          ? "opacity-100 translate-x-0"
          : "opacity-0 -translate-x-2",
        className
      )}
      role="navigation"
      aria-label="Sorting and tagging categories"
    >
      {/* Header */}
      <header className="px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiOrganizationChart className="h-4 w-4 text-vibe-orange" />
            </div>
            <div>
              <h2
                className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none"
                id="sorting-category-title"
              >
                Sorting & Tagging
              </h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">Organize Your Calls</p>
            </div>
          </div>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="sorting-category-title"
      >
        {SORTING_CATEGORIES_BASE.map((category) => {
          const isActive = selectedCategory === category.id;
          const IconComponent = category.icon;
          const count = categoryCounts[category.id];
          const labelWithCount = count !== undefined
            ? `${category.label} (${count})`
            : category.label;

          return (
            <div
              key={category.id}
              role="listitem"
              className="relative mb-1"
            >
              <SelectionButton
                ref={((el: HTMLButtonElement | null) => {
                  if (el) {
                    buttonRefs.current.set(category.id, el);
                  } else {
                    buttonRefs.current.delete(category.id);
                  }
                }) as unknown as React.Ref<HTMLElement>}
                selected={isActive}
                icon={
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                }
                label={labelWithCount}
                description={category.description}
                size="sm"
                showChevron
                onClick={() => onCategorySelect(category.id)}
                onKeyDown={(e) => handleKeyDown(e, category.id)}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}${count !== undefined ? `, ${count} items` : ""}`}
              />
            </div>
          );
        })}
      </div>

      {/* Quick Tips Section */}
      <footer className="shrink-0 bg-cb-card/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <RiLightbulbLine
            className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Quick Tip
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentTip}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SortingCategoryPane;
