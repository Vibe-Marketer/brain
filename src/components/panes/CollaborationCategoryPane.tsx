/**
 * Collaboration Category Pane (2nd Pane)
 *
 * Displays a list of collaboration categories for multi-pane navigation.
 * Team category is role-filtered (TEAM/ADMIN).
 *
 * ## Design Specification
 *
 * - **Position**: 2nd pane in the multi-pane layout (after sidebar)
 * - **Width**: 280px (fixed)
 * - **Purpose**: Category selection to trigger 3rd pane detail view
 * - **Pattern**: Microsoft Loop-inspired navigation
 *
 * @pattern collaboration-category-pane
 * @see docs/planning/settings-pane-allocation.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  RiTeamLine,
  RiGroupLine,
} from "@remixicon/react";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

export type CollaborationCategory = "team";

interface CategoryItem {
  id: CollaborationCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Filled icon variant for active/selected state (optional - falls back to line icon with orange color) */
  iconFill?: React.ComponentType<{ className?: string }>;
  /** Roles required to see this category. Empty array = visible to all. */
  requiredRoles?: Array<"ADMIN" | "TEAM">;
}

export const COLLABORATION_CATEGORIES: CategoryItem[] = [
  {
    id: "team",
    label: "Team",
    description: "Team hierarchy and sharing",
    icon: RiGroupLine,
    requiredRoles: ["TEAM", "ADMIN"],
  },
];

interface CollaborationCategoryPaneProps {
  /** Currently selected category ID */
  selectedCategory: CollaborationCategory | null;
  /** Callback when a category is clicked */
  onCategorySelect: (category: CollaborationCategory) => void;
  /** Additional CSS classes */
  className?: string;
}

export function CollaborationCategoryPane({
  selectedCategory,
  onCategorySelect,
  className,
}: CollaborationCategoryPaneProps) {
  const { isAdmin, isTeam } = useUserRole();

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Refs for category buttons to enable focus management
  const buttonRefs = React.useRef<Map<CollaborationCategory, HTMLButtonElement>>(
    new Map()
  );

  // Filter categories based on user role
  const visibleCategories = React.useMemo(() => {
    return COLLABORATION_CATEGORIES.filter((category) => {
      // No role requirement = visible to all
      if (!category.requiredRoles || category.requiredRoles.length === 0) {
        return true;
      }
      // Check if user has any of the required roles
      if (category.requiredRoles.includes("ADMIN") && isAdmin) {
        return true;
      }
      if (category.requiredRoles.includes("TEAM") && (isTeam || isAdmin)) {
        return true;
      }
      return false;
    });
  }, [isAdmin, isTeam]);

  // Get the current focused category index
  const getFocusedIndex = React.useCallback(() => {
    const focused = document.activeElement as HTMLElement;
    const entries = Array.from(buttonRefs.current.entries());
    return entries.findIndex(([, el]) => el === focused);
  }, []);

  // Focus a category by index (wraps around)
  const focusCategoryByIndex = React.useCallback(
    (index: number) => {
      const categoryIds = visibleCategories.map((c) => c.id);
      const wrappedIndex =
        ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
      const categoryId = categoryIds[wrappedIndex];
      const button = buttonRefs.current.get(categoryId);
      button?.focus();
    },
    [visibleCategories]
  );

  // Keyboard navigation handler for individual items
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: CollaborationCategory) => {
      const currentIndex = visibleCategories.findIndex(
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
          focusCategoryByIndex(visibleCategories.length - 1);
          break;
      }
    },
    [onCategorySelect, visibleCategories, focusCategoryByIndex]
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
      aria-label="Collaboration categories"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-cb-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
          aria-hidden="true"
        >
          <RiTeamLine className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-bold text-ink uppercase tracking-wide"
            id="collaboration-category-title"
          >
            Collaboration
          </h2>
          <p className="text-xs text-ink-muted">
            {visibleCategories.length} {visibleCategories.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="collaboration-category-title"
      >
        {visibleCategories.map((category) => {
          const isActive = selectedCategory === category.id;
          // Use filled icon variant when active, fall back to line icon
          const IconComponent = isActive && category.iconFill ? category.iconFill : category.icon;

          return (
            <div
              key={category.id}
              role="listitem"
              className="relative mb-1"
            >
              {/* Active indicator - pill shape (Loop-style) with smooth transition */}
              <div
                className={cn(
                  "cv-side-indicator-pill",
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
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                  isActive && [
                    "bg-hover",
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
                    "bg-cb-card border border-border",
                    "transition-all duration-200 ease-in-out",
                    isActive && "border-vibe-orange/30 bg-vibe-orange/10"
                  )}
                  aria-hidden="true"
                >
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-200 ease-in-out",
                      isActive
                        ? "text-vibe-orange"
                        : "text-ink-muted"
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

export default CollaborationCategoryPane;
