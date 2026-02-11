/**
 * Collaboration Page
 *
 * 3-pane layout for Team collaboration features.
 * Routes: /team
 *
 * ## Design Specification
 *
 * - **Position**: Full-page 3-pane layout (sidebar, category pane, detail pane)
 * - **Purpose**: Manage team hierarchy
 * - **Pattern**: Microsoft Loop-inspired navigation (same as Settings)
 *
 * @pattern collaboration-page
 * @see src/pages/Settings.tsx - Reference implementation for 3-pane layout
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RiLoader2Line, RiCloseLine, RiGroupLine, RiArrowLeftLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  CollaborationCategoryPane,
  type CollaborationCategory,
} from "@/components/panes/CollaborationCategoryPane";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load tab components
const TeamTab = React.lazy(() => import("@/components/settings/TeamTab"));

/** Category metadata for display in detail pane header */
const CATEGORY_META: Record<
  CollaborationCategory,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  team: {
    label: "Team",
    description: "Team hierarchy and sharing",
    icon: RiGroupLine,
  },
};

/** Loading skeleton for collaboration content */
function CollaborationLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading collaboration content">
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

export default function CollaborationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading: roleLoading, isAdmin, isTeam } = useUserRole();

  // --- Responsive Breakpoint ---
  const { isMobile } = useBreakpointFlags();

  // --- Pane System Logic ---
  const [selectedCategory, setSelectedCategory] = useState<CollaborationCategory | null>(null);

  // Determine if user has access to Team category
  const hasTeamAccess = isAdmin || isTeam;

  // Get category from URL path
  const getCategoryFromPath = useCallback((): CollaborationCategory | null => {
    if (location.pathname.startsWith("/team")) {
      return "team";
    }
    return null;
  }, [location.pathname]);

  // Get default category based on user role
  const getDefaultCategory = useCallback((): CollaborationCategory => {
    return "team";
  }, []);

  // --- Deep Link Handling and Role-Based Access ---
  useEffect(() => {
    if (roleLoading) return;

    const urlCategory = getCategoryFromPath();

    if (urlCategory === "team" && !hasTeamAccess) {
      // User doesn't have access to Team, show toast
      toast.info("Team management requires manager access");
      navigate("/", { replace: true });
      return;
    }

    if (urlCategory) {
      setSelectedCategory(urlCategory);
    } else {
      // No category in URL, navigate to default
      const defaultCategory = getDefaultCategory();
      setSelectedCategory(defaultCategory);
      navigate(`/${defaultCategory}`, { replace: true });
    }
  }, [location.pathname, roleLoading, hasTeamAccess, getCategoryFromPath, getDefaultCategory, navigate]);

  // --- Pane System Handlers ---
  const handleCategorySelect = useCallback((category: CollaborationCategory) => {
    // Check access for Team category
    if (category === "team" && !hasTeamAccess) {
      toast.info("Team management requires manager access");
      return;
    }
    // Update URL which will trigger the useEffect to update selectedCategory
    navigate(`/${category}`, { replace: true });
  }, [hasTeamAccess, navigate]);

  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RiLoader2Line className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mobile behavior: Show category pane or detail pane based on selection
  if (isMobile) {
    return (
      <AppShell config={{ showNavRail: false }}>
        {!selectedCategory ? (
          // Mobile: Show category list
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
              <span className="text-sm font-semibold">Collaboration</span>
            </div>
            <CollaborationCategoryPane
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              className="flex-1 min-h-0"
            />
          </div>
        ) : (
          // Mobile: Show detail pane
          <CollaborationDetailPane
            category={selectedCategory}
            onBack={handleBackFromDetail}
            showBackButton={true}
            className="flex-1 min-h-0"
          />
        )}
      </AppShell>
    );
  }

  // Desktop/Tablet: Full 3-pane layout with AppShell
  return (
    <AppShell
      config={{
        secondaryPane: (
          <CollaborationCategoryPane
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        ),
      }}
    >
      {selectedCategory ? (
        <CollaborationDetailPane
          category={selectedCategory}
          onClose={handleCloseDetailPane}
          showBackButton={false}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select a category to view details
        </div>
      )}
    </AppShell>
  );
}

/**
 * Collaboration Detail Pane (3rd Pane)
 *
 * Renders the actual collaboration content for the selected category.
 * Reuses TeamTab component in a pane format.
 */
interface CollaborationDetailPaneProps {
  category: CollaborationCategory;
  onClose?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

function CollaborationDetailPane({
  category,
  onClose,
  onBack,
  showBackButton = false,
  className,
}: CollaborationDetailPaneProps) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    // Use requestAnimationFrame for smoother initial render
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Render the appropriate content based on category
  const renderContent = () => {
    switch (category) {
      case "team":
        return <TeamTab />;
      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            Unknown collaboration category
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-background",
        "transition-all duration-500 ease-in-out",
        isMounted
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-2",
        className
      )}
      role="region"
      aria-label={`${meta.label} collaboration`}
      tabIndex={-1}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
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

          {/* Category icon */}
          <div
            className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 transition-all duration-200 ease-in-out"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4 text-vibe-orange transition-transform duration-200 ease-in-out" />
          </div>

          {/* Category title and description */}
          <div className="min-w-0">
            <h2
              className="text-sm font-bold text-ink uppercase tracking-wide truncate"
              id="collaboration-detail-title"
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

      {/* Content - scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          <React.Suspense fallback={<CollaborationLoadingSkeleton />}>
            {renderContent()}
          </React.Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}
