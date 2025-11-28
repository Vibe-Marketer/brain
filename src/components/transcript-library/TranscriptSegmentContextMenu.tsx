import {
  RiMoreLine,
  RiEditLine,
  RiUserLine,
  RiScissorsLine,
  RiArrowGoBackLine,
} from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface TranscriptSegmentContextMenuProps {
  segmentId: string;
  hasEdits: boolean;
  onEdit: () => void;
  onChangeSpeaker: () => void;
  onTrimThis: () => void;
  onTrimBefore: () => void;
  onRevert: () => void;
}

export function TranscriptSegmentContextMenu({
  segmentId: _segmentId,
  hasEdits,
  onEdit,
  onChangeSpeaker,
  onTrimThis,
  onTrimBefore,
  onRevert,
}: TranscriptSegmentContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="hollow"
          size="sm"
          className="h-5 w-5 p-0 rounded-full opacity-0 group-hover/message:opacity-100 transition-all bg-background dark:bg-card text-foreground border border-border hover:bg-muted hover:border-muted-foreground/20 data-[state=open]:bg-muted data-[state=open]:border-muted-foreground/20 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <RiMoreLine className="h-3 w-3" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onEdit}>
            <RiEditLine className="mr-2 h-4 w-4" />
            Edit transcript
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onChangeSpeaker}>
            <RiUserLine className="mr-2 h-4 w-4" />
            Change speaker
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onTrimThis} className="text-destructive">
            <RiScissorsLine className="mr-2 h-4 w-4" />
            Trim this section
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTrimBefore} className="text-destructive">
            <RiScissorsLine className="mr-2 h-4 w-4" />
            Trim all before this
          </DropdownMenuItem>
          {hasEdits && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRevert}>
                <RiArrowGoBackLine className="mr-2 h-4 w-4" />
                Revert changes
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
