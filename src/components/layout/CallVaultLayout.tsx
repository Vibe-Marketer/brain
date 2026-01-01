import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useBreakpoint, type Breakpoint } from "@/hooks/useBreakpoint";

/**
 * CallVaultLayout - Reusable 3-pane layout with responsive behavior
 *
 * Breakpoint behavior:
 * - Desktop (>1024px): All 3 panes visible, nav expanded by default
 * - Tablet (768-1024px): Nav collapsed by default, secondary panel visible
 * - Mobile (<768px): Nav hidden (shown as overlay), secondary panel as overlay
 */

export interface CallVaultLayoutProps {
  /** Content for the navigation rail (Pane 1) - receives isCollapsed prop */
  navRail?: React.ReactNode;
  /** Custom navigation rail renderer - overrides default SidebarNav */
  renderNavRail?: (props: {
    isCollapsed: boolean;
    onLibraryToggle: () => void;
    onSyncClick?: () => void;
  }) => React.ReactNode;
  /** Content for the secondary panel (Pane 2) */
  secondaryPanel?: React.ReactNode;
  /** Main content (Pane 3) */
  children: React.ReactNode;
  /** External control of nav rail expansion (overrides responsive defaults) */
  isNavExpanded?: boolean;
  /** Callback when nav expansion changes */
  onNavExpandedChange?: (expanded: boolean) => void;
  /** External control of secondary panel visibility (overrides responsive defaults) */
  isSecondaryPanelOpen?: boolean;
  /** Callback when secondary panel visibility changes */
  onSecondaryPanelOpenChange?: (open: boolean) => void;
  /** Whether to show library toggle in nav (default: true if secondaryPanel provided) */
  showLibraryToggle?: boolean;
  /** Callback for sync click in nav */
  onSyncClick?: () => void;
  /** Additional class for the container */
  className?: string;
  /** Title shown in nav header when expanded */
  navTitle?: string;
}

