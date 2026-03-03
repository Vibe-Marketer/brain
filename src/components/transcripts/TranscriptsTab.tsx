import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { TranscriptTableSkeleton } from "@/components/ui/transcript-table-skeleton";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types/meetings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireUser } from "@/lib/auth-utils";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
import QuickCreateTagDialog from "@/components/QuickCreateTagDialog";
import { TagManagementDialog } from "@/components/transcript-library/TagManagementDialog";
import { FilterBar } from "@/components/transcript-library/FilterBar";
import { BulkActionToolbarEnhanced } from "@/components/transcript-library/BulkActionToolbarEnhanced";
import { DragDropZones } from "@/components/transcript-library/DragDropZones";
import { EmptyState } from "@/components/transcript-library/EmptyStates";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import SmartExportDialog from "@/components/SmartExportDialog";
import AssignFolderDialog from "@/components/AssignFolderDialog";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import { usePanelStore } from "@/stores/panelStore";
import { useWorkspaces, useWorkspaceRecordings, mapRecordingToMeeting } from "@/hooks/useWorkspaces";
import { Folder } from "@/types/workspace";
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

interface DragHelpers {
  activeDragId: string | null;
  draggedItems: number[];
  handleDragStart: (e: unknown, selectedCalls: number[]) => void;
  handleDragEnd: (e: unknown) => void;
  handleDragCancel: () => void;
}

interface TranscriptsTabProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedFolderId: string | null;
  onTotalCountChange?: (count: number) => void;
  sidebarState: 'expanded' | 'collapsed';
  onToggleSidebar: () => void;
  folders: Folder[];
  folderAssignments: Record<string, string[]>;
  assignToFolder: (recordingIds: number[], folderId: string) => void;
  dragHelpers: DragHelpers;
}

/**
 * TranscriptsTab Component
 *
 * The main content card for the transcripts view.
 * Sidebar is rendered at page level (TranscriptsNew.tsx).
 * This component contains only the card content (table, filters, dialogs).
 */
