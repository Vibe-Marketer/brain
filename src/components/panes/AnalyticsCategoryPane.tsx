/**
 * Analytics Category Pane (2nd Pane)
 *
 * Displays a list of analytics categories for multi-pane navigation.
 * All categories are visible to all users (no role filtering).
 *
 * ## Design Specification
 *
 * - **Position**: 2nd pane in the multi-pane layout (after sidebar)
 * - **Width**: 280px (fixed)
 * - **Purpose**: Category selection to trigger 3rd pane detail view
 * - **Pattern**: Microsoft Loop-inspired navigation
 *
 * @pattern analytics-category-pane
 * @see docs/planning/settings-pane-allocation.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  RiDashboardLine,
  RiTimeLine,
  RiGroupLine,
  RiSpeakLine,
  RiPriceTag3Line,
  RiFilmLine,
  RiPieChart2Line,
} from "@remixicon/react";

export type AnalyticsCategory =
  | "overview"
  | "duration"
  | "participation"
  | "talktime"
  | "tags"
  | "content";

interface CategoryItem {
  id: AnalyticsCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ANALYTICS_CATEGORIES: CategoryItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "KPIs and call volume trends",
    icon: RiDashboardLine,
  },
  {
    id: "duration",
    label: "Call Duration",
    description: "Duration distribution and averages",
    icon: RiTimeLine,
  },
  {
    id: "participation",
    label: "Participation & Speakers",
    description: "Attendee metrics and trends",
    icon: RiGroupLine,
  },
  {
    id: "talktime",
    label: "Talk Time & Engagement",
    description: "Talk time and monologue analysis",
    icon: RiSpeakLine,
  },
  {
    id: "tags",
    label: "Tags & Categories",
    description: "Calls and minutes by tag",
    icon: RiPriceTag3Line,
  },
  {
    id: "content",
    label: "Content Created",
    description: "Clips tracking and performance",
    icon: RiFilmLine,
  },
];

interface AnalyticsCategoryPaneProps {
  /** Currently selected category ID */
  selectedCategory: AnalyticsCategory | null;
  /** Callback when a category is clicked */
  onCategorySelect: (category: AnalyticsCategory) => void;
  /** Additional CSS classes */
  className?: string;
}

export function AnalyticsCategoryPane({
  selectedCategory,
  onCategorySelect,
  className,
}: AnalyticsCategoryPaneProps) {
  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Refs for category buttons to enable focus management
  const buttonRefs = React.useRef<Map<AnalyticsCategory, HTMLButtonElement>>(
    new Map()
  );

  // Focus a category by index (wraps around)
  const focusCategoryByIndex = React.useCallback((index: number) => {
    const categoryIds = ANALYTICS_CATEGORIES.map((c) => c.id);
    const wrappedIndex =
      ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
    const categoryId = categoryIds[wrappedIndex];
    const button = buttonRefs.current.get(categoryId);
    button?.focus();
  }, []);

  // Keyboard navigation handler for individual items
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: AnalyticsCategory) => {
      const currentIndex = ANALYTICS_CATEGORIES.findIndex(
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
          focusCategoryByIndex(ANALYTICS_CATEGORIES.length - 1);
          break;
      }
    },
    [onCategorySelect, focusCategoryByIndex]
  );

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
      aria-label="Analytics categories"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
          aria-hidden="true"
        >
          <RiPieChart2Line className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-bold text-ink uppercase tracking-wide"
            id="analytics-category-title"
          >
            Analytics
          </h2>
          <p className="text-xs text-ink-muted">6 categories</p>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="analytics-category-title"
      >
        {ANALYTICS_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const IconComponent = category.icon;

          return (
            <div key={category.id} role="listitem" className="relative mb-1">
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
                  "relative w-full flex items-start gap-3 px-3 py-3 rounded-lg",
                  "text-left transition-all duration-150 ease-in-out",
                  "hover:bg-hover/70",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                  isActive && [
                    "bg-hover",
                    "border-l-0 pl-4", // Offset for the active indicator
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                  ]
                )}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}`}
              >
                {/* Icon - with smooth transition on state change */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                    "bg-cb-card border border-border",
                    "transition-all duration-500 ease-in-out",
                    isActive && "border-vibe-orange/30 bg-vibe-orange/10"
                  )}
                  aria-hidden="true"
                >
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-500 ease-in-out",
                      isActive ? "text-vibe-orange" : "text-ink-muted"
                    )}
                  />
                </div>

                {/* Label and Description */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span
                    className={cn(
                      "block text-sm font-medium truncate",
                      "transition-colors duration-500 ease-in-out",
                      isActive ? "text-vibe-orange" : "text-ink"
                    )}
                  >
                    {category.label}
                  </span>
                  <span className="block text-xs text-ink-muted truncate">
                    {category.description}
                  </span>
                </div>

                {/* Arrow indicator for selection */}
                <div
                  className={cn(
                    "flex-shrink-0 mt-1.5",
                    "transition-all duration-500 ease-in-out",
                    isActive
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-1"
                  )}
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4 text-vibe-orange"
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
    </div>
  );
}

export default AnalyticsCategoryPane;
