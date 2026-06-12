import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { TranscriptTableSkeleton } from "@/components/ui/transcript-table-skeleton";
import { logger } from "@/lib/logger";
import { Meeting } from "@/types/meetings";
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
import { DragDropZones } from "@/components/transcript-library/DragDropZones";
import { EmptyState } from "@/components/transcript-library/EmptyStates";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import SmartExportDialog from "@/components/SmartExportDialog";
import AssignFolderDialog from "@/components/AssignFolderDialog";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import { usePanelStore } from "@/stores/panelStore";
import { queryKeys } from "@/lib/query-config";
import { mapRecordingToMeeting } from "@/hooks/useWorkspaces";
import { usePersonalTags, usePersonalTagAssignments } from "@/hooks/usePersonalTags";
import { useAvailableSources } from "@/hooks/useAvailableSources";
import { chunkArray, IN_FILTER_CHUNK_SIZE } from "@/lib/chunk";
import {
  findParticipantRecordingIds,
  findRecordingIdsMatchingAllTags,
  getAssignedWorkspaceEntryFolderUuids,
  getRecordingIdsForFolderFilter,
  getUnorganizedRecordingUuids,
  getWorkspaceFolderRecordingIds,
  toInclusiveDateToIso,
} from "@/services/transcript-filters.service";
import { Folder } from "@/types/workspace";
import {
  FilterState,
  parseSearchSyntax,
  syntaxToFilters,
  filtersToURLParams,
  urlParamsToFilters,
  escapeIlike,
} from "@/lib/filter-utils";
import type { Tag } from "@/types/tags";

const TRANSCRIPT_RECORDING_SELECT =
  "id, fathom_provider_id, organization_id, owner_user_id, title, summary, global_tags, source_app, source_metadata, duration, recording_start_time, recording_end_time, created_at, synced_at";

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
  sidebarState?: 'expanded' | 'collapsed';
  onToggleSidebar?: () => void;
  folders: Folder[];
  folderAssignments: Record<string, string[]>;
  assignToFolder: (recordingIds: number[], folderId: string) => void;
  dragHelpers: DragHelpers;
}

type RecordingLookupRow = {
  id: string;
  fathom_provider_id: number | null;
  source_app: string | null;
};

type TagAssignmentRow = {
  recording_id: string;
  tag_id: string;
};

function intersectRecordingIds(
  currentIds: string[] | null,
  nextIds: string[],
): string[] {
  if (currentIds === null) return [...new Set(nextIds)];
  const nextSet = new Set(nextIds);
  return currentIds.filter((id) => nextSet.has(id));
}

function sortRecordingRows(rows: any[]): any[] {
  return [...rows].sort((a, b) => {
    const aTime = a.recording_start_time ?? "";
    const bTime = b.recording_start_time ?? "";
    if (aTime !== bTime) return bTime.localeCompare(aTime);

    const aCreated = a.created_at ?? "";
    const bCreated = b.created_at ?? "";
    return bCreated.localeCompare(aCreated);
  });
}

export async function fetchTagAssignmentsForRecordingUuids(
  recordingUuids: string[],
): Promise<TagAssignmentRow[]> {
  if (recordingUuids.length === 0) return [];

  const batches = await Promise.all(
    chunkArray(recordingUuids, IN_FILTER_CHUNK_SIZE).map(async (chunk) => {
      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select("recording_id, tag_id")
        .in("recording_id", chunk);

      if (error) throw error;
      return (data ?? []) as TagAssignmentRow[];
    }),
  );

  return batches.flat();
}

async function fetchRecordingLookupsByChunks(
  column: "id" | "fathom_provider_id",
  ids: string[] | number[],
): Promise<RecordingLookupRow[]> {
  if (ids.length === 0) return [];

  const batches = await Promise.all(
    chunkArray<string | number>(ids, IN_FILTER_CHUNK_SIZE).map(async (chunk) => {
      const { data, error } = await supabase
        .from("recordings")
        .select("id, fathom_provider_id, source_app")
        .in(column, chunk);

      if (error) throw error;
      return (data ?? []) as RecordingLookupRow[];
    }),
  );

  return batches.flat();
}

