import { CallDetailDialog } from "@/components/CallDetailDialog";
import ManualCategorizeDialog from "@/components/ManualCategorizeDialog";
import QuickCreateCategoryDialog from "@/components/QuickCreateCategoryDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncTabDialogsProps {
  // CallDetailDialog props
  viewingUnsyncedMeeting: any | null;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  setSelectedCallId: (id: string | null) => void;
  setViewingUnsyncedMeeting: (meeting: any | null) => void;
  loadExistingTranscripts: () => Promise<void>;

  // ManualCategorizeDialog props
  categorizeDialogOpen: boolean;
  setCategorizeDialogOpen: (open: boolean) => void;
  categorizingCallId: string | null;
  bulkCategorizingIds: string[];
  setCategorizingCallId: (id: string | null) => void;
  setBulkCategorizingIds: (ids: string[]) => void;

  // QuickCreateCategoryDialog props
  createCategoryDialogOpen: boolean;
  setCreateCategoryDialogOpen: (open: boolean) => void;

  // DeleteConfirmDialog props
  showDeleteDialog: boolean;
  setShowDeleteDialog: (show: boolean) => void;
  selectedExistingTranscripts: number[];
  setSelectedExistingTranscripts: (ids: number[]) => void;
}

export function SyncTabDialogs({
  viewingUnsyncedMeeting,
  dialogOpen,
  setDialogOpen,
  setSelectedCallId,
  setViewingUnsyncedMeeting,
  loadExistingTranscripts,
  categorizeDialogOpen,
  setCategorizeDialogOpen,
  categorizingCallId,
  bulkCategorizingIds,
  setCategorizingCallId,
  setBulkCategorizingIds,
  createCategoryDialogOpen,
  setCreateCategoryDialogOpen,
  showDeleteDialog,
  setShowDeleteDialog,
  selectedExistingTranscripts,
  setSelectedExistingTranscripts,
}: SyncTabDialogsProps) {
  return (
    <>
      {/* Call Detail Dialog - shows details for unsynced meetings */}
      {viewingUnsyncedMeeting && (
        <CallDetailDialog
          call={viewingUnsyncedMeeting}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedCallId(null);
              setViewingUnsyncedMeeting(null);
            }
          }}
          onDataChange={loadExistingTranscripts}
        />
      )}

      {/* Manual Categorize Dialog - assign categories to calls */}
      <ManualCategorizeDialog
        open={categorizeDialogOpen}
        onOpenChange={setCategorizeDialogOpen}
        recordingId={categorizingCallId}
        recordingIds={bulkCategorizingIds}
        onCategoriesUpdated={() => {
          loadExistingTranscripts();
          setCategorizingCallId(null);
          setBulkCategorizingIds([]);
        }}
      />

      {/* Quick Create Category Dialog - create new categories */}
      <QuickCreateCategoryDialog
        open={createCategoryDialogOpen}
        onOpenChange={setCreateCategoryDialogOpen}
      />

      {/* Delete Confirm Dialog - confirm bulk delete of transcripts */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={async () => {
          // Delete selected transcripts
          const { error } = await supabase
            .from('fathom_calls')
            .delete()
            .in('recording_id', selectedExistingTranscripts);

          if (error) {
            toast.error('Failed to delete transcripts');
          } else {
            toast.success(`Deleted ${selectedExistingTranscripts.length} transcript(s)`);
            setSelectedExistingTranscripts([]);
            loadExistingTranscripts();
          }
          setShowDeleteDialog(false);
        }}
        title="Delete Transcripts"
        description={`Are you sure you want to delete ${selectedExistingTranscripts.length} transcript(s)? This action cannot be undone.`}
        itemCount={selectedExistingTranscripts.length}
      />
    </>
  );
}
