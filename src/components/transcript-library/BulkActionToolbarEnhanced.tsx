import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RiDeleteBin6Line, RiCloseLine, RiShareForwardLine, RiPriceTag3Line, RiMagicLine, RiFolderLine, RiChatQuoteLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SmartExportDialog from "@/components/SmartExportDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
import { ActionButton } from "./ActionButton";
import { TagDropdown } from "./TagDropdown";
import { ExportDropdown } from "./ExportDropdown";
import { exportToPDF, exportToDOCX, exportToTXT, exportToJSON, exportToZIP } from "@/lib/export-utils";
import { autoTagCalls, generateAiTitles } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import type { Meeting } from "@/types";

/** Response shape from bulk AI operations (generate-ai-titles, auto-tag-calls) */
interface BulkAIOperationResponse {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    recording_id: number;
    success: boolean;
    error?: string;
    title?: string;
    tag?: string;
  }>;
}

interface BulkActionToolbarEnhancedProps {
  selectedCount: number;
  selectedCalls: Meeting[];
  tags: Array<{ id: string; name: string }>;
  onClearSelection: () => void;
  onDelete: () => void;
  onTag?: (tagId: string) => void;
  onRemoveTag?: () => void;
  onCreateNewTag?: () => void;
  onAssignFolder?: () => void;
}

