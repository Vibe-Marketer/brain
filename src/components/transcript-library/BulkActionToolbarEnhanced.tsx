/**
 * BulkActionsPane - Bulk action toolbar as 4th pane
 * 
 * Renders as a right-side slide-in pane (not bottom Mac-style bar).
 * Follows DetailPaneOutlet pattern for UI consistency.
 * 
 * @pattern detail-pane
 * @brand-version v4.2
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  RiDeleteBin6Line, 
  RiCloseLine, 
  RiShareForwardLine, 
  RiPriceTag3Line, 
  RiMagicLine, 
  RiFolderLine, 
  RiChatQuoteLine,
  RiDownloadLine,
  RiFileTextLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SmartExportDialog from "@/components/SmartExportDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
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

export interface BulkActionToolbarEnhancedProps {
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

/**
 * Helper component for grouped actions in the pane
 */
function ActionSection({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  );
}

/**
 * BulkActionsPane - 4th pane bulk action toolbar
 * 
 * Renders as a right-side slide-in pane when items are selected.
 * Returns null when no items selected.
 */
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

  return (
    <div 
      className={cn(
        // 4th pane styling (matches DetailPaneOutlet)
        "w-[360px] h-full bg-card border-l border-border",
        "flex flex-col flex-shrink-0",
        "animate-in slide-in-from-right duration-500"
      )}
      role="complementary"
      aria-label="Bulk actions panel"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-base px-2.5 py-0.5">
            {selectedCount}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {selectedCount === 1 ? "transcript" : "transcripts"} selected
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 w-8 p-0"
          aria-label="Clear selection"
        >
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </header>

      {/* Actions - vertical layout for pane */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Tags Section */}
        <ActionSection title="Tags">
          <TagDropdown
            tags={tags}
            onTag={onTag}
            onRemoveTag={onRemoveTag}
            onCreateNewTag={onCreateNewTag}
          />
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowManualTagDialog(true)}
          >
            <RiPriceTag3Line className="h-4 w-4 mr-2" />
            Manage Tags
          </Button>
        </ActionSection>

        {/* Export Section */}
        <ActionSection title="Export">
          <ExportDropdown
            onExport={handleExport}
            onSmartExport={() => setShowSmartExport(true)}
          />
        </ActionSection>

        {/* AI Section */}
        <ActionSection title="AI Actions">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleGenerateAITitles}
          >
            <RiMagicLine className="h-4 w-4 mr-2" />
            Generate AI Titles
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleAutoTagCalls}
          >
            <RiPriceTag3Line className="h-4 w-4 mr-2" />
            Auto-Tag with AI
          </Button>
        </ActionSection>

        {/* Organization Section */}
        <ActionSection title="Organize">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleChat}
          >
            <RiChatQuoteLine className="h-4 w-4 mr-2" />
            Chat with Selected
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={onAssignFolder}
          >
            <RiFolderLine className="h-4 w-4 mr-2" />
            Assign to Folder
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleShare}
          >
            <RiShareForwardLine className="h-4 w-4 mr-2" />
            Share
          </Button>
        </ActionSection>
      </div>

      {/* Footer - destructive action */}
      <footer className="p-4 border-t border-border">
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={onDelete}
        >
          <RiDeleteBin6Line className="h-4 w-4 mr-2" />
          Delete Selected
        </Button>
      </footer>

      {/* Dialogs */}
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
    </div>
  );
}
