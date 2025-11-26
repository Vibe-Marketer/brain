import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  RiTimeLine,
  RiEyeLine,
  RiFolderTransferLine,
  RiFolderLine,
  RiCloseCircleLine,
  RiPriceTag3Line,
  RiDownloadLine
} from "@remixicon/react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InviteesPopover } from "./InviteesPopover";
import { InviteesCountCircle } from "./InviteesCountCircle";

interface TranscriptTableRowProps {
  call: any;
  isSelected: boolean;
  categories: Array<{ id: string; name: string }>;
  categoryAssignments: string[];
  hostEmail?: string;
  isUnsyncedView?: boolean;
  onSelect: () => void;
  onCallClick: () => void;
  onCategorize: () => void;
  onDirectCategorize?: (categoryId: string) => void;
  onCustomDownload?: (callId: number | string, title: string) => void;
  DownloadComponent?: React.ComponentType<{ call: any }>;
}

export function TranscriptTableRow({
  call,
  isSelected,
  categories,
  categoryAssignments,
  hostEmail,
  isUnsyncedView = false,
  onSelect,
  onCallClick,
  onCategorize,
  onDirectCategorize,
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
    <TableRow key={call.recording_id} className="group h-10 md:h-12">
      <TableCell className="align-middle py-0.5">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell className="py-0.5 whitespace-nowrap">
        <div className="space-y-0">
          <button
            onClick={onCallClick}
            className="text-left hover:underline font-semibold text-xs md:text-sm truncate block max-w-[200px] md:max-w-[250px]"
          >
            {call.title}
          </button>
          <div className="flex items-center gap-1 mt-0.5">
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
      <TableCell className="py-0.5 whitespace-nowrap">
        <div className="flex flex-col gap-0.5 w-[95px]">
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
      <TableCell className="whitespace-nowrap">
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
      <TableCell className="whitespace-nowrap text-center">
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
      <TableCell className="text-center align-middle py-0.5 whitespace-nowrap">
        <InviteesCountCircle invitees={call.calendar_invitees} />
      </TableCell>
      <TableCell className="py-1.5 whitespace-nowrap">
        <div className="flex flex-col justify-center h-full gap-1 py-0.5">
          {/* User-assigned folder (or MAIN default) */}
          {(() => {
            const cat = categoryAssignments.length > 0
              ? categories.find((c) => c.id === categoryAssignments[0])
              : null;
            const isSkip = cat?.name === 'SKIP';
            const Icon = isSkip ? RiCloseCircleLine : RiFolderLine;
            return (
              <Badge
                variant={isSkip ? "destructive" : "outline"}
                className="text-[10px] px-1.5 py-0 h-4 w-fit leading-none flex items-center gap-0.5"
              >
                <Icon className="h-3 w-3 mr-0.5 flex-shrink-0" />
                <span className="truncate max-w-[80px]">
                  {cat ? cat.name : 'MAIN'}
                </span>
              </Badge>
            );
          })()}

          {/* Auto-generated taxonomy tag */}
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 h-4 w-fit leading-none flex items-center gap-0.5"
          >
            <RiPriceTag3Line className="h-3 w-3 mr-0.5 flex-shrink-0" />
            <span className="truncate max-w-[80px]">
              {call.auto_tags && call.auto_tags.length > 0 ? call.auto_tags[0] : 'UNKNOWN'}
            </span>
          </Badge>
        </div>
      </TableCell>
      <TableCell className="align-middle py-0.5">
        <div className="flex items-center justify-center gap-0.5 md:gap-1">
          <button
            onClick={onCallClick}
            className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors"
            title="View details"
          >
            <RiEyeLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
          </button>

          {onDirectCategorize ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors"
                  title="Quick categorize"
                >
                  <RiFolderTransferLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className="w-full justify-start text-sm px-2 py-1.5 rounded-md hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors text-left"
                      onClick={() => onDirectCategorize(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <button
              onClick={onCategorize}
              className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors"
              title="Categorize"
            >
              <RiFolderTransferLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
            </button>
          )}
          {onCustomDownload ? (
            <button
              onClick={() => onCustomDownload(call.recording_id, call.title)}
              className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors"
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
