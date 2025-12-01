import React from "react";
import { RiArrowUpDownLine } from "@remixicon/react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TranscriptTableRow } from "./TranscriptTableRow";
import { DownloadPopover } from "./DownloadPopover";

interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TranscriptTableProps {
  calls: any[];
  selectedCalls: (number | string)[]; // Support both number (synced) and string (unsynced)
  tags: Array<{ id: string; name: string }>;
  tagAssignments: Record<string, string[]>;
  folders?: Folder[];
  folderAssignments?: Record<string, string[]>;
  hostEmail?: string;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onSelectCall: (id: number | string) => void;
  onSelectAll: () => void;
  onCallClick: (call: any) => void;
  onFolderCall?: (callId: number | string) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // Unsynced meeting support
  isUnsyncedView?: boolean;
  syncingMeetings?: Set<string>;
  loadingMeeting?: string | null;
  onCustomDownload?: (callId: number | string, title: string) => void;
}


export const TranscriptTable = React.memo(({
  calls,
  selectedCalls,
  tags,
  tagAssignments,
  folders = [],
  folderAssignments = {},
  hostEmail,
  totalCount = 0,
  page = 1,
  pageSize = 20,
  onSelectCall,
  onSelectAll,
  onCallClick,
  onFolderCall,
  onPageChange,
  onPageSizeChange,
  isUnsyncedView = false,
  syncingMeetings: _syncingMeetings,
  loadingMeeting: _loadingMeeting,
  onCustomDownload,
}: TranscriptTableProps) => {
  const { sortField, sortDirection: _sortDirection, sortedData: sortedCalls, handleSort } = useTableSort(calls, "date");

  const SortButton = ({ field, children }: { field: any; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-sm rounded-md transition-colors cursor-pointer"
    >
      {children}
      <RiArrowUpDownLine className={`ml-2 h-3.5 w-3.5 ${sortField === field ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transcripts found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
                <TableHead className="w-8 md:w-12 h-10 md:h-12">
                  <Checkbox
                    checked={selectedCalls.length === calls.length && calls.length > 0}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead className="min-w-[150px] md:min-w-[200px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                  <SortButton field="title">TITLE</SortButton>
                </TableHead>
                <TableHead className="min-w-[100px] md:min-w-[120px] h-10 md:h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                  <SortButton field="date">DATE</SortButton>
                </TableHead>
                <TableHead className="hidden lg:table-cell text-center w-[80px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                  <SortButton field="duration">DURATION</SortButton>
                </TableHead>
                <TableHead className="hidden lg:table-cell text-center w-[85px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                  <SortButton field="participants">PARTICIPANTS</SortButton>
                </TableHead>
                <TableHead className="hidden xl:table-cell text-center w-20 h-12 whitespace-nowrap text-xs md:text-sm">COUNT</TableHead>
                <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">TAGS</TableHead>
                <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">FOLDERS</TableHead>
                <TableHead className="text-center w-[80px] md:w-[120px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCalls.map((call) => {
                // Normalize to string for consistent comparison (handles both synced number IDs and unsynced string IDs)
                const callId = String(call.recording_id);
                const isSelected = selectedCalls.some(id => String(id) === callId);
                return (
                  <TranscriptTableRow
                    key={call.recording_id}
                    call={call}
                    isSelected={isSelected}
                    tags={tags}
                    tagAssignments={tagAssignments[call.recording_id] || []}
                    folders={folders}
                    folderAssignments={folderAssignments[call.recording_id] || []}
                    hostEmail={hostEmail}
                    isUnsyncedView={isUnsyncedView}
                    onSelect={() => onSelectCall(call.recording_id)}
                    onCallClick={() => onCallClick(call)}
                    onFolder={onFolderCall ? () => onFolderCall(call.recording_id) : undefined}
                    onCustomDownload={onCustomDownload}
                    DownloadComponent={!onCustomDownload ? DownloadPopover : undefined}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {onPageChange && onPageSizeChange && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
});

TranscriptTable.displayName = "TranscriptTable";
