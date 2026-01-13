import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { RiSearchLine, RiAddLine } from "@remixicon/react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TranscriptsTab } from "@/components/transcripts/TranscriptsTab";
import { SyncTab } from "@/components/transcripts/SyncTab";
import { AnalyticsTab } from "@/components/transcripts/AnalyticsTab";
import { FolderSidebar } from "@/components/transcript-library/FolderSidebar";
import { AppShell } from "@/components/layout/AppShell";
import { useFolders } from "@/hooks/useFolders";
import { useHiddenFolders } from "@/hooks/useHiddenFolders";
import { useAllTranscriptsSettings } from "@/hooks/useAllTranscriptsSettings";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import EditAllTranscriptsDialog from "@/components/EditAllTranscriptsDialog";
import { FolderManagementDialog } from "@/components/transcript-library/FolderManagementDialog";
import { FOCUS_INLINE_SEARCH_EVENT } from "@/stores/searchStore";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for focus-inline-search events (triggered by Cmd/Ctrl+K)
  useEffect(() => {
    const handleFocusSearch = () => {
      // Focus the search input if we're on the transcripts tab
      if (activeTab === "transcripts" && searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    };

    window.addEventListener(FOCUS_INLINE_SEARCH_EVENT, handleFocusSearch);
    return () => window.removeEventListener(FOCUS_INLINE_SEARCH_EVENT, handleFocusSearch);
  }, [activeTab]);

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

  return (
    <DndContext
      onDragStart={(e) => dragHelpers.handleDragStart(e, [])}
      onDragEnd={handleDragEnd}
      onDragCancel={dragHelpers.handleDragCancel}
    >
      <AppShell
        config={{
          secondaryPane: (
            <>
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
            </>
          ),
          onSyncClick: () => handleTabChange("sync")
        }}
      >
        <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)} className="h-full flex flex-col">
          <div className="px-4 md:px-10 pt-2 flex-shrink-0">
            <div className="flex items-center gap-2">
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
              {/* Search Bar - Only for Transcripts (Cmd/Ctrl+K focuses this) */}
              {activeTab === "transcripts" && (
                <div className="relative w-64 flex-shrink-0 hidden md:block">
                  <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cb-ink-muted" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search transcripts... (⌘K)"
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
      </AppShell>

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
