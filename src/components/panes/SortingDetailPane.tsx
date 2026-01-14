/**
 * Sorting Detail Pane (3rd Pane)
 *
 * Renders the actual sorting/tagging content for the selected category.
 * Reuses existing tab components (FoldersTab, TagsTab, etc.) in a pane format.
 *
 * ## Design Specification
 *
 * - **Position**: 3rd pane in the multi-pane layout (after category pane)
 * - **Purpose**: Display detailed management content for selected category
 * - **Pattern**: Microsoft Loop-inspired detail view with header, scrollable content
 *
 * @pattern sorting-detail-pane
 * @see docs/planning/sorting-tagging-pane-allocation.md
 * @see src/components/panes/SettingsDetailPane.tsx
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiFolderLine,
  RiPriceTag3Line,
  RiFlowChart,
  RiRepeatLine,
  RiArrowLeftLine,
} from "@remixicon/react";
import type { SortingCategory } from "./SortingCategoryPane";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

// Lazy load sorting/tagging tab components
const FoldersTab = React.lazy(() =>
  import("@/components/tags/FoldersTab").then((module) => ({
    default: module.FoldersTab,
  }))
);
const TagsTab = React.lazy(() =>
  import("@/components/tags/TagsTab").then((module) => ({
    default: module.TagsTab,
  }))
);
const RulesTab = React.lazy(() =>
  import("@/components/tags/RulesTab").then((module) => ({
    default: module.RulesTab,
  }))
);
const RecurringTitlesTab = React.lazy(() =>
  import("@/components/tags/RecurringTitlesTab").then((module) => ({
    default: module.RecurringTitlesTab,
  }))
);

/** Category metadata for display */
const CATEGORY_META: Record<
  SortingCategory,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  folders: {
    label: "Folders",
    description: "Organize calls into folders",
    icon: RiFolderLine,
  },
  tags: {
    label: "Tags",
    description: "Classify and tag calls",
    icon: RiPriceTag3Line,
  },
  rules: {
    label: "Rules",
    description: "Auto-sort incoming calls",
    icon: RiFlowChart,
  },
  recurring: {
    label: "Recurring Titles",
    description: "Create rules from patterns",
    icon: RiRepeatLine,
  },
};

interface SortingDetailPaneProps {
  /** The sorting category to display */
  category: SortingCategory;
  /** Callback when the pane should close */
  onClose?: () => void;
  /** Callback when the back button is clicked (mobile/navigation) */
  onBack?: () => void;
  /** Whether the panel is pinned */
  isPinned?: boolean;
  /** Callback to toggle pin state */
  onTogglePin?: () => void;
  /** Whether to show the back button (for mobile navigation) */
  showBackButton?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Loading skeleton for sorting content */
function SortingLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading sorting content">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-10 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

/** Error boundary fallback for sorting content */
function SortingErrorFallback({
  category,
  error,
}: {
  category: SortingCategory;
  error?: Error;
}) {
  return (
    <div
      className="p-6 text-center"
      role="alert"
      aria-label="Sorting loading error"
    >
      <div className="text-destructive mb-2">
        Failed to load {CATEGORY_META[category].label}
      </div>
      <p className="text-sm text-muted-foreground">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
    </div>
  );
}

export function SortingDetailPane({
  category,
  onClose,
  onBack,
  isPinned = false,
  onTogglePin,
  showBackButton = false,
  className,
}: SortingDetailPaneProps) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  // Ref to the pane container for focus management
  const paneRef = React.useRef<HTMLDivElement>(null);

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Escape key to close pane (or go back if showing back button)
  const handleEscape = React.useCallback(() => {
    if (showBackButton && onBack) {
      onBack();
    } else if (onClose) {
      onClose();
    }
  }, [showBackButton, onBack, onClose]);

  useKeyboardShortcut(handleEscape, {
    key: "Escape",
    cmdOrCtrl: false,
    enabled: !!(onClose || (showBackButton && onBack)),
  });

  // Track content transition state for category changes
  const [isContentVisible, setIsContentVisible] = React.useState(true);
  const [displayedCategory, setDisplayedCategory] = React.useState(category);
  const prevCategoryRef = React.useRef(category);

  React.useEffect(() => {
    if (category !== prevCategoryRef.current) {
      // Category changed - trigger exit/enter animation
      setIsContentVisible(false);

      const timer = setTimeout(() => {
        setDisplayedCategory(category);
        setIsContentVisible(true);
      }, TRANSITION_DURATION);

      prevCategoryRef.current = category;
      return () => clearTimeout(timer);
    }
  }, [category]);

  // Render the appropriate sorting component based on category
  const renderContent = () => {
    switch (category) {
      case "folders":
        return <FoldersTab />;
      case "tags":
        return <TagsTab />;
      case "rules":
        return <RulesTab />;
      case "recurring":
        return <RecurringTitlesTab />;
      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Unknown sorting category
          </div>
        );
    }
  };

  return (
    <div
      ref={paneRef}
      className={cn(
        "h-full flex flex-col bg-background",
        // Pane enter animation (slide + fade)
        "transition-all duration-300 ease-in-out",
        isMounted
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-2",
        className
      )}
      role="region"
      aria-label={`${meta.label} management`}
      tabIndex={-1}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-cb-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile navigation */}
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-1 -ml-1"
              aria-label="Go back to categories"
            >
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {/* Category icon - with smooth transition */}
          <div
            className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 transition-all duration-200 ease-in-out"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4 text-vibe-orange transition-transform duration-200 ease-in-out" />
          </div>

          {/* Category title and description */}
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-ink truncate"
              id="sorting-detail-title"
            >
              {meta.label}
            </h2>
            <p className="text-xs text-ink-muted truncate">
              {meta.description}
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          role="toolbar"
          aria-label="Pane actions"
        >
          {onTogglePin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePin}
              aria-label={isPinned ? "Unpin pane" : "Pin pane"}
              aria-pressed={isPinned}
            >
              {isPinned ? (
                <RiPushpinFill
                  className="h-4 w-4 text-vibe-orange"
                  aria-hidden="true"
                />
              ) : (
                <RiPushpinLine className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close pane"
            >
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      {/* Content - scrollable with content transition animation */}
      <ScrollArea className="flex-1">
        <div
          className={cn(
            "p-4 md:p-6",
            // Content transition animation for category changes
            "transition-all duration-200 ease-in-out",
            isContentVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1"
          )}
        >
          <React.Suspense fallback={<SortingLoadingSkeleton />}>
            <ErrorBoundary
              fallback={<SortingErrorFallback category={displayedCategory} />}
            >
              {renderContent()}
            </ErrorBoundary>
          </React.Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Simple error boundary for catching render errors in sorting components
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Sorting component error", {
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default SortingDetailPane;
