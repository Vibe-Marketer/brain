import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-sm font-extrabold uppercase mb-2">MEETING INVITEES ({calendarInvitees.length})</h3>
                <p className="text-sm text-ink-muted mb-4">People who were invited to this meeting via calendar invite</p>
              </div>
              <div className="space-y-3">
                {calendarInvitees.map((invitee, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 py-2 px-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
                    {/* Vibe orange angled marker - STANDARDIZED DIMENSIONS */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                      style={{
                        clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                      }}
                    />
                    <Avatar className="ml-3">
                      <AvatarFallback>
                        {invitee.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{invitee.name}</p>
                      <p className="text-sm text-ink-muted">{invitee.email}</p>
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
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-ink-muted">No invitee data available for this meeting</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
