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

/**
 * ## Modal vs Pane 4 Rules (Phase 11 Decision)
 *
 * **Pane 4 (showDetailPane):** Quick config, single-action views
 * - Workspace settings, folder detail/rename, tag management
 * - Member role/info, import source config, quick call preview (title + summary)
 *
 * **Modal overlay:** Complex, multi-section, focused-attention views
 * - Full call detail + transcript (CallDetailDialog)
 * - Onboarding wizard, first-time source setup
 * - Bulk import selection, advanced org settings
 *
 * **Rule of thumb:** If it has scrollable content with multiple sections
 * or requires focused user attention, use a modal. If it's a quick glance
 * or single-action config, use Pane 4.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  RiCloseLine,
  RiDownloadFill,
  RiDownloadLine,
  RiGroupFill,
  RiGroupLine,
  RiInformationLine,
  RiLayoutLeft2Line,
  RiMoreFill,
  RiMoreLine,
  RiPhoneFill,
  RiPhoneLine,
  RiRouteFill,
  RiRouteLine,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useBreakpointFlags } from '@/hooks/useBreakpoint';
import { SidebarNav } from '@/components/ui/sidebar-nav';
import { Button } from '@/components/ui/button';
import { SidebarToggle } from './SidebarToggle';
import { DetailPaneOutlet } from './DetailPaneOutlet';
import { usePanelStore } from '@/stores/panelStore';
import { useOrgContextStore } from '@/stores/orgContextStore';

interface MobileNavItem {
  id: string;
  label: string;
  path: string;
  matchPaths: string[];
  icon: RemixiconComponentType;
  iconActive: RemixiconComponentType;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    id: 'calls',
    label: 'Calls',
    path: '/',
    matchPaths: ['/', '/transcripts', '/call/'],
    icon: RiPhoneLine,
    iconActive: RiPhoneFill,
  },
  {
    id: 'import',
    label: 'Import',
    path: '/import',
    matchPaths: ['/import'],
    icon: RiDownloadLine,
    iconActive: RiDownloadFill,
  },
  {
    id: 'rules',
    label: 'Rules',
    path: '/rules',
    matchPaths: ['/rules', '/sorting-tagging/rules'],
    icon: RiRouteLine,
    iconActive: RiRouteFill,
  },
  {
    id: 'people',
    label: 'People',
    path: '/people',
    matchPaths: ['/people'],
    icon: RiGroupLine,
    iconActive: RiGroupFill,
  },
];

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
  /** Title for the secondary pane header (used on mobile overlay, default: "Library") */
  secondaryPaneTitle?: string;
  /** Show detail panel outlet (default: false) */
  showDetailPane?: boolean;
  /**
   * Custom PANE 4 content. When truthy, renders as a true peer card (same
   * rounded-card styling as panes 2/3) to the right of the main pane — for
   * pages whose detail isn't panelStore-bound (e.g. Admin user detail).
   */
  detailPane?: React.ReactNode;
  /** Callback when Library toggle is clicked */
  onLibraryToggle?: () => void;
  /** Callback when Settings nav item is clicked */
  onSettingsClick?: () => void;
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
    secondaryPaneTitle = 'Library',
    showDetailPane = false,
    detailPane,
    onLibraryToggle,
    onSettingsClick,
  } = config;

  // Close detail panel on route changes (unless pinned)
  const location = useLocation();
  const navigate = useNavigate();
  const closePanel = usePanelStore((s) => s.closePanel);
  const isPanelOpen = usePanelStore((s) => s.isPanelOpen);
  useEffect(() => {
    closePanel();
  }, [location.pathname, closePanel]);

  // Org switch fade transition (D-11): brief 250ms opacity fade on content panes
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);
  const prevOrgRef = useRef(activeOrgId);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (prevOrgRef.current && prevOrgRef.current !== activeOrgId) {
      setIsSwitching(true);
      const timer = setTimeout(() => setIsSwitching(false), 250);
      return () => clearTimeout(timer);
    }
    prevOrgRef.current = activeOrgId;
  }, [activeOrgId]);

  // Responsive breakpoints
  const { isMobile, isTablet } = useBreakpointFlags();

  // Pane state
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true);

  // Mobile overlay states
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileSecondary, setShowMobileSecondary] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

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
      setShowMobileDetail(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isPanelOpen && !detailPane) {
      setShowMobileDetail(false);
    }
  }, [detailPane, isPanelOpen]);

  // Handle library toggle (for secondary pane) — defined for future toggle UI hookup
  const _handleLibraryToggle = () => {
    if (isMobile) {
      setShowMobileSecondary(!showMobileSecondary);
    } else {
      setIsSecondaryOpen(!isSecondaryOpen);
    }
    onLibraryToggle?.();
  };

  const hasMobileDetail = Boolean(detailPane || (showDetailPane && isPanelOpen));
  const mobilePaneControlCount =
    (secondaryPane ? 1 : 0) +
    (hasMobileDetail ? 1 : 0);
  const isMobileNavActive = (item: MobileNavItem) => item.matchPaths.some((path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  );

  return (
    <>

      {/* Mobile overlay backdrop */}
      {isMobile && (showMobileNav || showMobileSecondary || showMobileDetail) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => {
            setShowMobileNav(false);
            setShowMobileSecondary(false);
            setShowMobileDetail(false);
          }}
        />
      )}

      {/* Mobile navigation overlay */}
      {isMobile && showMobileNav && (
        <nav
          className={cn(
            "fixed top-[60px] left-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="w-full px-2 mb-2 flex items-center justify-end">
            <button
              onClick={() => setShowMobileNav(false)}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center"
              aria-label="Close navigation"
            >
              <RiCloseLine className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <SidebarNav
            isCollapsed={false}
            className="w-full flex-1"
            onSettingsClick={onSettingsClick}
          />
        </nav>
      )}

      {/* Mobile secondary panel overlay */}
      {isMobile && showMobileSecondary && secondaryPane && (
        <div
          className={cn(
            "fixed top-[60px] left-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
            <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">{secondaryPaneTitle}</h2>
            <button
              onClick={() => setShowMobileSecondary(false)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center"
              aria-label="Close panel"
            >
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden pt-2">
            {secondaryPane}
          </div>
        </div>
      )}

      {/* Mobile detail panel overlay */}
      {isMobile && showMobileDetail && hasMobileDetail && (
        <div
          className={cn(
            "fixed inset-x-2 top-[60px] bottom-[calc(72px+env(safe-area-inset-bottom,0px))]",
            "bg-card rounded-2xl border border-border/60 shadow-lg z-50 flex flex-col overflow-hidden",
            "animate-in slide-in-from-right-4 duration-300"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Detail panel"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">Details</h2>
            <button
              type="button"
              onClick={() => setShowMobileDetail(false)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center"
              aria-label="Close details"
            >
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {detailPane ? (
              detailPane
            ) : (
              <DetailPaneOutlet
                isTablet
                className="w-full h-full max-w-none rounded-none border-0 shadow-none translate-x-0 opacity-100"
              />
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE LAYOUT WRAPPER ── */}
      {isMobile ? (
        <div
          ref={containerRef}
          className="flex flex-col h-full overflow-hidden relative"
          style={{
            paddingBottom: 'calc(112px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* PANE 3 (mobile): Main content fills the space between header and tab bar */}
          <div
            className={cn(
              'flex-1 min-w-0 bg-card',
              'flex flex-col h-full relative z-0 overflow-hidden',
            )}
          >
            {children}
          </div>

          {mobilePaneControlCount > 0 && (
            <div
              className={cn(
                "absolute inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-[60]",
                "bg-card/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg",
                "grid gap-1 p-1",
                mobilePaneControlCount >= 2 ? "grid-cols-2" : "grid-cols-1"
              )}
              role="toolbar"
              aria-label="Mobile pane controls"
            >
              {secondaryPane && (
              <Button
                type="button"
                variant={showMobileSecondary ? "default" : "ghost"}
                size="sm"
                className="h-11 gap-2"
                onClick={() => {
                  setShowMobileNav(false);
                  setShowMobileSecondary(true);
                  setShowMobileDetail(false);
                }}
                aria-label={`Open ${secondaryPaneTitle} pane`}
                aria-expanded={showMobileSecondary}
              >
                <RiLayoutLeft2Line className="h-4 w-4" aria-hidden="true" />
                <span>{secondaryPaneTitle}</span>
              </Button>
              )}

              {hasMobileDetail && (
              <Button
                type="button"
                variant={showMobileDetail ? "default" : "ghost"}
                size="sm"
                className="h-11 gap-2"
                onClick={() => {
                  setShowMobileNav(false);
                  setShowMobileSecondary(false);
                  setShowMobileDetail(true);
                }}
                aria-label="Open detail pane"
                aria-expanded={showMobileDetail}
              >
                <RiInformationLine className="h-4 w-4" aria-hidden="true" />
                <span>Details</span>
              </Button>
              )}
            </div>
          )}

          <nav
            className={cn(
              "absolute inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom,0px))] z-[70]",
              "bg-card/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg",
              "grid grid-cols-5 gap-1 p-1"
            )}
            aria-label="Mobile primary navigation"
          >
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isMobileNavActive(item);
              const Icon = active ? item.iconActive : item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setShowMobileNav(false);
                    setShowMobileSecondary(false);
                    setShowMobileDetail(false);
                    navigate(item.path);
                  }}
                  className={cn(
                    "h-14 min-w-0 rounded-xl px-1 flex flex-col items-center justify-center gap-1",
                    "text-[10px] font-semibold transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                    active
                      ? "bg-muted text-vibe-orange"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  aria-label={`Go to ${item.label}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setShowMobileNav(true);
                setShowMobileSecondary(false);
                setShowMobileDetail(false);
              }}
              className={cn(
                "h-14 min-w-0 rounded-xl px-1 flex flex-col items-center justify-center gap-1",
                "text-[10px] font-semibold transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
                showMobileNav
                  ? "bg-muted text-vibe-orange"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              aria-label="Open more navigation"
              aria-expanded={showMobileNav}
            >
              {showMobileNav ? (
                <RiMoreFill className="h-5 w-5" aria-hidden="true" />
              ) : (
                <RiMoreLine className="h-5 w-5" aria-hidden="true" />
              )}
              <span>More</span>
            </button>
          </nav>
        </div>
      ) : null}

      {/* ── DESKTOP / TABLET LAYOUT ── */}
      {!isMobile && (
      <div ref={containerRef} className="h-full flex gap-2 overflow-hidden">
        {/* PANE 1: Navigation Rail (Sidebar) */}
        {showNavRail && (
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
              onSettingsClick={onSettingsClick}
            />
          </nav>
        )}

        {/* PANES 2/3/4: Content area — fades during org switch (D-11, 250ms) */}
        <div className={cn(
          "flex flex-1 gap-2 min-w-0 transition-opacity duration-250",
          isSwitching && "opacity-0"
        )}>

          {/* PANE 2: Secondary Panel */}
          {secondaryPane && (
            <div
              className={cn(
                // Base styles
                "flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm",
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

          {/* PANE 3: Main Content */}
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

          {/* PANE 4: Detail Panel Outlet (panelStore-bound pages) */}
          {showDetailPane && (
            <DetailPaneOutlet isTablet={isTablet} />
          )}

          {/* PANE 4 (custom): a true peer card — same styling as panes 2/3 —
              for pages whose detail isn't panelStore-bound. */}
          {detailPane && (
            <div
              className={cn(
                "flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm",
                "flex flex-col h-full z-10 overflow-hidden",
                "transition-all duration-500 ease-in-out animate-in slide-in-from-right-4",
                isTablet ? "w-[320px]" : "w-[360px]"
              )}
            >
              {detailPane}
            </div>
          )}

        </div>
      </div>
      )}

    </>
  );
}