export function CallVaultLayout({
  navRail,
  renderNavRail,
  secondaryPanel,
  children,
  isNavExpanded: controlledNavExpanded,
  onNavExpandedChange,
  isSecondaryPanelOpen: controlledSecondaryPanelOpen,
  onSecondaryPanelOpenChange,
  showLibraryToggle = true,
  onSyncClick,
  className,
  navTitle = "Menu",
}: CallVaultLayoutProps) {
  const breakpoint = useBreakpoint();

  // Get responsive defaults based on breakpoint
  const getDefaultNavExpanded = (bp: Breakpoint) => {
    switch (bp) {
      case "mobile":
        return false; // Hidden on mobile (shown as overlay)
      case "tablet":
        return false; // Collapsed on tablet
      case "desktop":
        return true; // Expanded on desktop
    }
  };

  const getDefaultSecondaryPanelOpen = (bp: Breakpoint) => {
    switch (bp) {
      case "mobile":
        return false; // Hidden on mobile (shown as overlay)
      case "tablet":
        return !!secondaryPanel; // Open on tablet if content exists
      case "desktop":
        return !!secondaryPanel; // Open on desktop if content exists
    }
  };

  // Internal state (used when not controlled)
  const [internalNavExpanded, setInternalNavExpanded] = React.useState(() =>
    getDefaultNavExpanded(breakpoint)
  );
  const [internalSecondaryPanelOpen, setInternalSecondaryPanelOpen] = React.useState(() =>
    getDefaultSecondaryPanelOpen(breakpoint)
  );

  // Determine if we're using controlled or uncontrolled state
  const isNavExpandedControlled = controlledNavExpanded !== undefined;
  const isSecondaryPanelOpenControlled = controlledSecondaryPanelOpen !== undefined;

  const isNavExpanded = isNavExpandedControlled ? controlledNavExpanded : internalNavExpanded;
  const isSecondaryPanelOpen = isSecondaryPanelOpenControlled
    ? controlledSecondaryPanelOpen
    : internalSecondaryPanelOpen;

  // Update internal state when breakpoint changes (only for uncontrolled mode)
  React.useEffect(() => {
    if (!isNavExpandedControlled) {
      setInternalNavExpanded(getDefaultNavExpanded(breakpoint));
    }
    if (!isSecondaryPanelOpenControlled) {
      setInternalSecondaryPanelOpen(getDefaultSecondaryPanelOpen(breakpoint));
    }
  }, [breakpoint, isNavExpandedControlled, isSecondaryPanelOpenControlled]);

  // Handlers
  const handleNavExpandedChange = React.useCallback(
    (expanded: boolean) => {
      if (!isNavExpandedControlled) {
        setInternalNavExpanded(expanded);
      }
      onNavExpandedChange?.(expanded);
    },
    [isNavExpandedControlled, onNavExpandedChange]
  );

  const handleSecondaryPanelOpenChange = React.useCallback(
    (open: boolean) => {
      if (!isSecondaryPanelOpenControlled) {
        setInternalSecondaryPanelOpen(open);
      }
      onSecondaryPanelOpenChange?.(open);
    },
    [isSecondaryPanelOpenControlled, onSecondaryPanelOpenChange]
  );

  const toggleNavExpanded = React.useCallback(() => {
    handleNavExpandedChange(!isNavExpanded);
  }, [handleNavExpandedChange, isNavExpanded]);

  const toggleSecondaryPanelOpen = React.useCallback(() => {
    handleSecondaryPanelOpenChange(!isSecondaryPanelOpen);
  }, [handleSecondaryPanelOpenChange, isSecondaryPanelOpen]);

  // Mobile overlay state
  const [showMobileNav, setShowMobileNav] = React.useState(false);
  const [showMobileSecondary, setShowMobileSecondary] = React.useState(false);

  // Close mobile overlays when breakpoint changes away from mobile
  React.useEffect(() => {
    if (breakpoint !== "mobile") {
      setShowMobileNav(false);
      setShowMobileSecondary(false);
    }
  }, [breakpoint]);

  const isMobile = breakpoint === "mobile";

  // Render navigation rail content
  const renderNavContent = () => {
    const navProps = {
      isCollapsed: !isNavExpanded,
      onLibraryToggle: isMobile
        ? () => {
            setShowMobileNav(false);
            setShowMobileSecondary(true);
          }
        : toggleSecondaryPanelOpen,
      onSyncClick,
    };

    if (renderNavRail) {
      return renderNavRail(navProps);
    }

    if (navRail) {
      return navRail;
    }

    // Default: use SidebarNav
    return (
      <SidebarNav
        isCollapsed={!isNavExpanded}
        className="w-full flex-1"
        onLibraryToggle={showLibraryToggle && secondaryPanel ? navProps.onLibraryToggle : undefined}
        onSyncClick={onSyncClick}
      />
    );
  };

  return (
    <>
      {/* Mobile overlay backdrops */}
      {isMobile && (showMobileNav || showMobileSecondary) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => {
            setShowMobileNav(false);
            setShowMobileSecondary(false);
          }}
        />
      )}

      {/* Mobile navigation overlay */}
      {isMobile && showMobileNav && (
        <div
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
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
            <span className="text-sm font-semibold mr-auto ml-2">{navTitle}</span>
          </div>
          <SidebarNav
            isCollapsed={false}
            className="w-full flex-1"
            onLibraryToggle={
              showLibraryToggle && secondaryPanel
                ? () => {
                    setShowMobileNav(false);
                    setShowMobileSecondary(true);
                  }
                : undefined
            }
            onSyncClick={onSyncClick}
          />
        </div>
      )}

      {/* Mobile secondary panel overlay */}
      {isMobile && showMobileSecondary && secondaryPanel && (
        <div
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSecondary(false)}
              className="text-muted-foreground hover:text-foreground h-8 w-8"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">{secondaryPanel}</div>
        </div>
      )}

      {/* Main 3-Pane Layout Container */}
      <div className={cn("h-full flex gap-3 overflow-hidden p-1", className)}>
        {/* PANE 1: Navigation Rail (Hidden on mobile, shown as overlay) */}
        {!isMobile && (
          <div
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10 transition-all duration-300 ease-in-out",
              isNavExpanded ? "w-[240px]" : "w-[72px] items-center"
            )}
          >
            <div className="w-full px-2 mb-2 flex items-center justify-between">
              {/* Toggle Sidebar Button (Hamburger/Menu) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleNavExpanded}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-panel-left"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </Button>
              {isNavExpanded && (
                <span className="text-sm font-semibold mr-auto ml-2">{navTitle}</span>
              )}
            </div>

            {renderNavContent()}
          </div>
        )}

        {/* PANE 2: Secondary Panel (Hidden on mobile, shown as overlay) */}
        {!isMobile && secondaryPanel && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden transition-all duration-500 ease-in-out",
              isSecondaryPanelOpen
                ? "w-[280px] opacity-100 ml-0"
                : "w-0 opacity-0 -ml-3 border-0"
            )}
          >
            {secondaryPanel}
          </div>
        )}

        {/* PANE 3: Main Content - Always visible */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-300">
          {/* Mobile header with hamburger menu */}
          {isMobile && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileNav(true)}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </Button>
              {secondaryPanel && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileSecondary(true)}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </Button>
              )}
            </div>
          )}

          {children}
        </div>
      </div>
    </>
  );
}

export default CallVaultLayout;
