/**
 * Collaboration Page
 *
 * 3-pane layout for Team and Coaches collaboration features.
 * Routes: /team, /coaches
 *
 * ## Design Specification
 *
 * - **Position**: Full-page 3-pane layout (sidebar, category pane, detail pane)
 * - **Purpose**: Manage team hierarchy and coaching relationships
 * - **Pattern**: Microsoft Loop-inspired navigation (same as Settings)
 *
 * @pattern collaboration-page
 * @see src/pages/Settings.tsx - Reference implementation for 3-pane layout
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RiLoader2Line, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  CollaborationCategoryPane,
  type CollaborationCategory,
} from "@/components/panes/CollaborationCategoryPane";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RiGroupLine,
  RiUserHeartLine,
  RiArrowLeftLine,
} from "@remixicon/react";

// Lazy load tab components
const TeamTab = React.lazy(() => import("@/components/settings/TeamTab"));
const CoachesTab = React.lazy(() => import("@/components/settings/CoachesTab"));

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
  coaches: {
    label: "Coaches",
    description: "Manage coaching relationships",
    icon: RiUserHeartLine,
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
  const { isMobile, isTablet } = useBreakpointFlags();

  // --- Sidebar Logic ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [showMobileNav, setShowMobileNav] = useState(false);

  // --- Pane System Logic ---
  const [selectedCategory, setSelectedCategory] = useState<CollaborationCategory | null>(null);
  const [isCategoryPaneOpen, setIsCategoryPaneOpen] = useState(true);

  // Determine if user has access to Team category
  const hasTeamAccess = isAdmin || isTeam;

  // Get category from URL path
  const getCategoryFromPath = useCallback((): CollaborationCategory | null => {
    if (location.pathname.startsWith("/team")) {
      return "team";
    }
    if (location.pathname.startsWith("/coaches")) {
      return "coaches";
    }
    return null;
  }, [location.pathname]);

  // Get default category based on user role
  const getDefaultCategory = useCallback((): CollaborationCategory => {
    if (hasTeamAccess) {
      return "team";
    }
    return "coaches";
  }, [hasTeamAccess]);

  // --- Deep Link Handling and Role-Based Access ---
  useEffect(() => {
    if (roleLoading) return;

    const urlCategory = getCategoryFromPath();

    if (urlCategory === "team" && !hasTeamAccess) {
      // User doesn't have access to Team, redirect to Coaches with toast
      toast.info("Team management requires manager access");
      navigate("/coaches", { replace: true });
      setSelectedCategory("coaches");
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

  // Sync tablet sidebar state
  useEffect(() => {
    if (isTablet) {
      setIsSidebarExpanded(false);
    }
  }, [isTablet]);

  // Close mobile overlays when breakpoint changes
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
    }
  }, [isMobile]);

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

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && showMobileNav && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setShowMobileNav(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile navigation overlay */}
      {isMobile && showMobileNav && (
        <nav
          role="navigation"
          aria-label="Mobile navigation menu"
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="w-full px-2 mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileNav(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
            <span className="text-sm font-semibold mr-auto ml-2">Menu</span>
          </div>
          <SidebarNav
            isCollapsed={false}
            className="w-full flex-1"
          />
        </nav>
      )}

      <div className="h-full flex gap-3 overflow-hidden p-1">

        {/* MOBILE: Single-pane view with category list or detail */}
        {isMobile && (
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            {/* Mobile: Show category pane when no category selected */}
            {!selectedCategory && (
              <div
                className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
                role="navigation"
                aria-label="Collaboration categories"
              >
                {/* Mobile header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileNav(true)}
                    className="text-muted-foreground hover:text-foreground h-10 w-10"
                    aria-label="Open navigation menu"
                    aria-expanded={showMobileNav}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </Button>
                  <span className="text-sm font-semibold">Collaboration</span>
                </div>
                <CollaborationCategoryPane
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                  className="flex-1 min-h-0"
                />
              </div>
            )}

            {/* Mobile: Show detail pane when category is selected */}
            {selectedCategory && (
              <div
                className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
                role="region"
                aria-label="Collaboration detail"
              >
                {/* Mobile header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileNav(true)}
                    className="text-muted-foreground hover:text-foreground h-10 w-10"
                    aria-label="Open navigation menu"
                    aria-expanded={showMobileNav}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </Button>
                  <span className="text-sm font-semibold">Collaboration</span>
                </div>
                <CollaborationDetailPane
                  category={selectedCategory}
                  onBack={handleBackFromDetail}
                  showBackButton={true}
                  className="flex-1 min-h-0"
                />
              </div>
            )}
          </div>
        )}

        {/* PANE 1: Navigation Rail (Hidden on mobile) */}
        {!isMobile && (
          <nav
            role="navigation"
            aria-label="Main navigation"
            tabIndex={0}
            className={cn(
              "relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10 transition-all duration-500 ease-in-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
              isSidebarExpanded ? "w-[240px]" : "w-[72px] items-center"
            )}
          >
            {/* Click-to-toggle background overlay */}
            <div
              className="absolute inset-0 cursor-pointer z-0"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              aria-hidden="true"
            />

            {/* Floating collapse/expand toggle on right edge */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarExpanded(!isSidebarExpanded);
              }}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm",
                "flex items-center justify-center hover:bg-muted transition-colors"
              )}
              aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarExpanded}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform duration-500",
                  isSidebarExpanded ? "rotate-0" : "rotate-180"
                )}
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="w-full px-2 mb-2 flex items-center justify-between relative z-10">
              {isSidebarExpanded && <span className="text-sm font-semibold ml-2">Menu</span>}
            </div>

            <SidebarNav
              isCollapsed={!isSidebarExpanded}
              className="w-full flex-1 relative z-10"
            />
          </nav>
        )}

        {/* PANE 2: Collaboration Category List */}
        {!isMobile && isCategoryPaneOpen && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out",
              "w-[280px] opacity-100"
            )}
            role="navigation"
            aria-label="Collaboration categories"
          >
            <CollaborationCategoryPane
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
            />
          </div>
        )}

        {/* PANE 3: Collaboration Detail (shown when category is selected) */}
        {!isMobile && selectedCategory && (
          <div
            className={cn(
              "flex-1 min-w-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out"
            )}
            role="region"
            aria-label="Collaboration detail"
          >
            <CollaborationDetailPane
              category={selectedCategory}
              onClose={handleCloseDetailPane}
              showBackButton={false}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Collaboration Detail Pane (3rd Pane)
 *
 * Renders the actual collaboration content for the selected category.
 * Reuses TeamTab and CoachesTab components in a pane format.
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
      case "coaches":
        return <CoachesTab />;
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
        "transition-all duration-300 ease-in-out",
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
              className="text-sm font-semibold text-cb-ink truncate"
              id="collaboration-detail-title"
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
