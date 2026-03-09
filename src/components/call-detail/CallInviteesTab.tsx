import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RiInformationLine } from "@remixicon/react";

import type { CalendarInvitee, Speaker } from "@/types";

interface CallInviteesTabProps {
  calendarInvitees?: CalendarInvitee[];
  callSpeakers?: Speaker[];
}

export function CallInviteesTab({ calendarInvitees, callSpeakers }: CallInviteesTabProps) {
  const hasInvitees = calendarInvitees && calendarInvitees.length > 0;

  return (
    <TabsContent value="invitees" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pr-4 pb-6">
          {hasInvitees ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-display text-sm font-extrabold uppercase">
                    MEETING INVITEES ({calendarInvitees.length})
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="About invitees vs participants">
                          <RiInformationLine className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Invitees are from the calendar invite. Participants are those who actually spoke.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  People who were invited to this meeting via calendar invite
                </p>
              </div>
              <div className="space-y-3">
                {calendarInvitees.map((invitee, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 py-2 px-4 bg-card border border-border rounded-lg">
                    {/* Vibe orange angled marker - STANDARDIZED DIMENSIONS */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange cv-vertical-marker" />
                    <Avatar className="ml-3">
                      <AvatarFallback>
                        {invitee.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{invitee.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{invitee.email}</p>
                      <div className="flex gap-2 mt-2">
                        {invitee.external ? (
                          <Badge variant="hollow">External</Badge>
                        ) : (
                          <Badge variant="secondary">Internal</Badge>
                        )}
                        {invitee.matched_speaker_display_name && (
                          <Badge variant="default">Spoke in meeting</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : callSpeakers && callSpeakers.length > 0 ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-display text-sm font-extrabold uppercase">
                    PARTICIPANTS ({callSpeakers.length})
                  </h3>
                  <Badge variant="secondary" className="text-xs">Ad-hoc call</Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Why participants instead of invitees">
                          <RiInformationLine className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>No calendar invitees found. Showing speakers from the transcript instead.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  This appears to be an impromptu or ad-hoc call — no calendar invitees were found. Showing transcript speakers instead.
                </p>
              </div>
              <div className="space-y-3">
                {callSpeakers.map((speaker, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 py-2 px-4 bg-card border border-border rounded-lg">
                    {/* Vibe orange angled marker - STANDARDIZED DIMENSIONS */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange cv-vertical-marker" />
                    <Avatar className="ml-3">
                      <AvatarFallback>
                        {speaker.speaker_name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{speaker.speaker_name || "Unknown"}</p>
                      {speaker.speaker_email && (
                        <p className="text-sm text-muted-foreground">{speaker.speaker_email}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">Spoke in Meeting</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 gap-3">
              <Badge variant="secondary" className="text-xs">Ad-hoc call</Badge>
              <p className="text-muted-foreground text-sm text-center">
                No invitee or participant data available for this meeting
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
