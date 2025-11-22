import { RiGroupLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface InviteesPopoverProps {
  invitees?: any[];
  hostEmail?: string;
}

export function InviteesPopover({ invitees, hostEmail }: InviteesPopoverProps) {
  if (!invitees || invitees.length === 0) {
    return <span className="text-muted-foreground text-xs">No invitees</span>;
  }

  const externalCount = invitees.filter(i => i.is_external).length;
  const internalCount = invitees.length - externalCount;

  // Filter out host and get display participants
  const displayParticipants = invitees.filter(inv => inv.email !== hostEmail);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="hollow" size="sm" className="h-auto py-1 px-2 gap-1.5 text-xs w-full justify-center">
          <RiGroupLine className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-xs font-medium min-w-[20px] text-center tabular-nums">{displayParticipants.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-2">Meeting Participants</h4>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Total: {invitees.length}</span>
              <span>Internal: {internalCount}</span>
              <span className="flex items-center gap-1">
                External: {externalCount}
              </span>
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {invitees.map((invitee, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    invitee.is_external ? "bg-primary/5" : "bg-muted/50"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {invitee.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invitee.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{invitee.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
