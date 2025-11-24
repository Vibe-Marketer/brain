import { useState } from "react";
import { RiDeleteBin6Line, RiCloseLine, RiShareForwardLine, RiPriceTag3Line, RiMagicLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SmartExportDialog from "@/components/SmartExportDialog";
import { TagManagementDialog } from "./TagManagementDialog";
import { ActionButton } from "./ActionButton";
import { CategorizeDropdown } from "./CategorizeDropdown";
import { ExportDropdown } from "./ExportDropdown";
import { exportToPDF, exportToDOCX, exportToTXT, exportToJSON, exportToZIP } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface BulkActionToolbarEnhancedProps {
  selectedCount: number;
  selectedCalls: any[];
  categories: Array<{ id: string; name: string }>;
  onClearSelection: () => void;
  onDelete: () => void;
  onCategorize?: (categoryId: string) => void;
  onUncategorize?: () => void;
  onCreateNewCategory?: () => void;
}

export function BulkActionToolbarEnhanced({
  selectedCount,
  selectedCalls,
  categories,
  onClearSelection,
  onDelete,
  onCategorize,
  onUncategorize,
  onCreateNewCategory,
}: BulkActionToolbarEnhancedProps) {
  const [showSmartExport, setShowSmartExport] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

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

  const handleTag = () => {
    setShowTagDialog(true);
  };

  const handleSaveTags = async (tags: string[]) => {
    try {
      const recordingIds = selectedCalls.map(c => c.recording_id);
      
      // Update tags for all selected calls
      const { error } = await supabase
        .from('fathom_calls')
        .update({ 
          auto_tags: tags,
          auto_tags_generated_at: new Date().toISOString()
        })
        .in('recording_id', recordingIds);

      if (error) throw error;

      toast.success(`Updated tags for ${selectedCount} call${selectedCount > 1 ? 's' : ''}`);
      onClearSelection();
    } catch (error) {
      logger.error('Error updating tags', error);
      toast.error('Failed to update tags');
    }
  };

  const handleGenerateAITitles = () => {
    toast.info("AI title generation coming soon");
  };

  const handleAutoTagCalls = () => {
    toast.info("Auto-tagging coming soon");
  };

  return (
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

          <CategorizeDropdown
            categories={categories}
            onCategorize={onCategorize}
            onUncategorize={onUncategorize}
            onCreateNewCategory={onCreateNewCategory}
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

          <ActionButton
            icon={RiPriceTag3Line}
            label="Tag"
            onClick={handleTag}
          />

          <ActionButton
            icon={RiMagicLine}
            label="Generate Titles"
            onClick={handleGenerateAITitles}
            title="AI title generation coming soon"
          />

          <ActionButton
            icon={RiPriceTag3Line}
            label="Auto-Tag"
            onClick={handleAutoTagCalls}
            title="Auto-tagging coming soon"
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

      <TagManagementDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        selectedCalls={selectedCalls}
        onSaveTags={handleSaveTags}
      />
    </div>
  );
}
