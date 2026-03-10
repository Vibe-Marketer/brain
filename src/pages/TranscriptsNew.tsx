import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { RiSearchLine, RiFileTextLine, RiPlayCircleLine } from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TranscriptsTab } from "@/components/transcripts/TranscriptsTab";
import { SyncTab } from "@/components/transcripts/SyncTab";
import WorkspaceSidebarPane from "@/components/panes/WorkspaceSidebarPane";
import { AppShell } from "@/components/layout/AppShell";
import { BreadcrumbItem } from "@/components/ui/breadcrumb";
import {
  useFolders,
  useFolderAssignments,
  useAssignCallToFolder,
  useDeleteFolder,
  useCreateFolder,
} from "@/hooks/useFolders";
import { useOrgContext } from "@/hooks/useOrgContext";
import { usePersonalFolders, usePersonalFolderAssignments, useAssignCallToPersonalFolder } from "@/hooks/usePersonalFolders";
import { usePersonalTags } from "@/hooks/usePersonalTags";
import { useAuth } from "@/contexts/AuthContext";
import type { Folder } from "@/types/workspace";
import { useHiddenFolders } from "@/hooks/useHiddenFolders";
import { useAllTranscriptsSettings } from "@/hooks/useAllTranscriptsSettings";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import EditAllTranscriptsDialog from "@/components/EditAllTranscriptsDialog";
import { FolderManagementDialog } from "@/components/transcript-library/FolderManagementDialog";
import { FOCUS_INLINE_SEARCH_EVENT } from "@/stores/searchStore";

type TabValue = "transcripts" | "sync";

const tabConfig: Record<TabValue, {
  title: string;
  subtitle: string;
  icon: RemixiconComponentType;
}> = {
  transcripts: {
    title: "Transcripts",
    subtitle: "Search and manage your calls",
    icon: RiFileTextLine,
  },
  sync: {
    title: "Import Meetings",
    subtitle: "Sync from connected sources",
    icon: RiPlayCircleLine,
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

  // Folder hooks
  const { 
    activeOrgId, 
    activeWorkspaceId, 
    activeFolderId, 
    switchFolder 
  } = useOrgContext();
  const activeOrganizationId = activeOrgId; // alias for compatibility
  const { user } = useAuth();
  const { data: folders = [], isLoading: foldersLoading } = useFolders(activeWorkspaceId);
  const { data: folderAssignments = {} } = useFolderAssignments(activeWorkspaceId, activeOrganizationId);
  const { mutate: deleteFolder } = useDeleteFolder();
  const { mutate: assignToFolderMutation } = useAssignCallToFolder();

  const { settings: allTranscriptsSettings, updateSettings: updateAllTranscriptsSettings, resetSettings: resetAllTranscriptsSettings, defaultSettings: allTranscriptsDefaults } = useAllTranscriptsSettings();
  const { hiddenFolders, toggleHidden } = useHiddenFolders();
  
  // Personal data
  const { data: personalFolders = [] } = usePersonalFolders(activeOrgId);
  const { data: personalFolderAssignments = {} } = usePersonalFolderAssignments(activeOrgId);
  const { mutate: assignToPersonalFolderMutation } = useAssignCallToPersonalFolder();

  // Combine legacy and personal folders
  const allFolders = useMemo(() => [
    ...folders,
    ...personalFolders.map(f => ({ ...f, workspace_id: null })) // Mark as personal
  ], [folders, personalFolders]);

  // Combine assignments
  const allFolderAssignments = useMemo(() => {
    const combined = { ...folderAssignments };
    Object.entries(personalFolderAssignments).forEach(([callId, folderIds]) => {
      if (!combined[callId]) {
        combined[callId] = [];
      }
      combined[callId] = Array.from(new Set([...combined[callId], ...folderIds]));
    });
    return combined;
  }, [folderAssignments, personalFolderAssignments]);

  const assignToFolder = (callIds: number[], folderId: string) => {
    if (!user) return;
    
    // Determine if it's a personal folder
    const isPersonal = personalFolders.some(f => f.id === folderId);

    callIds.forEach(callId => {
      if (isPersonal) {
        assignToPersonalFolderMutation({
          recordingId: String(callId),
          folderId
        });
      } else {
        assignToFolderMutation({
          callRecordingId: callId,
          folderId,
          userId: user.id
        });
      }
    });
  };

  // Drag and drop for folder assignment
  const dragHelpers = useDragAndDrop();

  // Calculate folder counts from allFolderAssignments
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(allFolderAssignments).forEach((folderIds) => {
      folderIds.forEach((folderId) => {
        counts[folderId] = (counts[folderId] || 0) + 1;
      });
    });
    return counts;
  }, [allFolderAssignments]);

  // Total count for "Home"
  const [totalCount, setTotalCount] = useState(0);

  // Dialog state
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderManagementOpen, setFolderManagementOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
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

  const selectedFolder = useMemo(() => 
    allFolders.find(f => f.id === activeFolderId),
    [allFolders, activeFolderId]
  );

  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItem[] = [{ label: "Home", onClick: () => {
      switchFolder(null);
      handleTabChange("transcripts");
    }}];
    
    if (activeTab === "sync") {
      items.push({ label: "Import" });
    } else if (selectedFolder) {
      items.push({ label: selectedFolder.name });
    }
    
    return items;
  }, [activeTab, selectedFolder]);

  return (
    <DndContext
      onDragStart={(e) => dragHelpers.handleDragStart(e, [])}
      onDragEnd={handleDragEnd}
      onDragCancel={dragHelpers.handleDragCancel}
    >
      <AppShell
        config={{
          secondaryPane: (
            <WorkspaceSidebarPane />
          ),
          showDetailPane: true
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <PageHeader 
            title={activeTab === "sync" ? "Import Meetings" : (selectedFolder?.name || "Home")}
            subtitle={currentConfig.subtitle}
            icon={currentConfig.icon}
            breadcrumbs={breadcrumbs}
            actions={(
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
            )}
          />

          {/* Content */}
          <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)} className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden relative h-full">
            <TabsContent value="transcripts" className="mt-0 h-full absolute inset-0">
              <TranscriptsTab
                searchQuery={searchQuery}
                selectedFolderId={activeFolderId}
                onTotalCountChange={setTotalCount}
                sidebarState="expanded"
                onToggleSidebar={() => {}}
                folders={allFolders as any}
                folderAssignments={allFolderAssignments}
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
