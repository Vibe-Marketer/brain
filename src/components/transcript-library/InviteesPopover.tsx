import { RiGroupLine, RiMicLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CalendarInvitee } from "@/types";

interface InviteesPopoverProps {
  invitees?: CalendarInvitee[];
  hostEmail?: string;
}

export function InviteesPopover({ invitees, hostEmail }: InviteesPopoverProps) {
  if (!invitees || !Array.isArray(invitees) || invitees.length === 0) {
    return <span className="text-muted-foreground text-xs">No invitees</span>;
  }

  const isExternal = (i: CalendarInvitee) => i.external || i.is_external;
  const externalCount = invitees.filter(i => i && isExternal(i)).length;
  const internalCount = invitees.length - externalCount;
  const spokeCount = invitees.filter(i => i && i.matched_speaker_display_name).length;

  // Filter out host for display
  const displayInvitees = invitees.filter(inv => inv && inv.email !== hostEmail);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="hollow" size="sm" className="h-auto py-1 px-2 gap-1.5 text-xs w-full justify-center">
          <RiGroupLine className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-xs font-medium min-w-[20px] text-center tabular-nums">{displayInvitees.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-2">Meeting Invitees</h4>
            <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
              <span>Total: {invitees.length}</span>
              <span>Internal: {internalCount}</span>
              <span>External: {externalCount}</span>
              {spokeCount > 0 && (
                <span className="flex items-center gap-1 text-vibe-orange">
                  <RiMicLine className="h-3 w-3" />
                  {spokeCount} spoke
                </span>
              )}
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {invitees.filter(inv => inv).map((invitee, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    isExternal(invitee) ? "bg-primary/5" : "bg-muted/50"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {invitee.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invitee.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{invitee.email || ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {invitee.matched_speaker_display_name && (
                      <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4 gap-0.5 whitespace-nowrap">
                        <RiMicLine className="h-2.5 w-2.5" />
                        Spoke
                      </Badge>
                    )}
                    {isExternal(invitee) && (
                      <Badge variant="outline" className="text-2xs px-1.5 py-0 h-4 whitespace-nowrap">
                        External
                      </Badge>
                    )}
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
