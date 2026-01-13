/**
 * Analytics Detail Pane (3rd Pane)
 *
 * Renders the actual analytics content for the selected category.
 * Displays detailed charts, tables, and metrics based on selected category.
 *
 * ## Design Specification
 *
 * - **Position**: 3rd pane in the multi-pane layout (after category pane)
 * - **Purpose**: Display detailed analytics content for selected category
 * - **Pattern**: Microsoft Loop-inspired detail view with header, scrollable content
 *
 * @pattern analytics-detail-pane
 * @see docs/specs/SPEC-ui-standardization-analytics-relocation.md
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
  RiArrowLeftLine,
  RiDashboardFill,
  RiTimeFill,
  RiGroupFill,
  RiVoiceprintFill,
  RiPriceTag3Fill,
  RiFilmFill,
} from "@remixicon/react";

/** Analytics categories matching AnalyticsCategoryPane */
export type AnalyticsCategory =
  | "overview"
  | "duration"
  | "participation"
  | "talktime"
  | "tags"
  | "content";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

/** Category metadata for display */
const CATEGORY_META: Record<
  AnalyticsCategory,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  overview: {
    label: "Overview",
    description: "KPIs and call volume trends",
    icon: RiDashboardFill,
  },
  duration: {
    label: "Call Duration",
    description: "Duration distribution and averages",
    icon: RiTimeFill,
  },
  participation: {
    label: "Participation",
    description: "Attendee metrics and trends",
    icon: RiGroupFill,
  },
  talktime: {
    label: "Talk Time",
    description: "Talk time and monologue analysis",
    icon: RiVoiceprintFill,
  },
  tags: {
    label: "Tags",
    description: "Calls and minutes by tag",
    icon: RiPriceTag3Fill,
  },
  content: {
    label: "Content",
    description: "Clips tracking and performance",
    icon: RiFilmFill,
  },
};

interface AnalyticsDetailPaneProps {
  /** The analytics category to display */
  category: AnalyticsCategory;
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

/** Loading skeleton for analytics content */
function AnalyticsLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading analytics content">
      <Skeleton className="h-8 w-1/3" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

/** Error boundary fallback for analytics content */
function AnalyticsErrorFallback({
  category,
  error,
}: {
  category: AnalyticsCategory;
  error?: Error;
}) {
  return (
    <div
      className="p-6 text-center"
      role="alert"
      aria-label="Analytics loading error"
    >
      <div className="text-destructive mb-2">
        Failed to load {CATEGORY_META[category].label} analytics
      </div>
      <p className="text-sm text-muted-foreground">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
    </div>
  );
}

/** Placeholder content for analytics categories */
function AnalyticsPlaceholder({ category }: { category: AnalyticsCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl bg-vibe-orange/10 flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <meta.icon className="h-8 w-8 text-vibe-orange" />
      </div>
      <h3 className="text-lg font-semibold text-cb-ink mb-2">
        {meta.label} Analytics
      </h3>
      <p className="text-sm text-cb-ink-muted max-w-sm">
        Analytics content for {category} coming soon
      </p>
    </div>
  );
}

export function AnalyticsDetailPane({
  category,
  onClose,
  onBack,
  isPinned = false,
  onTogglePin,
  showBackButton = false,
  className,
}: AnalyticsDetailPaneProps) {
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

  // Render the appropriate analytics component based on category
  // For now, render placeholder content - actual components will be added in future stories
  const renderContent = () => {
    switch (displayedCategory) {
      case "overview":
      case "duration":
      case "participation":
      case "talktime":
      case "tags":
      case "content":
        return <AnalyticsPlaceholder category={displayedCategory} />;
      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Unknown analytics category
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
        isMounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2",
        className
      )}
      role="region"
      aria-label={`${meta.label} analytics`}
      tabIndex={-1}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-cb-border bg-cb-card/50 flex-shrink-0">
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
              className="text-sm font-semibold text-cb-ink truncate"
              id="analytics-detail-title"
            >
              {meta.label}
            </h2>
            <p className="text-xs text-cb-ink-muted truncate">
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
          <React.Suspense fallback={<AnalyticsLoadingSkeleton />}>
            <ErrorBoundary
              fallback={<AnalyticsErrorFallback category={displayedCategory} />}
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
 * Simple error boundary for catching render errors in analytics components
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
    logger.error("Analytics component error", {
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

export default AnalyticsDetailPane;
