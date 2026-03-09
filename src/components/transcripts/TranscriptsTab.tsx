import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { TranscriptTableSkeleton } from "@/components/ui/transcript-table-skeleton";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types/meetings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireUser } from "@/lib/auth-utils";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { getSourceLabel } from "@/lib/source-labels";
import type { DeleteMode } from "@/components/DeleteConfirmDialog";

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
import { queryKeys } from "@/lib/query-config";
import { useWorkspaces, useWorkspaceRecordings, mapRecordingToMeeting } from "@/hooks/useWorkspaces";
import { usePersonalTags, usePersonalTagAssignments } from "@/hooks/usePersonalTags";
import { useAvailableSources } from "@/hooks/useAvailableSources";
import { Folder } from "@/types/workspace";
import {
  FilterState,
  parseSearchSyntax,
  syntaxToFilters,
  filtersToURLParams,
  urlParamsToFilters,
  escapeIlike,
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
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace, isPersonalOrganization, isLoading: _orgContextLoading, isInitialized } = useOrganizationContext();

  // Dynamic source filter options scoped to current org/workspace
  const { data: availableSources } = useAvailableSources(activeOrganizationId, activeWorkspaceId);

  // Selection & interaction state
  const [selectedCalls, setSelectedCalls] = useState<(number | string)[]>([]);
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

  // Determine if we're in the Home (all calls) view vs a specific workspace
  // The personal/default workspace IS the home view — show all calls, with source column
  const isHomeView = !activeWorkspaceId;

  // Column visibility — derived from current view, resets on workspace switch
  const homeColumns = { date: true, duration: true, source: true, tags: true, workspaces: true, sharedWith: true };
  const workspaceColumns = { date: true, duration: true, participants: true, tags: true, folders: true, workspaces: true, sharedWith: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(isHomeView ? homeColumns : workspaceColumns);

  // Reset column defaults when switching between home and workspace views
  useEffect(() => {
    setVisibleColumns(isHomeView ? homeColumns : workspaceColumns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // Dialog state
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const [smartExportOpen, setSmartExportOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taggingCallId, setTaggingCallId] = useState<number | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderingCallId, setFolderingCallId] = useState<number | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingTagTranscripts, setPendingTagTranscripts] = useState<(number | string)[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('permanent-delete');
  const [deleteSourceLabels, setDeleteSourceLabels] = useState<string[]>([]);
  const [deleteLastWorkspaceCount, setDeleteLastWorkspaceCount] = useState(0);

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

  // Fetch tags scoped to active organization/workspace
  const { data: legacyTags = [] } = useQuery({
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
    staleTime: 5 * 60 * 1000, // tags change infrequently
  });

  const { data: personalTags = [] } = usePersonalTags(activeOrganizationId);
  const { data: personalTagAssignments = {} } = usePersonalTagAssignments(activeOrganizationId);

  const tags = useMemo(() => [
    ...legacyTags,
    ...personalTags.map(t => ({ ...t, is_personal: true }))
  ], [legacyTags, personalTags]);

  // Update URL params when filters change (preserve tab param)
  useEffect(() => {
    const filterParams = filtersToURLParams(filters);
    const newParams = new URLSearchParams(searchParams);

    const currentTab = newParams.get("tab");

    ["from", "to", "participants", "categories", "durMin", "durMax", "tags", "folders", "sources"].forEach(key => {
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

  // Reset page to 1 and totalCount whenever search/filter/workspace context changes
  const prevFilterRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify({ searchQuery, combinedFilters, activeOrganizationId, activeWorkspaceId, selectedFolderId });
    if (prevFilterRef.current && prevFilterRef.current !== key) {
      setPage(1);
      // Reset totalCount so stale counts from previous workspace don't flash
      setTotalCount(0);
      onTotalCountChange?.(0);
    }
    prevFilterRef.current = key;
  }, [searchQuery, combinedFilters, activeOrganizationId, activeWorkspaceId, selectedFolderId]);

  // Fetch calls with filters
  const { data: calls = [], isLoading: callsLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["tag-calls", searchQuery, JSON.stringify(combinedFilters), page, pageSize, activeOrganizationId, activeWorkspaceId, isPersonalOrganization, activeWorkspace?.workspace_type, selectedFolderId],
    enabled: isInitialized,
    staleTime: 2 * 60 * 1000, // 2 minutes — don't refetch on every window focus
    gcTime: 5 * 60 * 1000,    // keep in cache for 5 minutes
    placeholderData: keepPreviousData, // smooth page transitions
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const offset = (page - 1) * pageSize;

      // WORKSPACE FILTERING (Decision 19 - Fix 2A/2B/2C)
      // If a specific workspace is active, fetch from workspace_entries -> recordings
      // Use !inner join so date/source/search filters on recordings exclude non-matching entries
      if (activeWorkspaceId) {
        let entryQuery = supabase
          .from('workspace_entries')
          .select(`
            id,
            recording:recordings!inner (
              id,
              legacy_recording_id,
              organization_id,
              owner_user_id,
              title,
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
        // Also includes calls from child folders (recursive) so parent folders aggregate.
        if (selectedFolderId) {
          // Get this folder + all child folders (recursive)
          const { data: childFolders } = await supabase
            .from('folders')
            .select('id')
            .eq('parent_id', selectedFolderId);

          const folderIds = [selectedFolderId, ...(childFolders || []).map((f) => f.id)];

          const { data: folderAssigns } = await supabase
            .from('folder_assignments')
            .select('call_recording_id')
            .in('folder_id', folderIds);

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

        // Apply search filter on recordings (title, summary, transcript)
        if (syntax.plainText) {
          const escaped = escapeIlike(syntax.plainText);
          entryQuery = entryQuery.or(
            `title.ilike.%${escaped}%,summary.ilike.%${escaped}%,full_transcript.ilike.%${escaped}%`,
            { referencedTable: 'recordings' }
          );
        }

        // Apply date filters (use select alias 'recording', not table name 'recordings')
        if (combinedFilters.dateFrom) {
          entryQuery = entryQuery.gte('recording.created_at', combinedFilters.dateFrom.toISOString());
        }
        if (combinedFilters.dateTo) {
          entryQuery = entryQuery.lte('recording.created_at', combinedFilters.dateTo.toISOString());
        }

        // Apply source filter via .or() with referencedTable (avoids dot-notation with .in())
        if (combinedFilters.sources && combinedFilters.sources.length > 0) {
          const sourceOrFilter = combinedFilters.sources.map((s: string) => `source_app.eq.${s}`).join(',');
          entryQuery = entryQuery.or(sourceOrFilter, { referencedTable: 'recordings' });
        }

        const { data: entries, error: entryError, count } = await entryQuery
          .order('created_at', { ascending: false, referencedTable: 'recordings' })
          .range(offset, offset + pageSize - 1);

        if (entryError) throw entryError;

        const totalCount = count || 0;
        setTotalCount(totalCount);
        onTotalCountChange?.(totalCount);

        let mappedRecordings = (entries || [])
          .filter((e: any) => e.recording)
          .map((e: any) => mapRecordingToMeeting({
            ...e.recording,
            organization_id: e.recording.organization_id,
            workspace_entry: { id: e.id, folder_id: e.folder_id }
          }));

        // Client-side duration filter
        // duration_seconds is always in seconds; start/end time diff gives milliseconds
        // Filter values (durationMin/durationMax) are in minutes
        if (combinedFilters.durationMin !== undefined || combinedFilters.durationMax !== undefined) {
          mappedRecordings = mappedRecordings.filter((call: any) => {
            // Get duration in minutes
            let durationMinutes: number | null = null;
            if (call.source_metadata?.duration_seconds != null) {
              durationMinutes = call.source_metadata.duration_seconds / 60;
            } else if (call.recording_start_time && call.recording_end_time) {
              durationMinutes = (new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / 60000;
            }
            if (durationMinutes === null) return true;
            if (combinedFilters.durationMin !== undefined && durationMinutes < combinedFilters.durationMin) return false;
            if (combinedFilters.durationMax !== undefined && durationMinutes > combinedFilters.durationMax) return false;
            return true;
          });
        }

        return mappedRecordings;
      }

      // ALL CALLS PATH — every recording in the organization, regardless of source or workspace.
      // Server-side pagination via .range() + count: "exact". No client-side slicing.

      let q = supabase
        .from('recordings')
        .select(
          'id, legacy_recording_id, organization_id, owner_user_id, title, summary, global_tags, source_app, source_metadata, duration, recording_start_time, recording_end_time, created_at, synced_at',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      // Scope to organization
      if (activeOrganizationId) {
        q = q.eq('organization_id', activeOrganizationId);
      } else {
        q = q.eq('owner_user_id', user.id);
      }

      // Folder filtering (Decision 19 - All Calls Folder support)
      if (selectedFolderId) {
        // Determine if it's a personal folder
        const selectedFolder = folders.find(f => f.id === selectedFolderId);
        const isPersonal = selectedFolder && !(selectedFolder as any).workspace_id;

        let recIds: string[] = [];

        if (isPersonal) {
          const { data: personalAssigns } = await (supabase as any)
            .from('personal_folder_recordings')
            .select('recording_id')
            .eq('folder_id', selectedFolderId);
          recIds = (personalAssigns || []).map((a: any) => a.recording_id);
        } else {
          // Legacy folder
          const { data: childFolders } = await supabase
            .from('folders')
            .select('id')
            .eq('parent_id', selectedFolderId);
          const folderIds = [selectedFolderId, ...(childFolders || []).map((f) => f.id)];

          const { data: folderAssigns } = await supabase
            .from('folder_assignments')
            .select('call_recording_id')
            .in('folder_id', folderIds);

          if (folderAssigns && folderAssigns.length > 0) {
            const legacyIds = folderAssigns.map((a) => a.call_recording_id);
            const { data: recs } = await supabase
              .from('recordings')
              .select('id')
              .in('legacy_recording_id', legacyIds);
            recIds = (recs || []).map((r) => r.id);
          }
        }

        if (recIds.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        q = q.in('id', recIds);
      }

      // Search filter (escape special chars to prevent PostgREST injection)
      // Note: filtering on full_transcript/summary without selecting them is valid in PostgREST
      if (syntax.plainText) {
        const escaped = escapeIlike(syntax.plainText);
        q = q.or(`title.ilike.%${escaped}%,summary.ilike.%${escaped}%,full_transcript.ilike.%${escaped}%`);
      }
      if (combinedFilters.dateFrom) {
        q = q.gte('created_at', combinedFilters.dateFrom.toISOString());
      }
      if (combinedFilters.dateTo) {
        q = q.lte('created_at', combinedFilters.dateTo.toISOString());
      }
      // Source filter
      if (combinedFilters.sources && combinedFilters.sources.length > 0) {
        q = q.in('source_app', combinedFilters.sources);
      }

      // Server-side pagination — no client-side slicing
      const { data, error, count } = await q.range(offset, offset + pageSize - 1);
      if (error) throw error;

      const mergedTotal = count ?? 0;
      setTotalCount(mergedTotal);
      onTotalCountChange?.(mergedTotal);

      return (data || []).map((rec: any) => mapRecordingToMeeting(rec)) as Meeting[];
    },
  });

  // Server-side pagination handles all filtering (workspace, folder, search, date, source).
  // Only filter out records with a null recording_id here (data integrity guard).
  // Note: Deduplication merged_from data is passed through to TranscriptTableRow
  // which displays "X sources" badge for primary records with merged duplicates
  const validCalls = useMemo(() => {
    return calls.filter(c => c && c.recording_id != null);
  }, [calls]);

  // Map recording_id → uuid for quick lookup (needed because selectedCalls uses recording_id)
  const idToUuid = useMemo(() => {
    const map = new Map<string, string>();
    validCalls.forEach(c => {
      map.set(String(c.recording_id), c.canonical_uuid);
    });
    return map;
  }, [validCalls]);

  /** Convert selectedCalls (recording_id) to UUIDs for DB queries on UUID columns */
  const selectedToUuids = (ids: (number | string)[]): string[] =>
    ids.map(id => idToUuid.get(String(id)) || String(id));

  // Fetch tag assignments for displayed calls using UUID keys
  // (call_tag_assignments.recording_id is UUID, not legacy BIGINT)
  const recordingUuids = validCalls.map(c => c.canonical_uuid).filter(Boolean);

  const { data: tagAssignments = {} } = useQuery({
    queryKey: ["tag-assignments", recordingUuids],
    queryFn: async () => {
      if (recordingUuids.length === 0) return {};

      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select("recording_id, tag_id")
        .in("recording_id", recordingUuids);

      if (error) throw error;

      const assignments: Record<string, string[]> = {};
      data?.forEach((assignment) => {
        if (!assignments[assignment.recording_id]) {
          assignments[assignment.recording_id] = [];
        }
        assignments[assignment.recording_id].push(assignment.tag_id);
      });

      const merged = { ...assignments };
      Object.entries(personalTagAssignments).forEach(([callId, tagIds]) => {
        if (!merged[callId]) {
          merged[callId] = [];
        }
        merged[callId] = Array.from(new Set([...merged[callId], ...tagIds]));
      });

      return merged;
    },
    enabled: calls.length > 0 && isInitialized,
    staleTime: 2 * 60 * 1000,
  });

  // Bulk tag mutation
  const tagMutation = useMutation({
    mutationFn: async ({ callIds, tagId }: { callIds: string[]; tagId: string }) => {
      await requireUser();

      await supabase
        .from("call_tag_assignments")
        .delete()
        .in("recording_id", callIds);

      const assignments = callIds.map((callId) => ({
        recording_id: callId,
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
    mutationFn: async ({ callIds }: { callIds: string[] }) => {
      const { error } = await supabase
        .from("call_tag_assignments")
        .delete()
        .in("recording_id", callIds);
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

  // --- Workspace-aware deletion helpers ---

  /** Resolve mixed (number | string)[] IDs to recording UUIDs + legacy IDs + source labels */
  const resolveRecordingIds = async (ids: (number | string)[]) => {
    const numericIds = ids.filter((id): id is number => typeof id === 'number');
    const stringIds = ids.filter((id): id is string => typeof id === 'string');

    const results: { uuid: string; legacyId: number | null; sourceApp: string | null }[] = [];

    if (numericIds.length > 0) {
      const { data } = await supabase
        .from('recordings')
        .select('id, legacy_recording_id, source_app')
        .in('legacy_recording_id', numericIds);
      (data || []).forEach((r) => results.push({
        uuid: r.id,
        legacyId: r.legacy_recording_id,
        sourceApp: r.source_app,
      }));
    }

    if (stringIds.length > 0) {
      const { data } = await supabase
        .from('recordings')
        .select('id, legacy_recording_id, source_app')
        .in('id', stringIds);
      (data || []).forEach((r) => results.push({
        uuid: r.id,
        legacyId: r.legacy_recording_id,
        sourceApp: r.source_app,
      }));
    }

    return results;
  };

  /** Count how many workspaces each recording is in */
  const getWorkspaceEntryCounts = async (uuids: string[]) => {
    const counts: Record<string, number> = {};
    if (uuids.length === 0) return counts;

    const { data } = await supabase
      .from('workspace_entries')
      .select('recording_id')
      .in('recording_id', uuids);

    (data || []).forEach((entry) => {
      counts[entry.recording_id] = (counts[entry.recording_id] || 0) + 1;
    });

    return counts;
  };

  // Remove from workspace mutation (soft — only removes workspace_entry)
  const removeFromWorkspaceMutation = useMutation({
    mutationFn: async (ids: (number | string)[]) => {
      if (!activeWorkspaceId) throw new Error('No active workspace');
      const resolved = await resolveRecordingIds(ids);
      const uuids = resolved.map((r) => r.uuid);

      const { error } = await supabase
        .from('workspace_entries')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .in('recording_id', uuids);

      if (error) throw error;
      return resolved.length;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['tag-calls'] });
      if (activeWorkspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.recordings(activeWorkspaceId) });
      }
      setSelectedCalls([]);
      setShowDeleteDialog(false);
      toast.success(`Removed ${count} from ${activeWorkspace?.name || 'workspace'}`);
    },
    onError: (error: Error) => {
      setShowDeleteDialog(false);
      toast.error(`Failed to remove: ${error.message || 'Unknown error'}`);
    },
  });

  // Permanent delete mutation (hard — removes all workspace_entries then recording)
  const permanentDeleteMutation = useMutation({
    mutationFn: async (ids: (number | string)[]) => {
      const user = await requireUser();
      const resolved = await resolveRecordingIds(ids);
      const uuids = resolved.map((r) => r.uuid);
      const legacyIds = resolved.map((r) => r.legacyId).filter((id): id is number => id !== null);

      logger.info('Permanent delete — UUIDs:', uuids, 'Legacy IDs:', legacyIds);

      // 1. Delete ALL workspace_entries (required before recording can be deleted — RLS policy)
      const { error: weError } = await supabase
        .from('workspace_entries')
        .delete()
        .in('recording_id', uuids);
      if (weError) {
        logger.error('Error deleting workspace_entries', weError);
        throw weError;
      }

      // 2a. Clean up migrated tables using UUID recording_id
      if (uuids.length > 0) {
        const { error: assignmentsError } = await supabase
          .from('call_tag_assignments')
          .delete()
          .in('recording_id', uuids);
        if (assignmentsError) logger.warn('Error deleting tag assignments', assignmentsError);

        const { error: tagsError } = await supabase
          .from('transcript_tag_assignments')
          .delete()
          .in('recording_id', uuids);
        if (tagsError) logger.warn('Error deleting transcript tag assignments', tagsError);

        const { error: speakersError } = await supabase
          .from('call_speakers')
          .delete()
          .in('recording_id', uuids);
        if (speakersError) logger.warn('Error deleting speakers', speakersError);
      }

      // 2b. Clean up folder_assignments (still uses BIGINT call_recording_id)
      if (legacyIds.length > 0) {
        const { error: folderError } = await supabase
          .from('folder_assignments')
          .delete()
          .in('call_recording_id', legacyIds);
        if (folderError) logger.warn('Error deleting folder assignments', folderError);
      }

      // 3. Delete recordings (RLS ensures owner_user_id match; raw tables have ON DELETE SET NULL)
      const { error: recError } = await supabase
        .from('recordings')
        .delete()
        .in('id', uuids)
        .eq('owner_user_id', user.id);
      if (recError) {
        logger.error('Error deleting recordings', recError);
        throw recError;
      }

      return uuids.length;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['tag-calls'] });
      await queryClient.invalidateQueries({ queryKey: ['tag-assignments'] });
      if (activeWorkspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.recordings(activeWorkspaceId) });
      }
      setSelectedCalls([]);
      setShowDeleteDialog(false);
      toast.success(`${count} transcript${count > 1 ? 's' : ''} permanently deleted`);
    },
    onError: (error: Error) => {
      setShowDeleteDialog(false);
      logger.error('Permanent delete failed', error);
      toast.error(`Failed to delete: ${error.message || 'Unknown error'}`);
    },
  });

  // Pre-delete scenario check
  const handleDeleteCalls = async () => {
    if (selectedCalls.length === 0) return;

    if (!activeWorkspaceId) {
      // All Calls view — always permanent
      const resolved = await resolveRecordingIds(selectedCalls);
      setDeleteMode('permanent-delete');
      setDeleteSourceLabels(resolved.map((r) => getSourceLabel(r.sourceApp)));
      setDeleteLastWorkspaceCount(0);
      setShowDeleteDialog(true);
      return;
    }

    // Workspace view — determine scenario
    const resolved = await resolveRecordingIds(selectedCalls);
    const uuids = resolved.map((r) => r.uuid);
    const entryCounts = await getWorkspaceEntryCounts(uuids);

    const lastWorkspaceItems = resolved.filter((r) => (entryCounts[r.uuid] || 0) <= 1);
    const multiWorkspaceItems = resolved.filter((r) => (entryCounts[r.uuid] || 0) > 1);

    setDeleteSourceLabels(resolved.map((r) => getSourceLabel(r.sourceApp)));

    if (lastWorkspaceItems.length === 0) {
      // All calls are in 2+ workspaces → safe remove
      setDeleteMode('remove-from-workspace');
      setDeleteLastWorkspaceCount(0);
    } else if (multiWorkspaceItems.length === 0) {
      // All calls are in only 1 workspace → permanent
      setDeleteMode('permanent-last-workspace');
      setDeleteLastWorkspaceCount(lastWorkspaceItems.length);
    } else {
      // Mixed — remove from workspace but warn about permanent ones
      setDeleteMode('remove-from-workspace');
      setDeleteLastWorkspaceCount(lastWorkspaceItems.length);
    }

    setShowDeleteDialog(true);
  };

  // Dispatch delete based on mode
  const confirmDeleteCalls = () => {
    if (deleteMode === 'remove-from-workspace') {
      removeFromWorkspaceMutation.mutate(selectedCalls);
    } else {
      permanentDeleteMutation.mutate(selectedCalls);
    }
  };

  // Keep bulk actions pane in sync
  useEffect(() => {
    if (selectedCalls.length > 0) {
      usePanelStore.getState().openPanel('bulk-actions', {
        type: 'bulk-actions',
        selectedIds: selectedCalls.map(String),
        selectedCalls: validCalls.filter(c => selectedCalls.includes(c.recording_id)),
        tags,
        onClearSelection: () => {
          setSelectedCalls([]);
          usePanelStore.getState().closePanel();
        },
        onDelete: handleDeleteCalls,
        onTag: (tagId: string) => tagMutation.mutate({ callIds: selectedToUuids(selectedCalls), tagId }),
        onRemoveTag: () => untagMutation.mutate({ callIds: selectedToUuids(selectedCalls) }),
        onCreateNewTag: () => {
          setIsQuickCreateOpen(true);
          setPendingTagTranscripts(selectedCalls);
        },
        onAssignFolder: () => setFolderDialogOpen(true),
        deleteLabel: isHomeView ? 'Delete Selected' : 'Remove from Workspace'
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
              callIds: selectedToUuids(dragHelpers.draggedItems),
              tagId,
            });
          }}
          onUntag={() => {
            untagMutation.mutate({
              callIds: selectedToUuids(dragHelpers.draggedItems),
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
                  availableSources={availableSources}
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
          ) : (isPlaceholderData && isFetching) ? (
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
                    tableMode={isHomeView ? 'home' : 'workspace'}
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
                        setSelectedCalls(validCalls.map(c => c.recording_id));
                      }
                    }}
                    onCallClick={(call) => setSelectedCall(call)}
                    tags={tags}
                    tagAssignments={tagAssignments}
                    folders={folders}
                    folderAssignments={folderAssignments}
                    onFolderCall={(callId) => setFolderingCallId(callId as number)}
                    totalCount={totalCount}
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
                callIds: selectedToUuids(pendingTagTranscripts),
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
        folders={folders.map(f => ({ id: String(f.id), name: f.name, color: (f as any).color || "" }))}
        tagAssignments={tagAssignments}
        tags={tags}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteCalls}
        mode={deleteMode}
        itemCount={selectedCalls.length}
        workspaceName={activeWorkspace?.name}
        sourceLabels={deleteSourceLabels}
        lastWorkspaceCount={deleteLastWorkspaceCount}
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
