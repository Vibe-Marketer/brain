import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/lib/auth-utils", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { buildContactParticipantStats } from "../useContacts";
import { buildUniqueContactsByName, mergeCallSpeakers } from "../useCallDetailQueries";

describe("people participant metrics", () => {
  it("dedupes call counts by recording and derives invited/attended from sources", () => {
    const stats = buildContactParticipantStats(
      [
        {
          email: "Daniel@Example.com",
          participant_type: "host",
          recording_id: "rec-newer",
          sources: ["calendar_invitees", "recorded_by"],
        },
        {
          email: "daniel@example.com",
          participant_type: "speaker",
          recording_id: "rec-newer",
          sources: ["transcript"],
        },
        {
          email: "daniel@example.com",
          participant_type: "attendee",
          recording_id: "rec-older",
          sources: ["calendar_invitees"],
        },
      ],
      new Map([
        ["rec-newer", "2026-06-02T15:00:00.000Z"],
        ["rec-older", "2026-05-30T15:00:00.000Z"],
      ]),
    );

    expect(stats["daniel@example.com"]).toEqual({
      invited: 2,
      attended: 1,
      callCount: 2,
      lastCallAt: "2026-06-02T15:00:00.000Z",
    });
  });

  it("uses transcript-only source rows as attended calls", () => {
    const stats = buildContactParticipantStats(
      [
        {
          email: "speaker@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees", "transcript"],
        },
      ],
      new Map([["rec-1", "2026-06-01T10:00:00.000Z"]]),
    );

    expect(stats["speaker@example.com"]).toMatchObject({
      invited: 1,
      attended: 1,
      callCount: 1,
    });
  });

  it("matches name-only participants to a uniquely named contact for email recovery", () => {
    const contactsByName = buildUniqueContactsByName([
      {
        id: "contact-1",
        name: "Avery Taylor",
        email: "avery@example.com",
        contact_type: null,
        last_seen_at: null,
        track_health: false,
        notes: null,
        tags: null,
      },
      {
        id: "contact-2",
        name: "Jordan Lee",
        email: "jordan-a@example.com",
        contact_type: null,
        last_seen_at: null,
        track_health: false,
        notes: null,
        tags: null,
      },
      {
        id: "contact-3",
        name: "Jordan Lee",
        email: "jordan-b@example.com",
        contact_type: null,
        last_seen_at: null,
        track_health: false,
        notes: null,
        tags: null,
      },
    ]);

    expect(contactsByName.get("avery taylor")?.email).toBe("avery@example.com");
    expect(contactsByName.has("jordan lee")).toBe(false);
  });

  it("merges transcript speaker emails into existing name-only participant rows", () => {
    const speakers = mergeCallSpeakers(
      [
        {
          speaker_name: "Daniel Marama",
          speaker_email: null,
          participant_type: "speaker",
        },
      ],
      [
        {
          speaker_name: "Daniel Marama",
          speaker_email: "daniel@example.com",
        },
      ],
    );

    expect(speakers).toEqual([
      {
        speaker_name: "Daniel Marama",
        speaker_email: "daniel@example.com",
        participant_type: "speaker",
      },
    ]);
  });
});
