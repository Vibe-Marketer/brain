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
  RiDashboardFill,
  RiTimeLine,
  RiTimeFill,
  RiGroupLine,
  RiGroupFill,
  RiSpeakLine,
  RiSpeakFill,
  RiPriceTag3Line,
  RiPriceTag3Fill,
  RiFilmLine,
  RiFilmFill,
  RiPieChart2Line,
} from "@remixicon/react";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

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
  /** Filled icon variant for active/selected state (optional - falls back to line icon with orange color) */
  iconFill?: React.ComponentType<{ className?: string }>;
}

export const ANALYTICS_CATEGORIES: CategoryItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "KPIs and call volume trends",
    icon: RiDashboardLine,
    iconFill: RiDashboardFill,
  },
  {
    id: "duration",
    label: "Call Duration",
    description: "Duration distribution and averages",
    icon: RiTimeLine,
    iconFill: RiTimeFill,
  },
  {
    id: "participation",
    label: "Participation & Speakers",
    description: "Attendee metrics and trends",
    icon: RiGroupLine,
    iconFill: RiGroupFill,
  },
  {
    id: "talktime",
    label: "Talk Time & Engagement",
    description: "Talk time and monologue analysis",
    icon: RiSpeakLine,
    iconFill: RiSpeakFill,
  },
  {
    id: "tags",
    label: "Tags & Categories",
    description: "Calls and minutes by tag",
    icon: RiPriceTag3Line,
    iconFill: RiPriceTag3Fill,
  },
  {
    id: "content",
    label: "Content Created",
    description: "Clips tracking and performance",
    icon: RiFilmLine,
    iconFill: RiFilmFill,
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

  // Get the current focused category index
  const getFocusedIndex = React.useCallback(() => {
    const focused = document.activeElement as HTMLElement;
    const entries = Array.from(buttonRefs.current.entries());
    return entries.findIndex(([, el]) => el === focused);
  }, []);

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
        "transition-all duration-300 ease-in-out",
        isMounted
          ? "opacity-100 translate-x-0"
          : "opacity-0 -translate-x-2",
        className
      )}
      role="navigation"
      aria-label="Analytics categories"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-cb-border bg-cb-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
          aria-hidden="true"
        >
          <RiPieChart2Line className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold text-ink uppercase tracking-wide"
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
          // Use filled icon variant when active, fall back to line icon
          const IconComponent =
            isActive && category.iconFill ? category.iconFill : category.icon;

          return (
            <div key={category.id} role="listitem" className="relative mb-1">
              {/* Active indicator - pill shape (Loop-style) with smooth transition */}
              <div
                className={cn(
                  "absolute left-1 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-vibe-orange rounded-full",
                  "transition-all duration-200 ease-in-out",
                  isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
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
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                  isActive && [
                    "bg-gray-100 dark:bg-gray-800",
                    "border-l-0 pl-4", // Offset for the active indicator
                  ]
                )}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}`}
              >
                {/* Icon - with smooth transition on state change */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
                    "bg-cb-card border border-cb-border",
                    "transition-all duration-200 ease-in-out",
                    isActive && "border-vibe-orange/30 bg-vibe-orange/10"
                  )}
                  aria-hidden="true"
                >
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-200 ease-in-out",
                      isActive ? "text-vibe-orange" : "text-ink-muted"
                    )}
                  />
                </div>

                {/* Label and Description */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <span
                    className={cn(
                      "block text-sm font-medium truncate",
                      "transition-colors duration-200 ease-in-out",
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
                    "transition-all duration-200 ease-in-out",
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
