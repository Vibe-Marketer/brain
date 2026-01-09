import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RiLoader2Line, RiQuestionLine, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { useUserRole } from "@/hooks/useUserRole";
import { useSetupWizard } from "@/hooks/useSetupWizard";
import { usePanelStore } from "@/stores/panelStore";
import FathomSetupWizard from "@/components/settings/FathomSetupWizard";
import { SettingHelpPanel, type SettingHelpTopic } from "@/components/panels/SettingHelpPanel";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { SettingsCategoryPane, type SettingsCategory, SETTINGS_CATEGORIES } from "@/components/panes/SettingsCategoryPane";
import { SettingsDetailPane } from "@/components/panes/SettingsDetailPane";

// Valid category IDs for URL validation
const VALID_CATEGORY_IDS = SETTINGS_CATEGORIES.map((c) => c.id);

export default function Settings() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const { loading: roleLoading, isAdmin, isTeam } = useUserRole();
  const { wizardCompleted, loading: wizardLoading, markWizardComplete } = useSetupWizard();

  // --- Responsive Breakpoint ---
  const { isMobile, isTablet } = useBreakpointFlags();

  // --- Sidebar Logic ---
  // Auto-collapse sidebar on tablet, expanded on desktop
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile nav overlay
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false); // Mobile bottom sheet for right panel

  // --- Pane System Logic (Dual Mode) ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory | null>(null);
  // Control visibility of the 2nd pane (category list)
  const [isCategoryPaneOpen, setIsCategoryPaneOpen] = useState(true);

  // --- Deep Link Handling ---
  // On initial load, read category from URL and validate
  useEffect(() => {
    if (urlCategory) {
      // Validate the category from URL
      if (VALID_CATEGORY_IDS.includes(urlCategory as SettingsCategory)) {
        // Check role-based access for restricted categories
        const categoryConfig = SETTINGS_CATEGORIES.find((c) => c.id === urlCategory);
        const hasAccess = !categoryConfig?.requiredRoles?.length ||
          (categoryConfig.requiredRoles.includes("ADMIN") && isAdmin) ||
          (categoryConfig.requiredRoles.includes("TEAM") && (isTeam || isAdmin));

        if (hasAccess && selectedCategory !== urlCategory) {
          setSelectedCategory(urlCategory as SettingsCategory);
          setIsCategoryPaneOpen(true);
        } else if (!hasAccess) {
          // Redirect to base settings if user doesn't have access
          navigate("/settings", { replace: true });
        }
      } else {
        // Invalid category in URL, redirect to base settings
        navigate("/settings", { replace: true });
      }
    } else if (!roleLoading) {
      // Auto-select first category if no URL category
      const firstCategory = SETTINGS_CATEGORIES[0];
      if (firstCategory && selectedCategory !== firstCategory.id) {
        setSelectedCategory(firstCategory.id);
        navigate(`/settings/${firstCategory.id}`, { replace: true });
      }
    }
  }, [urlCategory, isAdmin, isTeam, navigate, roleLoading]);

  // Sync URL when selectedCategory changes (for user interactions)
  useEffect(() => {
    // Skip URL sync on initial load (handled by urlCategory effect above)
    // Only sync when category changes via user interaction
    if (selectedCategory && selectedCategory !== urlCategory) {
      navigate(`/settings/${selectedCategory}`, { replace: true });
    } else if (!selectedCategory && urlCategory) {
      // If category is deselected, go back to base settings URL
      navigate("/settings", { replace: true });
    }
  }, [selectedCategory, urlCategory, navigate]);

  // --- Panel Store ---
  const { isPanelOpen, panelType, panelData, openPanel, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && panelType === 'setting-help';

  // Determine default tab based on role
  const getDefaultTab = () => {
    if (!wizardCompleted) return "account";
    return "account";
  };

  // Track current tab for contextual help
  const [currentTab, setCurrentTab] = useState(getDefaultTab());

  // Helper function to open help panel for a specific topic
  const openHelpPanel = (topic: SettingHelpTopic) => {
    openPanel('setting-help', { topic });
  };

  // Get help topic based on current tab
  const getHelpTopicForTab = (tab: string): SettingHelpTopic => {
    const topicMap: Record<string, SettingHelpTopic> = {
      account: "profile",
      users: "users",
      team: "users", // Team uses the same help topic as users for now
      coaches: "users", // Coaches use the same help topic as users for now
      billing: "billing",
      integrations: "integrations",
      ai: "ai",
      admin: "admin",
    };
    return topicMap[tab] || "profile";
  };

  // --- Keyboard Shortcuts ---
  // Escape: Close the help panel
  const handleEscapeShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    }
  }, [showRightPanel, closePanel]);

  // Cmd+/: Toggle help panel for current tab
  const handleHelpShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    } else {
      openHelpPanel(getHelpTopicForTab(currentTab));
    }
  }, [showRightPanel, closePanel, currentTab]);

  useKeyboardShortcut(handleEscapeShortcut, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: showRightPanel
  });

  useKeyboardShortcut(handleHelpShortcut, { key: '/' });

  // Sync tablet sidebar state - auto-collapse on tablet
  useEffect(() => {
    if (isTablet) {
      setIsSidebarExpanded(false);
    }
  }, [isTablet]);

  // Sync mobile bottom sheet with panel state
  useEffect(() => {
    if (isMobile && showRightPanel) {
      setShowMobileBottomSheet(true);
    } else if (!isMobile) {
      setShowMobileBottomSheet(false);
    }
  }, [isMobile, showRightPanel]);

  // Close mobile overlays when breakpoint changes away from mobile
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
      setShowMobileBottomSheet(false);
    }
  }, [isMobile]);

  // Handle closing the mobile bottom sheet
  const handleCloseMobileBottomSheet = useCallback(() => {
    setShowMobileBottomSheet(false);
    closePanel();
  }, [closePanel]);

  const handleWizardComplete = async () => {
    await markWizardComplete();
  };

  // --- Pane System Handlers ---
  // Handle Settings nav item click - ensure category pane is open
  const handleSettingsNavClick = useCallback(() => {
    setIsCategoryPaneOpen(true);
  }, []);

  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: SettingsCategory) => {
    setSelectedCategory(category);
    // Sync with tab state for dual mode
    setCurrentTab(category);
  }, []);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (roleLoading || wizardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RiLoader2Line className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Mobile overlay backdrop - for nav or bottom sheet */}
      {isMobile && (showMobileNav || showMobileBottomSheet) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => {
            if (showMobileNav) setShowMobileNav(false);
            if (showMobileBottomSheet) handleCloseMobileBottomSheet();
          }}
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
            onSettingsClick={handleSettingsNavClick}
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
                aria-label="Settings categories"
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
                  <span className="text-sm font-semibold">Settings</span>
                </div>
                <SettingsCategoryPane
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
                aria-label="Settings detail"
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
                  <span className="text-sm font-semibold">Settings</span>
                </div>
                <SettingsDetailPane
                  category={selectedCategory}
                  onClose={handleCloseDetailPane}
                  onBack={handleBackFromDetail}
                  showBackButton={true}
                  className="flex-1 min-h-0"
                />
              </div>
            )}
          </div>
        )}

        {/* PANE 1: Navigation Rail (Hidden on mobile, shown as overlay) */}
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
              onSettingsClick={handleSettingsNavClick}
            />
          </nav>
        )}

        {/* PANE 2: Settings Category List */}
        {!isMobile && isCategoryPaneOpen && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out",
              "w-[280px] opacity-100"
            )}
            role="navigation"
            aria-label="Settings categories"
          >
            <SettingsCategoryPane
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
            />
          </div>
        )}

        {/* PANE 3: Settings Detail (shown when category is selected) - NEW IMPLEMENTATION */}
        {!isMobile && selectedCategory && (
          <div
            className={cn(
              "flex-1 min-w-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out"
            )}
            role="region"
            aria-label="Settings detail"
          >
            <SettingsDetailPane
              category={selectedCategory}
              onClose={handleCloseDetailPane}
              onBack={handleBackFromDetail}
              showBackButton={false}
            />
          </div>
        )}

        {/* PANE 4: Removed - using new 3rd pane implementation instead of old content area */}

        {/* Right Panel - Settings Help (tablet and desktop) */}
        {!isMobile && (
          <aside
            role="complementary"
            aria-label="Settings help panel"
            aria-hidden={!showRightPanel}
            tabIndex={showRightPanel ? 0 : -1}
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full",
              "transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width,transform]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
              showRightPanel
                ? isTablet
                  ? "w-[320px] opacity-100 translate-x-0" // Narrower on tablet
                  : "w-[360px] opacity-100 translate-x-0" // Full width on desktop
                : "w-0 opacity-0 translate-x-4 border-0"
            )}
          >
            {showRightPanel && (
              <SettingHelpPanel topic={panelData?.topic as SettingHelpTopic} />
            )}
          </aside>
        )}
      </div>

      {/* Mobile Bottom Sheet - Settings Help */}
      {isMobile && showMobileBottomSheet && (
        <aside
          role="complementary"
          aria-label="Settings help panel"
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl border-t border-border/60 shadow-xl flex flex-col",
            "max-h-[85vh] animate-in slide-in-from-bottom duration-300"
          )}
        >
          {/* Bottom sheet handle/header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto"
                aria-hidden="true"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCloseMobileBottomSheet}
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              aria-label="Close panel"
            >
              <RiCloseLine className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          {/* Bottom sheet content */}
          <div className="flex-1 overflow-y-auto">
            {showRightPanel && (
              <SettingHelpPanel topic={panelData?.topic as SettingHelpTopic} />
            )}
          </div>
        </aside>
      )}

      {/* Fathom Setup Wizard */}
      {!wizardCompleted && (
        <FathomSetupWizard
          open={!wizardCompleted}
          onComplete={handleWizardComplete}
          onDismiss={handleWizardComplete}
        />
      )}
    </>
  );
}
