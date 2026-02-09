import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  RiTimeLine,
  RiEyeLine,
  RiCloseCircleLine,
  RiPriceTag3Line,
  RiDownloadLine,
  RiFolderLine,
  RiStackLine,
} from "@remixicon/react";
import { SourcePlatformIndicator } from "./SourcePlatformIcons";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { InviteesPopover } from "./InviteesPopover";
import { InviteesCountCircle } from "./InviteesCountCircle";
import { SharedWithIndicator } from "@/components/sharing/SharedWithIndicator";
import { AddToVaultMenu } from "@/components/vault/AddToVaultMenu";
import type { Meeting } from "@/types";
import type { SharingStatus, AccessLevel } from "@/types/sharing";

interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TranscriptTableRowProps {
  call: Meeting;
  isSelected: boolean;
  tags: Array<{ id: string; name: string }>;
  tagAssignments: string[];
  folders?: Folder[];
  folderAssignments?: string[];
  hostEmail?: string;
  isUnsyncedView?: boolean;
  visibleColumns?: Record<string, boolean>;
  sharingStatus?: SharingStatus;
  accessLevel?: AccessLevel;
  onSelect: () => void;
  onCallClick: () => void;
  onFolder?: () => void;
  onCustomDownload?: (callId: number | string, title: string) => void;
  DownloadComponent?: React.ComponentType<{ call: Meeting }>;
}

