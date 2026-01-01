import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RiLoader2Line, RiQuestionLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useBreakpoint } from "@/hooks/useBreakpoint";
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
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // --- Sidebar Logic ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // Control Nav Rail width (Icon vs Text)
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile nav overlay

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

  // Close mobile overlays when breakpoint changes away from mobile
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
    }
  }, [isMobile]);

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
      {/* Mobile overlay backdrop */}
      {isMobile && showMobileNav && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setShowMobileNav(false)}
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
      )}

      <div className="h-full flex gap-3 overflow-hidden p-1">

        {/* PANE 1: Navigation Rail (Hidden on mobile, shown as overlay) */}
        {!isMobile && (
          <nav
            role="navigation"
            aria-label="Main navigation"
            tabIndex={0}
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10 transition-all duration-300 ease-in-out",
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
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
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
            "flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-300",
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
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  title="Get help for this section"
                >
                  <RiQuestionLine className="h-5 w-5" />
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

        {/* Right Panel - Settings Help */}
        <aside
          role="complementary"
          aria-label="Settings help panel"
          tabIndex={showRightPanel ? 0 : -1}
          className={cn(
            "flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full transition-all duration-300 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
            showRightPanel ? "w-[360px] opacity-100" : "w-0 opacity-0 border-0"
          )}
        >
          {showRightPanel && (
            <SettingHelpPanel topic={panelData?.topic as SettingHelpTopic} />
          )}
        </aside>
      </div>

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
