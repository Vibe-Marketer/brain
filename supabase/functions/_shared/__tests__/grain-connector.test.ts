import { describe, expect, it, vi } from "vitest";
import { listRecordings } from "../grain-client.ts";
import {
  grainRecordingToCanonical,
  type GrainRecording,
} from "../grain-connector.ts";

describe("grain connector", () => {
  const recording: GrainRecording = {
    id: "pppp6666-qq77-rr88-ss99-tttt00000000",
    title: "All Hands",
    source: "zoom",
    url: "https://grain.com/share/recording/pppp6666-qq77-rr88-ss99-tttt00000000",
    media_type: "video",
    tags: ["all-hands"],
    start_datetime: "2025-01-01T09:30:00Z",
    end_datetime: "2025-01-01T10:00:00Z",
    duration_ms: 1_800_000,
    thumbnail_url: "https://media.grain.com/public_thumbnails/recordings/pppp6666",
    participants: [
      { id: "p1", name: "Leia Example", email: "leia@example.com", confirmed_attendee: true },
      { id: "p2", name: "Han Example", email: "han@example.com", confirmed_attendee: false },
    ],
    teams: [{ id: "team-1", name: "Sales" }],
    meeting_type: { id: "type-1", name: "Team Coordination", scope: "internal" },
    ai_summary: "We reviewed launch progress.",
    ai_action_items: [{ text: "Send launch recap" }],
    transcript: [
      { start: 8_000, end: 9_000, speaker: "Leia Example", participant_id: "p1", text: "Let's begin." },
      { start: 11_482, end: 13_000, speaker: "Han Example", participant_id: "p2", text: "The rollout is ready." },
    ],
  };

  it("normalizes Grain API recordings into canonical recordings", () => {
    const canonical = grainRecordingToCanonical(recording);

    expect(canonical).toMatchObject({
      externalId: "pppp6666-qq77-rr88-ss99-tttt00000000",
      sourceApp: "grain",
      title: "All Hands",
      recordingStartTime: "2025-01-01T09:30:00.000Z",
      recordingEndTime: "2025-01-01T10:00:00.000Z",
      durationSeconds: 1800,
      sourceUrl: "https://grain.com/share/recording/pppp6666-qq77-rr88-ss99-tttt00000000",
      participantEmails: ["leia@example.com", "han@example.com"],
    });
    expect(canonical.fullTranscript).toBe(
      "[0:08] Leia Example: Let's begin.\n\n[0:11] Han Example: The rollout is ready.",
    );
    expect(canonical.summary).toContain("We reviewed launch progress.");
    expect(canonical.summary).toContain("- Send launch recap");
    expect(canonical.sourceMetadata).toMatchObject({
      grain_recording_id: "pppp6666-qq77-rr88-ss99-tttt00000000",
      grain_source: "zoom",
      grain_media_type: "video",
      grain_tags: ["all-hands"],
      grain_ai_action_items: ["Send launch recap"],
    });
  });

  it("throws for recordings without transcript text", () => {
    expect(() =>
      grainRecordingToCanonical({
        id: "empty",
        start_datetime: "2025-01-01T09:30:00Z",
        transcript: [],
      }),
    ).toThrow(/no transcript text/);
  });
});

describe("grain client", () => {
  it("uses Grain v2 headers, filters, include body, and cursor pagination", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ cursor: "next-cursor", recordings: [] }), {
          status: 200,
        }),
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await listRecordings({
      token: "secret-token",
      cursor: "last-cursor",
      startDateTimeGte: "2025-01-01T00:00:00Z",
      startDateTimeLte: "2025-02-01T00:00:00Z",
      titleSearch: "hands",
      include: { participants: true, ai_summary: true },
      fetchImpl,
    });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe("https://api.grain.com/_/public-api/v2/recordings");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Public-Api-Version": "2025-10-31",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      cursor: "last-cursor",
      include: { participants: true, ai_summary: true },
      filter: {
        title_search: "hands",
        start_datetime_gte: "2025-01-01T00:00:00Z",
        start_datetime_lte: "2025-02-01T00:00:00Z",
      },
    });
  });
});
