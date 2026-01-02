/**
 * Settings Detail Pane (3rd Pane)
 *
 * Renders the actual settings content for the selected category.
 * Reuses existing tab components (AccountTab, BillingTab, etc.) in a pane format.
 *
 * ## Design Specification
 *
 * - **Position**: 3rd pane in the multi-pane layout (after category pane)
 * - **Purpose**: Display detailed settings content for selected category
 * - **Pattern**: Microsoft Loop-inspired detail view with header, scrollable content
 *
 * @pattern settings-detail-pane
 * @see docs/planning/settings-pane-allocation.md
 * @see src/components/panels/FolderDetailPanel.tsx
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiUserLine,
  RiTeamLine,
  RiWalletLine,
  RiPlugLine,
  RiRobot2Line,
  RiShieldLine,
  RiArrowLeftLine,
} from "@remixicon/react";
import type { SettingsCategory } from "./SettingsCategoryPane";

/** Transition duration for pane animations (matches Loop pattern: ~200-300ms) */
const TRANSITION_DURATION = 250;

// Lazy load settings tab components
const AccountTab = React.lazy(() => import("@/components/settings/AccountTab"));
const UsersTab = React.lazy(() => import("@/components/settings/UsersTab"));
const BillingTab = React.lazy(() => import("@/components/settings/BillingTab"));
const IntegrationsTab = React.lazy(
  () => import("@/components/settings/IntegrationsTab")
);
const AITab = React.lazy(() => import("@/components/settings/AITab"));
const AdminTab = React.lazy(() => import("@/components/settings/AdminTab"));

/** Category metadata for display */
const CATEGORY_META: Record<
  SettingsCategory,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  account: {
    label: "Account",
    description: "Profile and preferences",
    icon: RiUserLine,
  },
  users: {
    label: "Users",
    description: "Manage organization users",
    icon: RiTeamLine,
  },
  billing: {
    label: "Billing",
    description: "Plans and payments",
    icon: RiWalletLine,
  },
  integrations: {
    label: "Integrations",
    description: "Connected services",
    icon: RiPlugLine,
  },
  ai: {
    label: "AI",
    description: "Models and knowledge base",
    icon: RiRobot2Line,
  },
  admin: {
    label: "Admin",
    description: "System administration",
    icon: RiShieldLine,
  },
};

interface SettingsDetailPaneProps {
  /** The settings category to display */
  category: SettingsCategory;
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

/** Loading skeleton for settings content */
function SettingsLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading settings content">
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

/** Error boundary fallback for settings content */
function SettingsErrorFallback({
  category,
  error,
}: {
  category: SettingsCategory;
  error?: Error;
}) {
  return (
    <div
      className="p-6 text-center"
      role="alert"
      aria-label="Settings loading error"
    >
      <div className="text-destructive mb-2">
        Failed to load {CATEGORY_META[category].label} settings
      </div>
      <p className="text-sm text-muted-foreground">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
    </div>
  );
}

export function SettingsDetailPane({
  category,
  onClose,
  onBack,
  isPinned = false,
  onTogglePin,
  showBackButton = false,
  className,
}: SettingsDetailPaneProps) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger enter animation after mount
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

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

  // Render the appropriate settings component based on category
  const renderContent = () => {
    switch (category) {
      case "account":
        return <AccountTab />;
      case "users":
        return <UsersTab />;
      case "billing":
        return <BillingTab />;
      case "integrations":
        return <IntegrationsTab />;
      case "ai":
        return <AITab />;
      case "admin":
        return <AdminTab />;
      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Unknown settings category
          </div>
        );
    }
  };

  return (
    <div
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
      aria-label={`${meta.label} settings`}
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
            className="w-8 h-8 rounded-lg bg-cb-vibe-orange/10 flex items-center justify-center flex-shrink-0 transition-all duration-200 ease-in-out"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4 text-cb-vibe-orange transition-transform duration-200 ease-in-out" />
          </div>

          {/* Category title and description */}
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-cb-ink truncate"
              id="settings-detail-title"
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
                  className="h-4 w-4 text-cb-vibe-orange"
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
          <React.Suspense fallback={<SettingsLoadingSkeleton />}>
            <ErrorBoundary
              fallback={<SettingsErrorFallback category={displayedCategory} />}
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
 * Simple error boundary for catching render errors in settings components
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
    logger.error("Settings component error", { error, componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default SettingsDetailPane;