export function BulkActionToolbarEnhanced({
  selectedCount,
  selectedCalls,
  tags,
  onClearSelection,
  onDelete,
  onTag,
  onRemoveTag,
  onCreateNewTag,
  onAssignFolder,
}: BulkActionToolbarEnhancedProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showSmartExport, setShowSmartExport] = useState(false);
  const [showManualTagDialog, setShowManualTagDialog] = useState(false);

  if (selectedCount === 0) return null;

  const handleExport = async (format: 'pdf' | 'docx' | 'txt' | 'json' | 'zip') => {
    const loadingToast = toast.loading(`Exporting ${selectedCount} transcript${selectedCount > 1 ? 's' : ''} as ${format.toUpperCase()}...`);
    
    try {
      switch (format) {
        case 'pdf':
          await exportToPDF(selectedCalls);
          break;
        case 'docx':
          await exportToDOCX(selectedCalls);
          break;
        case 'txt':
          await exportToTXT(selectedCalls);
          break;
        case 'json':
          await exportToJSON(selectedCalls);
          break;
        case 'zip':
          await exportToZIP(selectedCalls);
          break;
      }
      toast.success(`Successfully exported ${selectedCount} transcript${selectedCount > 1 ? 's' : ''}`, { id: loadingToast });
    } catch (error) {
      logger.error('Export error', error);
      toast.error(`Failed to export transcripts`, { id: loadingToast });
    }
  };

  const handleShare = () => {
    toast.info("Share feature coming soon");
  };

  const handleChat = () => {
    const recordingIds = selectedCalls
      .filter(c => c?.recording_id != null)
      .map(c => Number(c.recording_id));

    if (recordingIds.length === 0) {
      toast.error('No valid recordings selected');
      return;
    }

    const initialContext = selectedCalls
      .filter(c => c?.recording_id != null)
      .map(c => ({
        type: 'call' as const,
        id: Number(c.recording_id),
        title: c.title || `Call ${c.recording_id}`,
        date: c.created_at
      }));

    navigate('/chat', {
      state: {
        newSession: true,
        prefilter: {
          recordingIds
        },
        initialContext
      }
    });
  };

  const handleGenerateAITitles = async () => {
    const loadingToast = toast.loading(`Generating AI titles for ${selectedCount} call${selectedCount > 1 ? 's' : ''}...`);

    try {
      const recordingIds = selectedCalls
        .filter(c => c?.recording_id != null)
        .map(c => Number(c.recording_id));

      if (recordingIds.length === 0) {
        toast.error('Invalid selection: no valid recording IDs', { id: loadingToast });
        return;
      }

      const { data, error } = await generateAiTitles(recordingIds);

      if (error) {
        throw new Error(error);
      }

      // Report results with appropriate feedback
      const responseData = data as BulkAIOperationResponse;
      if (responseData.successCount > 0) {
        if (responseData.failureCount > 0) {
          toast.success(
            `Generated ${responseData.successCount} title${responseData.successCount !== 1 ? 's' : ''}, ${responseData.failureCount} failed`,
            { id: loadingToast }
          );
        } else {
          toast.success(
            `Generated ${responseData.successCount} title${responseData.successCount !== 1 ? 's' : ''} successfully`,
            { id: loadingToast }
          );
        }
      } else if (responseData.failureCount > 0) {
        // All failed - show error with details
        const firstError = responseData.results?.find((r) => !r.success)?.error;
        toast.error(
          `Failed to generate titles: ${firstError || 'Unknown error'}`,
          { id: loadingToast }
        );
      } else {
        toast.info('No calls to process', { id: loadingToast });
      }

      // Invalidate queries to refresh the table with new AI titles
      await queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
      await queryClient.invalidateQueries({ queryKey: ["transcript-calls"] });

      onClearSelection();
    } catch (error) {
      logger.error('Error generating AI titles', error);
      toast.error('Failed to generate AI titles', { id: loadingToast });
    }
  };

  const handleAutoTagCalls = async () => {
    const loadingToast = toast.loading(`AI tagging ${selectedCount} call${selectedCount > 1 ? 's' : ''}...`);

    try {
      const recordingIds = selectedCalls
        .filter(c => c?.recording_id != null)
        .map(c => Number(c.recording_id));

      if (recordingIds.length === 0) {
        toast.error('Invalid selection: no valid recording IDs', { id: loadingToast });
        return;
      }

      const { data, error } = await autoTagCalls(recordingIds);

      if (error) {
        throw new Error(error);
      }

      const responseData = data as BulkAIOperationResponse;
      toast.success(
        `Tagged ${responseData.successCount} call${responseData.successCount > 1 ? 's' : ''} successfully`,
        { id: loadingToast }
      );
      onClearSelection();
    } catch (error) {
      logger.error('Error auto-tagging calls', error);
      toast.error('Failed to auto-tag calls', { id: loadingToast });
    }
  };

  return createPortal(
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background/80 backdrop-blur-xl shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-4 border border-border">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="border-0">
            {selectedCount}
          </Badge>
          <span className="text-sm font-medium">
            {selectedCount === 1 ? "transcript" : "transcripts"} selected
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button
            variant="hollow"
            size="sm"
            onClick={onClearSelection}
            className="h-8 w-8 p-0 hover:bg-muted hover:text-muted-foreground"
          >
            <RiCloseLine className="h-4 w-4" />
          </Button>

          <TagDropdown
            tags={tags}
            onTag={onTag}
            onRemoveTag={onRemoveTag}
            onCreateNewTag={onCreateNewTag}
          />

          <ExportDropdown
            onExport={handleExport}
            onSmartExport={() => setShowSmartExport(true)}
          />

          <ActionButton
            icon={RiShareForwardLine}
            label="Share"
            onClick={handleShare}
          />
          
          <div className="h-6 w-px bg-border mx-1" />

          <ActionButton
            icon={RiChatQuoteLine}
            label="Chat"
            onClick={handleChat}
            title="Chat with selected transcripts"
          />

          <div className="h-6 w-px bg-border mx-1" />

          <ActionButton
            icon={RiPriceTag3Line}
            label="Manage Tags"
            onClick={() => setShowManualTagDialog(true)}
            title="Manually assign tags to selected transcripts"
          />

          <ActionButton
            icon={RiFolderLine}
            label="Folder"
            onClick={onAssignFolder}
            title="Assign selected calls to a folder"
          />

          <ActionButton
            icon={RiMagicLine}
            label="Generate Titles"
            onClick={handleGenerateAITitles}
            title="Generate AI-powered titles for selected calls"
          />

          <ActionButton
            icon={RiPriceTag3Line}
            label="Auto-Tag"
            onClick={handleAutoTagCalls}
            title="AI selects single most appropriate tag based on your preferences and history"
          />

          <div className="h-6 w-px bg-border mx-1" />

          <ActionButton
            icon={RiDeleteBin6Line}
            label="Delete"
            onClick={onDelete}
            variant="destructive"
          />

          <div className="h-6 w-px bg-border mx-1" />

          <Button
            variant="hollow"
            size="sm"
            onClick={onClearSelection}
            className="h-8 w-8"
            title="Clear selection"
          >
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SmartExportDialog
        open={showSmartExport}
        onOpenChange={setShowSmartExport}
        selectedCalls={selectedCalls}
      />

      <ManualTagDialog
        open={showManualTagDialog}
        onOpenChange={setShowManualTagDialog}
        recordingIds={selectedCalls
          .filter(c => c?.recording_id != null)
          .map(c => String(c.recording_id))}
        onTagsUpdated={() => {
          setShowManualTagDialog(false);
          onClearSelection();
        }}
      />
    </div>,
    document.body
  );
}