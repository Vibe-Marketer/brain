import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";

interface CallSpeaker {
  speaker_name: string;
  speaker_email?: string | null;
}

interface CallParticipantsTabProps {
  callSpeakers?: CallSpeaker[];
  hasTranscripts: boolean;
}

export function CallParticipantsTab({ callSpeakers, hasTranscripts }: CallParticipantsTabProps) {
  return (
    <TabsContent value="participants" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pr-4 pb-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-sm font-extrabold uppercase mb-2">PARTICIPANTS ({callSpeakers?.length || 0})</h3>
              <p className="text-sm text-ink-muted mb-4">People who actually spoke during this meeting</p>
            </div>
            {callSpeakers && callSpeakers.length > 0 ? (
              <div className="space-y-3">
                {callSpeakers.map((speaker, index) => (
                  <div key={index} className="relative flex items-start gap-3 py-2 px-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
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
                        <p className="text-sm text-ink-muted">{speaker.speaker_email}</p>
                      )}
                      <Badge variant="secondary" className="mt-2">Spoke in Meeting</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-ink-muted">
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
