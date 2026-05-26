import { describe, expect, it } from "vitest";
import type { Meeting } from "@/hooks/useMeetingsSync";
import {
  findMeetingBySelectionKey,
  getUnsyncedMeetingSelectionKey,
} from "../syncSelection";

function meeting(
  sourcePlatform: Meeting["source_platform"],
  recordingId: string,
): Meeting {
  return {
    recording_id: recordingId,
    title: `${sourcePlatform ?? "fathom"} ${recordingId}`,
    created_at: "2026-05-26T00:00:00Z",
    recording_start_time: "2026-05-26T00:00:00Z",
    synced: false,
    source_platform: sourcePlatform,
  };
}

describe("SyncTab unsynced selection keys", () => {
  it("qualifies provider recording ids by source platform", () => {
    const readAiMeeting = meeting("read-ai", "shared-id");
    const grainMeeting = meeting("grain", "shared-id");

    expect(getUnsyncedMeetingSelectionKey(readAiMeeting)).toBe(
      "read-ai::shared-id",
    );
    expect(getUnsyncedMeetingSelectionKey(grainMeeting)).toBe(
      "grain::shared-id",
    );
    expect(getUnsyncedMeetingSelectionKey(readAiMeeting)).not.toBe(
      getUnsyncedMeetingSelectionKey(grainMeeting),
    );
  });

  it("falls back to Fathom for legacy unsynced rows without source metadata", () => {
    expect(getUnsyncedMeetingSelectionKey(meeting(null, "123"))).toBe(
      "fathom::123",
    );
  });

  it("finds the selected meeting without confusing duplicate provider ids", () => {
    const meetings = [
      meeting("read-ai", "shared-id"),
      meeting("grain", "shared-id"),
    ];

    expect(
      findMeetingBySelectionKey(meetings, "grain::shared-id")?.source_platform,
    ).toBe("grain");
  });
});
