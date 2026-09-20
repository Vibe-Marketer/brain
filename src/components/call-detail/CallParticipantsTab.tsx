import { useId, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { IdentityEvidenceBadge } from "@/components/shared/IdentityEvidenceBadge";
import {
  useCancelParticipationReminder,
  useParticipationInvitationStatuses,
  useResendParticipationInvitation,
  useSendParticipationInvitation,
} from "@/hooks/useEventDiscovery";
import type { ParticipationInvitationStatus } from "@/types/event-discovery";

interface CallSpeaker {
  speaker_name: string;
  speaker_email?: string | null;
  participant_id?: string;
  participant_type?: string | null;
  contact_id?: string | null;
  contact_type?: string | null;
  contact_last_seen_at?: string | null;
  contact_track_health?: boolean | null;
  contact_notes?: string | null;
  contact_tags?: string[] | null;
  /** Phase 34-05: resolved identities.id — renders the evidence popover when present. */
  identity_id?: string | null;
}

interface CallParticipantsTabProps {
  callSpeakers?: CallSpeaker[];
  hasTranscripts: boolean;
  recordingId?: string;
  isRecordingOwner?: boolean;
}

const absoluteDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatAbsoluteDate(value: string): string {
  return absoluteDateFormatter.format(new Date(value));
}

function ReminderOption({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const switchId = useId();
  const descriptionId = `${switchId}-description`;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={switchId}
        aria-describedby={descriptionId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <div className="min-w-0">
        <Label htmlFor={switchId}>Send one reminder</Label>
        <p id={descriptionId} className="sr-only">
          Send one automatic reminder before this invitation expires.
        </p>
      </div>
    </div>
  );
}

function ParticipationInvitationControls({
  participantId,
  participantName,
  recordingId,
  status,
}: {
  participantId: string;
  participantName: string;
  recordingId: string;
  status: ParticipationInvitationStatus;
}) {
  const [sendReminder, setSendReminder] = useState(false);
  const send = useSendParticipationInvitation(recordingId, participantId, participantName);
  const resend = useResendParticipationInvitation(recordingId, participantId, participantName);
  const cancelReminder = useCancelParticipationReminder(recordingId, participantId);
  const isPending = send.isPending || resend.isPending || cancelReminder.isPending;

  const runInvitation = (operation: "send" | "resend") => {
    const mutation = operation === "send" ? send : resend;
    void mutation.mutateAsync({ sendReminder })
      .then(() => setSendReminder(false))
      .catch(() => undefined);
  };

  const renderAction = (operation: "send" | "resend") => (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <ReminderOption
        checked={sendReminder}
        disabled={isPending}
        onCheckedChange={setSendReminder}
      />
      <Button
        type="button"
        size="sm"
        className="h-11 w-full sm:h-9 sm:w-auto"
        aria-label={isPending
          ? `Sending invitation to ${participantName}`
          : operation === "send"
            ? `Invite ${participantName} to claim participation`
            : `Resend invitation to ${participantName}`}
        disabled={isPending}
        onClick={() => runInvitation(operation)}
      >
        {isPending ? "Sending…" : operation === "send" ? "Invite to claim" : "Resend invite"}
      </Button>
    </div>
  );

  if (status.status === "eligible") {
    return renderAction("send");
  }

  if (status.status === "claimed") {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end" aria-live="polite">
        <Badge variant="secondary">Claimed</Badge>
        {status.claimedAt && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Claimed {formatAbsoluteDate(status.claimedAt)}
          </p>
        )}
      </div>
    );
  }

  if (status.status === "revoked" || status.status === "superseded") {
    return (
      <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end" aria-live="polite">
        <Badge variant="hollow">No active invitation</Badge>
        {status.canResend && renderAction("resend")}
      </div>
    );
  }

  if (status.status === "expired") {
    return (
      <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end" aria-live="polite">
        <Badge variant="hollow">Expired</Badge>
        <p className="text-xs tabular-nums text-muted-foreground">
          Sent {formatAbsoluteDate(status.sentAt)}
        </p>
        {status.canResend && <div className="mt-1 w-full sm:w-auto">{renderAction("resend")}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end" aria-live="polite">
      <Badge variant="secondary">
        {status.reminder.state === "sent" ? "Reminder sent" : "Invitation sent"}
      </Badge>
      <p className="text-xs tabular-nums text-muted-foreground">
        Sent {formatAbsoluteDate(status.sentAt)}
      </p>
      {status.reminder.state === "scheduled" ? (
        <>
          <p className="text-xs tabular-nums text-muted-foreground">
            Reminder scheduled {formatAbsoluteDate(status.reminder.scheduledFor)}
          </p>
          <Button
            type="button"
            variant="link"
            className="min-h-11 sm:min-h-0"
            disabled={cancelReminder.isPending}
            onClick={() => void cancelReminder.mutateAsync().catch(() => undefined)}
          >
            Cancel reminder
          </Button>
        </>
      ) : status.reminder.state === "sent" ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          Reminded {formatAbsoluteDate(status.reminder.sentAt)}
        </p>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          Resend available {formatAbsoluteDate(status.expiresAt)}
        </p>
      )}
    </div>
  );
}

export function CallParticipantsTab({
  callSpeakers,
  hasTranscripts,
  recordingId,
  isRecordingOwner = false,
}: CallParticipantsTabProps) {
  const participantIds = useMemo(() => {
    if (!isRecordingOwner || !recordingId) return [];
    return callSpeakers
      ?.filter((speaker) => speaker.participant_id && speaker.speaker_email)
      .map((speaker) => speaker.participant_id as string) ?? [];
  }, [callSpeakers, isRecordingOwner, recordingId]);
  const invitationStatuses = useParticipationInvitationStatuses(
    isRecordingOwner ? recordingId ?? "" : "",
    participantIds,
  );
  const statusByParticipantId = useMemo(
    () => new Map(
      (invitationStatuses.data ?? []).map((status) => [status.participantId, status]),
    ),
    [invitationStatuses.data],
  );

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
                {callSpeakers.map((speaker, index) => {
                  const invitationStatus = speaker.participant_id && speaker.speaker_email
                    ? statusByParticipantId.get(speaker.participant_id)
                    : undefined;
                  return (
                  <div
                    key={speaker.participant_id ?? `${speaker.speaker_email ?? speaker.speaker_name}-${index}`}
                    className="relative flex flex-col gap-3 py-2 px-4 bg-card border border-border rounded-lg sm:flex-row sm:items-start"
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
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {speaker.speaker_name || "Unknown"}
                      </p>
                      {speaker.speaker_email && (
                        <p className="text-sm text-muted-foreground">
                          {speaker.speaker_email}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
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
                        {speaker.identity_id && (
                          <IdentityEvidenceBadge identityId={speaker.identity_id} />
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
                    {isRecordingOwner && recordingId && speaker.participant_id && invitationStatus && (
                      <div className="ml-3 w-full sm:ml-auto sm:w-auto sm:min-w-[190px]">
                        <ParticipationInvitationControls
                          participantId={speaker.participant_id}
                          participantName={speaker.speaker_name || "participant"}
                          recordingId={recordingId}
                          status={invitationStatus}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
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
