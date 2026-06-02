import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";

interface CallSpeaker {
  speaker_name: string;
  speaker_email?: string | null;
  participant_type?: string | null;
  contact_id?: string | null;
  contact_type?: string | null;
  contact_last_seen_at?: string | null;
  contact_track_health?: boolean | null;
  contact_notes?: string | null;
  contact_tags?: string[] | null;
}

interface CallParticipantsTabProps {
  callSpeakers?: CallSpeaker[];
  hasTranscripts: boolean;
}

export function CallParticipantsTab({
  callSpeakers,
  hasTranscripts,
}: CallParticipantsTabProps) {
  return (
    <TabsContent value="participants" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pt-6 pl-6 pr-4 pb-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-sm font-extrabold uppercase mb-2">
                SPEAKERS ({callSpeakers?.length || 0})
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                People identified from the transcript, invitees, and contact records
              </p>
            </div>
            {callSpeakers && callSpeakers.length > 0 ? (
              <div className="space-y-3">
                {callSpeakers.map((speaker, index) => (
                  <div
                    key={index}
                    className="relative flex items-start gap-3 py-2 px-4 bg-card border border-border rounded-lg"
                  >
                    {/* Vibe orange angled marker - STANDARDIZED DIMENSIONS */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange cv-vertical-marker" />
                    <Avatar className="ml-3">
                      <AvatarFallback>
                        {speaker.speaker_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">
                        {speaker.speaker_name || "Unknown"}
                      </p>
                      {speaker.speaker_email && (
                        <p className="text-sm text-muted-foreground">
                          {speaker.speaker_email}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary">Speaker</Badge>
                        {speaker.participant_type === "host" && (
                          <Badge variant="hollow">Host</Badge>
                        )}
                        {speaker.contact_type && (
                          <Badge variant="outline">{speaker.contact_type}</Badge>
                        )}
                        {speaker.contact_track_health && (
                          <Badge variant="outline">Tracked contact</Badge>
                        )}
                      </div>
                      {speaker.contact_last_seen_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last seen {new Date(speaker.contact_last_seen_at).toLocaleDateString()}
                        </p>
                      )}
                      {speaker.contact_tags && speaker.contact_tags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tags: {speaker.contact_tags.join(", ")}
                        </p>
                      )}
                      {speaker.contact_notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {speaker.contact_notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {hasTranscripts
                    ? "Unable to identify speakers for this call"
                    : "No transcript data available for this meeting"}
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
