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
import {
  RiFolderLine,
  RiPriceTag3Line,
  RiFlowChart,
  RiRepeatLine,
  RiOrganizationChart,
  RiLightbulbLine,
} from "@remixicon/react";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

export type SortingCategory = "folders" | "tags" | "rules" | "recurring";

interface CategoryItem {
  id: SortingCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SORTING_CATEGORIES: CategoryItem[] = [
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
    icon: RiFlowChart,
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
    const categoryIds = SORTING_CATEGORIES.map((c) => c.id);
    const wrappedIndex =
      ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
    const categoryId = categoryIds[wrappedIndex];
    const button = buttonRefs.current.get(categoryId);
    button?.focus();
  }, []);

  // Keyboard navigation handler for individual items
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: SortingCategory) => {
      const currentIndex = SORTING_CATEGORIES.findIndex(
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
          focusCategoryByIndex(SORTING_CATEGORIES.length - 1);
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
        "transition-all duration-300 ease-in-out",
        isMounted
          ? "opacity-100 translate-x-0"
          : "opacity-0 -translate-x-2",
        className
      )}
      role="navigation"
      aria-label="Sorting and tagging categories"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-cb-border bg-cb-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary"
          aria-hidden="true"
        >
          <RiOrganizationChart className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold text-cb-ink uppercase tracking-wide"
            id="sorting-category-title"
          >
            Organization
          </h2>
          <p className="text-xs text-cb-ink-muted">
            {SORTING_CATEGORIES.length} categories
          </p>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="sorting-category-title"
      >
        {SORTING_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const Icon = category.icon;
          const count = categoryCounts[category.id];

          return (
            <div
              key={category.id}
              role="listitem"
              className="relative mb-1"
            >
              {/* Active indicator - left border (Loop-style) with smooth transition */}
              <div
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[80%] bg-cb-vibe-orange rounded-r-full",
                  "transition-all duration-200 ease-in-out",
                  isActive
                    ? "opacity-100 scale-y-100"
                    : "opacity-0 scale-y-0"
                )}
                aria-hidden="true"
              />
              <button
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(category.id, el);
                  } else {
                    buttonRefs.current.delete(category.id);
                  }
                }}
                type="button"
                onClick={() => onCategorySelect(category.id)}
                onKeyDown={(e) => handleKeyDown(e, category.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 rounded-lg",
                  "text-left transition-all duration-150 ease-in-out",
                  "hover:bg-muted/50 dark:hover:bg-white/5",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-cb-vibe-orange focus-visible:ring-offset-2",
                  isActive && [
                    "bg-cb-vibe-orange/10 dark:bg-cb-vibe-orange/20",
                    "border-l-0 pl-4", // Offset for the active indicator
                  ]
                )}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}${count !== undefined ? `, ${count} items` : ""}`}
              >
                {/* Icon - with smooth transition on state change */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                    "bg-cb-card border border-cb-border",
                    "transition-all duration-200 ease-in-out",
                    isActive && "border-cb-vibe-orange/30 bg-cb-vibe-orange/10"
                  )}
                  aria-hidden="true"
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors duration-200 ease-in-out",
                      isActive ? "text-cb-vibe-orange" : "text-cb-ink-muted"
                    )}
                  />
                </div>

                {/* Label, Description, and Count */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "block text-sm font-medium truncate",
                        "transition-colors duration-200 ease-in-out",
                        isActive ? "text-cb-vibe-orange" : "text-cb-ink"
                      )}
                    >
                      {category.label}
                    </span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "flex-shrink-0 text-xs tabular-nums",
                          isActive ? "text-cb-vibe-orange/70" : "text-cb-ink-muted"
                        )}
                        aria-hidden="true"
                      >
                        ({count})
                      </span>
                    )}
                  </div>
                  <span className="block text-xs text-cb-ink-muted truncate">
                    {category.description}
                  </span>
                </div>

                {/* Arrow indicator for selection */}
                <div
                  className={cn(
                    "flex-shrink-0 mt-1.5",
                    "transition-all duration-200 ease-in-out",
                    isActive
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-1"
                  )}
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4 text-cb-vibe-orange"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Tips Section */}
      <div className="flex-shrink-0 border-t border-cb-border bg-cb-card/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <RiLightbulbLine
            className="h-4 w-4 text-cb-ink-muted flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-cb-ink-muted uppercase tracking-wide mb-1">
              Quick Tip
            </p>
            <p className="text-xs text-cb-ink-muted leading-relaxed">
              {currentTip}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SortingCategoryPane;
