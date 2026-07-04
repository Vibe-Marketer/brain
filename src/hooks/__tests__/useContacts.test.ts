import { describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
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
  dedupeContactsByEmail,
  fetchAllParticipantStatsRows,
  isAttendedParticipant,
  splitContactName,
} from "@/hooks/useContacts";

describe("fetchAllParticipantStatsRows", () => {
  it("pages through all call_participants rows instead of stopping at Supabase's first 1000", async () => {
    const pageOne = Array.from({ length: 1000 }, (_, index) => ({
      name: "Paged Contact",
      email: "paged@example.com",
      participant_type: "attendee",
      recording_id: `rec-${index}`,
      sources: ["calendar_invitees"],
      recordings: { recording_start_time: "2026-06-01T10:00:00.000Z" },
    }));
    const pageTwo = [
      {
        name: "Paged Contact",
        email: "paged@example.com",
        participant_type: "attendee",
        recording_id: "rec-1000",
        sources: ["calendar_invitees"],
        recordings: { recording_start_time: "2026-06-02T10:00:00.000Z" },
      },
    ];
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: pageOne, error: null })
      .mockResolvedValueOnce({ data: pageTwo, error: null });
    const eq = vi.fn(() => ({ range }));
    const select = vi.fn(() => ({ eq }));
    supabaseMock.from.mockReturnValue({ select });

    const rows = await fetchAllParticipantStatsRows("org-1");

    expect(rows).toHaveLength(1001);
    expect(supabaseMock.from).toHaveBeenCalledWith("call_participants");
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

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

  it("splits comma-separated participant emails into separate contact stats", () => {
    const stats = buildContactParticipantStats(
      [
        {
          email: "andrew@aisimple.co,naegele412@gmail.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
      ],
      new Map([["rec-1", "2026-06-02T10:00:00.000Z"]]),
    );

    expect(stats["andrew@aisimple.co"]).toMatchObject({
      invited: 1,
      callCount: 1,
    });
    expect(stats["naegele412@gmail.com"]).toMatchObject({
      invited: 1,
      callCount: 1,
    });
    expect(stats["andrew@aisimple.co,naegele412@gmail.com"]).toBeUndefined();
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

  it("does not create a bogus contact for comma-separated participant emails", () => {
    const participantStats = buildContactParticipantStats(
      [
        {
          name: null,
          email: "andrew@aisimple.co,naegele412@gmail.com",
          participant_type: "attendee",
          recording_id: "rec-1",
          sources: ["calendar_invitees"],
        },
      ],
      new Map([["rec-1", "2026-06-02T10:00:00.000Z"]]),
    );

    const contacts = buildParticipantDerivedContacts({
      participants: [
        {
          name: null,
          email: "andrew@aisimple.co,naegele412@gmail.com",
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

    expect(contacts.map((contact) => contact.email).sort()).toEqual([
      "andrew@aisimple.co",
      "naegele412@gmail.com",
    ]);
    expect(contacts.some((contact) => contact.email.includes(","))).toBe(false);
  });
});

describe("dedupeContactsByEmail", () => {
  it("keeps one rendered contact per normalized email", () => {
    const contacts = dedupeContactsByEmail([
      {
        id: "contact-1",
        user_id: "user-1",
        org_id: "org-1",
        email: "PHILL@example.com",
        name: null,
        track_health: false,
        contact_type: null,
        last_seen_at: "2026-06-01T00:00:00.000Z",
        last_call_recording_id: null,
        health_alert_threshold_days: null,
        last_alerted_at: null,
        notes: null,
        tags: null,
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
        call_count: 1,
        invited_count: 1,
        attended_count: 0,
        source: "contact",
      },
      {
        id: "contact-2",
        user_id: "user-1",
        org_id: "org-1",
        email: "phill@example.com",
        name: "Phill Example",
        track_health: false,
        contact_type: null,
        last_seen_at: "2026-06-03T00:00:00.000Z",
        last_call_recording_id: null,
        health_alert_threshold_days: null,
        last_alerted_at: null,
        notes: null,
        tags: null,
        created_at: "2026-06-02T00:00:00.000Z",
        updated_at: "2026-06-03T00:00:00.000Z",
        call_count: 3,
        invited_count: 2,
        attended_count: 2,
        source: "contact",
      },
    ]);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      id: "contact-2",
      email: "phill@example.com",
      name: "Phill Example",
      last_seen_at: "2026-06-03T00:00:00.000Z",
      call_count: 3,
    });
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
