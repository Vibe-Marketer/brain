import { Button } from "@/components/ui/button";
import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { RiLoader2Line } from "@remixicon/react";
import type { Meeting } from "@/hooks/useMeetingsSync";
import type { Category } from "@/hooks/useCategorySync";

interface UnsyncedMeetingsSectionProps {
  meetings: Meeting[];
  selectedMeetings: Set<string>;
  syncing: boolean;
  categories: Category[];
  hostEmail: string;
  syncingMeetings: Set<string>;
  loadingUnsyncedMeeting: string | null;
  onSelectCall: (id: string) => void;
  onSelectAll: () => void;
  onSync: () => void;
  onClearSelection: () => void;
  onViewCall: (recordingId: string) => void;
  onDirectCategorize: (callId: number | string, categoryId: string) => Promise<void>;
  onDownload: (callId: string, title: string) => void;
}

export function UnsyncedMeetingsSection({
  meetings,
  selectedMeetings,
  syncing,
  categories,
  hostEmail,
  syncingMeetings: _syncingMeetings,
  loadingUnsyncedMeeting: _loadingUnsyncedMeeting,
  onSelectCall,
  onSelectAll,
  onSync,
  onClearSelection,
  onViewCall,
  onDirectCategorize,
  onDownload,
}: UnsyncedMeetingsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-cb-black dark:text-cb-white uppercase tracking-wide">
            Unsynced Meetings
          </h2>
          <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light mt-1">
            {meetings.length} meetings found • {selectedMeetings.size} selected
          </p>
        </div>
      </div>

      {/* Bulk Actions for Unsynced */}
      {selectedMeetings.size > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={onSync}
            disabled={syncing}
            className="h-8 px-3 text-xs"
          >
            {syncing ? (
              <>
                <RiLoader2Line className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Syncing...
              </>
            ) : (
              `Sync Selected (${selectedMeetings.size})`
            )}
          </Button>
          <Button
            variant="hollow"
            size="sm"
            onClick={onClearSelection}
            className="h-8 px-3 text-xs"
          >
            Clear Selection
          </Button>
        </div>
      )}

      <TranscriptTable
        calls={meetings.map(m => ({
          recording_id: m.recording_id, // Keep as string - no conversion
          title: m.title,
          created_at: m.created_at,
          recording_start_time: m.recording_start_time,
          recording_end_time: m.recording_end_time || null,
          calendar_invitees: m.calendar_invitees || null,
          recorded_by_email: hostEmail,
          recorded_by_name: null,
          url: null,
          share_url: null,
          user_id: '',
          synced_at: null,
          full_transcript: m.full_transcript || null,
          summary: null,
        }))}
        selectedCalls={Array.from(selectedMeetings)} // Keep as string[] - no conversion
        categories={categories}
        categoryAssignments={{}}
        hostEmail={hostEmail}
        totalCount={meetings.length}
        page={1}
        pageSize={meetings.length}
        onSelectCall={(id) => onSelectCall(String(id))} // Ensure string
        onSelectAll={onSelectAll}
        onCallClick={(call) => onViewCall(String(call.recording_id))}
        onCategorizeCall={() => {
          // This opens the categorize dialog for unsynced meetings
        }}
        onDirectCategorize={onDirectCategorize}
        onCustomDownload={(callId, title) => onDownload(String(callId), title)}
        isUnsyncedView={true}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    </div>
  );
}
