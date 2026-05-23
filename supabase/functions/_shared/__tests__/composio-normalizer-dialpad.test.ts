import { describe, expect, it } from "vitest";
import {
  dialpadCallToCanonical,
  type DialpadCallPayload,
} from "../composio-normalizers/dialpad";

const basePayload: DialpadCallPayload = {
  call_id: "dp-555",
  call: {
    id: "dp-555",
    internal_number: "+15555550101",
    external_number: "+15555559999",
    direction: "outbound",
    date_started: "2026-05-23T16:00:00Z",
    date_ended: "2026-05-23T16:18:00Z",
    duration: 1080,
    recording_url: "https://dialpad.com/recording/dp-555",
    target: { email: "rep@callvault.dev", name: "Rep" },
    contact: { email: "lead@buyer.com", name: "Lead", phone: "+15555559999" },
  },
  transcript: [
    {
      content: "Hello?",
      name: "Lead",
      email: "lead@buyer.com",
      start_time: 0,
      end_time: 2,
      speaker_type: "contact",
    },
    {
      content: "Hi, this is Rep.",
      name: "Rep",
      email: "rep@callvault.dev",
      start_time: 3,
      end_time: 6,
      speaker_type: "user",
    },
  ],
  connected_account_id: "ca_dialpad_42",
};

describe("composio dialpad normalizer — canonical shape", () => {
  it("maps Dialpad payload into canonical recording fields", () => {
    const canonical = dialpadCallToCanonical(basePayload);
    expect(canonical).toMatchObject({
      externalId: "dp-555",
      sourceApp: "dialpad",
      title: "Outbound call to Lead",
      durationSeconds: 1080,
      sourceUrl: "https://dialpad.com/recording/dp-555",
      recordedByEmail: "rep@callvault.dev",
      recordedByName: "Rep",
    });
    expect(canonical.participantEmails).toEqual([
      "rep@callvault.dev",
      "lead@buyer.com",
    ]);
    expect(canonical.fullTranscript).toContain("Hello?");
    expect(canonical.fullTranscript).toContain("Hi, this is Rep.");
  });

  it("stamps composio_connected_account_id + composio_routed into sourceMetadata", () => {
    const canonical = dialpadCallToCanonical(basePayload);
    expect(canonical.sourceMetadata).toMatchObject({
      dialpad_call_id: "dp-555",
      composio_connected_account_id: "ca_dialpad_42",
      composio_routed: true,
    });
  });

  it("treats numeric date_started > 1e12 as milliseconds, not seconds", () => {
    // Heuristic guard: if removed, every Dialpad call's start time would
    // be wrong by 1000x for any number larger than 2001-09-09.
    const millis = 1748016000000; // 2025-05-23T16:00:00Z
    const canonical = dialpadCallToCanonical({
      ...basePayload,
      call: { ...basePayload.call, date_started: millis },
    });
    expect(canonical.recordingStartTime).toBe(new Date(millis).toISOString());
  });

  it("treats numeric date_started <= 1e12 as seconds (legacy Dialpad responses)", () => {
    const seconds = 1748016000; // 2025-05-23T16:00:00Z
    const canonical = dialpadCallToCanonical({
      ...basePayload,
      call: { ...basePayload.call, date_started: seconds },
    });
    expect(canonical.recordingStartTime).toBe(
      new Date(seconds * 1000).toISOString(),
    );
  });

  it("throws when call id is missing — webhook treats as ignored, not retry", () => {
    expect(() =>
      dialpadCallToCanonical({ ...basePayload, call_id: null, call: {} }),
    ).toThrow(/missing call id/);
  });

  it("throws when date_started is missing — webhook treats as ignored, not retry", () => {
    expect(() =>
      dialpadCallToCanonical({
        ...basePayload,
        call: { id: "dp-x", date_started: null },
      }),
    ).toThrow(/missing call.date_started/);
  });
});
