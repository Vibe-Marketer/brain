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

import {
  buildParticipantDerivedContacts,
  buildContactParticipantStats,
  buildUniqueContactEmailByName,
  composeContactName,
  isAttendedParticipant,
  splitContactName,
} from "@/hooks/useContacts";

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

  it("uses the shared attended predicate for speaker and transcript rows", () => {
    expect(isAttendedParticipant({ participant_type: "speaker", sources: [] })).toBe(true);
    expect(isAttendedParticipant({ participant_type: "host", sources: [] })).toBe(true);
    expect(isAttendedParticipant({ participant_type: "attendee", sources: ["transcript"] })).toBe(true);
    expect(isAttendedParticipant({ participant_type: "attendee", sources: ["calendar_invitees"] })).toBe(false);
  });
});

describe("buildParticipantDerivedContacts", () => {
  it("adds read-only people from call participants when no contact row exists", () => {
    const participantStats = buildContactParticipantStats(
      [
        {
          name: "Avery Taylor",
          email: "avery@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
        {
          name: "Avery Taylor",
          email: "avery@example.com",
          participant_type: "speaker",
          recording_id: "rec-1",
          sources: ["transcript"],
        },
      ],
      new Map([["rec-1", "2026-06-02T10:00:00.000Z"]]),
    );

    const contacts = buildParticipantDerivedContacts({
      participants: [
        {
          name: "Avery Taylor",
          email: "avery@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
      ],
      existingContacts: [],
      participantStats,
      userId: "user-1",
      orgId: "org-1",
    });

    expect(contacts).toMatchObject([
      {
        id: "participant:avery@example.com",
        email: "avery@example.com",
        name: "Avery Taylor",
        org_id: "org-1",
        user_id: "user-1",
        source: "participant",
        call_count: 1,
        invited_count: 1,
        attended_count: 1,
        last_seen_at: "2026-06-02T10:00:00.000Z",
      },
    ]);
  });

  it("does not duplicate persisted contacts by email", () => {
    const contacts = buildParticipantDerivedContacts({
      participants: [
        {
          name: "Avery Taylor",
          email: "avery@example.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
      ],
      existingContacts: [
        {
          id: "contact-1",
          user_id: "user-1",
          org_id: "org-1",
          email: "avery@example.com",
          name: "Avery Taylor",
          track_health: false,
          contact_type: null,
          last_seen_at: null,
          last_call_recording_id: null,
          health_alert_threshold_days: null,
          last_alerted_at: null,
          notes: null,
          tags: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      participantStats: {},
      userId: "user-1",
      orgId: "org-1",
    });

    expect(contacts).toEqual([]);
  });
});

describe("contact name helpers", () => {
  it("splits a stored full name into editable first and last fields", () => {
    expect(splitContactName("Daniel Marama")).toEqual({
      firstName: "Daniel",
      lastName: "Marama",
    });
    expect(splitContactName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
    expect(splitContactName(null)).toEqual({
      firstName: "",
      lastName: "",
    });
  });

  it("composes first and last name fields back into the stored name", () => {
    expect(composeContactName(" Daniel ", " Marama ")).toBe("Daniel Marama");
    expect(composeContactName("Daniel", "")).toBe("Daniel");
    expect(composeContactName("", "")).toBeNull();
  });
});
