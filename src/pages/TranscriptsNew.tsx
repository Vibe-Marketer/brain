import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { RiSearchLine, RiAddLine, RiMenuLine } from "@remixicon/react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TranscriptsTab } from "@/components/transcripts/TranscriptsTab";
import { SyncTab } from "@/components/transcripts/SyncTab";
import { AnalyticsTab } from "@/components/transcripts/AnalyticsTab";
import { FolderSidebar } from "@/components/transcript-library/FolderSidebar";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { useFolders } from "@/hooks/useFolders";
import { useHiddenFolders } from "@/hooks/useHiddenFolders";
import { useAllTranscriptsSettings } from "@/hooks/useAllTranscriptsSettings";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import EditAllTranscriptsDialog from "@/components/EditAllTranscriptsDialog";
import { FolderManagementDialog } from "@/components/transcript-library/FolderManagementDialog";
import { cn } from "@/lib/utils";

type TabValue = "transcripts" | "sync" | "analytics";

const tabConfig = {
  transcripts: {
    title: "TRANSCRIPTS",
    description: "Organize, search, and manage all your transcripts in one place.",
  },
  sync: {
    title: "SYNC & IMPORT",
    description: "Search and sync transcripts from your connected sources.",
  },
  analytics: {
    title: "ANALYTICS",
    description: "Insights and metrics about your call patterns and performance.",
  },
};

