/**
 * Content Category Pane (2nd Pane)
 *
 * Displays navigation categories for the Content Hub section.
 * Categories: Overview, Generators, Library (Hooks, Posts, Emails)
 *
 * ## Design Specification
 *
 * - **Position**: 2nd pane in the multi-pane layout (after sidebar)
 * - **Width**: 260px (fixed, inherited from AppShell secondaryPane)
 * - **Purpose**: Category/section selection for Content Hub navigation
 * - **Pattern**: Microsoft Loop-inspired navigation
 *
 * @pattern content-category-pane
 * @see src/components/panes/SortingCategoryPane.tsx
 */

import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  RiHome4Line,
  RiSparklingLine,
  RiLightbulbLine,
  RiFileTextLine,
  RiMailLine,
  RiPhoneLine,
  RiLayoutGridLine,
} from "@remixicon/react";

export type ContentCategory =
  | "overview"
  | "generators"
  | "call-content"
  | "hooks"
  | "posts"
  | "emails";

interface CategoryItem {
  id: ContentCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  indent?: boolean;
}

const CONTENT_CATEGORIES: CategoryItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Content Hub home",
    icon: RiHome4Line,
    path: "/content",
  },
  {
    id: "generators",
    label: "Generators",
    description: "Create new content",
    icon: RiSparklingLine,
    path: "/content/generators",
  },
  {
    id: "call-content",
    label: "Social Posts",
    description: "From transcripts",
    icon: RiPhoneLine,
    path: "/content/generators/call-content",
    indent: true,
  },
  {
    id: "hooks",
    label: "Hooks",
    description: "Attention grabbers",
    icon: RiLightbulbLine,
    path: "/content/library/hooks",
  },
  {
    id: "posts",
    label: "Posts",
    description: "Social content",
    icon: RiFileTextLine,
    path: "/content/library/posts",
  },
  {
    id: "emails",
    label: "Emails",
    description: "Email drafts",
    icon: RiMailLine,
    path: "/content/library/emails",
  },
];

/** Contextual tips that change based on selected category */
const QUICK_TIPS: Record<ContentCategory, string> = {
  overview: "Your Content Hub dashboard shows stats and quick access to all content features.",
  generators: "Content generators transform your source material into ready-to-use marketing content.",
  "call-content": "Generate social media posts from your call transcripts using AI.",
  hooks: "Hooks are attention-grabbing opening lines. Star your favorites for quick access.",
  posts: "Social posts are ready to share. Copy directly or edit before posting.",
  emails: "Email drafts are formatted for your email client. Customize before sending.",
};

interface ContentCategoryPaneProps {
  /** Additional CSS classes */
  className?: string;
  /** Counts per category (optional) */
  categoryCounts?: Partial<Record<ContentCategory, number>>;
}

export function ContentCategoryPane({
  className,
  categoryCounts = {},
}: ContentCategoryPaneProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Determine active category from current path
  const getActiveCategory = (): ContentCategory | null => {
    const path = location.pathname;

    // Exact matches first
    if (path === "/content") return "overview";
    if (path === "/content/generators") return "generators";
    if (path === "/content/generators/call-content") return "call-content";
    if (path === "/content/library/hooks") return "hooks";
    if (path === "/content/library/posts") return "posts";
    if (path === "/content/library/emails") return "emails";

    // Partial matches for nested routes
    if (path.startsWith("/content/generators/call-content")) return "call-content";
    if (path.startsWith("/content/generators")) return "generators";
    if (path.startsWith("/content/library/hooks")) return "hooks";
    if (path.startsWith("/content/library/posts")) return "posts";
    if (path.startsWith("/content/library/emails")) return "emails";

    return "overview";
  };

  const selectedCategory = getActiveCategory();

  // Refs for category buttons for focus management
  const buttonRefs = React.useRef<Map<ContentCategory, HTMLButtonElement>>(new Map());

  // Focus a category by index (wraps around)
  const focusCategoryByIndex = React.useCallback((index: number) => {
    const categoryIds = CONTENT_CATEGORIES.map((c) => c.id);
    const wrappedIndex = ((index % categoryIds.length) + categoryIds.length) % categoryIds.length;
    const categoryId = categoryIds[wrappedIndex];
    const button = buttonRefs.current.get(categoryId);
    button?.focus();
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, categoryId: ContentCategory) => {
      const currentIndex = CONTENT_CATEGORIES.findIndex((c) => c.id === categoryId);

      switch (event.key) {
        case "Enter":
        case " ": {
          event.preventDefault();
          const category = CONTENT_CATEGORIES.find((c) => c.id === categoryId);
          if (category) navigate(category.path);
          break;
        }
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
          focusCategoryByIndex(CONTENT_CATEGORIES.length - 1);
          break;
      }
    },
    [navigate, focusCategoryByIndex]
  );

  // Get current quick tip
  const currentTip = selectedCategory
    ? QUICK_TIPS[selectedCategory]
    : QUICK_TIPS.overview;

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "transition-all duration-500 ease-in-out",
        isMounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
        className
      )}
      role="navigation"
      aria-label="Content Hub categories"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <div
          className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 text-vibe-orange"
          aria-hidden="true"
        >
          <RiLayoutGridLine className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold text-ink uppercase tracking-wide"
            id="content-category-title"
          >
            Content Hub
          </h2>
          <p className="text-xs text-ink-muted">
            Create & manage content
          </p>
        </div>
      </header>

      {/* Category List */}
      <div
        className="flex-1 overflow-y-auto py-2 px-2"
        role="list"
        aria-labelledby="content-category-title"
      >
        {CONTENT_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const IconComponent = category.icon;
          const count = categoryCounts[category.id];

          return (
            <div
              key={category.id}
              role="listitem"
              className={cn("relative mb-1", category.indent && "ml-4")}
            >
              <button
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(category.id, el);
                  } else {
                    buttonRefs.current.delete(category.id);
                  }
                }}
                type="button"
                onClick={() => navigate(category.path)}
                onKeyDown={(e) => handleKeyDown(e, category.id)}
                className={cn(
                  "relative w-full flex items-start gap-3 px-3 py-3 rounded-lg",
                  "text-left transition-all duration-150 ease-in-out",
                  "hover:bg-hover/70",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                  isActive && [
                    "bg-hover",
                    "border-l-0 pl-4",
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                  ]
                )}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${category.label}: ${category.description}${count !== undefined ? `, ${count} items` : ""}`}
              >
                {/* Icon */}
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
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "block text-sm font-medium truncate",
                        "transition-colors duration-500 ease-in-out",
                        isActive ? "text-vibe-orange" : "text-ink"
                      )}
                    >
                      {category.label}
                    </span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "flex-shrink-0 text-xs tabular-nums",
                          isActive ? "text-vibe-orange/70" : "text-ink-muted"
                        )}
                        aria-hidden="true"
                      >
                        ({count})
                      </span>
                    )}
                  </div>
                  <span className="block text-xs text-ink-muted truncate">
                    {category.description}
                  </span>
                </div>

                {/* Arrow indicator */}
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

      {/* Quick Tips Section */}
      <div className="flex-shrink-0 border-t border-border bg-cb-card/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <RiLightbulbLine
            className="h-4 w-4 text-ink-muted flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">
              Quick Tip
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              {currentTip}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentCategoryPane;
