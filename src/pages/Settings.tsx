import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RiLoader2Line, RiQuestionLine, RiCloseLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { useUserRole } from "@/hooks/useUserRole";
import { useSetupWizard } from "@/hooks/useSetupWizard";
import { usePanelStore } from "@/stores/panelStore";
import AccountTab from "@/components/settings/AccountTab";
import BillingTab from "@/components/settings/BillingTab";
import IntegrationsTab from "@/components/settings/IntegrationsTab";
import UsersTab from "@/components/settings/UsersTab";
import AdminTab from "@/components/settings/AdminTab";
import AITab from "@/components/settings/AITab";
import FathomSetupWizard from "@/components/settings/FathomSetupWizard";
import { SettingHelpPanel, type SettingHelpTopic } from "@/components/panels/SettingHelpPanel";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function Settings() {
  const { loading: roleLoading, isAdmin, isTeam } = useUserRole();
  const { wizardCompleted, loading: wizardLoading, markWizardComplete } = useSetupWizard();

  // --- Responsive Breakpoint ---
  const { isMobile, isTablet } = useBreakpointFlags();

  // --- Sidebar Logic ---
  // Auto-collapse sidebar on tablet, expanded on desktop
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile nav overlay
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false); // Mobile bottom sheet for right panel

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
          />
        </nav>
      )}

      <div className="h-full flex gap-3 overflow-hidden p-1">

        {/* PANE 1: Navigation Rail (Hidden on mobile, shown as overlay) */}
        {!isMobile && (
          <nav
            role="navigation"
            aria-label="Main navigation"
            tabIndex={0}
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10",
              "transition-[width,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
              isSidebarExpanded ? "w-[240px]" : "w-[72px] items-center"
            )}
          >
            <div className="w-full px-2 mb-2 flex items-center justify-between">
              {/* Toggle Sidebar Button (Hamburger/Menu) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={isSidebarExpanded}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
              </Button>
              {isSidebarExpanded && <span className="text-sm font-semibold mr-auto ml-2">Menu</span>}
            </div>

            <SidebarNav
              isCollapsed={!isSidebarExpanded}
              className="w-full flex-1"
            />
          </nav>
        )}

        {/* PANE 3: Main Content (Settings/Tabs) - No Pane 2 for Settings per spec */}
        <main
          role="main"
          aria-label="Settings content"
          tabIndex={0}
          className={cn(
            "flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0",
            "transition-[flex,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2"
          )}
        >
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="h-full flex flex-col">
            {/* Mobile header with hamburger menu */}
            {isMobile && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileNav(true)}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
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
            )}

            {/* Tabs at the top */}
            <div className="px-4 md:px-10 pt-2 flex-shrink-0">
              <TabsList>
                <TabsTrigger value="account">ACCOUNT</TabsTrigger>
                {(isTeam || isAdmin) && (
                  <TabsTrigger value="users">USERS</TabsTrigger>
                )}
                <TabsTrigger value="billing">BILLING</TabsTrigger>
                <TabsTrigger value="integrations">INTEGRATIONS</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin">ADMIN</TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Full-width black line */}
            <div className="w-full border-b border-cb-black dark:border-cb-white flex-shrink-0" />

            {/* Page Header */}
            <div className="px-4 md:px-10 flex-shrink-0">
              <div className="mt-2 mb-3 flex items-start justify-between">
                <div>
                  <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
                    Settings
                  </h1>
                  <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
                    Manage your account, integrations, and preferences
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openHelpPanel(getHelpTopicForTab(currentTab))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Get help for this section"
                  aria-expanded={showRightPanel}
                >
                  <RiQuestionLine className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-auto px-4 md:px-10">
              {/* ACCOUNT TAB */}
              <TabsContent value="account" className="space-y-0 mt-0">
                <AccountTab />
              </TabsContent>

              {/* USERS TAB (TEAM/ADMIN only) */}
              {(isTeam || isAdmin) && (
                <TabsContent value="users" className="space-y-0 mt-0">
                  <UsersTab />
                </TabsContent>
              )}

              {/* BILLING TAB */}
              <TabsContent value="billing" className="space-y-0 mt-0">
                <BillingTab />
              </TabsContent>

              {/* INTEGRATIONS TAB */}
              <TabsContent value="integrations" className="space-y-0 mt-0">
                <IntegrationsTab />
              </TabsContent>

              {/* AI TAB */}
              <TabsContent value="ai" className="space-y-0 mt-0">
                <AITab />
              </TabsContent>

              {/* ADMIN TAB (ADMIN only) */}
              {isAdmin && (
                <TabsContent value="admin" className="space-y-0 mt-0">
                  <AdminTab />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </main>

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