const TranscriptsNew = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive initial tab from URL, defaulting to "transcripts"
  const getTabFromUrl = (): TabValue => {
    const urlTab = searchParams.get("tab") as TabValue;
    if (urlTab && ["transcripts", "sync", "analytics"].includes(urlTab)) {
      return urlTab;
    }
    return "transcripts";
  };

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromUrl);

  // Single effect to handle URL changes (browser back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // Only depend on searchParams - activeTab changes are handled by handleTabChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle tab changes from user clicks
  const handleTabChange = (newTab: TabValue) => {
    setActiveTab(newTab);
    // Update URL immediately
    if (newTab === "transcripts") {
      // Remove tab param for default tab
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("tab");
      setSearchParams(newParams, { replace: true });
    } else {
      setSearchParams({ tab: newTab }, { replace: true });
    }
  };

  const currentConfig = tabConfig[activeTab];

  // Search state lifted to page level
  const [searchQuery, setSearchQuery] = useState("");

  // ============================================================================
  // 3-PANE LAYOUT STATE - Matching LoopLayoutDemo.tsx pattern
  // ============================================================================

  // Breakpoint detection for responsive behavior
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // PANE 1: Nav Rail state (expand/collapse)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // PANE 2: Library panel state (show/hide)
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  // Mobile overlay states
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);

  // Folder selection
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Folder hooks
  const { folders, folderAssignments, deleteFolder, assignToFolder, isLoading: foldersLoading } = useFolders();
  const { hiddenFolders, toggleHidden } = useHiddenFolders();
  const {
    settings: allTranscriptsSettings,
    updateSettings: updateAllTranscriptsSettings,
    resetSettings: resetAllTranscriptsSettings,
    defaultSettings: allTranscriptsDefaults,
  } = useAllTranscriptsSettings();

  // Drag and drop for folder assignment
  const dragHelpers = useDragAndDrop();

  // Calculate folder counts from folderAssignments
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(folderAssignments).forEach((folderIds) => {
      folderIds.forEach((folderId) => {
        counts[folderId] = (counts[folderId] || 0) + 1;
      });
    });
    return counts;
  }, [folderAssignments]);

  // Total count for "All Transcripts"
  const [totalCount, setTotalCount] = useState(0);

  // Dialog state
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderManagementOpen, setFolderManagementOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<typeof folders[0] | null>(null);
  const [editAllTranscriptsOpen, setEditAllTranscriptsOpen] = useState(false);

  // Handle drag end for folder assignment
  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    if (over?.data?.current?.type === "folder-zone" && dragHelpers.draggedItems.length > 0) {
      const folderId = over.data.current.folderId;
      assignToFolder(dragHelpers.draggedItems, folderId);
    }

    dragHelpers.handleDragEnd(event);
  };

  // Close mobile overlays when breakpoint changes away from mobile
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
      setShowMobileLibrary(false);
    }
  }, [isMobile]);

  return (
    <DndContext
      onDragStart={(e) => dragHelpers.handleDragStart(e, [])}
      onDragEnd={handleDragEnd}
      onDragCancel={dragHelpers.handleDragCancel}
    >
      {/* Mobile overlay backdrop */}
      {isMobile && (showMobileNav || showMobileLibrary) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => {
            setShowMobileNav(false);
            setShowMobileLibrary(false);
          }}
        />
      )}

      {/* Mobile Navigation Overlay */}
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
            onSyncClick={() => {
              handleTabChange("sync");
              setShowMobileNav(false);
            }}
            onLibraryToggle={() => {
              setShowMobileNav(false);
              setShowMobileLibrary(true);
            }}
          />
        </div>
      )}

      {/* Mobile Library Overlay */}
      {isMobile && showMobileLibrary && (
        <div
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
            <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">Library</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => {
                  setQuickCreateFolderOpen(true);
                  setShowMobileLibrary(false);
                }}
              >
                <RiAddLine className="w-4 h-4 opacity-70" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileLibrary(false)}
                className="text-muted-foreground hover:text-foreground h-6 w-6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden pt-2">
            <FolderSidebar
              folders={folders}
              folderCounts={folderCounts}
              totalCount={totalCount}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(id) => {
                setSelectedFolderId(id);
                setShowMobileLibrary(false);
                // Ensure we're on transcripts tab when selecting a folder
                if (activeTab !== "transcripts") {
                  handleTabChange("transcripts");
                }
              }}
              onNewFolder={() => {
                setQuickCreateFolderOpen(true);
                setShowMobileLibrary(false);
              }}
              onManageFolders={() => {
                setFolderManagementOpen(true);
                setShowMobileLibrary(false);
              }}
              onEditFolder={setEditingFolder}
              onDeleteFolder={(f) => deleteFolder(f.id)}
              hiddenFolders={hiddenFolders}
              onToggleHidden={toggleHidden}
              onEditAllTranscripts={() => {
                setEditAllTranscriptsOpen(true);
                setShowMobileLibrary(false);
              }}
              isCollapsed={false}
            />
          </div>
        </div>
      )}

      {/* 3-Pane Layout Container - Matches LoopLayoutDemo.tsx */}
      <div className="h-full flex gap-3 overflow-hidden p-1">

        {/* PANE 1: Navigation Rail (Expandable) - Hidden on mobile */}
        {!isMobile && (
          <div
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10 transition-all duration-300 ease-in-out",
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
              onSyncClick={() => handleTabChange("sync")}
              onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
            />
          </div>
        )}

        {/* PANE 2: Library Panel (Folders) - Collapsible, Hidden on mobile */}
        {!isMobile && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden transition-all duration-500 ease-in-out",
              isLibraryOpen ? "w-[280px] opacity-100 ml-0" : "w-0 opacity-0 -ml-3 border-0"
            )}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
              <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">Library</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setQuickCreateFolderOpen(true)}>
                <RiAddLine className="w-4 h-4 opacity-70" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden pt-2">
              <FolderSidebar
                folders={folders}
                folderCounts={folderCounts}
                totalCount={totalCount}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => {
                  setSelectedFolderId(id);
                  // If we select a folder, ensure we are on the transcripts tab
                  if (activeTab === "sync" || activeTab === "analytics") {
                    handleTabChange("transcripts");
                  }
                }}
                onNewFolder={() => setQuickCreateFolderOpen(true)}
                onManageFolders={() => setFolderManagementOpen(true)}
                onEditFolder={setEditingFolder}
                onDeleteFolder={(f) => deleteFolder(f.id)}
                hiddenFolders={hiddenFolders}
                onToggleHidden={toggleHidden}
                onEditAllTranscripts={() => setEditAllTranscriptsOpen(true)}
                isCollapsed={false}
              />
            </div>
          </div>
        )}

        {/* PANE 3: Main Content (Transcripts/Tabs) */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-300">
          <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)} className="h-full flex flex-col">
            <div className="px-4 md:px-10 pt-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                {/* Mobile navigation menu toggle */}
                {isMobile && (
                  <Button
                    variant="hollow"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowMobileNav(true)}
                  >
                    <RiMenuLine className="h-5 w-5" />
                  </Button>
                )}
                {/* Mobile library toggle */}
                {isMobile && (
                  <Button
                    variant="hollow"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowMobileLibrary(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2"/>
                      <path d="M9 3v18"/>
                    </svg>
                  </Button>
                )}
                <TabsList>
                  <TabsTrigger value="transcripts">TRANSCRIPTS</TabsTrigger>
                  {/* Sync is hidden here on desktop, triggered by Plus Icon in Nav Rail */}
                  <TabsTrigger value="analytics">ANALYTICS</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="w-full border-b border-cb-black dark:border-cb-white flex-shrink-0" />

            {/* Dynamic Page Header */}
            <div className="px-4 md:px-10 flex-shrink-0">
              <div className="mt-2 mb-2 flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cb-gray-dark dark:text-cb-gray-light uppercase tracking-wider mb-0.5">
                    LIBRARY
                  </p>
                  <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
                    {currentConfig.title}
                  </h1>
                  <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">{currentConfig.description}</p>
                </div>
                {/* Search Bar - Only for Transcripts */}
                {activeTab === "transcripts" && (
                  <div className="relative w-64 flex-shrink-0 hidden md:block">
                    <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cb-ink-muted" />
                    <Input
                      placeholder="Search transcripts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8 text-sm bg-white dark:bg-cb-card border-cb-border"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tab Content Areas */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <TabsContent value="transcripts" className="mt-0 h-full absolute inset-0">
                <TranscriptsTab
                  searchQuery={searchQuery}
                  selectedFolderId={selectedFolderId}
                  onTotalCountChange={setTotalCount}
                  sidebarState="expanded"
                  onToggleSidebar={() => {}}
                  folders={folders}
                  folderAssignments={folderAssignments}
                  assignToFolder={assignToFolder}
                  dragHelpers={{
                    ...dragHelpers,
                    activeDragId: dragHelpers.activeDragId ? String(dragHelpers.activeDragId) : null
                  }}
                />
              </TabsContent>

              <TabsContent value="sync" className="mt-0 h-full overflow-auto absolute inset-0 p-4 md:p-10">
                <SyncTab />
              </TabsContent>

              <TabsContent value="analytics" className="mt-0 h-full overflow-auto absolute inset-0 p-4 md:p-10">
                <AnalyticsTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>

      </div>

      {/* Dialogs */}
      <QuickCreateFolderDialog
        open={quickCreateFolderOpen}
        onOpenChange={setQuickCreateFolderOpen}
      />
      {folderManagementOpen && (
        <FolderManagementDialog
          open={folderManagementOpen}
          onOpenChange={setFolderManagementOpen}
          folders={folders}
          transcriptCounts={folderCounts}
          onCreateFolder={() => {
            setFolderManagementOpen(false);
            setQuickCreateFolderOpen(true);
          }}
          onEditFolder={(folder) => {
            setFolderManagementOpen(false);
            setEditingFolder(folder);
          }}
          onDeleteFolder={(folder) => deleteFolder(folder.id)}
        />
      )}
      {editingFolder && (
        <EditFolderDialog
          folder={editingFolder}
          open={!!editingFolder}
          onOpenChange={(open) => !open && setEditingFolder(null)}
        />
      )}
      {editAllTranscriptsOpen && (
        <EditAllTranscriptsDialog
          open={editAllTranscriptsOpen}
          onOpenChange={setEditAllTranscriptsOpen}
          settings={allTranscriptsSettings}
          onSave={updateAllTranscriptsSettings}
          onReset={resetAllTranscriptsSettings}
          defaultSettings={allTranscriptsDefaults}
        />
      )}
    </DndContext>
  );
};

export default TranscriptsNew;
