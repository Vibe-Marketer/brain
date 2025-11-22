import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";

interface CalendarInvitee {
  name: string;
  email: string;
  is_external?: boolean;
  matched_speaker_display_name?: string;
}

interface CallInviteesTabProps {
  calendarInvitees?: CalendarInvitee[];
}

export function CallInviteesTab({ calendarInvitees }: CallInviteesTabProps) {
  return (
    <TabsContent value="invitees" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pr-4 pb-6">
          {calendarInvitees && calendarInvitees.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Meeting Invitees ({calendarInvitees.length})</h3>
              <p className="text-sm text-muted-foreground mb-4">People who were invited to this meeting via calendar invite</p>
              <div className="space-y-3">
                {calendarInvitees.map((invitee, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                    <Avatar>
                      <AvatarFallback>
                        {invitee.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{invitee.name}</p>
                      <p className="text-sm text-muted-foreground">{invitee.email}</p>
                      <div className="flex gap-2 mt-2">
                        {invitee.is_external ? (
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
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No invitee data available for this meeting</p>
            </Card>
          )}
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
