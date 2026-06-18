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
import {
  RiDeleteBin6Line,
  RiCloseLine,
  RiShareForwardLine,
  RiPriceTag3Line,
  RiMagicLine,
  RiFolderLine,
  RiExpandLeftRightLine,
  RiBuildingLine,
  RiLoader4Line,
  RiRefreshLine,
  RiDownloadLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SmartExportDialog from "@/components/SmartExportDialog";
import ManualTagDialog from "@/components/ManualTagDialog";
import { TagDropdown } from "./TagDropdown";
import { MoveToWorkspaceDialog } from "@/components/dialogs/MoveToWorkspaceDialog";
import { CopyToOrganizationDialog } from "@/components/dialogs/CopyToOrganizationDialog";
import { autoTagCalls, generateAiTitles } from "@/lib/api-client";
import { useAiGate } from "@/hooks/useAiGate";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { logger } from "@/lib/logger";
import { invalidateCallListCaches, queryKeys } from "@/lib/query-config";
import { invokeBulkFathomRefreshForSyncTab } from "@/services/sync-tab.service";
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
  deleteLabel?: string;
  currentWorkspaceId?: string | null;
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
  deleteLabel = 'Delete Selected',
  currentWorkspaceId = null,
}: BulkActionToolbarEnhancedProps) {
  const queryClient = useQueryClient();
  const { trackAction } = useAiGate();
  const { activeOrgId } = useOrganizationContext();
  const [showSmartExport, setShowSmartExport] = useState(false);
  const [showManualTagDialog, setShowManualTagDialog] = useState(false);
  const [showMoveToWsDialog, setShowMoveToWsDialog] = useState(false);
  const [showCopyToOrgDialog, setShowCopyToOrgDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

  if (selectedCount === 0) return null;

  const handleShare = () => {
    toast.info("Share feature coming soon");
  };

  const selectedFathomCalls = selectedCalls.filter(
    (call) => call.source_platform === "fathom",
  );
  const refreshableFathomCalls = selectedFathomCalls.filter(
    (call) => Boolean(call.canonical_uuid) && call.fathom_provider_id != null,
  );
  const skippedFathomCalls = selectedFathomCalls.length - refreshableFathomCalls.length;

  const handleRefreshFromFathom = async () => {
    if (refreshableFathomCalls.length === 0) {
      toast.error(
        selectedFathomCalls.length > 0
          ? "The selected Fathom calls are missing provider IDs, so they cannot be refreshed yet."
          : "Select at least one refreshable Fathom call.",
      );
      return;
    }

    const loadingToast = toast.loading(
      `Refreshing ${refreshableFathomCalls.length} Fathom call${refreshableFathomCalls.length === 1 ? "" : "s"}...`,
    );

    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: refreshableFathomCalls.length });
    let titleChangeCount = 0;

    try {
      const result = await invokeBulkFathomRefreshForSyncTab(
        refreshableFathomCalls.map((call) => ({
          recordingId: call.canonical_uuid as string,
          label: call.title || call.canonical_uuid || "Untitled call",
        })),
        {
          onProgress: (progress) => {
            setRefreshProgress({ current: progress.current, total: progress.total });
            toast.loading(
              progress.waitingForRetry
                ? `Fathom rate-limited ${progress.current}/${progress.total}. Retrying "${progress.currentLabel}" in ${progress.retryAfterSec ?? 5}s...`
                : `Refreshing ${progress.current}/${progress.total}: ${progress.currentLabel}`,
              { id: loadingToast },
            );
          },
        },
      );

      titleChangeCount = result.results.reduce((count, refreshedCall) => {
        const original = refreshableFathomCalls.find(
          (call) => call.canonical_uuid === refreshedCall.recording_id,
        );
        return count + ((original?.title || "") !== (refreshedCall.title || "") ? 1 : 0);
      }, 0);

      invalidateCallListCaches(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.transcripts.all });
      await queryClient.invalidateQueries({ queryKey: ["raw-call-data"] });

      if (result.successCount > 0 && result.failureCount === 0 && skippedFathomCalls === 0) {
        toast.success(
          `Refreshed ${result.successCount} Fathom call${result.successCount === 1 ? "" : "s"}; ${titleChangeCount} title${titleChangeCount === 1 ? "" : "s"} changed.`,
          { id: loadingToast },
        );
        onClearSelection();
      } else if (result.successCount > 0) {
        toast.success(
          `Refreshed ${result.successCount}; ${titleChangeCount} title${titleChangeCount === 1 ? "" : "s"} changed; ${result.failureCount} failed; ${skippedFathomCalls} skipped. First issue: ${result.failures[0] || "Some selected calls could not be refreshed."}`,
          { id: loadingToast },
        );
      } else if (skippedFathomCalls > 0) {
        toast.error(
          `No calls were refreshed. ${skippedFathomCalls} selected Fathom call${skippedFathomCalls === 1 ? "" : "s"} are missing provider IDs and cannot be refreshed yet.`,
          { id: loadingToast },
        );
      } else {
        toast.error(`Refresh failed: ${result.failures[0] || "Unknown error"}`, {
          id: loadingToast,
        });
      }
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ current: 0, total: 0 });
    }
  };

  const handleGenerateAITitles = async () => {
    const loadingToast = toast.loading(`Generating AI titles for ${selectedCount} call${selectedCount > 1 ? 's' : ''}...`);

    try {
      // Fathom-sourced calls carry an integer fathom_provider_id (recording_id is
      // numeric) and are titled via fathom_raw_calls. Everything else — cross-org
      // copies, Zoom, manual uploads — is a UUID-keyed recording titled straight
      // from the recordings row via its canonical UUID. Partition the selection
      // so both kinds get processed (previously UUID-keyed calls were rejected,
      // which broke AI titles for Fathom calls copied between orgs).
      const recordingIds: number[] = [];
      const canonicalRecordingIds: string[] = [];
      for (const c of selectedCalls) {
        const n = c?.recording_id == null ? NaN : Number(c.recording_id);
        if (!isNaN(n) && n > 0) {
          recordingIds.push(n);
        } else {
          const uuid = c?.canonical_uuid ?? (typeof c?.recording_id === 'string' ? c.recording_id : null);
          if (uuid) canonicalRecordingIds.push(uuid);
        }
      }

      if (recordingIds.length === 0 && canonicalRecordingIds.length === 0) {
        toast.error('None of the selected calls have a transcript to title yet.', { id: loadingToast });
        return;
      }

      // Gate: check AI usage limit before proceeding
      const gate = await trackAction('auto_name', { orgId: activeOrgId });
      if (!gate.allowed) return; // toast shown by useAiGate

      const { data, error } = await generateAiTitles(recordingIds, canonicalRecordingIds);

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

      // Invalidate queries to refresh the table with new AI titles. Include the
      // workspace recordings list so canonical (cross-org copy / Zoom / manual)
      // titles surface there too — their title is written to recordings and read
      // back via get_workspace_recordings.
      await queryClient.invalidateQueries({ queryKey: ["tag-calls"] });
      await queryClient.invalidateQueries({ queryKey: ["transcript-calls"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces", "recordings"] });

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
        .filter(c => {
          if (c?.recording_id == null) return false;
          const n = Number(c.recording_id);
          return !isNaN(n) && n > 0;
        })
        .map(c => Number(c.recording_id));

      if (recordingIds.length === 0) {
        toast.error('None of the selected calls have a Fathom recording ID. AI tagging requires calls synced from Fathom.', { id: loadingToast });
        return;
      }

      // Gate: check AI usage limit before proceeding
      const gate = await trackAction('auto_tag', { orgId: activeOrgId });
      if (!gate.allowed) return; // toast shown by useAiGate

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
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowSmartExport(true)}
          >
            <RiDownloadLine className="h-4 w-4 mr-2" />
            Download
          </Button>
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
        <ActionSection title="Provider">
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={isRefreshing || refreshableFathomCalls.length === 0}
            onClick={handleRefreshFromFathom}
          >
            {isRefreshing ? (
              <RiLoader4Line className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RiRefreshLine className="h-4 w-4 mr-2" />
            )}
            {isRefreshing
              ? `Refreshing ${refreshProgress.current}/${refreshProgress.total}`
              : "Refresh from Fathom"}
          </Button>
          {isRefreshing && (
            <p className="text-xs text-muted-foreground">
              Keep this pane open while CallVault refreshes each selected Fathom call.
            </p>
          )}
          {selectedCount > 0 && refreshableFathomCalls.length < selectedCount && (
            <p className="text-xs text-muted-foreground">
              Available for {refreshableFathomCalls.length} selected Fathom call{refreshableFathomCalls.length === 1 ? "" : "s"}.
            </p>
          )}
        </ActionSection>

        {/* Organization Section */}
        <ActionSection title="Organize">
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
            onClick={() => setShowMoveToWsDialog(true)}
          >
            <RiExpandLeftRightLine className="h-4 w-4 mr-2" />
            Move to Workspace
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start text-vibe-orange hover:text-vibe-orange/80"
            onClick={() => setShowCopyToOrgDialog(true)}
          >
            <RiBuildingLine className="h-4 w-4 mr-2" />
            Copy to Organization
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
          {deleteLabel}
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

      <MoveToWorkspaceDialog
        open={showMoveToWsDialog}
        onOpenChange={setShowMoveToWsDialog}
        recordingIds={selectedCalls.map(c => c.canonical_uuid || String(c.recording_id))}
        currentWorkspaceId={currentWorkspaceId}
        onSuccess={() => {
          onClearSelection();
          queryClient.invalidateQueries({ queryKey: ["transcript-calls"] });
        }}
      />

      <CopyToOrganizationDialog
        open={showCopyToOrgDialog}
        onOpenChange={setShowCopyToOrgDialog}
        recordingIds={selectedCalls.map(c => c.canonical_uuid || String(c.recording_id))}
        onSuccess={() => {
          onClearSelection();
        }}
      />
    </div>
  );
}
