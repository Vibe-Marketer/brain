import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RiAddLine, RiSearchLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Hooks
import { useFolders } from '@/hooks/useFolders';
import { useHiddenFolders } from '@/hooks/useHiddenFolders';
import { useAllTranscriptsSettings } from '@/hooks/useAllTranscriptsSettings';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';

// Components
import { FolderSidebar } from '@/components/transcript-library/FolderSidebar';
import { TranscriptsTab } from '@/components/transcripts/TranscriptsTab';
import { SyncTab } from '@/components/transcripts/SyncTab';
import { AnalyticsTab } from '@/components/transcripts/AnalyticsTab';
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import { FolderManagementDialog } from "@/components/transcript-library/FolderManagementDialog";
import EditAllTranscriptsDialog from "@/components/EditAllTranscriptsDialog";
import { SidebarNav } from "@/components/ui/sidebar-nav";

// Tab Configuration - matching TranscriptsNew but without explicit "SYNC" tab text
// We will manually switch to "sync" view using the SideNav Plus button
type TabValue = "transcripts" | "analytics" | "sync";

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

export default function LoopLayoutDemo() {
  // --- Folder Logic ---
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const { folders, folderAssignments, deleteFolder, assignToFolder, isLoading: foldersLoading } = useFolders();
  const { hiddenFolders, toggleHidden } = useHiddenFolders();
  const {
    settings: allTranscriptsSettings,
    updateSettings: updateAllTranscriptsSettings,
    resetSettings: resetAllTranscriptsSettings,
    defaultSettings: allTranscriptsDefaults,
  } = useAllTranscriptsSettings();
  
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(folderAssignments).forEach((folderIds) => {
      folderIds.forEach((folderId) => {
        counts[folderId] = (counts[folderId] || 0) + 1;
      });
    });
    return counts;
  }, [folderAssignments]);

  const [totalCount, setTotalCount] = useState(0);

  // --- Dialog States ---
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderManagementOpen, setFolderManagementOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [editAllTranscriptsOpen, setEditAllTranscriptsOpen] = useState(false);

  // --- Tab Logic ---
  const [activeTab, setActiveTab] = useState<TabValue>("transcripts");
  const currentConfig = tabConfig[activeTab];
  const [searchQuery, setSearchQuery] = useState("");

  // --- Sidebar Logic ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // Control Nav Rail width (Icon vs Text)
  const [isLibraryOpen, setIsLibraryOpen] = useState(true); // Control Middle Panel visibility

  // --- Drag & Drop ---
  const dragHelpers = useDragAndDrop();
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
      <div className="h-full flex gap-3 overflow-hidden p-1">
        
        {/* CARD 1: Navigation Rail (Expandable) */}
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
            onSyncClick={() => setActiveTab("sync")}
            onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
          />
        </div>

        {/* CARD 2: Library Panel (Folders) - Collapsible */}
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
                        setActiveTab("transcripts");
                    }
                }}
                onNewFolder={() => setQuickCreateFolderOpen(true)}
                onManageFolders={() => setFolderManagementOpen(true)}
                onEditFolder={setEditingFolder}
                onDeleteFolder={(f) => deleteFolder(f.id)}
                hiddenFolders={[...hiddenFolders]}
                onToggleHidden={toggleHidden}
                onEditAllTranscripts={() => setEditAllTranscriptsOpen(true)}
                isCollapsed={false}
              />
          </div>
        </div>

        {/* CARD 3: Main Content (Transcripts/Tabs) */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-300">
            {/* 
               Exact Layout from TranscriptsNew.tsx:
               1. Tabs Header (TRANSCRIPTS | ANALYTICS) - Sync removed from here
               2. Full width line
               3. Page Header + Search
               4. Content
            */}
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
                <div className="px-4 md:px-10 pt-2 flex-shrink-0">
                  <TabsList>
                    <TabsTrigger value="transcripts">TRANSCRIPTS</TabsTrigger>
                    {/* Sync is hidden here, triggered by Plus Icon */}
                    <TabsTrigger value="analytics">ANALYTICS</TabsTrigger>
                  </TabsList>
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
                      <div className="relative w-64 flex-shrink-0">
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
}
