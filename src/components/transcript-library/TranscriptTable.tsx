import React from "react";
import { RiArrowUpDownLine, RiLayoutColumnLine, RiFileDownloadLine } from "@remixicon/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTableSort } from "@/hooks/useTableSort";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TranscriptTableRow } from "./TranscriptTableRow";
import { DownloadPopover } from "./DownloadPopover";
import type { Meeting } from "@/types";

interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// Column options for visibility toggle
const columnOptions = [
  { id: "date", label: "Date" },
  { id: "duration", label: "Duration" },
  { id: "participants", label: "Participants" },
  { id: "tags", label: "Tags" },
  { id: "folders", label: "Folders" },
];

interface TranscriptTableProps {
  calls: Meeting[];
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
  onCallClick: (call: Meeting) => void;
  onFolderCall?: (callId: number | string) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // Unsynced meeting support
  isUnsyncedView?: boolean;
  syncingMeetings?: Set<string>;
  loadingMeeting?: string | null;
  onCustomDownload?: (callId: number | string, title: string) => void;
  // Column visibility and export
  visibleColumns?: Record<string, boolean>;
  onToggleColumn?: (columnId: string) => void;
  onExport?: () => void;
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
  visibleColumns = {},
  onToggleColumn,
  onExport,
}: TranscriptTableProps) => {
  const { sortField, sortDirection: _sortDirection, sortedData: sortedCalls, handleSort } = useTableSort(calls, "date");

  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
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
                {visibleColumns.date !== false && (
                  <TableHead className="min-w-[100px] md:min-w-[120px] h-10 md:h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="date">DATE</SortButton>
                  </TableHead>
                )}
                {visibleColumns.duration !== false && (
                  <TableHead className="hidden lg:table-cell text-center w-[80px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="duration">DURATION</SortButton>
                  </TableHead>
                )}
                {visibleColumns.participants !== false && (
                  <TableHead className="hidden lg:table-cell text-center w-[85px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="participants">PARTICIPANTS</SortButton>
                  </TableHead>
                )}
                <TableHead className="hidden xl:table-cell text-center w-20 h-12 whitespace-nowrap text-xs md:text-sm">COUNT</TableHead>
                {visibleColumns.tags !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">TAGS</TableHead>
                )}
                {visibleColumns.folders !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">FOLDERS</TableHead>
                )}
                <TableHead className="w-[80px] md:w-[120px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                  <div className="flex items-center justify-end gap-1">
                    {/* Column visibility toggle */}
                    {onToggleColumn && (
                      <TooltipProvider>
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <RiLayoutColumnLine className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>Toggle columns</p>
                            </TooltipContent>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {columnOptions.map((col) => (
                                <DropdownMenuCheckboxItem
                                  key={col.id}
                                  checked={visibleColumns[col.id] !== false}
                                  onCheckedChange={() => onToggleColumn(col.id)}
                                >
                                  {col.label}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* Export button */}
                    {onExport && (
                      <TooltipProvider>
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <RiFileDownloadLine className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>Export calls</p>
                            </TooltipContent>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={onExport}>
                                Export visible calls
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableHead>
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
                    visibleColumns={visibleColumns}
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
