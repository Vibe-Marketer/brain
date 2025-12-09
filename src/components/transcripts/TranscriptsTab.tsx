import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { RiMenuLine, RiLayoutLeftLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { TranscriptTableSkeleton } from "@/components/ui/transcript-table-skeleton";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types/meetings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireUser } from "@/lib/auth-utils";

import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
import QuickCreateTagDialog from "@/components/QuickCreateTagDialog";
import { TagManagementDialog } from "@/components/transcript-library/TagManagementDialog";
import { FilterBar } from "@/components/transcript-library/FilterBar";
import { BulkActionToolbarEnhanced } from "@/components/transcript-library/BulkActionToolbarEnhanced";
import { useFolders } from "@/hooks/useFolders";
import { DragDropZones } from "@/components/transcript-library/DragDropZones";
import { EmptyState } from "@/components/transcript-library/EmptyStates";
import { AIProcessingProgress } from "@/components/transcripts/AIProcessingProgress";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import SmartExportDialog from "@/components/SmartExportDialog";
import AssignFolderDialog from "@/components/AssignFolderDialog";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";
import EditAllTranscriptsDialog from "@/components/EditAllTranscriptsDialog";
import { FolderManagementDialog } from "@/components/transcript-library/FolderManagementDialog";
import { FolderSidebar } from "@/components/transcript-library/FolderSidebar";
import { useAllTranscriptsSettings } from "@/hooks/useAllTranscriptsSettings";
import {
  ChatOuterCard,
  ChatInnerCard,
} from "@/components/chat/chat-main-card";
import {
  FilterState,
  parseSearchSyntax,
  syntaxToFilters,
  filtersToURLParams,
  urlParamsToFilters,
} from "@/lib/filter-utils";

interface Tag {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * TranscriptsTab Component
 * 
 * Extracted from TranscriptLibrary for use in tabbed interface.
 * Contains all transcript management functionality without page header.
 */
export function TranscriptsTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Removed viewMode - only one table view now