export function TranscriptTableRow({
  call,
  isSelected,
  tags,
  tagAssignments,
  folders = [],
  folderAssignments = [],
  hostEmail,
  isUnsyncedView = false,
  visibleColumns = {},
  sharingStatus,
  accessLevel,
  onSelect,
  onCallClick,
  onFolder,
  onCustomDownload,
  DownloadComponent,
}: TranscriptTableRowProps) {
  const duration = call.recording_start_time && call.recording_end_time
    ? Math.round(
        (new Date(call.recording_end_time).getTime() -
          new Date(call.recording_start_time).getTime()) /
          60000
      )
    : null;

  const meetingDate = call.recording_start_time
    ? toZonedTime(new Date(call.recording_start_time), "America/New_York")
    : new Date(call.created_at);

  const dayOfWeek = format(meetingDate, "EEE").toUpperCase();
  const meetingYear = meetingDate.getFullYear();
  const dateWithoutYear = format(meetingDate, "MMM d").toUpperCase();
  const yearOnly = meetingYear.toString();
  const time = call.recording_start_time
    ? format(meetingDate, "h:mm a")
    : "Not recorded";

  return (
    <TableRow key={call.recording_id} className="group h-7 md:h-8">
      <TableCell className="align-middle py-0">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell className="py-0 whitespace-nowrap">
        <div className="space-y-0">
          {/* First line: Title + Source Platform Icons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCallClick}
              className="text-left hover:underline font-semibold text-xs md:text-sm truncate block max-w-[200px] md:max-w-[250px]"
            >
              {call.title}
            </button>
            <SourcePlatformIndicator
              sourcePlatform={call.source_platform}
              mergedFrom={call.merged_from}
              size={14}
            />
          </div>
          {/* Second line: Metadata badges and subtitle */}
          <div className="flex items-center gap-1 mt-0">
            {/* Sources count badge for merged meetings - only show for primary records with 3+ sources */}
            {call.is_primary && call.merged_from && call.merged_from.length > 1 && (
              <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 md:px-1.5 py-0 h-3.5 md:h-4 shrink-0 flex items-center gap-0.5">
                <RiStackLine className="h-2.5 w-2.5" />
                {call.merged_from.length + 1} sources
              </Badge>
            )}
            {(() => {
              // Only show "NO TRANSCRIPT" badge for SYNCED meetings where we can verify
              if (!isUnsyncedView) {
                const transcriptLength = call.full_transcript?.length || 0;
                const hasNoTranscript = transcriptLength === 0 || transcriptLength < 500;

                if (hasNoTranscript) {
                  return (
                    <Badge variant="destructive" className="text-[9px] md:text-[10px] px-1 md:px-1.5 py-0 h-3.5 md:h-4 shrink-0">
                      NO TRANSCRIPT
                    </Badge>
                  );
                }
              }

              // For unsynced meetings OR synced meetings with transcripts, show subtitle
              return (
                <span className="text-[9px] md:text-[10px] text-muted-foreground leading-tight hidden md:inline">
                  {call.ai_generated_title || `ID: ${call.recording_id}`}
                </span>
              );
            })()}
          </div>
        </div>
      </TableCell>
      {visibleColumns.date !== false && (
        <TableCell className="py-0 whitespace-nowrap">
          <div className="flex flex-col gap-0 w-[95px]">
            {/* Top row: Day left, Date right - monospace for alignment */}
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-left font-mono">{dayOfWeek}</span>
              <span className="text-right font-mono tabular-nums">{dateWithoutYear}</span>
            </div>
            {/* Bottom row: Time left, Year right */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground leading-tight">
              <span className="text-left font-mono">{time}</span>
              <span className="text-right font-mono text-muted-foreground/50">{yearOnly}</span>
            </div>
          </div>
        </TableCell>
      )}
      {visibleColumns.duration !== false && (
        <TableCell className="hidden lg:table-cell whitespace-nowrap">
        <div className="flex items-center justify-between w-[80px] mx-auto">
          {/* Left-aligned clock icon */}
          <RiTimeLine className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {/* Right-aligned duration text - monospace for alignment */}
          <div className="flex items-baseline gap-0.5 justify-end min-w-[50px]">
            <span className="text-sm font-normal font-mono tabular-nums text-right">
              {duration || "-"}
            </span>
            {duration && <span className="text-xs text-muted-foreground font-normal">m</span>}
          </div>
        </div>
        </TableCell>
      )}
      {visibleColumns.participants !== false && (
        <TableCell className="hidden lg:table-cell whitespace-nowrap text-center">
          <div className="flex justify-center w-full">
            <div className="w-[70px]">
              {call.calendar_invitees && call.calendar_invitees.length > 0 ? (
                <InviteesPopover invitees={call.calendar_invitees} hostEmail={hostEmail} />
              ) : (
                <span className="text-muted-foreground text-[10px]">No participants</span>
              )}
            </div>
          </div>
        </TableCell>
      )}
      <TableCell className="hidden xl:table-cell text-center align-middle py-0 whitespace-nowrap">
        <InviteesCountCircle invitees={call.calendar_invitees} />
      </TableCell>
      {visibleColumns.tags !== false && (
        <TableCell className="hidden xl:table-cell py-0 whitespace-nowrap">
        <div className="flex flex-col justify-center h-full gap-0.5 py-0">
          {/* Primary tag - only render if assigned */}
          {tagAssignments.length > 0 && (() => {
            const tag = tags.find((t) => t.id === tagAssignments[0]);
            if (!tag) return null;
            const isSkip = tag.name === 'SKIP';
            const Icon = isSkip ? RiCloseCircleLine : RiPriceTag3Line;
            return (
              <Badge
                variant={isSkip ? "destructive" : "outline"}
                className="text-[10px] px-1.5 py-0 h-4 w-fit leading-none flex items-center gap-0.5"
              >
                <Icon className="h-3 w-3 mr-0.5 flex-shrink-0" />
                <span className="truncate max-w-[80px]">
                  {tag.name}
                </span>
              </Badge>
            );
          })()}

          {/* Secondary tag from auto_tags - only render if exists */}
          {call.auto_tags && call.auto_tags.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 h-4 w-fit leading-none flex items-center gap-0.5"
            >
              <RiPriceTag3Line className="h-3 w-3 mr-0.5 flex-shrink-0" />
              <span className="truncate max-w-[80px]">
                {call.auto_tags[0]}
              </span>
            </Badge>
          )}

          {/* Show placeholder only if NO tags at all */}
          {tagAssignments.length === 0 && (!call.auto_tags || call.auto_tags.length === 0) && (
            <span className="text-[10px] text-muted-foreground">No tags</span>
          )}
          </div>
        </TableCell>
      )}
      {/* Folders column */}
      {visibleColumns.folders !== false && (
        <TableCell className="hidden xl:table-cell py-0 whitespace-nowrap">
          <div className="flex flex-col justify-center h-full gap-0.5 py-0">
            {folderAssignments.length > 0 ? (
              folderAssignments.slice(0, 2).map((folderId) => {
                const folder = folders.find((f) => f.id === folderId);
                if (!folder) return null;
                return (
                  <Badge
                    key={folderId}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 w-fit leading-none flex items-center gap-0.5"
                    style={{ borderColor: folder.color }}
                  >
                    <RiFolderLine className="h-3 w-3 mr-0.5 flex-shrink-0" style={{ color: folder.color }} />
                    <span className="truncate max-w-[80px]">{folder.name}</span>
                  </Badge>
                );
              })
            ) : (
              <span className="text-[10px] text-muted-foreground">No folder</span>
            )}
            {folderAssignments.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{folderAssignments.length - 2} more
              </span>
            )}
          </div>
        </TableCell>
      )}
      {/* Shared With column */}
      {visibleColumns.sharedWith !== false && (
        <TableCell className="hidden xl:table-cell py-0 whitespace-nowrap">
          <SharedWithIndicator
            sharingStatus={sharingStatus}
            accessLevel={accessLevel}
            compact
          />
        </TableCell>
      )}
      <TableCell className="align-middle py-0">
        <div className="flex items-center justify-center gap-0.5 md:gap-1">
          <button
            onClick={onCallClick}
            className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-hover dark:hover:bg-cb-panel-dark transition-colors"
            title="View details"
          >
            <RiEyeLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
          </button>

          {onFolder && (
            <button
              onClick={onFolder}
              className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-hover dark:hover:bg-cb-panel-dark transition-colors"
              title="Assign to folder"
            >
              <RiFolderLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
            </button>
          )}
          <AddToVaultMenu
            legacyRecordingId={typeof call.recording_id === 'number' ? call.recording_id : null}
            compact
          />
          {onCustomDownload ? (
            <button
              onClick={() => onCustomDownload(call.recording_id, call.title)}
              className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-hover dark:hover:bg-cb-panel-dark transition-colors"
              title="Download transcript"
            >
              <RiDownloadLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
            </button>
          ) : DownloadComponent ? (
            <DownloadComponent call={call} />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
