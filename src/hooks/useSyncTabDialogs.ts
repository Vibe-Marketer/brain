import { useState } from 'react';

interface DialogState {
  categorizeDialogOpen: boolean;
  createCategoryDialogOpen: boolean;
  showDeleteDialog: boolean;
  categorizingCallId: string | null;
  bulkCategorizingIds: string[];
  dialogOpen: boolean;
  selectedCallId: string | null;
  viewingUnsyncedMeeting: any | null;
}

export function useSyncTabDialogs() {
  const [dialogState, setDialogState] = useState<DialogState>({
    categorizeDialogOpen: false,
    createCategoryDialogOpen: false,
    showDeleteDialog: false,
    categorizingCallId: null,
    bulkCategorizingIds: [],
    dialogOpen: false,
    selectedCallId: null,
    viewingUnsyncedMeeting: null,
  });

  const openCategorizeDialog = (callId?: string) => {
    setDialogState(prev => ({
      ...prev,
      categorizeDialogOpen: true,
      categorizingCallId: callId || null,
    }));
  };

  const closeCategorizeDialog = () => {
    setDialogState(prev => ({
      ...prev,
      categorizeDialogOpen: false,
      categorizingCallId: null,
      bulkCategorizingIds: [],
    }));
  };

  const openDeleteDialog = () => {
    setDialogState(prev => ({ ...prev, showDeleteDialog: true }));
  };

  const closeDeleteDialog = () => {
    setDialogState(prev => ({ ...prev, showDeleteDialog: false }));
  };

  const openCreateCategoryDialog = () => {
    setDialogState(prev => ({ ...prev, createCategoryDialogOpen: true }));
  };

  const closeCreateCategoryDialog = () => {
    setDialogState(prev => ({ ...prev, createCategoryDialogOpen: false }));
  };

  const openViewDialog = (meeting: any, callId: string) => {
    setDialogState(prev => ({
      ...prev,
      dialogOpen: true,
      selectedCallId: callId,
      viewingUnsyncedMeeting: meeting,
    }));
  };

  const closeViewDialog = () => {
    setDialogState(prev => ({
      ...prev,
      dialogOpen: false,
      selectedCallId: null,
      viewingUnsyncedMeeting: null,
    }));
  };

  const setBulkCategorizingIds = (ids: string[]) => {
    setDialogState(prev => ({ ...prev, bulkCategorizingIds: ids }));
  };

  return {
    // State
    ...dialogState,

    // Actions
    openCategorizeDialog,
    closeCategorizeDialog,
    openDeleteDialog,
    closeDeleteDialog,
    openCreateCategoryDialog,
    closeCreateCategoryDialog,
    openViewDialog,
    closeViewDialog,
    setBulkCategorizingIds,
  };
}
