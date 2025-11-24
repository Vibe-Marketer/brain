import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { TranscriptTableSkeleton } from "@/components/ui/transcript-table-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { categorySchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { CallDetailDialog } from "@/components/CallDetailDialog";
import ManualCategorizeDialog from "@/components/ManualCategorizeDialog";
import QuickCreateCategoryDialog from "@/components/QuickCreateCategoryDialog";
import { CategoryNavigationDropdown } from "@/components/transcript-library/CategoryNavigationDropdown";
import { CategoryManagementDialog } from "@/components/transcript-library/CategoryManagementDialog";
import { FilterBar } from "@/components/transcript-library/FilterBar";
import { BulkActionToolbarEnhanced } from "@/components/transcript-library/BulkActionToolbarEnhanced";
import { DragDropZones } from "@/components/transcript-library/DragDropZones";
import { EmptyState } from "@/components/transcript-library/EmptyStates";
import { AIProcessingProgress } from "@/components/transcripts/AIProcessingProgress";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import SmartExportDialog from "@/components/SmartExportDialog";
import {
  FilterState,
  parseSearchSyntax,
  syntaxToFilters,
  filtersToURLParams,
  urlParamsToFilters,
} from "@/lib/filter-utils";

interface Category {
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Removed viewMode - only one table view now

