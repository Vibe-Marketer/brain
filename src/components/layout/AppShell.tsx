/**
 * AppShell - Master layout component with integrated sidebar and panes
 *
 * Provides the unified 3-4 pane layout system for all pages in the application.
 * Eliminates per-page duplication of sidebar and pane code.
 *
 * ## Architecture
 * - **Pane 1**: Navigation rail (sidebar) - Always present, collapsible
 * - **Pane 2**: Secondary panel (optional) - Library, categories, etc.
 * - **Pane 3**: Main content (required) - Page-specific content via children
 * - **Pane 4+**: Detail panel (optional) - Via DetailPaneOutlet
 *
 * ## Responsive Behavior
 * - **Desktop**: All panes visible, sidebar expanded
 * - **Tablet**: Sidebar auto-collapsed, panes visible
 * - **Mobile**: Single-pane with overlays
 *
 * @pattern app-shell
 * @brand-version v4.1
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useBreakpointFlags } from '@/hooks/useBreakpoint';
import { SidebarNav } from '@/components/ui/sidebar-nav';
import { SidebarToggle } from './SidebarToggle';
import { DetailPaneOutlet } from './DetailPaneOutlet';

/**
 * DEV-MODE CHECK: Detects if AppShell is incorrectly wrapped in Layout.tsx's card container.
 *
 * If you see this warning, add your page's route to the `usesCustomLayout` check in
 * src/components/Layout.tsx to bypass the card wrapper.
 *
 * Example: const isMyNewPage = location.pathname.startsWith('/my-new-page');
 * Then add it to: const usesCustomLayout = ... || isMyNewPage;
 */
function useCardWrapperDetection(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!containerRef.current) return;

    // Check parent elements for the card wrapper signature from Layout.tsx
    // The wrapper has: bg-card rounded-2xl shadow-lg border border-border
    let parent = containerRef.current.parentElement;
    while (parent) {
      const classList = parent.classList;
      // Detect Layout.tsx's card wrapper by its distinctive class combination
      if (
        classList.contains('bg-card') &&
        classList.contains('rounded-2xl') &&
        classList.contains('shadow-lg')
      ) {
        console.warn(
          `[AppShell] ⚠️ Detected card wrapper around AppShell!\n\n` +
          `This page is missing from the usesCustomLayout check in Layout.tsx.\n` +
          `Add this page's route to bypass the card wrapper.\n\n` +
          `Fix: Edit src/components/Layout.tsx and add your route to usesCustomLayout.\n` +
          `Example: const isMyPage = location.pathname.startsWith('/my-route');\n` +
          `         const usesCustomLayout = ... || isMyPage;`
        );
        break;
      }
      parent = parent.parentElement;
    }
  }, [containerRef]);
}

export interface AppShellConfig {
  /** Show navigation rail (default: true) */
  showNavRail?: boolean;
  /** Secondary pane content */
  secondaryPane?: React.ReactNode;
  /** Show detail panel outlet (default: false) */
  showDetailPane?: boolean;
  /** Callback when Library toggle is clicked */
  onLibraryToggle?: () => void;
  /** Callback when Settings nav item is clicked */
  onSettingsClick?: () => void;
  /** Callback when Sorting nav item is clicked */
  onSortingClick?: () => void;
  /** Callback when Sync button is clicked */
  onSyncClick?: () => void;
}

export interface AppShellProps {
  /** Main content to render in Pane 3 */
  children: React.ReactNode;
  /** Configuration options */
  config?: AppShellConfig;
}

/**
 * Master layout component for all pages
 *
 * Provides consistent sidebar, pane architecture, and responsive behavior.
 * Pages simply provide their content and optional secondary pane.
 *
 * @example
 * ```tsx
 * // Simple page (just main content)
 * <AppShell>
 *   <MyPageContent />
 * </AppShell>
 *
 * // Page with secondary pane and detail outlet
 * <AppShell
 *   config={{
 *     secondaryPane: <FolderSidebar />,
 *     showDetailPane: true
 *   }}
 * >
 *   <MyPageContent />
 * </AppShell>
 * ```
 */
