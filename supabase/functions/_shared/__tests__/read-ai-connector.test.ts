import { describe, expect, it, vi } from "vitest";
import {
  clampReadAiLimit,
  listMeetings,
} from "../read-ai-client";
import {
  readAiMeetingToCanonical,
  type ReadAiMeeting,
} from "../read-ai-connector";

describe("read-ai connector", () => {
  const meeting: ReadAiMeeting = {
    id: "01HFYH0A6JM4R7MZ2E6X5T9BNP",
    title: "Weekly status sync",
    start_time_ms: 1_733_800_000_000,
    end_time_ms: 1_733_803_600_000,
    report_url: "https://app.read.ai/analytics/meetings/01HFYH0A6JM4R7MZ2E6X5T9BNP",
    platform: "zoom",
    platform_id: "987654321",
    owner: { name: "Alice Example", email: "alice@example.com" },
    participants: [
      { name: "Alice Example", email: "alice@example.com", invited: true, attended: true },
      { name: "Bob Example", email: "bob@example.com", invited: true, attended: true },
    ],
    summary: "We reviewed project timelines.",
    topics: ["Roadmap"],
    action_items: [{ text: "Send launch notes", assignee: { name: "Bob Example" } }],
    metrics: { read_score: 0.9 },
    transcript: {
      turns: [
        {
          speaker: { name: "Alice Example", email: "alice@example.com" },
          text: "Let's start with project updates.",
          start_time_ms: 1_733_800_000_000,
          end_time_ms: 1_733_800_005_000,
        },
        {
          speaker: { name: "Bob Example", email: "bob@example.com" },
          text: "The import connector is ready.",
          start_time_ms: 1_733_800_012_000,
          end_time_ms: 1_733_800_018_000,
        },
      ],
    },
  };

  it("normalizes Read.ai API meetings into canonical recordings", () => {
    const canonical = readAiMeetingToCanonical(meeting);

    expect(canonical).toMatchObject({
      externalId: "01HFYH0A6JM4R7MZ2E6X5T9BNP",
      sourceApp: "read-ai",
      title: "Weekly status sync",
      recordingStartTime: "2024-12-10T03:06:40.000Z",
      recordingEndTime: "2024-12-10T04:06:40.000Z",
      durationSeconds: 3600,
      sourceUrl: "https://app.read.ai/analytics/meetings/01HFYH0A6JM4R7MZ2E6X5T9BNP",
      recordedByEmail: "alice@example.com",
      participantEmails: ["alice@example.com", "bob@example.com"],
    });
    expect(canonical.fullTranscript).toBe(
      "[0:00] Alice Example: Let's start with project updates.\n\n[0:12] Bob Example: The import connector is ready.",
    );
    expect(canonical.summary).toContain("We reviewed project timelines.");
    expect(canonical.summary).toContain("- Send launch notes");
    expect(canonical.sourceMetadata).toMatchObject({
      read_ai_meeting_id: "01HFYH0A6JM4R7MZ2E6X5T9BNP",
      read_ai_platform: "zoom",
      read_ai_action_items: ["Send launch notes (assignee: Bob Example)"],
      read_ai_topics: ["Roadmap"],
      read_ai_metrics: { read_score: 0.9 },
    });
  });

  it("normalizes webhook-style speaker_blocks", () => {
    const canonical = readAiMeetingToCanonical({
      id: "01WEBHOOK",
      title: "Webhook payload",
      start_time_ms: 1_733_800_000_000,
      transcript: {
        speaker_blocks: [
          {
            speaker_name: "Speaker One",
            words: [{ text: "Hello" }, { text: "there." }],
            start_time_ms: 1_733_800_003_000,
          },
        ],
      },
    });

    expect(canonical.fullTranscript).toBe("[0:03] Speaker One: Hello there.");
  });

  it("throws for meetings without transcript text", () => {
    expect(() =>
      readAiMeetingToCanonical({
        id: "01EMPTY",
        title: "Empty",
        start_time_ms: 1_733_800_000_000,
        transcript: { turns: [] },
      }),
    ).toThrow(/no transcript text/);
  });
});

describe("read-ai client", () => {
  it("uses bearer auth, date filters, clamped limit, and cursor pagination", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ object: "list", has_more: true, data: [] }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    await listMeetings({
      token: "secret-token",
      limit: 50,
      cursor: "01LAST",
      startTimeMsGte: 1_733_800_000_000,
      startTimeMsLte: 1_733_900_000_000,
      expand: ["transcript", "summary"],
      fetchImpl,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("https://api.read.ai/v1/meetings");
    expect(String(url)).toContain("limit=10");
    expect(String(url)).toContain("cursor=01LAST");
    expect(String(url)).toContain("start_time_ms.gte=1733800000000");
    expect(String(url)).toContain("start_time_ms.lte=1733900000000");
    expect(String(url)).toContain("expand%5B%5D=transcript");
    expect(String(url)).toContain("expand%5B%5D=summary");
    expect(init).toMatchObject({
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
      },
    });
  });

  it("clamps list limits to Read.ai's documented maximum", () => {
    expect(clampReadAiLimit(0)).toBe(1);
    expect(clampReadAiLimit(8)).toBe(8);
    expect(clampReadAiLimit(100)).toBe(10);
  });
});
