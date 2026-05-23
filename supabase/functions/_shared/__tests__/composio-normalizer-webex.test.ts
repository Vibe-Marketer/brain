import { describe, expect, it } from "vitest";
import {
  webexRecordingToCanonical,
  type WebexRecordingPayload,
} from "../composio-normalizers/webex";

const basePayload: WebexRecordingPayload = {
  recording: {
    id: "wbx-rec-1",
    meetingId: "wbx-meet-1",
    topic: "Pricing Review",
    timeRecorded: "2026-05-23T17:00:00Z",
    durationSeconds: 1500,
    hostEmail: "host@callvault.dev",
    hostDisplayName: "Host",
    playbackUrl: "https://webex.com/play/wbx-rec-1",
    downloadUrl: "https://webex.com/download/wbx-rec-1",
    format: "MP4",
  },
  meeting: {
    id: "wbx-meet-1",
    title: "Pricing Review",
    start: "2026-05-23T17:00:00Z",
    end: "2026-05-23T17:25:00Z",
    hostEmail: "host@callvault.dev",
    hostDisplayName: "Host",
    invitees: [
      { email: "buyer@acme.com", displayName: "Buyer" },
      { email: "host@callvault.dev", displayName: "Host" },
    ],
  },
  transcript: [
    {
      text: "Welcome.",
      speaker: "Host",
      speakerEmail: "host@callvault.dev",
      startTime: 0,
      endTime: 2,
    },
    {
      text: "Thanks.",
      speaker: "Buyer",
      speakerEmail: "buyer@acme.com",
      startTime: 3,
      endTime: 4,
    },
  ],
  connected_account_id: "ca_webex_7",
};

describe("composio webex normalizer — canonical shape", () => {
  it("maps Webex payload into canonical recording fields", () => {
    const canonical = webexRecordingToCanonical(basePayload);
    expect(canonical).toMatchObject({
      externalId: "wbx-rec-1",
      sourceApp: "webex",
      title: "Pricing Review",
      recordingStartTime: "2026-05-23T17:00:00.000Z",
      durationSeconds: 1500,
      sourceUrl: "https://webex.com/play/wbx-rec-1",
      recordedByEmail: "host@callvault.dev",
      recordedByName: "Host",
    });
    expect(canonical.participantEmails).toEqual(
      expect.arrayContaining(["host@callvault.dev", "buyer@acme.com"]),
    );
    expect(canonical.fullTranscript).toContain("Welcome.");
    expect(canonical.fullTranscript).toContain("Thanks.");
  });

  it("stamps composio_connected_account_id + composio_routed into sourceMetadata", () => {
    const canonical = webexRecordingToCanonical(basePayload);
    expect(canonical.sourceMetadata).toMatchObject({
      webex_recording_id: "wbx-rec-1",
      webex_meeting_id: "wbx-meet-1",
      composio_connected_account_id: "ca_webex_7",
      composio_routed: true,
    });
  });

  it("falls back to meeting.id when recording.id is absent", () => {
    const canonical = webexRecordingToCanonical({
      ...basePayload,
      recording: { ...basePayload.recording, id: null },
    });
    expect(canonical.externalId).toBe("wbx-meet-1");
  });

  it("throws when both recording.id and meeting.id are missing", () => {
    expect(() =>
      webexRecordingToCanonical({
        ...basePayload,
        recording: { ...basePayload.recording, id: null },
        meeting: { ...basePayload.meeting, id: null },
      }),
    ).toThrow(/missing recording.id and meeting.id/);
  });

  it("produces an empty fullTranscript when transcript is []", () => {
    const canonical = webexRecordingToCanonical({
      ...basePayload,
      transcript: [],
    });
    expect(canonical.fullTranscript).toBe("");
  });
});
