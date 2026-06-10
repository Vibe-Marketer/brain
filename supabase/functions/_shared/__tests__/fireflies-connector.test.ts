import { describe, expect, it, vi } from "vitest";
import {
  coerceFirefliesDate,
  fetchFirefliesTranscript,
  fetchFirefliesUser,
  firefliesTranscriptToCanonical,
  normalizeDurationSeconds,
  type FirefliesTranscript,
} from "../fireflies-connector.ts";

describe("fireflies connector", () => {
  const transcript: FirefliesTranscript = {
    id: "01HXFIREFLIES",
    title: "CallVault Connector Design",
    dateString: "2026-05-23T15:00:00Z",
    duration: 95,
    host_email: "host@example.com",
    organizer_email: "organizer@example.com",
    transcript_url: "https://app.fireflies.ai/view/01HXFIREFLIES",
    meeting_link: "https://meet.example.com/abc",
    participants: ["guest@example.com"],
    meeting_attendees: [
      { displayName: "Host User", email: "host@example.com" },
      { displayName: "Guest User", email: "guest@example.com" },
    ],
    sentences: [
      {
        index: 2,
        speaker_name: "Guest User",
        text: "Second turn.",
        start_time: 12.2,
        end_time: 18,
      },
      {
        index: 1,
        speaker_name: "Host User",
        text: "First turn.",
        start_time: 0,
        end_time: 5,
      },
    ],
    summary: {
      short_summary: "Connector design review.",
      action_items: ["Build conformance tests"],
      topics_discussed: ["Canonical recordings"],
    },
  };

  it("normalizes Fireflies transcript payloads into canonical recordings", () => {
    const canonical = firefliesTranscriptToCanonical(transcript);

    expect(canonical).toMatchObject({
      externalId: "01HXFIREFLIES",
      sourceApp: "fireflies",
      title: "CallVault Connector Design",
      recordingStartTime: "2026-05-23T15:00:00.000Z",
      recordingEndTime: "2026-05-23T16:35:00.000Z",
      durationSeconds: 5700,
      sourceUrl: "https://app.fireflies.ai/view/01HXFIREFLIES",
      recordedByEmail: "host@example.com",
      participantEmails: [
        "host@example.com",
        "organizer@example.com",
        "guest@example.com",
      ],
    });
    expect(canonical.fullTranscript).toBe(
      "[0:00] Host User: First turn.\n\n[0:12] Guest User: Second turn.",
    );
    expect(canonical.transcriptTurns).toEqual([
      {
        speakerName: "Host User",
        text: "First turn.",
        startSeconds: 0,
        endSeconds: 5,
      },
      {
        speakerName: "Guest User",
        text: "Second turn.",
        startSeconds: 12.2,
        endSeconds: 18,
      },
    ]);
    expect(canonical.summary).toContain("Connector design review.");
    expect(canonical.summary).toContain("- Build conformance tests");
    expect(canonical.sourceMetadata).toMatchObject({
      fireflies_transcript_id: "01HXFIREFLIES",
      recorded_by_name: "Host User",
      recorded_by_email: "host@example.com",
      transcript_speaker_names: ["Host User", "Guest User"],
      action_items: ["Build conformance tests"],
      topics_discussed: ["Canonical recordings"],
    });
  });

  it("uses the documented GraphQL endpoint and bearer auth", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { transcript } }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await fetchFirefliesTranscript(
      "secret-key",
      "01HXFIREFLIES",
      fetchImpl,
    );

    expect(result.id).toBe("01HXFIREFLIES");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.fireflies.ai/graphql",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-key",
        },
      }),
    );
  });
});

describe("fireflies connector — fetchFirefliesUser", () => {
  it("returns the user payload on a successful GraphQL response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              user: {
                user_id: "user_123",
                email: "andrew@example.com",
                name: "Andrew Naegele",
                integrations: ["google_calendar"],
              },
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const user = await fetchFirefliesUser("secret-key", fetchImpl);

    expect(user).toMatchObject({
      user_id: "user_123",
      email: "andrew@example.com",
      name: "Andrew Naegele",
    });
  });

  it("throws a descriptive error when GraphQL returns an errors array", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ errors: [{ message: "Invalid API key" }] }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    await expect(fetchFirefliesUser("bad-key", fetchImpl)).rejects.toThrow(
      /Invalid API key/,
    );
  });

  it("throws with the HTTP status when a non-2xx response carries no errors array", async () => {
    // Fireflies returns a JSON envelope even on 5xx. The connector calls
    // response.json() before checking response.ok, so a non-JSON body would
    // surface a parse error rather than the status — document the
    // JSON-shaped-error contract by matching it here.
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: null }), { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(fetchFirefliesUser("any-key", fetchImpl)).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("throws when the GraphQL response has no user object", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { user: null } }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(fetchFirefliesUser("any-key", fetchImpl)).rejects.toThrow(
      /Fireflies user lookup failed/,
    );
  });
});

describe("fireflies connector — coerceFirefliesDate epoch branch", () => {
  // Reference: 2024-05-23T14:00:00.000Z
  // seconds:      1_716_472_800
  // milliseconds: 1_716_472_800_000
  const EXPECTED_ISO = "2024-05-23T14:00:00.000Z";

  it("treats values <= 10_000_000_000 as epoch seconds", () => {
    expect(coerceFirefliesDate(1_716_472_800)).toBe(EXPECTED_ISO);
  });

  it("treats values > 10_000_000_000 as epoch milliseconds", () => {
    expect(coerceFirefliesDate(1_716_472_800_000)).toBe(EXPECTED_ISO);
  });

  it("prefers an ISO-8601 string when one is provided", () => {
    expect(coerceFirefliesDate("2024-05-23T14:00:00Z")).toBe(EXPECTED_ISO);
  });

  it("throws when no valid date is available", () => {
    expect(() => coerceFirefliesDate(null)).toThrow(/missing a valid date/);
    expect(() => coerceFirefliesDate(undefined)).toThrow(
      /missing a valid date/,
    );
    expect(() => coerceFirefliesDate("")).toThrow(/missing a valid date/);
    expect(() => coerceFirefliesDate("not-a-date")).toThrow(
      /missing a valid date/,
    );
  });
});

describe("fireflies connector — normalizeDurationSeconds", () => {
  it("treats Fireflies durations as minutes", () => {
    expect(normalizeDurationSeconds(95.4)).toBe(5724);
    expect(normalizeDurationSeconds(95.6)).toBe(5736);
  });

  it("falls back to sentence offsets when the reported duration is implausibly short", () => {
    expect(
      normalizeDurationSeconds(1, [
        { index: 1, speaker_name: "A", text: "hello", start_time: 0, end_time: 240 },
      ]),
    ).toBe(240);
  });

  it("returns null for nullish, NaN, or negative values", () => {
    expect(normalizeDurationSeconds(null)).toBeNull();
    expect(normalizeDurationSeconds(undefined)).toBeNull();
    expect(normalizeDurationSeconds(Number.NaN)).toBeNull();
    expect(normalizeDurationSeconds(-1)).toBeNull();
  });
});
