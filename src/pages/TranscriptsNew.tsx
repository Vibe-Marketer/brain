import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { RiSearchLine, RiAddLine, RiHome4Line } from "@remixicon/react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TranscriptsTab } from "@/components/transcripts/TranscriptsTab";
import { SyncTab } from "@/components/transcripts/SyncTab";
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

type TabValue = "transcripts" | "sync";

const tabConfig = {
  transcripts: {
    title: "TRANSCRIPTS",
    description: "Organize, search, and manage all your transcripts in one place.",
  },
  sync: {
    title: "SYNC & IMPORT",
    description: "Search and sync transcripts from your connected sources.",
  },
};

const TranscriptsNew = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive initial tab from URL, defaulting to "transcripts"
  const getTabFromUrl = (): TabValue => {
    const urlTab = searchParams.get("tab") as TabValue;
    if (urlTab && ["transcripts", "sync"].includes(urlTab)) {
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
            <FolderSidebar
                  folders={folders}
                  folderCounts={folderCounts}
                  totalCount={totalCount}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={(id) => {
                    setSelectedFolderId(id);
                    // If we select a folder, ensure we are on the transcripts tab
                    if (activeTab === "sync") {
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
          ),
          onSyncClick: () => handleTabChange("sync")
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header - standardized detail pane pattern */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <RiHome4Line className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">
                  Transcripts
                </h2>
                <p className="text-xs text-ink-muted">
                  {totalCount} transcript{totalCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {/* Search Bar */}
            <div className="relative w-64 flex-shrink-0 hidden md:block">
              <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <Input
                ref={searchInputRef}
                placeholder="Search transcripts... (⌘K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm bg-white dark:bg-card border-border"
              />
            </div>
          </header>

          {/* Content */}
          <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)} className="flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden relative h-full">
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
          </div>
        </Tabs>
        </div>
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