async function deleteRowsByInChunks(
  tableName: string,
  column: string,
  ids: string[] | number[],
  apply?: (query: any) => any,
) {
  if (ids.length === 0) return;

  await Promise.all(
    chunkArray<string | number>(ids, IN_FILTER_CHUNK_SIZE).map(async (chunk) => {
      let query = (supabase as any)
        .from(tableName)
        .delete();

      if (apply) {
        query = apply(query);
      }

      const { error } = await query.in(column, chunk);
      if (error) throw error;
    }),
  );
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
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace, isPersonalOrganization, isSharedView, isLoading: _orgContextLoading, isInitialized } = useOrganizationContext();

  // Dynamic source filter options scoped to current org/workspace
  const { data: availableSources } = useAvailableSources(activeOrganizationId, activeWorkspaceId);

// Selection & interaction state
   const [selectedCalls, setSelectedCalls] = useState<(number | string)[]>([]);
   // Track if we're in "select all matching" mode (vs "select all visible" mode)
   const [selectAllMatchingMode, setSelectAllMatchingMode] = useState(false);
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
  // Shared view is a separate virtual workspace, not home view
  const isHomeView = !activeWorkspaceId && !isSharedView;

  // Column visibility — derived from current view, resets on workspace switch
  const homeColumns = { date: true, duration: true, source: true, participants: true, tags: true, workspaces: true };
  const workspaceColumns = { date: true, duration: true, participants: true, tags: true, folders: true, workspaces: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(isHomeView ? homeColumns : workspaceColumns);

  // Track whether the workspace effect is running for the first time on mount.
  // We must NOT reset filters on initial mount — that would wipe URL-initialized filters.
  // Only reset when the user actually switches to a different workspace.
  const isWorkspaceFirstMount = useRef(true);

  // Reset column defaults and filters when switching workspaces
  useEffect(() => {
    if (isWorkspaceFirstMount.current) {
      isWorkspaceFirstMount.current = false;
      return;
    }
    setVisibleColumns(isHomeView ? homeColumns : workspaceColumns);
    setFilters({});
    setSelectedCalls([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, isSharedView]);

  // Dialog state
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const [smartExportOpen, setSmartExportOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taggingCallId, setTaggingCallId] = useState<number | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [quickCreateFolderOpen, setQuickCreateFolderOpen] = useState(false);
  const [folderingCallId, setFolderingCallId] = useState<number | string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingTagTranscripts, setPendingTagTranscripts] = useState<(number | string)[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('permanent-delete');
  const [deleteSourceLabels, setDeleteSourceLabels] = useState<string[]>([]);
  const [detailCall, setDetailCall] = useState<Meeting | null>(null);

  // Load host email
  useEffect(() => {
    let isMounted = true;

    const loadHostEmail = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

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
      const { data, error } = await supabase
        .from("call_tags")
        .select("*")
        .eq("organization_id", activeOrganizationId!)
        .order("name");

      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!activeOrganizationId,
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

    ["from", "to", "participants", "durMin", "durMax", "status", "tags", "folders", "sources"].forEach(key => {
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

  // Combine filters from search syntax and filter panel using AND logic.
  // For array fields (tags, participants, sources, folders, status):
  //   - Resolve tag *names* from syntax to tag IDs using the loaded tag list
  //   - Resolve folder *names* from syntax to folder IDs using the loaded folder list
  //   - Union syntax values with panel values so both apply
  // For scalar fields (dates, duration): syntax takes precedence when specified,
  // otherwise falls back to panel values.
  const combinedFilters = useMemo(() => {
    const syntaxFilters = syntaxToFilters(syntax);

    // Resolve tag names from syntax to IDs (panel uses IDs; syntax uses names)
    let resolvedSyntaxTagIds: string[] = [];
    if (syntax.filters.tag && syntax.filters.tag.length > 0) {
      resolvedSyntaxTagIds = syntax.filters.tag.flatMap((nameOrId) => {
        const lowerName = nameOrId.toLowerCase();
        const match = tags.find(
          (t) => t.name.toLowerCase() === lowerName || t.id === nameOrId
        );
        return match ? [match.id] : [];
      });
    }

    // Resolve folder names from syntax to IDs (panel uses IDs; syntax uses names)
    let resolvedSyntaxFolderIds: string[] = [];
    if (syntax.filters.folder && syntax.filters.folder.length > 0) {
      resolvedSyntaxFolderIds = syntax.filters.folder.flatMap((nameOrId) => {
        const lowerName = nameOrId.toLowerCase();
        const match = folders.find(
          (f) => f.name.toLowerCase() === lowerName || f.id === nameOrId
        );
        return match ? [match.id] : [];
      });
    }

    // Union arrays from both sources
    const mergedTags = Array.from(new Set([...(filters.tags ?? []), ...resolvedSyntaxTagIds]));
    const mergedFolders = Array.from(new Set([...(filters.folders ?? []), ...resolvedSyntaxFolderIds]));
    const mergedSources = Array.from(new Set([...(filters.sources ?? []), ...(syntaxFilters.sources ?? [])]));

    return {
      // Scalar filters: syntax overrides panel when present
      dateFrom: syntaxFilters.dateFrom ?? filters.dateFrom,
      dateTo: syntaxFilters.dateTo ?? filters.dateTo,
      durationMin: syntaxFilters.durationMin ?? filters.durationMin,
      durationMax: syntaxFilters.durationMax ?? filters.durationMax,
      // Panel participants: exact email strings from the Contacts picker
      participants: filters.participants,
      // Syntax participant: search terms matched via ILIKE name OR email in the query
      participantSearchTerms: syntax.filters.participant ?? [],
      // Array filters: union of both
      tags: mergedTags.length > 0 ? mergedTags : undefined,
      folders: mergedFolders.length > 0 ? mergedFolders : undefined,
      sources: mergedSources.length > 0 ? mergedSources : undefined,
      // Status filter: from inline search syntax only (status:synced / status:unsynced)
      status: syntax.filters.status && syntax.filters.status.length > 0 ? syntax.filters.status : undefined,
    };
  }, [syntax, filters, tags, folders]);

// Reset page to 1 whenever search/filter/workspace context changes.
   // Do NOT eagerly reset totalCount here — the query's queryFn will set the
   // correct totalCount once the new data arrives.  Resetting it to 0 before
   // the query resolves causes a "Showing 1 to 0 of 0" flash while rows from
   // placeholderData are still visible.
   const prevFilterRef = useRef<string>("");
   useEffect(() => {
     const key = JSON.stringify({ searchQuery, combinedFilters, activeOrganizationId, activeWorkspaceId, selectedFolderId });
     if (prevFilterRef.current && prevFilterRef.current !== key) {
       setPage(1);
       // Exit select-all matching mode when filters change
       if (selectAllMatchingMode) {
         setSelectAllMatchingMode(false);
       }
     }
     prevFilterRef.current = key;
   }, [searchQuery, combinedFilters, activeOrganizationId, activeWorkspaceId, selectedFolderId, selectAllMatchingMode]);

   // Exit select-all matching mode when page or pageSize changes
   useEffect(() => {
     if (selectAllMatchingMode) {
       setSelectAllMatchingMode(false);
     }
   }, [page, pageSize, selectAllMatchingMode]);

  // Fetch calls with filters
  const { data: calls = [], isLoading: callsLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["tag-calls", searchQuery, JSON.stringify(combinedFilters), page, pageSize, activeOrganizationId, activeWorkspaceId, isPersonalOrganization, selectedFolderId, isSharedView],
    enabled: isInitialized,
    staleTime: 2 * 60 * 1000, // 2 minutes — don't refetch on every window focus
    gcTime: 5 * 60 * 1000,    // keep in cache for 5 minutes
    // Only keep previous data for pagination (same org/folder/filters, different page).
    // Clear data when org, workspace, or folder changes to avoid showing stale results
    // from a different organization or workspace context.
    placeholderData: (previousData, previousQuery) => {
      if (!previousQuery) return undefined;
      const prevKey = previousQuery.queryKey as unknown[];
      const currOrgId = activeOrganizationId;
      const currFolderId = selectedFolderId;
      const currWorkspaceId = activeWorkspaceId;
      // prevKey indices: [0]=tag-calls, [1]=search, [2]=filters, [3]=page, [4]=pageSize, [5]=orgId, [6]=wsId, [7]=isPersonalOrg, [8]=folderId, [9]=isSharedView
      const prevOrgId = prevKey[5];
      const prevFolderId = prevKey[8];
      const prevWsId = prevKey[6];
      if (prevOrgId !== currOrgId || prevFolderId !== currFolderId || prevWsId !== currWorkspaceId) return undefined;
      return previousData;
    },
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");

      const offset = (page - 1) * pageSize;

      // SHARED WITH ME — virtual workspace that shows all calls shared with the user.
      // Uses the same RPC as the dedicated SharedWithMe page.
      if (isSharedView) {
        const { data: sharedRows, error: sharedError } = await supabase.rpc("get_calls_shared_with_me_v2", {
          p_include_expired: false,
        });
        if (sharedError) throw sharedError;

        const rows = (sharedRows || []) as Array<{
          recording_id: number;
          call_name: string;
          recording_start_time: string;
          duration: string | null;
          source_label: string;
        }>;

        // Client-side search filter
        let filtered = rows;
        if (searchQuery?.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter((r) => r.call_name?.toLowerCase().includes(q));
        }

        const total = filtered.length;
        setTotalCount(total);
        onTotalCountChange?.(total);

        // Client-side pagination
        const paged = filtered.slice(offset, offset + pageSize);

        // Map to Meeting shape for TranscriptTable compatibility
        return paged.map((row) => ({
          id: row.recording_id,
          title: row.call_name || "Untitled Call",
          summary: null,
          tags: [] as string[],
          recording_start_time: row.recording_start_time,
          recording_end_time: null,
          created_at: row.recording_start_time,
          synced: false,
          source: "Shared",
          sourceLabel: row.source_label || "Direct Link",
          duration: row.duration,
          canonical_uuid: null,
        })) as Meeting[];
      }

      // WORKSPACE FILTERING — RPC approach.
      // Uses get_workspace_recordings() DB function which does the JOIN + ORDER + pagination
      // server-side. This avoids:
      //   1. PostgREST embedded-resource ordering (only sorts nested rows, not parent rows)
      //   2. .in() URL length limits (~8KB) that break for workspaces with 200+ recordings
      if (activeWorkspaceId) {
        // Folder pre-filter: resolve recording UUIDs from both folder sources
        let folderRecordingIds: string[] | null = null;
        if (selectedFolderId) {
          folderRecordingIds = await getWorkspaceFolderRecordingIds(activeWorkspaceId, selectedFolderId);
          if (folderRecordingIds.length === 0) {
            setTotalCount(0);
            onTotalCountChange?.(0);
            return [];
          }
        }

        // Call RPC — single server-side JOIN + ORDER + pagination.
        // When client-side filters are active (participants, tags, duration, status,
        // folders), we must fetch ALL workspace recordings so the filters can
        // evaluate every record. Otherwise, filtering only the current server page
        // silently drops matches that happen to be on other pages.
        const hasClientSideFilters = !!(
          folderRecordingIds ||
          (combinedFilters.participants && combinedFilters.participants.length > 0) ||
          (combinedFilters.participantSearchTerms && combinedFilters.participantSearchTerms.length > 0) ||
          (combinedFilters.tags && combinedFilters.tags.length > 0) ||
          (combinedFilters.durationMin !== undefined || combinedFilters.durationMax !== undefined) ||
          (combinedFilters.status && combinedFilters.status.length > 0)
        );

        const rpcParams: Record<string, unknown> = {
          p_workspace_id: activeWorkspaceId,
          p_limit: hasClientSideFilters ? 10000 : pageSize,
          p_offset: hasClientSideFilters ? 0 : offset,
          p_search: syntax.plainText || null,
          p_date_from: combinedFilters.dateFrom?.toISOString() ?? null,
          p_date_to: toInclusiveDateToIso(combinedFilters.dateTo),
          p_sources: combinedFilters.sources?.length ? combinedFilters.sources : null,
        };

        const { data: rows, error: rpcError } = await supabase.rpc('get_workspace_recordings', rpcParams);

        if (rpcError) throw rpcError;

        // Apply folder filter client-side
        let filteredRows = (rows || []) as any[];
        if (folderRecordingIds) {
          const folderSet = new Set(folderRecordingIds);
          filteredRows = filteredRows.filter((r: any) => folderSet.has(r.id));
        }

        // When server-side pagination was used (no client-side filters), use RPC total_count
        if (!hasClientSideFilters) {
          const totalCount = filteredRows.length > 0 ? Number(filteredRows[0].total_count) : 0;
          setTotalCount(totalCount);
          onTotalCountChange?.(totalCount);
        }

        let mappedRecordings = filteredRows.map((row: any) => mapRecordingToMeeting({
          id: row.id,
          fathom_provider_id: row.fathom_provider_id,
          organization_id: row.organization_id,
          owner_user_id: row.owner_user_id,
          title: row.title,
          summary: row.summary,
          global_tags: row.global_tags,
          source_app: row.source_app,
          source_metadata: row.source_metadata,
          duration: row.duration,
          recording_start_time: row.recording_start_time,
          recording_end_time: row.recording_end_time,
          created_at: row.created_at,
          synced_at: row.synced_at,
          ai_generated_title: row.ai_generated_title ?? null,
          workspace_entry: { id: row.entry_id, folder_id: row.entry_folder_id },
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

        // Status filter — client-side filter by synced field
        // 'synced' means meeting.synced === true
        // 'unsynced' means meeting.synced === false or null/undefined
        if (combinedFilters.status && combinedFilters.status.length > 0) {
          const statusSet = new Set(combinedFilters.status);
          mappedRecordings = mappedRecordings.filter((call: any) => {
            const isSynced = call.synced === true;
            if (statusSet.has('synced') && statusSet.has('unsynced')) return true; // both = no filter
            if (statusSet.has('synced')) return isSynced;
            if (statusSet.has('unsynced')) return !isSynced;
            return true;
          });
        }

        // Participant filter — two passes: exact email match (panel) and ILIKE name/email (syntax)
        if (activeOrganizationId) {
          const matchingIds = await findParticipantRecordingIds({
            organizationId: activeOrganizationId,
            participants: combinedFilters.participants,
            participantSearchTerms: combinedFilters.participantSearchTerms,
          });

          if (matchingIds) {
            const matchingRecordingIds = new Set(matchingIds);
            mappedRecordings = mappedRecordings.filter(
              (call: any) => matchingRecordingIds.has(call.canonical_uuid)
            );
          }
        }

        // Tag filter — AND logic: recordings must carry ALL selected tags
        if (combinedFilters.tags && combinedFilters.tags.length > 0) {
          const tagRecordingIds = await findRecordingIdsMatchingAllTags({
            selectedTagIds: combinedFilters.tags,
            legacyTags,
            personalTags,
          });
          const selectedTagSet = new Set(tagRecordingIds ?? []);
          mappedRecordings = mappedRecordings.filter((call: any) => {
            return selectedTagSet.has(call.canonical_uuid);
          });
        }

        // Filter bar folder filter — handles named folders and "unorganized" (no folder assigned)
        // Only applied when the filter bar has folder filters set (not just the sidebar folder nav)
        if (!selectedFolderId && combinedFilters.folders && combinedFilters.folders.length > 0) {
          const namedFolderIds = combinedFilters.folders.filter((id) => id !== 'unorganized');
          const includeUnorganized = combinedFilters.folders.includes('unorganized');

          const allowedRecordingIds = new Set<string>();

          if (namedFolderIds.length > 0) {
            const ids = await getRecordingIdsForFolderFilter(namedFolderIds);
            ids.forEach((id) => allowedRecordingIds.add(id));
          }

          if (includeUnorganized) {
            const assignedUuids = await getAssignedWorkspaceEntryFolderUuids();
            getUnorganizedRecordingUuids(
              mappedRecordings.map((call: any) => call.canonical_uuid),
              assignedUuids
            ).forEach((id) => allowedRecordingIds.add(id));
          }

          mappedRecordings = mappedRecordings.filter((call: any) =>
            allowedRecordingIds.has(call.canonical_uuid)
          );
        }

        // When client-side filters were active, we fetched all records.
        // Now set the correct total count and paginate the filtered results.
        if (hasClientSideFilters) {
          setTotalCount(mappedRecordings.length);
          onTotalCountChange?.(mappedRecordings.length);
          mappedRecordings = mappedRecordings.slice(offset, offset + pageSize);
        }

        return mappedRecordings;
      }

      // ALL CALLS PATH — every recording in the organization, regardless of source or workspace.
      // Server-side pagination via .range() + count: "exact". No client-side slicing.

      let q = supabase
        .from('recordings')
        .select(
          TRANSCRIPT_RECORDING_SELECT,
          { count: 'exact' }
        )
        .order('recording_start_time', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      let restrictedRecordingIds: string[] | null = null;

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
          recIds = await getWorkspaceFolderRecordingIds(null, selectedFolderId);
        }

        if (recIds.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        restrictedRecordingIds = intersectRecordingIds(restrictedRecordingIds, recIds);
      }

      // Filter bar folder filter — handles named folders and "unorganized" (no folder assigned)
      if (!selectedFolderId && combinedFilters.folders && combinedFilters.folders.length > 0) {
        const namedFolderIds = combinedFilters.folders.filter((id) => id !== 'unorganized');
        const includeUnorganized = combinedFilters.folders.includes('unorganized');

        const allowedRecordingIds = new Set<string>();

        if (namedFolderIds.length > 0) {
          const ids = await getRecordingIdsForFolderFilter(namedFolderIds);
          ids.forEach((id) => allowedRecordingIds.add(id));
        }

        if (includeUnorganized) {
          const assignedUuids = await getAssignedWorkspaceEntryFolderUuids();

          // Get all org recordings and keep those NOT in any folder
          const orgId = activeOrganizationId;
          if (orgId) {
            const { data: allRecs } = await supabase
              .from('recordings')
              .select('id')
              .eq('organization_id', orgId);

            getUnorganizedRecordingUuids(
              (allRecs || []).map((r: { id: string }) => r.id),
              assignedUuids
            ).forEach((id) => allowedRecordingIds.add(id));
          }
        }

        const allowedList = Array.from(allowedRecordingIds);
        if (allowedList.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        restrictedRecordingIds = intersectRecordingIds(restrictedRecordingIds, allowedList);
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
        q = q.lte('created_at', toInclusiveDateToIso(combinedFilters.dateTo));
      }
      // Source filter
      if (combinedFilters.sources && combinedFilters.sources.length > 0) {
        q = q.in('source_app', combinedFilters.sources);
      }

      // Status filter — filter by synced field
      // Note: 'synced' is not a DB column in recordings — it comes from source_metadata or synced_at presence.
      // We do this client-side after the query returns results.

      // Participant filter — two passes: exact email (panel) and ILIKE name/email (syntax)
      if (activeOrganizationId) {
        const matchingIds = await findParticipantRecordingIds({
          organizationId: activeOrganizationId,
          participants: combinedFilters.participants,
          participantSearchTerms: combinedFilters.participantSearchTerms,
        });

        if (matchingIds) {
          if (matchingIds.length === 0) {
            setTotalCount(0);
            onTotalCountChange?.(0);
            return [];
          }
          restrictedRecordingIds = intersectRecordingIds(restrictedRecordingIds, matchingIds);
        }
      }

      // Tag filter — AND logic: recordings must carry ALL selected tags
      if (combinedFilters.tags && combinedFilters.tags.length > 0) {
        const tagRecordingIdList = await findRecordingIdsMatchingAllTags({
          selectedTagIds: combinedFilters.tags,
          legacyTags,
          personalTags,
        }) ?? [];

        if (tagRecordingIdList.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        restrictedRecordingIds = intersectRecordingIds(restrictedRecordingIds, tagRecordingIdList);
      }

      // Server-side pagination — no client-side slicing
      if (restrictedRecordingIds !== null) {
        if (restrictedRecordingIds.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }

        if (restrictedRecordingIds.length <= IN_FILTER_CHUNK_SIZE) {
          q = q.in('id', restrictedRecordingIds);
          const { data, error, count } = await q.range(offset, offset + pageSize - 1);
          if (error) throw error;

          const mergedTotal = count ?? 0;
          setTotalCount(mergedTotal);
          onTotalCountChange?.(mergedTotal);

          return (data || []).map((rec: any) => mapRecordingToMeeting(rec)) as Meeting[];
        }

        const batches = await Promise.all(
          chunkArray(restrictedRecordingIds, IN_FILTER_CHUNK_SIZE).map(async (chunk) => {
            let chunkQ = supabase
              .from('recordings')
              .select(TRANSCRIPT_RECORDING_SELECT)
              .order('recording_start_time', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false });

            if (activeOrganizationId) {
              chunkQ = chunkQ.eq('organization_id', activeOrganizationId);
            } else {
              chunkQ = chunkQ.eq('owner_user_id', user.id);
            }

            if (syntax.plainText) {
              const escaped = escapeIlike(syntax.plainText);
              chunkQ = chunkQ.or(`title.ilike.%${escaped}%,summary.ilike.%${escaped}%,full_transcript.ilike.%${escaped}%`);
            }
            if (combinedFilters.dateFrom) {
              chunkQ = chunkQ.gte('created_at', combinedFilters.dateFrom.toISOString());
            }
            if (combinedFilters.dateTo) {
              chunkQ = chunkQ.lte('created_at', toInclusiveDateToIso(combinedFilters.dateTo));
            }
            if (combinedFilters.sources && combinedFilters.sources.length > 0) {
              chunkQ = chunkQ.in('source_app', combinedFilters.sources);
            }

            const { data, error } = await chunkQ.in('id', chunk);
            if (error) throw error;
            return data || [];
          }),
        );

        const sortedRows = sortRecordingRows(batches.flat());
        const mergedTotal = sortedRows.length;
        setTotalCount(mergedTotal);
        onTotalCountChange?.(mergedTotal);

        return sortedRows
          .slice(offset, offset + pageSize)
          .map((rec: any) => mapRecordingToMeeting(rec)) as Meeting[];
      }

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

   // Deep-link handler: open CallDetailDialog when ?callId=<id> is present in the URL.
   // This supports the redirect pattern from CallDetailPage (/call/:id → /?callId=:id).
   // Runs once after calls data is loaded and only if a callId param is present.
   //
   // Phase 36-07 QA-05 fix: KEEP the ?callId param in the URL while the modal
   // is open. Old code stripped it on open, which destroyed the deep-link
   // state — reload closed the modal, share-by-URL didn't work. The param now
   // stays until the user explicitly closes the modal (handled via the modal's
   // own onOpenChange handler elsewhere).
   useEffect(() => {
     const urlCallId = searchParams.get("callId");
     if (!urlCallId || validCalls.length === 0 || detailCall) return;

     // Match by legacy integer recording_id or canonical UUID
     const match = validCalls.find(
       c => String(c.recording_id) === urlCallId || c.canonical_uuid === urlCallId
     );

     if (match) {
       setDetailCall(match);
       // Note: we intentionally do NOT delete ?callId here — see Phase 36-07 QA-05.
     }
   }, [validCalls, searchParams, detailCall, setSearchParams]);

   useEffect(() => {
     if (!detailCall || validCalls.length === 0) return;

     const refreshed = validCalls.find(
       c =>
         String(c.recording_id) === String(detailCall.recording_id) ||
         (detailCall.canonical_uuid && c.canonical_uuid === detailCall.canonical_uuid),
     );

     if (refreshed && refreshed !== detailCall) {
       setDetailCall(refreshed);
     }
   }, [validCalls, detailCall]);

   // When in select-all matching mode, automatically select all calls that match current filters
   useEffect(() => {
     if (selectAllMatchingMode) {
       // Select all calls that match current filters (not just visible page)
       // We need to get all matching calls, not just the current page
       // For now, we'll select all visible calls as an approximation
       // A full implementation would require fetching all matching calls
       const visibleIds = validCalls.map(c => c.recording_id);
       setSelectedCalls(visibleIds);
     }
   }, [selectAllMatchingMode, validCalls]);

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

      const data = await fetchTagAssignmentsForRecordingUuids(recordingUuids);

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

      await deleteRowsByInChunks("call_tag_assignments", "recording_id", callIds);

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
      await deleteRowsByInChunks("call_tag_assignments", "recording_id", callIds);
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

    const results: { uuid: string; fathomProviderId: number | null; sourceApp: string | null }[] = [];

    if (numericIds.length > 0) {
      const data = await fetchRecordingLookupsByChunks('fathom_provider_id', numericIds);
      (data || []).forEach((r) => results.push({
        uuid: r.id,
        fathomProviderId: r.fathom_provider_id,
        sourceApp: r.source_app,
      }));
    }

    if (stringIds.length > 0) {
      const data = await fetchRecordingLookupsByChunks('id', stringIds);
      (data || []).forEach((r) => results.push({
        uuid: r.id,
        fathomProviderId: r.fathom_provider_id,
        sourceApp: r.source_app,
      }));
    }

    return results;
  };

  // Remove from workspace mutation (soft — only removes workspace_entry)
  const removeFromWorkspaceMutation = useMutation({
    mutationFn: async (ids: (number | string)[]) => {
      if (!activeWorkspaceId) throw new Error('No active workspace');
      const resolved = await resolveRecordingIds(ids);
      const uuids = resolved.map((r) => r.uuid);

      await deleteRowsByInChunks(
        'workspace_entries',
        'recording_id',
        uuids,
        (query) => query.eq('workspace_id', activeWorkspaceId),
      );
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
      const legacyIds = resolved.map((r) => r.fathomProviderId).filter((id): id is number => id !== null);

      logger.info('Permanent delete — UUIDs:', uuids, 'Legacy IDs:', legacyIds);

      // 1. Delete ALL workspace_entries (required before recording can be deleted — RLS policy)
      await deleteRowsByInChunks('workspace_entries', 'recording_id', uuids);

      // 2a. Clean up migrated tables using UUID recording_id
      if (uuids.length > 0) {
        try {
          await deleteRowsByInChunks('call_tag_assignments', 'recording_id', uuids);
        } catch (error) {
          logger.warn('Error deleting tag assignments', error);
        }

        try {
          await deleteRowsByInChunks('transcript_tag_assignments', 'recording_id', uuids);
        } catch (error) {
          logger.warn('Error deleting transcript tag assignments', error);
        }

        try {
          await deleteRowsByInChunks('call_speakers', 'recording_id', uuids);
        } catch (error) {
          logger.warn('Error deleting speakers', error);
        }
      }

      // 2b. Clean up folder_assignments (still uses BIGINT call_recording_id)
      if (legacyIds.length > 0) {
        try {
          await deleteRowsByInChunks('folder_assignments', 'call_recording_id', legacyIds);
        } catch (error) {
          logger.warn('Error deleting folder assignments', error);
        }
      }

      // 3. Delete recordings (RLS ensures owner_user_id match; raw tables have ON DELETE SET NULL)
      try {
        await deleteRowsByInChunks(
          'recordings',
          'id',
          uuids,
          (query) => query.eq('owner_user_id', user.id),
        );
      } catch (error) {
        logger.error('Error deleting recordings', error);
        throw error;
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

    const resolved = await resolveRecordingIds(selectedCalls);
    setDeleteSourceLabels(resolved.map((r) => getSourceLabel(r.sourceApp)));

    if (!activeWorkspaceId) {
      // Home view — permanently destroy the recording
      setDeleteMode('permanent-delete');
    } else {
      // Workspace view — always just remove from this workspace;
      // recording persists and remains visible in Home
      setDeleteMode('remove-from-workspace');
    }

    setShowDeleteDialog(true);
  };

  // Dispatch delete based on effective mode (may differ from deleteMode if user checked permanent-delete)
  const confirmDeleteCalls = (effectiveMode: DeleteMode) => {
    if (effectiveMode === 'remove-from-workspace') {
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
        deleteLabel: isHomeView ? 'Delete Selected' : 'Remove from Workspace',
        currentWorkspaceId: activeWorkspaceId ?? null
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
              <div className="border-border h-full">
                <TranscriptTable
                  calls={validCalls}
                    tableMode={isHomeView ? 'home' : 'workspace'}
                    selectedCalls={selectedCalls}
onSelectCall={(callId) => {
                       // Exit select-all mode when user manually deselects any call
                       if (selectAllMatchingMode && selectedCalls.includes(callId)) {
                         setSelectAllMatchingMode(false);
                         const newSelected = selectedCalls.filter(id => id !== callId);
                         setSelectedCalls(newSelected);
                       } else {
                         const newSelected = selectedCalls.includes(callId)
                           ? selectedCalls.filter(id => id !== callId)
                           : [...selectedCalls, callId];
                         setSelectedCalls(newSelected);
                       }
                     }}
onSelectAll={() => {
                       // Three-state logic: 
                       // 1. No calls selected -> select all visible (current page)
                       // 2. Some/all visible selected -> select all matching (entire dataset)
                       // 3. All matching selected -> clear selection
                       
                       const visibleIds = validCalls.map(c => c.recording_id);
                       const allVisibleSelected = selectedCalls.length > 0 && 
                         selectedCalls.every(id => visibleIds.includes(id)) &&
                         selectedCalls.length === visibleIds.length;
                         
                       if (!allVisibleSelected) {
                         // State 1 or 2: Go to select all visible
                         setSelectAllMatchingMode(false);
                         setSelectedCalls(visibleIds);
                       } else if (selectedCalls.length === totalCount) {
                         // State 3: All matching selected -> clear
                         setSelectedCalls([]);
                         setSelectAllMatchingMode(false);
                       } else {
                         // State 2: All visible selected but not all matching -> select all matching
                         setSelectAllMatchingMode(true);
                         // We don't set selectedCalls here - it will be handled by useEffect
                       }
                     }}
                    onCallClick={(call) => {
                      setDetailCall(call);
                      // Phase 36-07 QA-05: push ?callId to URL so the deep-link
                      // works on reload + share-by-URL.
                      const newParams = new URLSearchParams(searchParams);
                      const idForUrl = call.canonical_uuid ?? String(call.recording_id);
                      newParams.set("callId", idForUrl);
                      setSearchParams(newParams, { replace: false });
                    }}
                    tags={tags}
                    tagAssignments={tagAssignments}
                    folders={folders}
                    folderAssignments={folderAssignments}
                    onFolderCall={(callId) => setFolderingCallId(callId)}
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
      <CallDetailDialog
        call={detailCall}
        open={!!detailCall}
        onOpenChange={(open) => {
          if (!open) {
            setDetailCall(null);
            // Phase 36-07 QA-05: strip ?callId from the URL only when the user
            // explicitly closes the modal. While open, the param persists so
            // reload + deep-link sharing work.
            if (searchParams.has("callId")) {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete("callId");
              setSearchParams(newParams, { replace: true });
            }
          }
        }}
        onDataChange={() => queryClient.invalidateQueries()}
      />

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
