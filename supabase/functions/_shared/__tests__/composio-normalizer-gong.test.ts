import { describe, expect, it } from "vitest";
import {
  gongCallToCanonical,
  type GongCallPayload,
} from "../composio-normalizers/gong";

const basePayload: GongCallPayload = {
  metaData: {
    id: "gong-9999",
    title: "Discovery — Acme Corp",
    started: "2026-05-23T15:00:00Z",
    duration: 1820,
    url: "https://app.gong.io/call/gong-9999",
    primaryUserId: "u-host",
    direction: "Outbound",
    media: "audio_video",
  },
  parties: [
    {
      id: "u-host",
      speakerId: "spk-1",
      emailAddress: "ae@callvault.dev",
      name: "AE Host",
      affiliation: "Internal",
    },
    {
      id: "u-guest",
      speakerId: "spk-2",
      emailAddress: "buyer@acme.com",
      name: "Buyer",
      affiliation: "External",
    },
  ],
  transcript: [
    {
      speakerId: "spk-1",
      sentences: [
        { start: 0, end: 4000, text: "Hi there, thanks for joining." },
      ],
    },
    {
      speakerId: "spk-2",
      sentences: [{ start: 5000, end: 9000, text: "Happy to be here." }],
    },
  ],
  connected_account_id: "ca_gong_123",
};

describe("composio gong normalizer — canonical shape", () => {
  it("maps Gong payload into canonical recording fields", () => {
    const canonical = gongCallToCanonical(basePayload);
    expect(canonical).toMatchObject({
      externalId: "gong-9999",
      sourceApp: "gong",
      title: "Discovery — Acme Corp",
      recordingStartTime: "2026-05-23T15:00:00.000Z",
      durationSeconds: 1820,
      sourceUrl: "https://app.gong.io/call/gong-9999",
      recordedByEmail: "ae@callvault.dev",
      recordedByName: "AE Host",
    });
    expect(canonical.participantEmails).toEqual([
      "ae@callvault.dev",
      "buyer@acme.com",
    ]);
  });

  it("converts sentence millisecond offsets to seconds (NOT the raw value)", () => {
    // Regression guard: removing the /1000 divisor makes every Gong call's
    // timestamp wrong by 1000x.
    const canonical = gongCallToCanonical(basePayload);
    expect(canonical.fullTranscript).toContain("[0:00] AE Host: Hi there");
    expect(canonical.fullTranscript).toContain("[0:05] Buyer: Happy to be");
  });

  it("stamps composio_connected_account_id into sourceMetadata for framework symmetry", () => {
    const canonical = gongCallToCanonical(basePayload);
    expect(canonical.sourceMetadata).toMatchObject({
      gong_call_id: "gong-9999",
      composio_connected_account_id: "ca_gong_123",
      composio_routed: true,
    });
  });

  it("throws when metaData.id is missing — webhook should treat as ignored, not retry", () => {
    expect(() =>
      gongCallToCanonical({ ...basePayload, metaData: { started: "x" } }),
    ).toThrow(/missing metaData.id/);
  });

  it("throws when both started and scheduled are missing", () => {
    expect(() =>
      gongCallToCanonical({
        ...basePayload,
        metaData: { id: "x", started: null, scheduled: null },
      }),
    ).toThrow(/missing metaData.started\/scheduled/);
  });

  it("produces an empty fullTranscript when transcript is []", () => {
    const canonical = gongCallToCanonical({
      ...basePayload,
      transcript: [],
    });
    expect(canonical.fullTranscript).toBe("");
  });
});
