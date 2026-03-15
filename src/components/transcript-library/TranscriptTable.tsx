import React, { useMemo } from "react";
import { RiArrowUpDownLine, RiArrowUpLine, RiArrowDownLine, RiLayoutColumnLine, RiFileDownloadLine, RiTeamLine } from "@remixicon/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WorkspaceEntriesBatchProvider } from "@/hooks/useWorkspaceEntriesBatch";
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
import type { SharingStatus, AccessLevel } from "@/types/sharing";
import type { Folder } from "@/types/workspace";


interface SortButtonProps {
  field: string;
  children: React.ReactNode;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}

function SortButton({ field, children, sortField, sortDirection, onSort }: SortButtonProps) {
  const isActive = sortField === field;
  const Icon = isActive
    ? sortDirection === "asc"
      ? RiArrowUpLine
      : RiArrowDownLine
    : RiArrowUpDownLine;

  return (
    <button
      onClick={() => onSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-sm rounded-md transition-colors cursor-pointer"
    >
      {children}
      <Icon className={`ml-2 h-3.5 w-3.5 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );
}

// Column options for visibility toggle — varies by table mode
const workspaceColumnOptions = [
  { id: "date", label: "Date" },
  { id: "duration", label: "Duration" },
  { id: "participants", label: "Contacts" },
  { id: "tags", label: "Tags" },
  { id: "folders", label: "Folders" },
  { id: "workspaces", label: "Workspaces" },
  { id: "sharedWith", label: "Shared With" },
];

const homeColumnOptions = [
  { id: "date", label: "Date" },
  { id: "duration", label: "Duration" },
  { id: "source", label: "Source" },
  { id: "tags", label: "Tags" },
  { id: "workspaces", label: "Workspaces" },
  { id: "sharedWith", label: "Shared With" },
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
  // Direct reports filter (for managers)
  showDirectReportsFilter?: boolean;
  directReportsFilter?: boolean;
  onDirectReportsFilterChange?: (enabled: boolean) => void;
  // Sharing status per call
  sharingStatuses?: Record<string | number, SharingStatus>;
  accessLevels?: Record<string | number, AccessLevel>;
  // Table mode: 'home' shows universal columns, 'workspace' shows full columns
  tableMode?: 'home' | 'workspace';
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
  showDirectReportsFilter = false,
  directReportsFilter = false,
  onDirectReportsFilterChange,
  sharingStatuses = {},
  accessLevels = {},
  tableMode = 'workspace',
}: TranscriptTableProps) => {
  const isHome = tableMode === 'home';
  const columnOptions = isHome ? homeColumnOptions : workspaceColumnOptions;
  const { sortField, sortDirection, sortedData: sortedCalls, handleSort } = useTableSort(calls, "date");

  // Extract UUID recording IDs for batch workspace entries fetch
  // Use canonical_uuid (always UUID) instead of recording_id (may be legacy BIGINT)
  // Sorted for stable query key regardless of table sort order
  const recordingUuids = useMemo(
    () => calls
      .map((c) => c.canonical_uuid)
      .filter((id): id is string => !!id)
      .sort(),
    [calls],
  );

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transcripts found
      </div>
    );
  }

  return (
    <WorkspaceEntriesBatchProvider recordingIds={recordingUuids}>
    <div className="space-y-4">
      {/* Direct Reports Filter */}
      {showDirectReportsFilter && onDirectReportsFilterChange && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <RiTeamLine className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Switch
              id="direct-reports-filter"
              checked={directReportsFilter}
              onCheckedChange={onDirectReportsFilterChange}
              aria-label="Show only direct reports' calls"
            />
            <Label
              htmlFor="direct-reports-filter"
              className="text-sm font-medium cursor-pointer"
            >
              Direct Reports Only
            </Label>
          </div>
          {directReportsFilter && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing calls from your direct reports
            </span>
          )}
        </div>
      )}
      <div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
                <TableHead className="w-8 md:w-12 h-10 md:h-12">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center">
                          <Checkbox
                            checked={selectedCalls.length === calls.length && calls.length > 0}
                            onCheckedChange={onSelectAll}
                            aria-label={selectedCalls.length === calls.length ? "Deselect all" : "Select all"}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{selectedCalls.length === calls.length && calls.length > 0 ? "Deselect all" : `Select all (${calls.length})`}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="min-w-[150px] md:min-w-[200px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                  <SortButton field="title" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>TITLE</SortButton>
                </TableHead>
                {visibleColumns.date !== false && (
                  <TableHead className="min-w-[100px] md:min-w-[120px] h-10 md:h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>DATE</SortButton>
                  </TableHead>
                )}
                {visibleColumns.duration !== false && (
                  <TableHead className="hidden lg:table-cell text-center w-[80px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="duration" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>DURATION</SortButton>
                  </TableHead>
                )}
                {visibleColumns.participants !== false && (
                  <TableHead className="hidden lg:table-cell text-center w-[85px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="participants" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>INVITEES</SortButton>
                  </TableHead>
                )}
                {(
                  <TableHead className="hidden xl:table-cell text-center w-20 h-12 whitespace-nowrap text-xs md:text-sm">SPOKE</TableHead>
                )}
                {isHome && visibleColumns.source !== false && (
                  <TableHead className="hidden lg:table-cell min-w-[100px] h-11 whitespace-nowrap py-2 text-xs md:text-sm">
                    <SortButton field="source" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>SOURCE</SortButton>
                  </TableHead>
                )}
                {visibleColumns.tags !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">TAGS</TableHead>
                )}
                {!isHome && visibleColumns.folders !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">FOLDERS</TableHead>
                )}
                {visibleColumns.workspaces !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[120px] h-12 whitespace-nowrap text-xs md:text-sm">WORKSPACES</TableHead>
                )}
                {visibleColumns.sharedWith !== false && (
                  <TableHead className="hidden xl:table-cell min-w-[80px] h-12 whitespace-nowrap text-xs md:text-sm">SHARED</TableHead>
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
                    tagAssignments={tagAssignments[call.canonical_uuid] || tagAssignments[call.recording_id] || []}
                    folders={folders}
                    folderAssignments={folderAssignments[call.recording_id] || []}
                    hostEmail={hostEmail}
                    isUnsyncedView={isUnsyncedView}
                    visibleColumns={visibleColumns}
                    sharingStatus={sharingStatuses[call.recording_id]}
                    accessLevel={accessLevels[call.recording_id]}
                    tableMode={tableMode}
                    onSelectCall={onSelectCall}
                    onCallClick={onCallClick}
                    onFolderCall={onFolderCall}
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
    </WorkspaceEntriesBatchProvider>
  );
});

TranscriptTable.displayName = "TranscriptTable";