export function AppShell({
  children,
  config = {}
}: AppShellProps) {
  const {
    showNavRail = true,
    secondaryPane,
    showDetailPane = false,
    onLibraryToggle,
    onSettingsClick,
    onSortingClick,
    onSyncClick
  } = config;

  // Responsive breakpoints
  const { isMobile, isTablet } = useBreakpointFlags();

  // Pane state
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);

  // Mobile overlay states
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileSecondary, setShowMobileSecondary] = useState(false);

  // Dev-mode check: Warn if AppShell is wrapped in Layout.tsx's card container
  const containerRef = useRef<HTMLDivElement>(null);
  useCardWrapperDetection(containerRef);

  // Auto-collapse sidebar on tablet
  useEffect(() => {
    if (isTablet) {
      setIsSidebarExpanded(false);
    }
  }, [isTablet]);

  // Close mobile overlays when switching to desktop/tablet
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
      setShowMobileSecondary(false);
    }
  }, [isMobile]);

  // Handle library toggle (for secondary pane)
  const handleLibraryToggle = () => {
    if (isMobile) {
      setShowMobileSecondary(!showMobileSecondary);
    } else {
      setIsSecondaryOpen(!isSecondaryOpen);
    }
    onLibraryToggle?.();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
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
        <nav
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="w-full px-2 mb-2 flex items-center justify-end">
            <button
              onClick={() => setShowMobileNav(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <SidebarNav
            isCollapsed={false}
            className="w-full flex-1"
            onSyncClick={onSyncClick}
            onLibraryToggle={handleLibraryToggle}
            onSettingsClick={onSettingsClick}
            onSortingClick={onSortingClick}
          />
        </nav>
      )}

      {/* Mobile secondary panel overlay */}
      {isMobile && showMobileSecondary && secondaryPane && (
        <div
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
            <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">Library</h2>
            <button
              onClick={() => setShowMobileSecondary(false)}
              className="text-muted-foreground hover:text-foreground h-6 w-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden pt-2">
            {secondaryPane}
          </div>
        </div>
      )}

      {/* Main pane container */}
      <div ref={containerRef} className="h-full flex gap-3 overflow-hidden p-1">
        {/* PANE 1: Navigation Rail (Sidebar) - Hidden on mobile */}
        {!isMobile && showNavRail && (
          <nav
            role="navigation"
            aria-label="Main navigation"
            tabIndex={0}
            className={cn(
              // Base styles
              "relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm",
              "flex flex-col py-2 h-full z-10",
              // Transitions - 500ms for premium feel
              "transition-all duration-500 ease-in-out",
              // Focus states
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
              // Width states
              isSidebarExpanded ? "w-[220px]" : "w-[72px] items-center"
            )}
          >
            {/* Click-to-toggle background overlay */}
            <div
              className="absolute inset-0 cursor-pointer z-0"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              aria-hidden="true"
            />

            {/* Edge-mounted toggle button */}
            <SidebarToggle
              isExpanded={isSidebarExpanded}
              onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
            />


            {/* Navigation items */}
            <SidebarNav
              isCollapsed={!isSidebarExpanded}
              className="w-full flex-1 relative z-10"
              onSyncClick={onSyncClick}
              onLibraryToggle={handleLibraryToggle}
              onSettingsClick={onSettingsClick}
              onSortingClick={onSortingClick}
            />
          </nav>
        )}

        {/* PANE 2: Secondary Panel - Hidden on mobile */}
        {!isMobile && secondaryPane && (
          <div
            className={cn(
              // Base styles
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm",
              "flex flex-col h-full z-10 overflow-hidden",
              // Transitions - 500ms for premium feel
              "transition-all duration-500 ease-in-out",
              // Visibility states
              isSecondaryOpen
                ? "w-[280px] opacity-100 ml-0"
                : "w-0 opacity-0 -ml-3 border-0"
            )}
          >
            {secondaryPane}
          </div>
        )}

        {/* PANE 3: Main Content - Always visible */}
        <div
          className={cn(
            // Base styles
            "flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm",
            "flex flex-col h-full relative z-0 overflow-hidden",
            // Transitions
            "transition-all duration-500"
          )}
        >
          {children}
        </div>

        {/* PANE 4: Detail Panel Outlet - Hidden on mobile */}
        {!isMobile && showDetailPane && (
          <DetailPaneOutlet isTablet={isTablet} />
        )}
      </div>
    </>
  );
}
