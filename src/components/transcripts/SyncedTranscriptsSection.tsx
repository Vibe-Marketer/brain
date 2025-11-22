import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { BulkActionToolbarEnhanced } from "@/components/transcript-library/BulkActionToolbarEnhanced";
import { DateRange } from "react-day-picker";
import type { Meeting } from "@/hooks/useMeetingsSync";
import type { Category } from "@/hooks/useCategorySync";

interface SyncedTranscriptsSectionProps {
  existingTranscripts: Meeting[];
  filteredExistingTranscripts: Meeting[];
  selectedExistingTranscripts: number[];
  existingPage: number;
  existingPageSize: number;
  existingTotalCount: number;
  categories: Category[];
  categoryAssignments: Record<string, string[]>;
  hostEmail: string;
  dateRange: DateRange | undefined;
  onSelectCall: (id: number) => void;
  onSelectAll: () => void;
  onCallClick: (call: any) => void;
  onCategorizeCall: (callId: number) => void;
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
  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-cb-black dark:text-cb-white uppercase tracking-wide">
            Synced Transcripts
          </h2>
          <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light mt-1">
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
            selectedExistingTranscripts.includes(Number(t.recording_id))
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
        categories={categories}
        categoryAssignments={categoryAssignments}
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
