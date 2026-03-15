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
  const homeColumns = { date: true, duration: true, source: true, participants: true, tags: true, workspaces: true, sharedWith: true };
  const workspaceColumns = { date: true, duration: true, participants: true, tags: true, folders: true, workspaces: true, sharedWith: true };
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
    const mergedStatus = Array.from(new Set([...(filters.status ?? []), ...(syntaxFilters.status ?? [])]));

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
      status: mergedStatus.length > 0 ? mergedStatus : undefined,
      // Keep categories passthrough
      categories: Array.from(new Set([...(filters.categories ?? []), ...(syntaxFilters.categories ?? [])])),
    };
  }, [syntax, filters, tags, folders]);

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

      // WORKSPACE FILTERING — RPC approach.
      // Uses get_workspace_recordings() DB function which does the JOIN + ORDER + pagination
      // server-side. This avoids:
      //   1. PostgREST embedded-resource ordering (only sorts nested rows, not parent rows)
      //   2. .in() URL length limits (~8KB) that break for workspaces with 200+ recordings
      if (activeWorkspaceId) {
        // Folder pre-filter: resolve recording UUIDs from folder assignments if needed
        let folderRecordingIds: string[] | null = null;
        if (selectedFolderId) {
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

          folderRecordingIds = recs.map((r) => r.id);
        }

        // Ensure dateTo is inclusive by extending to end of the selected day (23:59:59.999)
        let rpcDateTo: string | null = null;
        if (combinedFilters.dateTo) {
          const dateTo = new Date(combinedFilters.dateTo);
          if (dateTo.getHours() === 0 && dateTo.getMinutes() === 0 && dateTo.getSeconds() === 0) {
            dateTo.setHours(23, 59, 59, 999);
          }
          rpcDateTo = dateTo.toISOString();
        }

        // Call RPC — single server-side JOIN + ORDER + pagination
        const rpcParams: Record<string, unknown> = {
          p_workspace_id: activeWorkspaceId,
          p_limit: pageSize,
          p_offset: offset,
          p_search: syntax.plainText || null,
          p_date_from: combinedFilters.dateFrom?.toISOString() ?? null,
          p_date_to: rpcDateTo,
          p_sources: combinedFilters.sources?.length ? combinedFilters.sources : null,
        };

        const { data: rows, error: rpcError } = await supabase.rpc('get_workspace_recordings', rpcParams);

        if (rpcError) throw rpcError;

        // Apply folder filter client-side (folder_recording_ids were resolved above)
        let filteredRows = (rows || []) as any[];
        if (folderRecordingIds) {
          const folderSet = new Set(folderRecordingIds);
          filteredRows = filteredRows.filter((r: any) => folderSet.has(r.id));
        }

        const totalCount = filteredRows.length > 0 ? Number(filteredRows[0].total_count) : 0;
        setTotalCount(totalCount);
        onTotalCountChange?.(totalCount);

        let mappedRecordings = filteredRows.map((row: any) => mapRecordingToMeeting({
          id: row.id,
          legacy_recording_id: row.legacy_recording_id,
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

        // Participant filter — two passes: exact email match (panel) and ILIKE name/email (syntax)
        if (activeOrganizationId) {
          const hasEmailFilter = combinedFilters.participants && combinedFilters.participants.length > 0;
          const hasNameFilter = combinedFilters.participantSearchTerms && combinedFilters.participantSearchTerms.length > 0;

          if (hasEmailFilter || hasNameFilter) {
            const matchingRecordingIds = new Set<string>();

            // Exact email match from filter panel
            if (hasEmailFilter) {
              const { data: byEmail } = await supabase
                .from('call_participants')
                .select('recording_id')
                .eq('organization_id', activeOrganizationId)
                .in('email', combinedFilters.participants!);
              (byEmail || []).forEach((p: { recording_id: string }) => matchingRecordingIds.add(p.recording_id));
            }

            // ILIKE on name OR email for each syntax search term
            if (hasNameFilter) {
              for (const term of combinedFilters.participantSearchTerms!) {
                const escaped = escapeIlike(term);
                const { data: byName } = await supabase
                  .from('call_participants')
                  .select('recording_id')
                  .eq('organization_id', activeOrganizationId)
                  .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
                (byName || []).forEach((p: { recording_id: string }) => matchingRecordingIds.add(p.recording_id));
              }
            }

            mappedRecordings = mappedRecordings.filter(
              (call: any) => matchingRecordingIds.has(call.canonical_uuid)
            );
          }
        }

        // Tag filter — AND logic: recordings must carry ALL selected tags
        if (combinedFilters.tags && combinedFilters.tags.length > 0) {
          // Build a map of recording_id → Set of tag_ids that are assigned to it
          const recordingTagMap = new Map<string, Set<string>>();

          // Regular tags: query call_tag_assignments
          const regularTagIds = combinedFilters.tags.filter((id: string) => legacyTags.some(t => t.id === id));
          if (regularTagIds.length > 0) {
            const { data: regularAssignments } = await supabase
              .from('call_tag_assignments')
              .select('recording_id, tag_id')
              .in('tag_id', regularTagIds);
            (regularAssignments || []).forEach((a: { recording_id: string; tag_id: string }) => {
              if (!recordingTagMap.has(a.recording_id)) recordingTagMap.set(a.recording_id, new Set());
              recordingTagMap.get(a.recording_id)!.add(a.tag_id);
            });
          }

          // Personal tags: query personal_tag_recordings
          const personalTagIds = combinedFilters.tags.filter((id: string) => personalTags.some(t => t.id === id));
          if (personalTagIds.length > 0) {
            const { data: personalAssignments } = await supabase
              .from('personal_tag_recordings')
              .select('recording_id, tag_id')
              .in('tag_id', personalTagIds);
            (personalAssignments || []).forEach((a: { recording_id: string; tag_id: string }) => {
              if (!recordingTagMap.has(a.recording_id)) recordingTagMap.set(a.recording_id, new Set());
              recordingTagMap.get(a.recording_id)!.add(a.tag_id);
            });
          }

          // Keep only recordings that have ALL selected tags
          const selectedTagSet = new Set(combinedFilters.tags);
          mappedRecordings = mappedRecordings.filter((call: any) => {
            const assignedTags = recordingTagMap.get(call.canonical_uuid);
            if (!assignedTags) return false;
            for (const tagId of selectedTagSet) {
              if (!assignedTags.has(tagId)) return false;
            }
            return true;
          });
        }

        // Status filter — synced = has synced_at; unsynced = synced_at is null
        if (combinedFilters.status && combinedFilters.status.length > 0) {
          const wantsSynced = combinedFilters.status.includes('synced');
          const wantsUnsynced = combinedFilters.status.includes('unsynced');
          if (wantsSynced && !wantsUnsynced) {
            mappedRecordings = mappedRecordings.filter((call: any) => !!call.synced_at);
          } else if (wantsUnsynced && !wantsSynced) {
            mappedRecordings = mappedRecordings.filter((call: any) => !call.synced_at);
          }
          // if both selected, no filter needed
        }

        // Filter bar folder filter — handles named folders and "unorganized" (no folder assigned)
        // Only applied when the filter bar has folder filters set (not just the sidebar folder nav)
        if (!selectedFolderId && combinedFilters.folders && combinedFilters.folders.length > 0) {
          const namedFolderIds = combinedFilters.folders.filter((id) => id !== 'unorganized');
          const includeUnorganized = combinedFilters.folders.includes('unorganized');

          const allowedRecordingIds = new Set<string>();

          if (namedFolderIds.length > 0) {
            // Expand each folder to include its children
            const { data: childFolders } = await supabase
              .from('folders')
              .select('id')
              .in('parent_id', namedFolderIds);
            const allFolderIds = [...namedFolderIds, ...(childFolders || []).map((f: { id: string }) => f.id)];

            const { data: folderAssigns } = await supabase
              .from('folder_assignments')
              .select('call_recording_id')
              .in('folder_id', allFolderIds);

            if (folderAssigns && folderAssigns.length > 0) {
              const legacyIds = folderAssigns.map((a: { call_recording_id: number }) => a.call_recording_id);
              const { data: recs } = await supabase
                .from('recordings')
                .select('id')
                .in('legacy_recording_id', legacyIds);
              (recs || []).forEach((r: { id: string }) => allowedRecordingIds.add(r.id));
            }
          }

          if (includeUnorganized) {
            // Get all legacy IDs that have a folder assignment in any folder
            const { data: allAssigns } = await supabase
              .from('folder_assignments')
              .select('call_recording_id');
            const assignedLegacyIds = new Set(
              (allAssigns || []).map((a: { call_recording_id: number }) => a.call_recording_id)
            );
            // Mark workspace recordings with no folder as unorganized
            mappedRecordings.forEach((call: any) => {
              const legacyId = call.recording_id;
              if (legacyId == null || !assignedLegacyIds.has(Number(legacyId))) {
                allowedRecordingIds.add(call.canonical_uuid);
              }
            });
          }

          mappedRecordings = mappedRecordings.filter((call: any) =>
            allowedRecordingIds.has(call.canonical_uuid)
          );
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

      // Filter bar folder filter — handles named folders and "unorganized" (no folder assigned)
      if (\!selectedFolderId && combinedFilters.folders && combinedFilters.folders.length > 0) {
        const namedFolderIds = combinedFilters.folders.filter((id) => id \!== 'unorganized');
        const includeUnorganized = combinedFilters.folders.includes('unorganized');

        const allowedRecordingIds = new Set<string>();

        if (namedFolderIds.length > 0) {
          // Expand each folder to include its children
          const { data: childFolders } = await supabase
            .from('folders')
            .select('id')
            .in('parent_id', namedFolderIds);
          const allFolderIds = [...namedFolderIds, ...(childFolders || []).map((f: { id: string }) => f.id)];

          const { data: folderAssigns } = await supabase
            .from('folder_assignments')
            .select('call_recording_id')
            .in('folder_id', allFolderIds);

          if (folderAssigns && folderAssigns.length > 0) {
            const legacyIds = folderAssigns.map((a: { call_recording_id: number }) => a.call_recording_id);
            const { data: recs } = await supabase
              .from('recordings')
              .select('id')
              .in('legacy_recording_id', legacyIds);
            (recs || []).forEach((r: { id: string }) => allowedRecordingIds.add(r.id));
          }
        }

        if (includeUnorganized) {
          // Find all recording legacy IDs that have at least one folder assignment
          const { data: allAssigns } = await supabase
            .from('folder_assignments')
            .select('call_recording_id');

          const assignedLegacyIds = new Set((allAssigns || []).map((a: { call_recording_id: number }) => a.call_recording_id));

          // Get all org recordings and keep those NOT in any folder
          const orgId = activeOrganizationId;
          if (orgId) {
            const { data: allRecs } = await supabase
              .from('recordings')
              .select('id, legacy_recording_id')
              .eq('organization_id', orgId);

            (allRecs || []).forEach((r: { id: string; legacy_recording_id: number | null }) => {
              if (r.legacy_recording_id === null || \!assignedLegacyIds.has(r.legacy_recording_id)) {
                allowedRecordingIds.add(r.id);
              }
            });
          }
        }

        const allowedList = Array.from(allowedRecordingIds);
        if (allowedList.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        q = q.in('id', allowedList);
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
        // Ensure dateTo is inclusive by extending to end of the selected day (23:59:59.999)
        const dateTo = new Date(combinedFilters.dateTo);
        if (dateTo.getHours() === 0 && dateTo.getMinutes() === 0 && dateTo.getSeconds() === 0) {
          dateTo.setHours(23, 59, 59, 999);
        }
        q = q.lte('created_at', dateTo.toISOString());
      }
      // Source filter
      if (combinedFilters.sources && combinedFilters.sources.length > 0) {
        q = q.in('source_app', combinedFilters.sources);
      }

      // Participant filter — two passes: exact email (panel) and ILIKE name/email (syntax)
      if (activeOrganizationId) {
        const hasEmailFilter = combinedFilters.participants && combinedFilters.participants.length > 0;
        const hasNameFilter = combinedFilters.participantSearchTerms && combinedFilters.participantSearchTerms.length > 0;

        if (hasEmailFilter || hasNameFilter) {
          const matchingRecordingIds = new Set<string>();

          // Exact email match from filter panel
          if (hasEmailFilter) {
            const { data: byEmail } = await supabase
              .from('call_participants')
              .select('recording_id')
              .eq('organization_id', activeOrganizationId)
              .in('email', combinedFilters.participants!);
            (byEmail || []).forEach((p: { recording_id: string }) => matchingRecordingIds.add(p.recording_id));
          }

          // ILIKE on name OR email for each syntax search term
          if (hasNameFilter) {
            for (const term of combinedFilters.participantSearchTerms!) {
              const escaped = escapeIlike(term);
              const { data: byName } = await supabase
                .from('call_participants')
                .select('recording_id')
                .eq('organization_id', activeOrganizationId)
                .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
              (byName || []).forEach((p: { recording_id: string }) => matchingRecordingIds.add(p.recording_id));
            }
          }

          const matchingIds = Array.from(matchingRecordingIds);
          if (matchingIds.length === 0) {
            setTotalCount(0);
            onTotalCountChange?.(0);
            return [];
          }
          q = q.in('id', matchingIds);
        }
      }

      // Status filter — synced = has synced_at; unsynced = synced_at is null
      if (combinedFilters.status && combinedFilters.status.length > 0) {
        const wantsSynced = combinedFilters.status.includes('synced');
        const wantsUnsynced = combinedFilters.status.includes('unsynced');
        if (wantsSynced && !wantsUnsynced) {
          q = q.not('synced_at', 'is', null);
        } else if (wantsUnsynced && !wantsSynced) {
          q = q.is('synced_at', null);
        }
        // if both are selected, no filter needed (all rows)
      }

      // Tag filter — AND logic: recordings must carry ALL selected tags
      if (combinedFilters.tags && combinedFilters.tags.length > 0) {
        // Build a map of recording_id → Set of tag_ids that are assigned to it
        const recordingTagMap = new Map<string, Set<string>>();

        // Regular tags: query call_tag_assignments
        const regularTagIds = combinedFilters.tags.filter((id: string) => legacyTags.some(t => t.id === id));
        if (regularTagIds.length > 0) {
          const { data: regularAssignments } = await supabase
            .from('call_tag_assignments')
            .select('recording_id, tag_id')
            .in('tag_id', regularTagIds);
          (regularAssignments || []).forEach((a: { recording_id: string; tag_id: string }) => {
            if (!recordingTagMap.has(a.recording_id)) recordingTagMap.set(a.recording_id, new Set());
            recordingTagMap.get(a.recording_id)!.add(a.tag_id);
          });
        }

        // Personal tags: query personal_tag_recordings
        const personalTagIds = combinedFilters.tags.filter((id: string) => personalTags.some(t => t.id === id));
        if (personalTagIds.length > 0) {
          const { data: personalAssignments } = await supabase
            .from('personal_tag_recordings')
            .select('recording_id, tag_id')
            .in('tag_id', personalTagIds);
          (personalAssignments || []).forEach((a: { recording_id: string; tag_id: string }) => {
            if (!recordingTagMap.has(a.recording_id)) recordingTagMap.set(a.recording_id, new Set());
            recordingTagMap.get(a.recording_id)!.add(a.tag_id);
          });
        }

        // Intersect: keep only recordings that have ALL selected tags
        const selectedTagSet = new Set(combinedFilters.tags);
        const tagRecordingIdList = Array.from(recordingTagMap.entries())
          .filter(([, assignedTags]) => {
            for (const tagId of selectedTagSet) {
              if (!assignedTags.has(tagId)) return false;
            }
            return true;
          })
          .map(([recordingId]) => recordingId);

        if (tagRecordingIdList.length === 0) {
          setTotalCount(0);
          onTotalCountChange?.(0);
          return [];
        }
        q = q.in('id', tagRecordingIdList);
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
