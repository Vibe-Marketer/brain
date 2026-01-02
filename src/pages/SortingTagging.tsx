import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { FoldersTab } from "@/components/tags/FoldersTab";
import { TagsTab } from "@/components/tags/TagsTab";
import { RulesTab } from "@/components/tags/RulesTab";
import { RecurringTitlesTab } from "@/components/tags/RecurringTitlesTab";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { usePanelStore } from "@/stores/panelStore";
import { FolderDetailPanel } from "@/components/panels/FolderDetailPanel";
import { TagDetailPanel } from "@/components/panels/TagDetailPanel";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { RiCloseLine } from "@remixicon/react";
import { SortingCategoryPane, type SortingCategory } from "@/components/panes/SortingCategoryPane";
import { SortingDetailPane } from "@/components/panes/SortingDetailPane";

type TabValue = "folders" | "tags" | "rules" | "recurring";

const tabConfig = {
  folders: {
    title: "FOLDERS",
    description: "Create and manage folders to organize your calls.",
  },
  tags: {
    title: "TAGS",
    description: "View available call tags. Tags classify calls and control AI behavior.",
  },
  rules: {
    title: "RULES",
    description: "Create and manage rules for automatic sorting and tagging.",
  },
  recurring: {
    title: "RECURRING TITLES",
    description: "View your most common call titles and create sorting rules.",
  },
};

export default function SortingTagging() {
  // --- Tab Logic ---
  const [activeTab, setActiveTab] = useState<TabValue>("folders");
  const currentConfig = tabConfig[activeTab];

  // --- Responsive Breakpoint ---
  const { isMobile, isTablet } = useBreakpointFlags();

  // --- Sidebar Logic ---
  // Auto-collapse sidebar on tablet, expanded on desktop
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); // Control Middle Panel visibility (default closed for settings)
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile nav overlay
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false); // Mobile bottom sheet for right panel

  // --- Pane System Logic (Dual Mode) ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] = useState<SortingCategory | null>(null);
  // Control visibility of the 2nd pane (category list)
  const [isCategoryPaneOpen, setIsCategoryPaneOpen] = useState(true);

  // --- Panel Store ---
  const { isPanelOpen, panelType, panelData, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && (panelType === 'folder-detail' || panelType === 'tag-detail');

  // --- Keyboard Shortcuts ---
  // Escape: Close the detail panel
  const handleEscapeShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    }
  }, [showRightPanel, closePanel]);

  useKeyboardShortcut(handleEscapeShortcut, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: showRightPanel
  });

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

  // --- Pane System Handlers ---
  // Handle Sorting nav item click - ensure category pane is open
  const handleSortingNavClick = useCallback(() => {
    setIsCategoryPaneOpen(true);
  }, []);

  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: SortingCategory) => {
    setSelectedCategory(category);
    // Sync with tab state for dual mode
    setActiveTab(category);
  }, []);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
  }, []);

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
            onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
            onSortingClick={handleSortingNavClick}
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
              onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
              onSortingClick={handleSortingNavClick}
            />
          </nav>
        )}

        {/* PANE 2: Sorting Category List (Dual Mode - visible alongside tabs) */}
        {!isMobile && isCategoryPaneOpen && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out",
              "w-[280px] opacity-100"
            )}
            role="navigation"
            aria-label="Sorting and tagging categories"
          >
            <SortingCategoryPane
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
            />
          </div>
        )}

        {/* PANE 3: Sorting Detail (shown when category is selected, alongside tabs in dual mode) */}
        {!isMobile && selectedCategory && (
          <div
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-all duration-500 ease-in-out",
              "w-[400px] opacity-100"
            )}
            role="region"
            aria-label="Sorting detail"
          >
            <SortingDetailPane
              category={selectedCategory}
              onClose={handleCloseDetailPane}
              onBack={handleBackFromDetail}
              showBackButton={false}
            />
          </div>
        )}

        {/* PANE 4: Main Content (Sorting/Tabs) - Tabs preserved for dual mode */}
        <main
          role="main"
          aria-label="Sorting and tagging content"
          tabIndex={0}
          className={cn(
            "flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0",
            "transition-[flex,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2"
          )}
        >
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
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
            <div className="px-4 md:px-10 pt-2 flex-shrink-0">
              <TabsList>
                <TabsTrigger value="folders">FOLDERS</TabsTrigger>
                <TabsTrigger value="tags">TAGS</TabsTrigger>
                <TabsTrigger value="rules">RULES</TabsTrigger>
                <TabsTrigger value="recurring">RECURRING</TabsTrigger>
              </TabsList>
            </div>

          {/* Full-width line */}
          <div className="w-full border-b border-cb-black dark:border-cb-white flex-shrink-0" />

          {/* Page Header */}
          <div className="px-4 md:px-10 flex-shrink-0">
            <div className="mt-2 mb-3">
              <p className="text-sm font-semibold text-cb-gray-dark dark:text-cb-gray-light uppercase tracking-wider mb-0.5">
                SETTINGS
              </p>
              <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
                {currentConfig.title}
              </h1>
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">{currentConfig.description}</p>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-auto px-4 md:px-10">
            <TabsContent value="folders" className="mt-0">
              <FoldersTab />
            </TabsContent>

            <TabsContent value="tags" className="mt-0">
              <TagsTab />
            </TabsContent>

            <TabsContent value="rules" className="mt-0">
              <RulesTab />
            </TabsContent>

            <TabsContent value="recurring" className="mt-0">
              <RecurringTitlesTab />
            </TabsContent>
          </div>
        </Tabs>
      </main>

        {/* PANE 5: Right Panel - Detail view for selected folder/tag (tablet and desktop) */}
        {!isMobile && (
          <aside
            role="complementary"
            aria-label={panelType === 'folder-detail' ? "Folder detail panel" : panelType === 'tag-detail' ? "Tag detail panel" : "Detail panel"}
            aria-hidden={!showRightPanel}
            tabIndex={showRightPanel ? 0 : -1}
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden",
              "transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width,transform]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
              showRightPanel
                ? isTablet
                  ? "w-[320px] opacity-100 translate-x-0" // Narrower on tablet
                  : "w-[360px] opacity-100 translate-x-0" // Full width on desktop
                : "w-0 opacity-0 translate-x-4 border-0"
            )}
          >
            {showRightPanel && panelType === 'folder-detail' && panelData?.folderId && (
              <FolderDetailPanel folderId={panelData.folderId} />
            )}
            {showRightPanel && panelType === 'tag-detail' && panelData?.tagId && (
              <TagDetailPanel tagId={panelData.tagId} />
            )}
          </aside>
        )}
    </div>

      {/* Mobile Bottom Sheet - Detail view for selected folder/tag */}
      {isMobile && showMobileBottomSheet && (
        <aside
          role="complementary"
          aria-label={panelType === 'folder-detail' ? "Folder detail panel" : panelType === 'tag-detail' ? "Tag detail panel" : "Detail panel"}
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
            {showRightPanel && panelType === 'folder-detail' && panelData?.folderId && (
              <FolderDetailPanel folderId={panelData.folderId} />
            )}
            {showRightPanel && panelType === 'tag-detail' && panelData?.tagId && (
              <TagDetailPanel tagId={panelData.tagId} />
            )}
          </div>
        </aside>
      )}
  </>
  );
}
