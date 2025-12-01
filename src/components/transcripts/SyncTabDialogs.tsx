import { CallDetailDialog } from "@/components/CallDetailDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
import QuickCreateTagDialog from "@/components/QuickCreateTagDialog";
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

  // ManualTagDialog props
  tagDialogOpen: boolean;
  setTagDialogOpen: (open: boolean) => void;
  taggingCallId: string | null;
  bulkTaggingIds: string[];
  setTaggingCallId: (id: string | null) => void;
  setBulkTaggingIds: (ids: string[]) => void;

  // QuickCreateTagDialog props
  createTagDialogOpen: boolean;
  setCreateTagDialogOpen: (open: boolean) => void;

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
  tagDialogOpen,
  setTagDialogOpen,
  taggingCallId,
  bulkTaggingIds,
  setTaggingCallId,
  setBulkTaggingIds,
  createTagDialogOpen,
  setCreateTagDialogOpen,
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

      {/* Manual Tag Dialog - assign tags to calls */}
      <ManualTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        recordingId={taggingCallId}
        recordingIds={bulkTaggingIds}
        onTagsUpdated={() => {
          loadExistingTranscripts();
          setTaggingCallId(null);
          setBulkTaggingIds([]);
        }}
      />

      {/* Quick Create Tag Dialog - create new tags */}
      <QuickCreateTagDialog
        open={createTagDialogOpen}
        onOpenChange={setCreateTagDialogOpen}
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
