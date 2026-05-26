import type { Meeting } from "@/hooks/useMeetingsSync";
import type { IntegrationPlatform } from "@/lib/integration-platforms";

const DEFAULT_PLATFORM: IntegrationPlatform = "fathom";
const SEPARATOR = "::";

export function getMeetingSourcePlatform(meeting: Meeting): IntegrationPlatform {
  return meeting.source_platform ?? DEFAULT_PLATFORM;
}

export function getUnsyncedMeetingSelectionKey(meeting: Meeting): string {
  return `${encodeURIComponent(getMeetingSourcePlatform(meeting))}${SEPARATOR}${encodeURIComponent(meeting.recording_id)}`;
}

export function findMeetingBySelectionKey(
  meetings: Meeting[],
  selectionKey: string,
): Meeting | undefined {
  return meetings.find(
    (meeting) => getUnsyncedMeetingSelectionKey(meeting) === selectionKey,
  );
}