  // Selection & interaction state
  const [selectedCalls, setSelectedCalls] = useState<number[]>([]);
  const [selectedCall, setSelectedCall] = useState<Meeting | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hostEmail, setHostEmail] = useState<string>("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state - initialize from URL params
  const [filters, setFilters] = useState<Partial<FilterState>>(() => {
    return urlParamsToFilters(searchParams);
  });

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    duration: true,
    participants: true,
    tags: true,
    folders: true,
  });

  // Sidebar state - 'expanded' (full) | 'collapsed' (icons only)
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed'>('expanded');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Helper to toggle sidebar state
  const toggleSidebar = () => {
    setSidebarState(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
  };

  // Dialog state
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const [smartExportOpen, setSmartExportOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taggingCallId, setTaggingCallId] = useState<number | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderManagementOpen, setFolderManagementOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<typeof folders[0] | null>(null);
  const [folderingCallId, setFolderingCallId] = useState<number | null>(null);

  // Load host email
  useEffect(() => {
    // Track if component is still mounted to prevent state updates after unmount
    let isMounted = true;

    const loadHostEmail = async () => {
      try {
        // Use safe pattern to handle network errors
        const userResponse = await supabase.auth.getUser();

        // Check for errors in the response (network issues, etc.)
        if (userResponse.error) {
          logger.warn("Error getting user for host email", userResponse.error);
          return;
        }

        const user = userResponse.data?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from("user_settings")
          .select("host_email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if (isMounted) {
            logger.warn("Error fetching host email", error);
          }
          return;
        }

        if (isMounted && data?.host_email) {
          setHostEmail(data.host_email);
        }
      } catch (error) {
        // Only log errors if component is still mounted
        if (isMounted) {
          logger.error("Error loading host email", error);
        }
      }
    };

    loadHostEmail();

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Tag[];
    },
  });

  // Fetch folders
  const { folders, folderAssignments, deleteFolder, assignToFolder, isLoading: foldersLoading } = useFolders();

  // All Transcripts customization settings
  const { settings: allTranscriptsSettings, updateSettings: updateAllTranscriptsSettings, resetSettings: resetAllTranscriptsSettings, defaultSettings: allTranscriptsDefaults } = useAllTranscriptsSettings();
  const [editAllTranscriptsOpen, setEditAllTranscriptsOpen] = useState(false);

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

  // Drag and drop helpers
  const dragHelpers = useDragAndDrop();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingTagTranscripts, setPendingTagTranscripts] = useState<number[]>([]);

  // Update URL params when filters change (preserve tab param)
  useEffect(() => {
    const filterParams = filtersToURLParams(filters);
    const newParams = new URLSearchParams(searchParams);

    // Preserve the tab parameter
    const currentTab = newParams.get("tab");

    // Remove all filter-related params first, then add new ones
    ["from", "to", "participants", "categories", "durMin", "durMax", "tags", "folders"].forEach(key => {
      newParams.delete(key);
    });

    // Add filter params
    filterParams.forEach((value, key) => {
      newParams.set(key, value);
    });

    // Restore tab if it was set
    if (currentTab) {
      newParams.set("tab", currentTab);
    }

    // Only update if actually changed
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  // Parse search syntax
  const syntax = useMemo(() => {
    if (!searchQuery) return {
      plainText: "",
      filters: {
        participant: [],
        date: "",
        tag: [],
        duration: "",
        status: []
      }
    };
    return parseSearchSyntax(searchQuery);
  }, [searchQuery]);

  // Combine filters from search syntax and filter panel
  const combinedFilters = useMemo(() => {
    const syntaxFilters = syntaxToFilters(syntax);
    return { ...filters, ...syntaxFilters };
  }, [syntax, filters]);

  // Fetch calls with filters
  const { data: calls = [], isLoading: callsLoading } = useQuery({
    queryKey: ["tag-calls", searchQuery, combinedFilters, page, pageSize],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("fathom_calls")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Tag filter (multiple tags)
      if (combinedFilters.tags && combinedFilters.tags.length > 0) {
        const { data: assignments } = await supabase
          .from("call_tag_assignments")
          .select("call_recording_id")
          .in("tag_id", combinedFilters.tags);

        if (assignments && assignments.length > 0) {
          const recordingIds = assignments.map((a) => a.call_recording_id);
          query = query.in("recording_id", recordingIds);
        } else {
          return [];
        }
      }

      // Search query (plain text)
      if (syntax.plainText) {
        query = query.or(`title.ilike.%${syntax.plainText}%,summary.ilike.%${syntax.plainText}%,full_transcript.ilike.%${syntax.plainText}%`);
      }

      // Date filters
      if (combinedFilters.dateFrom) {
        query = query.gte("created_at", combinedFilters.dateFrom.toISOString());
      }
      if (combinedFilters.dateTo) {
        query = query.lte("created_at", combinedFilters.dateTo.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count || 0);

      // Client-side filtering for complex queries
      let filteredData = data || [];

      // Filter by participants
      if (combinedFilters.participants && combinedFilters.participants.length > 0) {
        filteredData = filteredData.filter((call) => {
          const invitees = call.calendar_invitees as Array<{ name?: string; email?: string }>;
          if (!invitees) return false;
          return combinedFilters.participants!.some((p) =>
            invitees.some((inv) => inv.name?.toLowerCase().includes(p.toLowerCase()) || inv.email?.toLowerCase().includes(p.toLowerCase()))
          );
        });
      }

      return filteredData;
    },
  });

  // Fetch tag assignments for displayed calls
  // Filter out any undefined/null entries to prevent "Cannot read properties of undefined" errors
  // Also filter by selected folder if one is selected
  const validCalls = useMemo(() => {
    let filtered = calls.filter(c => c && c.recording_id != null);

    // Filter by selected folder (null = inbox = show all)
    if (selectedFolderId) {
      // Specific folder: show transcripts in that folder
      filtered = filtered.filter(call => {
        const callFolders = folderAssignments[call.recording_id] || [];
        return callFolders.includes(selectedFolderId);
      });
    }

    return filtered;
  }, [calls, selectedFolderId, folderAssignments]);
  const { data: tagAssignments = {} } = useQuery({
    queryKey: ["tag-assignments", validCalls.map(c => c.recording_id)],
    queryFn: async () => {
      if (validCalls.length === 0) return {};

      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select("call_recording_id, tag_id")
        .in("call_recording_id", validCalls.map(c => c.recording_id));

      if (error) throw error;

      const assignments: Record<string, string[]> = {};
      data?.forEach((assignment) => {
        if (!assignments[assignment.call_recording_id]) {
          assignments[assignment.call_recording_id] = [];
        }
        assignments[assignment.call_recording_id].push(assignment.tag_id);
      });

      return assignments;
    },
    enabled: calls.length > 0,
  });

  // Bulk tag mutation
  const tagMutation = useMutation({
    mutationFn: async ({ callIds, tagId }: { callIds: number[]; tagId: string }) => {
      const user = await requireUser();

      // Remove existing tag assignments
      await supabase
        .from("call_tag_assignments")
        .delete()
        .in("call_recording_id", callIds);

      // Create new assignments
      const assignments = callIds.map((callId) => ({
        call_recording_id: callId,
        tag_id: tagId,
        auto_assigned: false,
      }));

      const { error } = await supabase
        .from("call_tag_assignments")
        .insert(assignments);
      if (error) throw error;
    },
    onMutate: ({ callIds, tagId }) => {
      const tag = tags.find((t) => t.id === tagId);
      const tagName = tag?.name || "Untagged";
      const count = callIds.length;
      const toastId = toast.loading(
        `Moving ${count} transcript${count > 1 ? 's' : ''} to ${tagName}...`
      );
      return { toastId };
    },
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
      queryClient.invalidateQueries({ queryKey: ["tag-assignments"] });
      const tag = tags.find((t) => t.id === variables.tagId);
      const tagName = tag?.name || "Untagged";
      const count = variables.callIds.length;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} moved to ${tagName}`, {
        id: context?.toastId
      });
      setSelectedCalls([]);
    },
    onError: (_error, _variables, context) => {
      toast.error("Failed to tag transcript(s)", {
        id: context?.toastId
      });
    },
  });

  // Untag mutation
  const untagMutation = useMutation({
    mutationFn: async ({ callIds }: { callIds: number[] }) => {
      const { error } = await supabase
        .from("call_tag_assignments")
        .delete()
        .in("call_recording_id", callIds);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
      queryClient.invalidateQueries({ queryKey: ["tag-assignments"] });
      const count = variables.callIds.length;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} untagged`);
      setSelectedCalls([]);
    },
    onError: () => {
      toast.error("Failed to untag transcript(s)");
    },
  });

  // Delete calls mutation - CASCADE deletes from all related tables
  const deleteCallsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const user = await requireUser();

      logger.info("Starting delete for IDs", ids);

      // Delete from all related tables first - throw errors to stop execution
      const { error: assignmentsError } = await supabase
        .from("call_tag_assignments")
        .delete()
        .in("call_recording_id", ids);
      if (assignmentsError) {
        logger.error("Error deleting tag assignments", assignmentsError);
        throw assignmentsError;
      }

      const { error: tagsError } = await supabase
        .from("transcript_tag_assignments")
        .delete()
        .in("call_recording_id", ids);
      if (tagsError) {
        logger.error("Error deleting tag assignments", tagsError);
        throw tagsError;
      }

      // NOTE: contact_call_associations and intel_items tables deleted (orphaned features)
      // Removed deletion attempts to prevent errors

      const { error: speakersError } = await supabase
        .from("call_speakers")
        .delete()
        .in("call_recording_id", ids);
      if (speakersError) {
        logger.error("Error deleting speakers", speakersError);
        throw speakersError;
      }

      const { error: transcriptsError } = await supabase
        .from("fathom_transcripts")
        .delete()
        .in("recording_id", ids);
      if (transcriptsError) {
        logger.error("Error deleting transcripts", transcriptsError);
        throw transcriptsError;
      }
      
      // Finally delete the main call record with user verification
      const { data: deletedCalls, error } = await supabase
        .from("fathom_calls")
        .delete()
        .in("recording_id", ids)
        .eq("user_id", user.id)
        .select();
        
      if (error) {
        logger.error("Error deleting fathom_calls", error);
        throw error;
      }

      logger.info("Successfully deleted calls", deletedCalls);
      return deletedCalls;
    },
    onSuccess: async (deletedCalls) => {
      logger.info("Delete mutation succeeded, refetching queries");
      // Force immediate refetch of all queries
      await queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
      await queryClient.invalidateQueries({ queryKey: ["tag-assignments"] });
      setSelectedCalls([]);
      setShowDeleteDialog(false);
      const count = deletedCalls?.length || 0;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} deleted successfully`);
    },
    onError: (error: Error) => {
      setShowDeleteDialog(false);
      logger.error("Delete mutation failed", error);
      toast.error(`Failed to delete transcript(s): ${error.message || "Unknown error"}`);
    },
  });

  const handleDeleteCalls = () => {
    if (selectedCalls.length === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmDeleteCalls = () => {
    deleteCallsMutation.mutate(selectedCalls);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    if (over) {
      // Handle untag
      if (over.data?.current?.type === "untag-zone") {
        untagMutation.mutate({
          callIds: dragHelpers.draggedItems,
        });
        setSelectedCalls([]);
      }

      // Handle create new tag
      if (over.data?.current?.type === "create-new-zone") {
        setIsQuickCreateOpen(true);
        setPendingTagTranscripts(dragHelpers.draggedItems);
      }

      // Handle drop on tag zones
      if (over.data?.current?.type === "tag-zone") {
        const tagId = over.data.current.tagId;
        tagMutation.mutate({
          callIds: dragHelpers.draggedItems,
          tagId,
        });
        setSelectedCalls([]);
      }

      // Handle drop on folder zones (from FolderSidebar)
      if (over.data?.current?.type === "folder-zone") {
        const folderId = over.data.current.folderId;
        assignToFolder(dragHelpers.draggedItems, folderId);
        setSelectedCalls([]);
      }
    }

    dragHelpers.handleDragEnd(event);
  };


  return (
    <DndContext
      onDragStart={(e) => dragHelpers.handleDragStart(e, selectedCalls)}
      onDragEnd={handleDragEnd}
      onDragCancel={dragHelpers.handleDragCancel}
    >
      {/* Drag Drop Zones - Shows when dragging */}
      {dragHelpers.activeDragId && (
        <DragDropZones
          tags={tags}
          isDragging={true}
          onDrop={(tagId) => {
            tagMutation.mutate({
              callIds: dragHelpers.draggedItems,
              tagId,
            });
          }}
          onUntag={() => {
            untagMutation.mutate({
              callIds: dragHelpers.draggedItems,
            });
          }}
          onCreateNew={() => {
            setIsQuickCreateOpen(true);
            setPendingTagTranscripts(dragHelpers.draggedItems);
          }}
        />
      )}

      {/* Mobile sidebar overlay backdrop - only when expanded on mobile */}
      {sidebarState === 'expanded' && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarState('collapsed')}
        />
      )}

      {/* BG-CARD-MAIN: Browser window container */}
      <ChatOuterCard className="h-[calc(100vh-120px)]">
        {/* SIDEBAR - Expanded (280px) or Collapsed (icons only)
            Collapsed width: 56px = 40px icon + 8px padding on each side */}
        <div
          className={`
            ${sidebarState === 'expanded' ? 'fixed inset-y-0 left-0 z-50 shadow-2xl md:relative md:shadow-none w-[280px]' : 'w-[56px]'}
            flex-shrink-0 transition-all duration-200
          `}
        >
          <FolderSidebar
            folders={folders}
            folderCounts={folderCounts}
            totalCount={totalCount}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(folderId) => {
              setSelectedFolderId(folderId);
              // Only collapse sidebar on mobile
              if (window.innerWidth < 768) {
                setSidebarState('collapsed');
              }
            }}
            isCollapsed={sidebarState === 'collapsed'}
            onNewFolder={() => setQuickCreateFolderOpen(true)}
            onManageFolders={() => setFolderManagementOpen(true)}
            onEditFolder={(folder) => setEditingFolder(folder)}
            onDeleteFolder={(folder) => deleteFolder(folder.id)}
            isDragging={!!dragHelpers.activeDragId}
            isLoading={foldersLoading}
            allTranscriptsSettings={allTranscriptsSettings}
            onEditAllTranscripts={() => setEditAllTranscriptsOpen(true)}
          />
        </div>

        {/* BG-CARD-INNER: Main content */}
        <ChatInnerCard>
          {/* Header with sidebar toggle */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle button */}
              <Button
                variant="hollow"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={toggleSidebar}
                title={sidebarState === 'expanded' ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarState === 'expanded' ? (
                  <RiLayoutLeftLine className="h-5 w-5" />
                ) : (
                  <RiMenuLine className="h-5 w-5" />
                )}
              </Button>

              {/* Filter bar - moved to header */}
              <div className="flex-1">
                <FilterBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  tags={tags}
                  folders={folders}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onCreateFolder={() => setQuickCreateFolderOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* Content area with scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Bulk Actions Toolbar */}
            {selectedCalls.length > 0 && (
              <ErrorBoundary>
                <BulkActionToolbarEnhanced
                  selectedCount={selectedCalls.length}
                  selectedCalls={validCalls.filter(c => selectedCalls.includes(c.recording_id))}
                  tags={tags}
                  onTag={(tagId) => {
                    tagMutation.mutate({
                      callIds: selectedCalls,
                      tagId,
                    });
                  }}
                  onRemoveTag={() => {
                    untagMutation.mutate({
                      callIds: selectedCalls,
                    });
                  }}
                  onClearSelection={() => setSelectedCalls([])}
                  onDelete={handleDeleteCalls}
                  onCreateNewTag={() => {
                    setIsQuickCreateOpen(true);
                    setPendingTagTranscripts(selectedCalls);
                  }}
                  onAssignFolder={() => setFolderDialogOpen(true)}
                />
              </ErrorBoundary>
            )}

            {/* Content Area */}
            {callsLoading ? (
              <TranscriptTableSkeleton />
            ) : validCalls.length === 0 ? (
              <EmptyState
                type={searchQuery || Object.keys(combinedFilters).length > 0 ? "no-results" : "no-transcripts"}
                onAction={() => {
                  setSearchQuery("");
                  setFilters({});
                  setSelectedFolderId(null);
                }}
              />
            ) : (
              <>
                {/* AI Processing Progress */}
                <AIProcessingProgress onJobsComplete={() => queryClient.invalidateQueries({ queryKey: ["transcript-calls"] })} />

                <ErrorBoundary>
                  <div className="border-t border-cb-gray-light dark:border-cb-gray-dark">
                    <TranscriptTable
                      calls={validCalls}
                      selectedCalls={selectedCalls}
                      onSelectCall={(callId) => {
                        if (selectedCalls.includes(callId)) {
                          setSelectedCalls(selectedCalls.filter(id => id !== callId));
                        } else {
                          setSelectedCalls([...selectedCalls, callId]);
                        }
                      }}
                      onSelectAll={() => {
                        if (selectedCalls.length === validCalls.length) {
                          setSelectedCalls([]);
                        } else {
                          setSelectedCalls(validCalls.map(c => c.recording_id));
                        }
                      }}
                      onCallClick={(call) => setSelectedCall(call)}
                      tags={tags}
                      tagAssignments={tagAssignments}
                      folders={folders}
                      folderAssignments={folderAssignments}
                      onFolderCall={(callId) => setFolderingCallId(callId as number)}
                      totalCount={selectedFolderId ? validCalls.length : totalCount}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      hostEmail={hostEmail}
                      visibleColumns={visibleColumns}
                      onToggleColumn={(columnId) =>
                        setVisibleColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }))
                      }
                      onExport={() => setSmartExportOpen(true)}
                    />
                  </div>
                </ErrorBoundary>
              </>
            )}
          </div>
        </ChatInnerCard>
      </ChatOuterCard>

      {/* Dialogs */}
      {selectedCall && (
        <CallDetailDialog
          call={selectedCall}
          open={!!selectedCall}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCall(null);
            }
          }}
        />
      )}

      {taggingCallId && (
        <ManualTagDialog
          open={!!taggingCallId}
          onOpenChange={(open) => !open && setTaggingCallId(null)}
          recordingId={taggingCallId.toString()}
          onTagsUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
            queryClient.invalidateQueries({ queryKey: ["tag-assignments"] });
            setTaggingCallId(null);
          }}
        />
      )}

      {isQuickCreateOpen && (
        <QuickCreateTagDialog
          open={isQuickCreateOpen}
          onOpenChange={setIsQuickCreateOpen}
          onTagCreated={(tagId) => {
            if (pendingTagTranscripts.length > 0) {
              tagMutation.mutate({
                callIds: pendingTagTranscripts,
                tagId,
              });
              setPendingTagTranscripts([]);
            }
          }}
        />
      )}

      {tagManagementOpen && (
        <TagManagementDialog
          open={tagManagementOpen}
          onOpenChange={setTagManagementOpen}
          tags={tags}
          onCreateTag={() => {
            setTagManagementOpen(false);
          }}
          onEditTag={() => {
            setTagManagementOpen(false);
          }}
        />
      )}

      {/* Smart Export Dialog */}
      <SmartExportDialog
        open={smartExportOpen}
        onOpenChange={setSmartExportOpen}
        selectedCalls={validCalls.filter(c => selectedCalls.includes(c.recording_id))}
        folderAssignments={folderAssignments}
        folders={folders}
        tagAssignments={tagAssignments}
        tags={tags}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteCalls}
        title="Delete Transcripts"
        description="Are you sure you want to delete"
        itemCount={selectedCalls.length}
      />

      {/* Folder Assignment Dialog (Bulk) */}
      {folderDialogOpen && (
        <AssignFolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          recordingIds={selectedCalls.map(id => String(id))}
          onFoldersUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["folders", "assignments"] });
            setSelectedCalls([]);
          }}
          onCreateFolder={() => {
            setFolderDialogOpen(false);
            setQuickCreateFolderOpen(true);
          }}
        />
      )}

      {/* Folder Assignment Dialog (Single Row) */}
      {folderingCallId && (
        <AssignFolderDialog
          open={!!folderingCallId}
          onOpenChange={(open) => !open && setFolderingCallId(null)}
          recordingId={String(folderingCallId)}
          onFoldersUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["folders", "assignments"] });
            setFolderingCallId(null);
          }}
          onCreateFolder={() => {
            setFolderingCallId(null);
            setQuickCreateFolderOpen(true);
          }}
        />
      )}

      {/* Quick Create Folder Dialog */}
      {quickCreateFolderOpen && (
        <QuickCreateFolderDialog
          open={quickCreateFolderOpen}
          onOpenChange={setQuickCreateFolderOpen}
          onFolderCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["folders"] });
          }}
        />
      )}

      {/* Folder Management Dialog */}
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

      {/* Edit Folder Dialog */}
      {editingFolder && (
        <EditFolderDialog
          open={!!editingFolder}
          onOpenChange={(open) => !open && setEditingFolder(null)}
          folder={editingFolder}
          onFolderUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["folders"] });
            setEditingFolder(null);
          }}
        />
      )}

      {/* Edit All Transcripts Dialog */}
      <EditAllTranscriptsDialog
        open={editAllTranscriptsOpen}
        onOpenChange={setEditAllTranscriptsOpen}
        settings={allTranscriptsSettings}
        onSave={updateAllTranscriptsSettings}
        onReset={resetAllTranscriptsSettings}
        defaultSettings={allTranscriptsDefaults}
      />
    </DndContext>
  );
}