export function TranscriptsTab({
  searchQuery: externalSearchQuery,
  onSearchChange,
  selectedFolderId,
  onTotalCountChange,
  sidebarState: _sidebarState,
  onToggleSidebar: _onToggleSidebar,
  folders,
  folderAssignments,
  assignToFolder: _assignToFolder,
  dragHelpers,
}: TranscriptsTabProps) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Organization context for filtering calls by active workspace
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace, isPersonalOrganization, isLoading: _bankContextLoading, isInitialized } = useOrganizationContext();

  // Selection & interaction state
  const [selectedCalls, setSelectedCalls] = useState<number[]>([]);
  const [selectedCall, setSelectedCall] = useState<Meeting | null>(null);
  // Use external search if provided, otherwise local state for backwards compatibility
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onSearchChange ?? setInternalSearchQuery;
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

  // Dialog state
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const [smartExportOpen, setSmartExportOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taggingCallId, setTaggingCallId] = useState<number | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderingCallId, setFolderingCallId] = useState<number | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingTagTranscripts, setPendingTagTranscripts] = useState<number[]>([]);

  // Load host email
  useEffect(() => {
    let isMounted = true;

    const loadHostEmail = async () => {
      try {
        const userResponse = await supabase.auth.getUser();

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
        if (isMounted) {
          logger.error("Error loading host email", error);
        }
      }
    };

    loadHostEmail();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch tags scoped to active bank/workspace
  const { data: tags = [] } = useQuery({
    queryKey: ["tags", activeOrganizationId],
    queryFn: async () => {
      let query = supabase
        .from("call_tags")
        .select("*")
        .order("name");

      if (activeOrganizationId) {
        query = query.eq("organization_id", activeOrganizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Tag[];
    },
  });

  // Update URL params when filters change (preserve tab param)
  useEffect(() => {
    const filterParams = filtersToURLParams(filters);
    const newParams = new URLSearchParams(searchParams);

    const currentTab = newParams.get("tab");

    ["from", "to", "participants", "categories", "durMin", "durMax", "tags", "folders"].forEach(key => {
      newParams.delete(key);
    });

    filterParams.forEach((value, key) => {
      newParams.set(key, value);
    });

    if (currentTab) {
      newParams.set("tab", currentTab);
    }

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
    queryKey: ["tag-calls", searchQuery, combinedFilters, page, pageSize, activeOrganizationId, activeWorkspaceId, isPersonalOrganization, activeWorkspace?.workspace_type, selectedFolderId],
    enabled: isInitialized,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const offset = (page - 1) * pageSize;

      // WORKSPACE FILTERING (Decision 19 - Fix 2A/2B/2C)
      // If a specific workspace is active, fetch from workspace_entries -> recordings
      if (activeWorkspaceId) {
        let entryQuery = supabase
          .from('workspace_entries')
          .select(`
            id,
            recording:recordings (
              id,
              legacy_recording_id,
              organization_id,
              owner_user_id,
              title,
              audio_url,
              full_transcript,
              summary,
              global_tags,
              source_app,
              source_metadata,
              duration,
              recording_start_time,
              recording_end_time,
              created_at,
              synced_at
            )
          `, { count: "exact" })
          .eq('workspace_id', activeWorkspaceId);

        // Server-side folder filtering: look up recording IDs from folder_assignments
        // (workspace_entries.folder_id is mostly NULL — folder_assignments is the source of truth)
        if (selectedFolderId) {
          const { data: folderAssigns } = await supabase
            .from('folder_assignments')
            .select('call_recording_id')
            .eq('folder_id', selectedFolderId);

          if (!folderAssigns || folderAssigns.length === 0) {
            setTotalCount(0);
            onTotalCountChange?.(0);
            return [];
          }

          // Get recording UUIDs from legacy IDs
          const legacyIds = folderAssigns.map((a) => a.call_recording_id);
          const { data: recs } = await supabase
            .from('recordings')
            .select('id')
            .in('legacy_recording_id', legacyIds);

          if (!recs || recs.length === 0) {
            setTotalCount(0);
            onTotalCountChange?.(0);
            return [];
          }

          const recUuids = recs.map((r) => r.id);
          entryQuery = entryQuery.in('recording_id', recUuids);
        }

        const { data: entries, error: entryError, count } = await entryQuery
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (entryError) throw entryError;

        const totalCount = count || 0;
        setTotalCount(totalCount);
        onTotalCountChange?.(totalCount);

        const mappedRecordings = (entries || [])
          .filter((e: any) => e.recording)
          .map((e: any) => mapRecordingToMeeting({
            ...e.recording,
            organization_id: e.recording.organization_id,
            workspace_entry: { id: e.id, folder_id: e.folder_id }
          }));

        return mappedRecordings;
      }

      // LEGACY / ALL CALLS PATH
      let bankRecordingIds: number[] | null = null;
      if (activeOrganizationId) {
        let recordingQuery = supabase
          .from('recordings')
          .select('legacy_recording_id')
          .eq('organization_id', activeOrganizationId)
          .limit(100000);

        const { data: bankRecordings } = await recordingQuery;
        if (bankRecordings && bankRecordings.length > 0) {
          bankRecordingIds = bankRecordings
            .map((r) => r.legacy_recording_id)
            .filter((id): id is number => id != null);
        } else if (activeOrganizationId && !isPersonalOrganization) {
           // Business org with no recordings yet
           setTotalCount(0);
           onTotalCountChange?.(0);
           return [];
        }
      }

      let query = supabase
        .from("fathom_calls")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply source platform source filters if needed.
      // Fix 2C: YouTube exclusion is now only for when no specific YouTube workspace is selected
      // (but in this path, activeWorkspaceId is null, so we are in "All Calls").
      // Usually, users want "All Calls" to keep its original clutter-free behavior.
      query = query.or('source_platform.is.null,source_platform.neq.youtube');

      if (bankRecordingIds !== null) {
        query = query.in("recording_id", bankRecordingIds);
      }

      // Server-side folder filtering for legacy path:
      // Look up call_recording_ids assigned to the selected folder
      if (selectedFolderId) {
        const { data: folderAssigns } = await supabase
          .from('folder_assignments')
          .select('call_recording_id')
          .eq('folder_id', selectedFolderId);

        if (folderAssigns && folderAssigns.length > 0) {
          const folderCallIds = folderAssigns.map((a) => a.call_recording_id);
          query = query.in("recording_id", folderCallIds);
        } else {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
      }

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

      const newTotalCount = count || 0;
      setTotalCount(newTotalCount);
      onTotalCountChange?.(newTotalCount);

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

      return filteredData as Meeting[];
    },
  });

  // Filter by selected folder
  // Note: Deduplication merged_from data is passed through to TranscriptTableRow
  // which displays "X sources" badge for primary records with merged duplicates
  const validCalls = useMemo(() => {
    let filtered = calls.filter(c => c && c.recording_id != null);

    if (selectedFolderId) {
      filtered = filtered.filter(call => {
        const callIdKey = String(call.recording_id);
        const callFolders = folderAssignments[callIdKey] || [];
        return callFolders.includes(selectedFolderId);
      });
    }

    return filtered;
  }, [calls, selectedFolderId, folderAssignments]);

  // Fetch tag assignments for displayed calls
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
      await requireUser();

      await supabase
        .from("call_tag_assignments")
        .delete()
        .in("call_recording_id", callIds);

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

  // Delete calls mutation
  const deleteCallsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const user = await requireUser();

      logger.info("Starting delete for IDs", ids);

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

  // Keep bulk actions pane in sync
  useEffect(() => {
    if (selectedCalls.length > 0) {
      usePanelStore.getState().openPanel('bulk-actions', {
        type: 'bulk-actions',
        selectedIds: selectedCalls.map(String),
        selectedCalls: validCalls.filter(c => selectedCalls.includes(c.recording_id as number)),
        tags,
        onClearSelection: () => {
          setSelectedCalls([]);
          usePanelStore.getState().closePanel();
        },
        onDelete: handleDeleteCalls,
        onTag: (tagId: string) => tagMutation.mutate({ callIds: selectedCalls, tagId }),
        onRemoveTag: () => untagMutation.mutate({ callIds: selectedCalls }),
        onCreateNewTag: () => {
          setIsQuickCreateOpen(true);
          setPendingTagTranscripts(selectedCalls);
        },
        onAssignFolder: () => setFolderDialogOpen(true)
      });
    } else if (usePanelStore.getState().panelType === 'bulk-actions') {
      usePanelStore.getState().closePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalls, validCalls, tags]);

  return (
    <>
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

      {/* Main layout - flex row to accommodate 4th pane bulk actions */}
      <div className="h-full flex flex-row">
        {/* Main content area - takes remaining space */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          {/* Filter bar - compact mode (no search, search is in page header) */}
          {/* No border separator - clean transition from header to filters */}
          <div className="flex-shrink-0 px-4 md:px-10 pt-2 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <FilterBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  tags={tags}
                  folders={folders}
                  onCreateFolder={() => setQuickCreateFolderOpen(true)}
                  compact={true}
                />
              </div>
            </div>
          </div>

          {/* Content area with scroll */}
          <div className="flex-1 overflow-y-auto px-4 md:px-4 py-0 space-y-4">
            {/* Content Area */}
          {callsLoading ? (
            <TranscriptTableSkeleton />
          ) : validCalls.length === 0 ? (
            <EmptyState
              type={searchQuery || Object.keys(combinedFilters).length > 0 ? "no-results" : "no-transcripts"}
              onAction={() => {
                setSearchQuery("");
                setFilters({});
              }}
            />
          ) : (
            <>
              <div className="border-cb-gray-light dark:border-cb-gray-dark h-full">
                <TranscriptTable
                  calls={validCalls}
                    selectedCalls={selectedCalls}
                    onSelectCall={(callId) => {
                      const newSelected = selectedCalls.includes(callId)
                        ? selectedCalls.filter(id => id !== callId)
                        : [...selectedCalls, callId];
                      setSelectedCalls(newSelected);
                    }}
                    onSelectAll={() => {
                      if (selectedCalls.length === validCalls.length) {
                        setSelectedCalls([]);
                      } else {
                        setSelectedCalls(validCalls.map(c => c.recording_id as number));
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
            </>
          )}
          </div>
        </div>

        {/* Bulk Actions Pane - rendered via DetailPaneOutlet using panelStore state instead */}
      </div>

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
        selectedCalls={validCalls.filter(c => selectedCalls.includes(c.recording_id as number))}
        folderAssignments={folderAssignments}
        folders={folders.map(f => ({ id: String(f.id), name: f.name, color: (f as any).color || "" }))}
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
    </>
  );
}
