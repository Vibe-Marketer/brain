import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import { mergeCallSpeakers } from "@/hooks/useCallDetailQueries";

describe("mergeCallSpeakers", () => {
  it("preserves participant emails when transcript rows only have names", () => {
    const merged = mergeCallSpeakers(
      [
        {
          speaker_name: "Daniel Smith",
          speaker_email: "daniel@example.com",
          participant_type: "attendee",
        },
      ],
      [
        {
          speaker_name: "Daniel Smith",
          speaker_email: null,
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      speaker_name: "Daniel Smith",
      speaker_email: "daniel@example.com",
      participant_type: "attendee",
    });
  });

  it("adds transcript-only speakers without duplicating existing named participants", () => {
    const merged = mergeCallSpeakers(
      [
        {
          speaker_name: "Daniel Smith",
          speaker_email: "daniel@example.com",
          participant_type: "attendee",
        },
      ],
      [
        {
          speaker_name: "Daniel Smith",
          speaker_email: null,
        },
        {
          speaker_name: "Alex Guest",
          speaker_email: null,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          speaker_name: "Daniel Smith",
          speaker_email: "daniel@example.com",
        }),
        expect.objectContaining({
          speaker_name: "Alex Guest",
          speaker_email: null,
          participant_type: "speaker",
        }),
      ]),
    );
  });

  it("upgrades a name-only participant when the transcript later provides an email", () => {
    const merged = mergeCallSpeakers(
      [
        {
          speaker_name: "Alex Guest",
          speaker_email: null,
          participant_type: "speaker",
        },
      ],
      [
        {
          speaker_name: "Alex Guest",
          speaker_email: "alex@example.com",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      speaker_name: "Alex Guest",
      speaker_email: "alex@example.com",
      participant_type: "speaker",
    });
  });

  it("does not merge two email-identified people who share a display name", () => {
    const merged = mergeCallSpeakers(
      [
        {
          speaker_name: "Alex Guest",
          speaker_email: "alex-a@example.com",
          participant_type: "attendee",
        },
        {
          speaker_name: "Alex Guest",
          speaker_email: "alex-b@example.com",
          participant_type: "attendee",
        },
      ],
      [
        {
          speaker_name: "Alex Guest",
          speaker_email: null,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker_email: "alex-a@example.com" }),
        expect.objectContaining({ speaker_email: "alex-b@example.com" }),
      ]),
    );
  });
});
