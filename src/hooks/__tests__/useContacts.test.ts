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

import { buildContactParticipantStats, buildUniqueContactEmailByName } from "@/hooks/useContacts";

describe("buildContactParticipantStats", () => {
  it("counts invited and attended per recording using participant sources", () => {
    const stats = buildContactParticipantStats(
      [
        {
          email: "daniel@example.com",
          participant_type: "speaker",
          recording_id: "rec-1",
          sources: ["calendar_invitees", "transcript"],
        },
        {
          email: "daniel@example.com",
          participant_type: "host",
          recording_id: "rec-2",
          sources: ["recorded_by"],
        },
        {
          email: "daniel@example.com",
          participant_type: "attendee",
          recording_id: "rec-3",
          sources: ["calendar_invitees"],
        },
      ],
      new Map([
        ["rec-1", "2026-06-01T10:00:00.000Z"],
        ["rec-2", "2026-06-02T10:00:00.000Z"],
        ["rec-3", "2026-05-31T10:00:00.000Z"],
      ]),
    );

    expect(stats["daniel@example.com"]).toEqual({
      invited: 2,
      attended: 2,
      callCount: 3,
      lastCallAt: "2026-06-02T10:00:00.000Z",
    });
  });

  it("dedupes multiple participant rows from the same recording", () => {
    const stats = buildContactParticipantStats(
      [
        {
          email: "alex@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
        {
          email: "alex@example.com",
          participant_type: "speaker",
          recording_id: "rec-1",
          sources: ["calendar_invitees", "transcript"],
        },
      ],
      new Map([["rec-1", "2026-06-02T10:00:00.000Z"]]),
    );

    expect(stats["alex@example.com"]).toEqual({
      invited: 1,
      attended: 1,
      callCount: 1,
      lastCallAt: "2026-06-02T10:00:00.000Z",
    });
  });

  it("counts name-only speaker rows when they match a unique contact name", () => {
    const contactEmailByName = buildUniqueContactEmailByName([
      { name: "Daniel Marama", email: "daniel@example.com" },
      { name: "Alex Guest", email: "alex-a@example.com" },
      { name: "Alex Guest", email: "alex-b@example.com" },
    ]);

    const stats = buildContactParticipantStats(
      [
        {
          name: "Daniel Marama",
          email: "daniel@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
        {
          name: "Daniel Marama",
          email: null,
          participant_type: "speaker",
          recording_id: "rec-1",
          sources: ["transcript"],
        },
        {
          name: "Alex Guest",
          email: null,
          participant_type: "speaker",
          recording_id: "rec-1",
          sources: ["transcript"],
        },
      ],
      new Map([["rec-1", "2026-06-02T10:00:00.000Z"]]),
      contactEmailByName,
    );

    expect(stats["daniel@example.com"]).toEqual({
      invited: 1,
      attended: 1,
      callCount: 1,
      lastCallAt: "2026-06-02T10:00:00.000Z",
    });
    expect(stats["alex-a@example.com"]).toBeUndefined();
    expect(stats["alex-b@example.com"]).toBeUndefined();
  });
});