  // Selection & interaction state
  const [selectedCalls, setSelectedCalls] = useState<number[]>([]);
  const [selectedCall, setSelectedCall] = useState<any>(null);
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
    categories: true,
    status: true,
  });

  // Dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [smartExportOpen, setSmartExportOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [categorizingCallId, setCategorizingCallId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Load host email
  useEffect(() => {
    const loadHostEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_settings")
          .select("host_email")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (data?.host_email) {
          setHostEmail(data.host_email);
        }
      }
    };

    loadHostEmail();
  }, []);

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Drag and drop helpers
  const dragHelpers = useDragAndDrop();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingCategoryTranscripts, setPendingCategoryTranscripts] = useState<number[]>([]);

  // Update URL params when filters change
  useEffect(() => {
    const params = filtersToURLParams(filters);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filters]);

  // Parse search syntax
  const syntax = useMemo(() => {
    if (!searchQuery) return { 
      plainText: "", 
      filters: { 
        participant: [], 
        date: "", 
        category: [], 
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
    queryKey: ["category-calls", searchQuery, combinedFilters, page, pageSize],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("fathom_calls")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Category filter (multiple categories)
      if (combinedFilters.categories && combinedFilters.categories.length > 0) {
        const { data: assignments } = await supabase
          .from("call_category_assignments")
          .select("call_recording_id")
          .in("category_id", combinedFilters.categories);

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
          const invitees = call.calendar_invitees as any[];
          if (!invitees) return false;
          return combinedFilters.participants!.some((p) =>
            invitees.some((inv) => inv.name?.toLowerCase().includes(p.toLowerCase()) || inv.email?.toLowerCase().includes(p.toLowerCase()))
          );
        });
      }

      return filteredData;
    },
  });

  // Fetch category assignments for displayed calls
  const { data: categoryAssignments = {} } = useQuery({
    queryKey: ["category-assignments", calls.map(c => c.recording_id)],
    queryFn: async () => {
      if (calls.length === 0) return {};
      
      const { data, error } = await supabase
        .from("call_category_assignments")
        .select("call_recording_id, category_id")
        .in("call_recording_id", calls.map(c => c.recording_id));
      
      if (error) throw error;
      
      const assignments: Record<string, string[]> = {};
      data?.forEach((assignment) => {
        if (!assignments[assignment.call_recording_id]) {
          assignments[assignment.call_recording_id] = [];
        }
        assignments[assignment.call_recording_id].push(assignment.category_id);
      });
      
      return assignments;
    },
    enabled: calls.length > 0,
  });

  // Bulk categorize mutation
  const categorizeMutation = useMutation({
    mutationFn: async ({ callIds, categoryId }: { callIds: number[]; categoryId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Remove existing category assignments
      await supabase
        .from("call_category_assignments")
        .delete()
        .in("call_recording_id", callIds);

      // Create new assignments
      const assignments = callIds.map((callId) => ({
        call_recording_id: callId,
        category_id: categoryId,
        auto_assigned: false,
      }));

      const { error } = await supabase
        .from("call_category_assignments")
        .insert(assignments);
      if (error) throw error;
    },
    onMutate: ({ callIds, categoryId }) => {
      const category = categories.find((c) => c.id === categoryId);
      const categoryName = category?.name || "Uncategorized";
      const count = callIds.length;
      const toastId = toast.loading(
        `Moving ${count} transcript${count > 1 ? 's' : ''} to ${categoryName}...`
      );
      return { toastId };
    },
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["category-calls"] });
      queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
      const category = categories.find((c) => c.id === variables.categoryId);
      const categoryName = category?.name || "Uncategorized";
      const count = variables.callIds.length;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} moved to ${categoryName}`, { 
        id: context?.toastId 
      });
      setSelectedCalls([]);
    },
    onError: (_error, _variables, context) => {
      toast.error("Failed to categorize transcript(s)", { 
        id: context?.toastId 
      });
    },
  });

  // Uncategorize mutation
  const uncategorizeMutation = useMutation({
    mutationFn: async ({ callIds }: { callIds: number[] }) => {
      const { error } = await supabase
        .from("call_category_assignments")
        .delete()
        .in("call_recording_id", callIds);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["category-calls"] });
      queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
      const count = variables.callIds.length;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} uncategorized`);
      setSelectedCalls([]);
    },
    onError: () => {
      toast.error("Failed to uncategorize transcript(s)");
    },
  });

  // Delete calls mutation - CASCADE deletes from all related tables
  const deleteCallsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      logger.info("Starting delete for IDs", ids);

      // Delete from all related tables first - throw errors to stop execution
      const { error: assignmentsError } = await supabase
        .from("call_category_assignments")
        .delete()
        .in("call_recording_id", ids);
      if (assignmentsError) {
        logger.error("Error deleting category assignments", assignmentsError);
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
      await queryClient.invalidateQueries({ queryKey: ["category-calls"] });
      await queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
      setSelectedCalls([]);
      setShowDeleteDialog(false);
      const count = deletedCalls?.length || 0;
      toast.success(`${count} transcript${count > 1 ? "s" : ""} deleted successfully`);
    },
    onError: (error: any) => {
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
      // Handle uncategorize
      if (over.data?.current?.type === "uncategorize-zone") {
        uncategorizeMutation.mutate({
          callIds: dragHelpers.draggedItems,
        });
        setSelectedCalls([]);
      }
      
      // Handle create new category
      if (over.data?.current?.type === "create-new-zone") {
        setIsQuickCreateOpen(true);
        setPendingCategoryTranscripts(dragHelpers.draggedItems);
      }
      
      // Handle drop on category zones
      if (over.data?.current?.type === "category-zone") {
        const categoryId = over.data.current.categoryId;
        categorizeMutation.mutate({
          callIds: dragHelpers.draggedItems,
          categoryId,
        });
        setSelectedCalls([]);
      }
    }
    
    dragHelpers.handleDragEnd(event);
  };

  // Extract unique participants from all calls
  const allParticipants = useMemo(() => {
    const participants = new Set<string>();
    calls.forEach((call) => {
      const invitees = call.calendar_invitees as any[];
      if (invitees) {
        invitees.forEach((inv) => {
          if (inv.name) participants.add(inv.name);
        });
      }
    });
    return Array.from(participants).sort();
  }, [calls]);

  return (
    <DndContext
      onDragStart={(e) => dragHelpers.handleDragStart(e, selectedCalls)}
      onDragEnd={handleDragEnd}
      onDragCancel={dragHelpers.handleDragCancel}
    >
      {/* Drag Drop Zones - Shows when dragging */}
      {dragHelpers.activeDragId && (
        <DragDropZones
          categories={categories}
          isDragging={true}
          onDrop={(categoryId) => {
            categorizeMutation.mutate({
              callIds: dragHelpers.draggedItems,
              categoryId,
            });
          }}
          onUncategorize={() => {
            uncategorizeMutation.mutate({
              callIds: dragHelpers.draggedItems,
            });
          }}
          onCreateNew={() => {
            setIsQuickCreateOpen(true);
            setPendingCategoryTranscripts(dragHelpers.draggedItems);
          }}
        />
      )}

      <div>
        {/* Top separator for breathing room */}
        <Separator className="mb-12" />

        {/* Filter bar */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          visibleColumns={visibleColumns}
          onToggleColumn={(columnId) =>
            setVisibleColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }))
          }
          onExport={() => setSmartExportOpen(true)}
        />

        <Separator className="my-12" />

        {/* Bulk Actions Toolbar */}
        {selectedCalls.length > 0 && (
          <BulkActionToolbarEnhanced
            selectedCount={selectedCalls.length}
            selectedCalls={calls.filter(c => selectedCalls.includes(c.recording_id))}
            categories={categories}
            onCategorize={(categoryId) => {
              categorizeMutation.mutate({
                callIds: selectedCalls,
                categoryId,
              });
            }}
            onUncategorize={() => {
              uncategorizeMutation.mutate({
                callIds: selectedCalls,
              });
            }}
            onClearSelection={() => setSelectedCalls([])}
            onDelete={handleDeleteCalls}
            onCreateNewCategory={() => {
              setIsQuickCreateOpen(true);
              setPendingCategoryTranscripts(selectedCalls);
            }}
          />
        )}

        {selectedCalls.length > 0 && <Separator className="my-12" />}

        {/* Content Area */}
        {callsLoading ? (
          <TranscriptTableSkeleton />
        ) : calls.length === 0 ? (
          <EmptyState
            type={searchQuery || Object.keys(combinedFilters).length > 0 ? "no-results" : "no-transcripts"}
            onAction={() => {
              setSearchQuery("");
              setFilters({});
            }}
          />
        ) : (
          <>
            {/* AI Processing Progress */}
            <AIProcessingProgress onJobsComplete={() => queryClient.invalidateQueries({ queryKey: ["transcript-calls"] })} />
            
            <div className="border-t border-cb-gray-light dark:border-cb-gray-dark">
              <TranscriptTable
                calls={calls}
                selectedCalls={selectedCalls}
                onSelectCall={(callId) => {
                  if (selectedCalls.includes(callId)) {
                    setSelectedCalls(selectedCalls.filter(id => id !== callId));
                  } else {
                    setSelectedCalls([...selectedCalls, callId]);
                  }
                }}
                onSelectAll={() => {
                  if (selectedCalls.length === calls.length) {
                    setSelectedCalls([]);
                  } else {
                    setSelectedCalls(calls.map(c => c.recording_id));
                  }
                }}
                onCallClick={(call) => setSelectedCall(call)}
                categories={categories}
                categoryAssignments={categoryAssignments}
                onCategorizeCall={(callId) => setCategorizingCallId(callId)}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                hostEmail={hostEmail}
              />
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {selectedCall && (
        <CallDetailDialog
          call={selectedCall}
          open={!!selectedCall}
          onOpenChange={(open) => !open && setSelectedCall(null)}
        />
      )}

      {categorizingCallId && (
        <ManualCategorizeDialog
          open={!!categorizingCallId}
          onOpenChange={(open) => !open && setCategorizingCallId(null)}
          recordingId={categorizingCallId.toString()}
          onCategoriesUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["category-calls"] });
            queryClient.invalidateQueries({ queryKey: ["category-assignments"] });
            setCategorizingCallId(null);
          }}
        />
      )}

      {isQuickCreateOpen && (
        <QuickCreateCategoryDialog
          open={isQuickCreateOpen}
          onOpenChange={setIsQuickCreateOpen}
          onCategoryCreated={(categoryId) => {
            if (pendingCategoryTranscripts.length > 0) {
              categorizeMutation.mutate({
                callIds: pendingCategoryTranscripts,
                categoryId,
              });
              setPendingCategoryTranscripts([]);
            }
          }}
        />
      )}

      {categoryManagementOpen && (
        <CategoryManagementDialog
          open={categoryManagementOpen}
          onOpenChange={setCategoryManagementOpen}
          categories={categories}
          onCreateCategory={() => {
            setCategoryManagementOpen(false);
            setCategoryDialogOpen(true);
          }}
          onEditCategory={(category) => {
            setEditingCategory(category);
            setFormData({
              name: category.name,
              description: category.description || "",
            });
            setCategoryManagementOpen(false);
            setCategoryDialogOpen(true);
          }}
        />
      )}

      {/* Smart Export Dialog */}
      <SmartExportDialog
        open={smartExportOpen}
        onOpenChange={setSmartExportOpen}
        selectedCalls={calls.filter(c => selectedCalls.includes(c.recording_id))}
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
    </DndContext>
  );
}
