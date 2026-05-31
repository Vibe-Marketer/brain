import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { BulkActionToolbarEnhanced } from "@/components/transcript-library/BulkActionToolbarEnhanced";
import { DateRange } from "react-day-picker";
import type { Meeting } from "@/hooks/useMeetingsSync";
import type { Category } from "@/hooks/useCategorySync";

interface SyncedTranscriptsSectionProps {
  existingTranscripts: Meeting[];
  filteredExistingTranscripts: Meeting[];
  selectedExistingTranscripts: Array<number | string>;
  existingPage: number;
  existingPageSize: number;
  existingTotalCount: number;
  categories: Category[];
  categoryAssignments: Record<string, string[]>;
  hostEmail: string;
  dateRange: DateRange | undefined;
  onSelectCall: (id: number | string) => void;
  onSelectAll: () => void;
  onCallClick: (call: Meeting) => void;
  onCategorizeCall: (callId: number | string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onBulkCategorize: () => void;
}

export function SyncedTranscriptsSection({
  existingTranscripts,
  filteredExistingTranscripts,
  selectedExistingTranscripts,
  existingPage,
  existingPageSize,
  existingTotalCount,
  categories,
  categoryAssignments,
  hostEmail,
  dateRange,
  onSelectCall,
  onSelectAll,
  onCallClick,
  onCategorizeCall,
  onPageChange,
  onPageSizeChange,
  onClearSelection,
  onDelete,
  onBulkCategorize,
}: SyncedTranscriptsSectionProps) {
  // Normalize selected IDs to strings so we can reliably match against recording_id
  const selectedIdSet = new Set(selectedExistingTranscripts.map((id) => String(id)));

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground uppercase tracking-wide">
            Synced Transcripts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dateRange?.from || dateRange?.to
              ? `${existingTotalCount} meetings synced for this date range`
              : `${existingTotalCount} total transcripts`}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedExistingTranscripts.length > 0 && (
        <BulkActionToolbarEnhanced
          selectedCount={selectedExistingTranscripts.length}
          selectedCalls={existingTranscripts.filter((t) =>
            selectedIdSet.has(String(t.recording_id))
          )}
          categories={categories}
          onClearSelection={onClearSelection}
          onDelete={onDelete}
          onCategorize={onBulkCategorize}
        />
      )}

      {/* Use Reusable TranscriptTable */}
      <TranscriptTable
        calls={filteredExistingTranscripts}
        selectedCalls={selectedExistingTranscripts}
        tags={categories}
        tagAssignments={categoryAssignments}
        hostEmail={hostEmail}
        totalCount={existingTotalCount}
        page={existingPage}
        pageSize={existingPageSize}
        onSelectCall={onSelectCall}
        onSelectAll={onSelectAll}
        onCallClick={onCallClick}
        onCategorizeCall={onCategorizeCall}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
