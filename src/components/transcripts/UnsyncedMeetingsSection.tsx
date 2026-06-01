import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import { RiLoader2Line } from "@remixicon/react";
import { useMemo, useState } from "react";
import type { Meeting } from "@/hooks/useMeetingsSync";
import type { Category } from "@/hooks/useCategorySync";
import {
  findMeetingBySelectionKey,
  getUnsyncedMeetingSelectionKey,
} from "./syncSelection";

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
  onApplyUpdates: () => Promise<void>;
  onClearSelection: () => void;
  onViewCall: (meeting: Meeting) => void;
  onDownload: (meeting: Meeting, title: string) => void;
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
  onApplyUpdates,
  onClearSelection,
  onViewCall,
  onDownload,
}: UnsyncedMeetingsSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const allSelected = selectedMeetings.size === meetings.length && meetings.length > 0;
  const someSelected = selectedMeetings.size > 0;
  const selectedRows = useMemo(
    () =>
      meetings.filter((meeting) =>
        selectedMeetings.has(getUnsyncedMeetingSelectionKey(meeting)),
      ),
    [meetings, selectedMeetings],
  );
  const selectedUpdatedRows = selectedRows.filter(
    (meeting) => meeting.sync_state === "updated_remotely",
  );
  const hasSelectedUpdates = selectedUpdatedRows.length > 0;
  const selectedOnlyUpdates =
    hasSelectedUpdates && selectedUpdatedRows.length === selectedRows.length;
  const selectedHasMixedStates =
    hasSelectedUpdates && selectedUpdatedRows.length !== selectedRows.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground uppercase tracking-wide">
            Unsynced Meetings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found
            {someSelected && (
              <span className="ml-1">
                • <span className="font-medium text-primary">{selectedMeetings.size} selected</span>
              </span>
            )}
          </p>
        </div>
        {meetings.length > 0 && (
          <Button
            variant="hollow"
            size="sm"
            onClick={onSelectAll}
            className="h-8 px-3 text-xs"
          >
            {allSelected ? 'Deselect All' : `Select All (${meetings.length})`}
          </Button>
        )}
      </div>

      {/* Bulk Actions for Unsynced */}
      {someSelected && (
        <div className="flex items-center gap-2">
          {selectedOnlyUpdates ? (
            <Button
              variant="default"
              onClick={() => setConfirmOpen(true)}
              disabled={syncing}
              className="h-8 px-3 text-xs"
            >
              {syncing ? (
                <>
                  <RiLoader2Line className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Applying...
                </>
              ) : (
                `Apply updates (${selectedMeetings.size})`
              )}
            </Button>
          ) : (
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
          )}
          {selectedHasMixedStates && (
            <Button
              variant="hollow"
              onClick={() => setConfirmOpen(true)}
              disabled={syncing}
              className="h-8 px-3 text-xs"
            >
              Apply updates
            </Button>
          )}
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
          recording_id: getUnsyncedMeetingSelectionKey(m),
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
          source_platform: m.source_platform,
          source_metadata: {
            externalRecordingId: m.recording_id,
            sync_state: m.sync_state,
            local_title: m.local_title ?? null,
            remote_title: m.remote_title ?? null,
          },
          sync_state: m.sync_state,
          local_title: m.local_title ?? null,
          remote_title: m.remote_title ?? null,
        }))}
        selectedCalls={Array.from(selectedMeetings)}
        tags={categories}
        tagAssignments={{}}
        hostEmail={hostEmail}
        totalCount={meetings.length}
        page={1}
        pageSize={meetings.length}
        onSelectCall={(id) => onSelectCall(String(id))}
        onSelectAll={onSelectAll}
        onCallClick={(call) => {
          const meeting = findMeetingBySelectionKey(meetings, String(call.recording_id));
          if (meeting) onViewCall(meeting);
        }}
        onCategorizeCall={() => {
          // This opens the categorize dialog for unsynced meetings
        }}
        onCustomDownload={(callId, title) => {
          const meeting = findMeetingBySelectionKey(meetings, String(callId));
          if (meeting) onDownload(meeting, title);
        }}
        isUnsyncedView={true}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update from Fathom</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {selectedUpdatedRows.slice(0, 3).map((meeting) => (
              <div
                key={getUnsyncedMeetingSelectionKey(meeting)}
                className="rounded-md border border-border p-3"
              >
                <p className="text-xs text-muted-foreground">Current title</p>
                <p className="font-medium">{meeting.local_title ?? meeting.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">Fathom title</p>
                <p className="font-medium">{meeting.remote_title ?? meeting.title}</p>
              </div>
            ))}
            {selectedUpdatedRows.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{selectedUpdatedRows.length - 3} more title update(s)
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current title</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                await onApplyUpdates();
                setConfirmOpen(false);
              }}
            >
              Update from Fathom
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
