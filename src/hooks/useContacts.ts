import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { chunkArray, IN_FILTER_CHUNK_SIZE } from "@/lib/chunk";
import { queryKeys } from "@/lib/query-config";
import { requireUser } from "@/lib/auth-utils";
import type { 
  Contact, 
  ContactCallAppearance, 
  UserContactSettings,
  ContactWithCallCount,
  ContactCallHistoryItem,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contacts";
import type { CalendarInvitee } from "@/types/meetings";

interface ImportAllContactsOptions {
  silent?: boolean;
}

// Re-export types for consumers
export type { 
  Contact, 
  ContactCallAppearance, 
  UserContactSettings,
  ContactWithCallCount,
  ContactCallHistoryItem,
  ContactType,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contacts";

/**
 * Normalize email for consistent storage
 * - Lowercase
 * - Trim whitespace
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeEmailCandidates(email: string | null | undefined): string[] {
  if (!email) return [];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const rawEmail of email.split(",")) {
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized || !normalized.includes("@") || seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

interface ParticipantStatsRow {
  name?: string | null;
  email: string | null;
  participant_type: string | null;
  recording_id: string;
  sources: string[] | null;
}

interface ContactParticipantStats {
  invited: number;
  attended: number;
  callCount: number;
  lastCallAt: string | null;
}

interface ParticipantContactIdentity {
  email: string;
  name: string | null;
}

interface ContactCallParticipantRow {
  name: string | null;
  email: string | null;
  participant_type: string | null;
  recording_id: string;
  sources: string[] | null;
}

interface ContactCallRecordingRow {
  id: string;
  fathom_provider_id: number | null;
  title: string | null;
  recording_start_time: string | null;
  duration: number | null;
}

const PARTICIPANT_STATS_PAGE_SIZE = 1000;

interface ParticipantStatsQueryRow extends ParticipantStatsRow {
  recordings?:
    | { recording_start_time: string | null }
    | Array<{ recording_start_time: string | null }>
    | null;
}

export async function fetchAllParticipantStatsRows(orgId: string): Promise<ParticipantStatsQueryRow[]> {
  const rows: ParticipantStatsQueryRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PARTICIPANT_STATS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("call_participants")
      .select("name, email, participant_type, recording_id, sources, recordings(recording_start_time)")
      .eq("organization_id", orgId)
      .range(from, to);

    if (error) throw error;

    const page = (data ?? []) as ParticipantStatsQueryRow[];
    rows.push(...page);

    if (page.length < PARTICIPANT_STATS_PAGE_SIZE) break;
    from += PARTICIPANT_STATS_PAGE_SIZE;
  }

  return rows;
}

export function buildContactParticipantStats(
  participants: ParticipantStatsRow[],
  recordingTimeMap: Map<string, string | null>,
  contactEmailByName: Map<string, string> = new Map(),
): Record<string, ContactParticipantStats> {
  const grouped = new Map<string, Map<string, { invited: boolean; attended: boolean }>>();

  for (const participant of participants) {
    const matchedEmails = participant.email
      ? normalizeEmailCandidates(participant.email)
      : participant.name
        ? normalizeEmailCandidates(contactEmailByName.get(participant.name.trim().toLowerCase()))
        : [];
    if (matchedEmails.length === 0) continue;

    const recordingId = participant.recording_id;
    const sources = participant.sources ?? [];
    const invited =
      participant.participant_type === "attendee" ||
      sources.includes("calendar_invitees");
    const attended = isAttendedParticipant(participant);

    for (const email of matchedEmails) {
      const byRecording = grouped.get(email) ?? new Map<string, { invited: boolean; attended: boolean }>();
      const existing = byRecording.get(recordingId) ?? { invited: false, attended: false };
      byRecording.set(recordingId, {
        invited: existing.invited || invited,
        attended: existing.attended || attended,
      });
      grouped.set(email, byRecording);
    }
  }

  const statsByEmail: Record<string, ContactParticipantStats> = {};

  grouped.forEach((byRecording, email) => {
    let invited = 0;
    let attended = 0;
    let lastCallAt: string | null = null;

    byRecording.forEach((flags, recordingId) => {
      if (flags.invited) invited++;
      if (flags.attended) attended++;

      const callTime = recordingTimeMap.get(recordingId) ?? null;
      if (callTime && (!lastCallAt || new Date(callTime) > new Date(lastCallAt))) {
        lastCallAt = callTime;
      }
    });

    statsByEmail[email] = {
      invited,
      attended,
      callCount: byRecording.size,
      lastCallAt,
    };
  });

  return statsByEmail;
}

export function buildUniqueContactEmailByName(
  contacts: Array<{ name: string | null; email: string }>,
): Map<string, string> {
  const emailByName = new Map<string, string>();
  const duplicateNames = new Set<string>();

  contacts.forEach((contact) => {
    const nameKey = contact.name?.trim().toLowerCase();
    if (!nameKey) return;

    if (emailByName.has(nameKey)) {
      duplicateNames.add(nameKey);
      emailByName.delete(nameKey);
      return;
    }

    if (!duplicateNames.has(nameKey)) {
      emailByName.set(nameKey, contact.email);
    }
  });

  return emailByName;
}

export function buildParticipantDerivedContacts(params: {
  participants: ParticipantStatsRow[];
  existingContacts: Contact[];
  participantStats: Record<string, ContactParticipantStats>;
  userId: string;
  orgId: string;
}): ContactWithCallCount[] {
  const existingEmails = new Set(
    params.existingContacts.map((contact) => normalizeEmail(contact.email)),
  );
  const identitiesByEmail = new Map<string, ParticipantContactIdentity>();

  for (const participant of params.participants) {
    const emails = normalizeEmailCandidates(participant.email);
    if (emails.length === 0) continue;

    for (const email of emails) {
      if (existingEmails.has(email)) continue;

      const existing = identitiesByEmail.get(email);
      if (!existing) {
        identitiesByEmail.set(email, {
          email,
          name: emails.length === 1 ? participant.name?.trim() || null : null,
        });
        continue;
      }

      if (!existing.name && emails.length === 1 && participant.name?.trim()) {
        identitiesByEmail.set(email, {
          ...existing,
          name: participant.name.trim(),
        });
      }
    }
  }

  return Array.from(identitiesByEmail.values()).map((identity) => {
    const stats = params.participantStats[identity.email];
    const timestamp = stats?.lastCallAt ?? new Date(0).toISOString();

    return {
      id: `participant:${identity.email}`,
      user_id: params.userId,
      org_id: params.orgId,
      email: identity.email,
      name: identity.name,
      track_health: false,
      contact_type: null,
      last_seen_at: stats?.lastCallAt ?? null,
      last_call_recording_id: null,
      health_alert_threshold_days: null,
      last_alerted_at: null,
      notes: null,
      tags: null,
      created_at: timestamp,
      updated_at: timestamp,
      call_count: stats?.callCount ?? 0,
      invited_count: stats?.invited ?? 0,
      attended_count: stats?.attended ?? 0,
      source: "participant",
    };
  });
}

function latestTimestamp(first: string | null, second: string | null): string | null {
  if (!first) return second;
  if (!second) return first;
  return second > first ? second : first;
}

export function dedupeContactsByEmail<T extends ContactWithCallCount>(contacts: T[]): T[] {
  const contactsByEmail = new Map<string, T>();

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    const existing = contactsByEmail.get(email);
    if (!existing) {
      contactsByEmail.set(email, contact);
      continue;
    }

    const keepCurrent =
      (!existing.name && !!contact.name) ||
      (existing.source === "participant" && contact.source === "contact");
    const base = keepCurrent ? contact : existing;
    const other = keepCurrent ? existing : contact;

    contactsByEmail.set(email, {
      ...base,
      name: base.name || other.name,
      track_health: base.track_health || other.track_health,
      last_seen_at: latestTimestamp(base.last_seen_at, other.last_seen_at),
      updated_at: latestTimestamp(base.updated_at, other.updated_at) ?? base.updated_at,
      call_count: Math.max(base.call_count ?? 0, other.call_count ?? 0),
      invited_count: Math.max(base.invited_count ?? 0, other.invited_count ?? 0),
      attended_count: Math.max(base.attended_count ?? 0, other.attended_count ?? 0),
    });
  }

  return Array.from(contactsByEmail.values());
}

export function isAttendedParticipant(participant: {
  participant_type: string | null;
  sources: string[] | null;
}): boolean {
  const sources = participant.sources ?? [];
  return (
    participant.participant_type === "speaker" ||
    participant.participant_type === "host" ||
    sources.includes("recorded_by") ||
    sources.includes("transcript") ||
    sources.includes("mcp_manual")
  );
}

export function splitContactName(name: string | null): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function composeContactName(firstName: string, lastName: string): string | null {
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  return fullName || null;
}

function buildContactCallHistory(
  participants: ContactCallParticipantRow[],
  recordings: ContactCallRecordingRow[],
): ContactCallHistoryItem[] {
  const recordingMap = new Map(recordings.map((recording) => [recording.id, recording]));
  const byRecording = new Map<string, ContactCallHistoryItem>();

  for (const participant of participants) {
    const recording = recordingMap.get(participant.recording_id);
    if (!recording) continue;

    const existing = byRecording.get(participant.recording_id);
    const sources = participant.sources ?? [];
    const invited =
      participant.participant_type === "attendee" ||
      sources.includes("calendar_invitees");
    const attended = isAttendedParticipant(participant);

    byRecording.set(participant.recording_id, {
      recording_id: recording.id,
      fathom_provider_id: recording.fathom_provider_id,
      title: recording.title || "Untitled call",
      recording_start_time: recording.recording_start_time,
      duration: recording.duration,
      invited: (existing?.invited ?? false) || invited,
      attended: (existing?.attended ?? false) || attended,
      participant_name: existing?.participant_name ?? participant.name,
      participant_email: existing?.participant_email ?? participant.email,
    });
  }

  return Array.from(byRecording.values()).sort((a, b) => {
    const aTime = a.recording_start_time ? new Date(a.recording_start_time).getTime() : 0;
    const bTime = b.recording_start_time ? new Date(b.recording_start_time).getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Fetch recording rows for a contact's call history by canonical recording UUID.
 *
 * Chunks the `.in("id", ...)` lookup to avoid PostgREST URL-length limits:
 * an unbounded UUID list for accounts with many recordings exceeds ~8KB and
 * returns HTTP 400, silently breaking contact call history (QA b96e351b).
 * Chunks run in parallel and results are merged in chunk order; final
 * ordering is applied downstream by buildContactCallHistory.
 *
 * Exported for regression testing.
 */
export async function fetchContactCallRecordings(
  orgId: string,
  recordingIds: string[],
): Promise<ContactCallRecordingRow[]> {
  if (recordingIds.length === 0) return [];

  const chunks = chunkArray(recordingIds, IN_FILTER_CHUNK_SIZE);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("recordings")
        .select("id, fathom_provider_id, title, recording_start_time, duration")
        .eq("organization_id", orgId)
        .in("id", chunk);

      if (error) throw error;
      return (data ?? []) as ContactCallRecordingRow[];
    }),
  );

  return results.flat();
}

export function useContactCallHistory(
  orgId: string | null | undefined,
  contact: ContactWithCallCount | null,
  includeNameOnlyMatch = false,
) {
  return useQuery<ContactCallHistoryItem[]>({
    queryKey: [
      ...queryKeys.contacts.appearances(contact?.id ?? "none"),
      contact?.email ?? "",
      contact?.name ?? "",
      includeNameOnlyMatch,
    ],
    enabled: !!orgId && !!contact?.email,
    queryFn: async () => {
      if (!orgId || !contact?.email) return [];

      const email = normalizeEmail(contact.email);
      const { data: emailParticipants, error: emailError } = await supabase
        .from("call_participants")
        .select("name, email, participant_type, recording_id, sources")
        .eq("organization_id", orgId)
        .eq("email", email);

      if (emailError) throw emailError;

      let nameParticipants: ContactCallParticipantRow[] = [];
      if (includeNameOnlyMatch && contact.name?.trim()) {
        const { data, error } = await supabase
          .from("call_participants")
          .select("name, email, participant_type, recording_id, sources")
          .eq("organization_id", orgId)
          .is("email", null)
          .eq("name", contact.name.trim());

        if (error) throw error;
        nameParticipants = (data ?? []) as ContactCallParticipantRow[];
      }

      const participants = [
        ...((emailParticipants ?? []) as ContactCallParticipantRow[]),
        ...nameParticipants,
      ];
      const recordingIds = [...new Set(participants.map((participant) => participant.recording_id))];
      if (recordingIds.length === 0) return [];

      const recordings = await fetchContactCallRecordings(orgId, recordingIds);

      return buildContactCallHistory(participants, recordings);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook for managing contacts database
 * Provides CRUD operations and import functionality from call attendees.
 *
 * @param orgId - The active organization ID used to scope all contact queries.
 *   Pass this from useOrgContext().activeOrgId. When undefined the hook still
 *   renders safely but all queries are disabled until an orgId is available.
 */
export function useContacts(orgId?: string | null) {
  const queryClient = useQueryClient();

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Fetch all contacts with call counts, scoped to the active org.
   */
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: queryKeys.contacts.list(orgId ?? undefined),
    enabled: !!orgId,
    queryFn: async () => {
      const user = await requireUser();

      // Get contacts scoped to the active org
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .eq("org_id", orgId!)
        .order("last_seen_at", { ascending: false, nullsFirst: false });

      if (contactsError) throw contactsError;

      // Get call counts and appearance timestamps for each contact in this org
      const { data: appearanceRows, error: countsError } = await supabase
        .from("contact_call_appearances")
        .select("contact_id, appeared_at")
        .eq("user_id", user.id)
        .eq("org_id", orgId!);

      if (countsError) throw countsError;

      // Count appearances and track max appeared_at per contact
      const countMap: Record<string, number> = {};
      const appearanceLastSeenMap: Record<string, string> = {};
      (appearanceRows || []).forEach(({ contact_id, appeared_at }) => {
        countMap[contact_id] = (countMap[contact_id] || 0) + 1;
        if (appeared_at) {
          if (!appearanceLastSeenMap[contact_id] || appeared_at > appearanceLastSeenMap[contact_id]) {
            appearanceLastSeenMap[contact_id] = appeared_at;
          }
        }
      });

      // Query call_participants for deduped invited/attended counts and accurate last_seen_at.
      const participantStats: Record<string, ContactParticipantStats> = {};
      let participants: ParticipantStatsRow[] = [];

      // Embed recording_start_time directly through the call_participants → recordings
      // foreign key (call_participants_recording_id_fkey) instead of a separate, batched
      // `recordings .in("id", ...)` wave. Those follow-up lookups fired LAST in the
      // contacts-load chain, so for accounts with many calls they were routinely still
      // in flight when the user navigated away — the browser then aborted them, surfacing
      // as "Request failed" (net::ERR_ABORTED) network findings on every route the nightly
      // crawler hard-navigated through (QA 6c5f7725). One embedded request also replaces
      // the prior 1 + ceil(N/100) round trips, so contacts load faster for real users too.
      const participantRows = await fetchAllParticipantStatsRows(orgId!);

      if (participantRows && participantRows.length > 0) {
        participants = participantRows as ParticipantStatsRow[];

        // Build the timestamp map from the embedded recordings rows. A to-one FK embed
        // returns an object (or null); guard for an array shape defensively.
        const recordingTimeMap = new Map<string, string | null>();
        participantRows.forEach((participant) => {
          const embedded = participant.recordings;
          const recording = Array.isArray(embedded) ? embedded[0] : embedded;
          if (participant.recording_id && recording) {
            recordingTimeMap.set(participant.recording_id, recording.recording_start_time);
          }
        });

        Object.assign(
          participantStats,
          buildContactParticipantStats(
            participants,
            recordingTimeMap,
            buildUniqueContactEmailByName(contactsData || []),
          ),
        );
      }

      // Merge counts and participant stats into contacts
      const contactsWithCounts: ContactWithCallCount[] = (contactsData || []).map((contact) => {
        const stats = participantStats[contact.email.toLowerCase()];

        // Pick the most recent date from all available sources:
        // 1. call_participants joined with recordings (most authoritative)
        // 2. contact_call_appearances.appeared_at (populated during import)
        // 3. contacts.last_seen_at (stored value, may be stale)
        const candidates: string[] = [];
        if (stats?.lastCallAt) candidates.push(stats.lastCallAt);
        if (appearanceLastSeenMap[contact.id]) candidates.push(appearanceLastSeenMap[contact.id]);
        if (contact.last_seen_at) candidates.push(contact.last_seen_at);

        const accurateLastSeen = candidates.length > 0
          ? candidates.reduce((latest, curr) => curr > latest ? curr : latest)
          : null;

        return {
          ...contact,
          last_seen_at: accurateLastSeen,
          call_count: stats?.callCount ?? countMap[contact.id] ?? 0,
          invited_count: stats?.invited ?? 0,
          attended_count: stats?.attended ?? 0,
          source: "contact",
        };
      });

      const participantDerivedContacts = buildParticipantDerivedContacts({
        participants,
        existingContacts: (contactsData || []) as Contact[],
        participantStats,
        userId: user.id,
        orgId: orgId!,
      });

      return dedupeContactsByEmail([...contactsWithCounts, ...participantDerivedContacts]).sort((a, b) => {
        const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        return bTime - aTime;
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  /**
   * Fetch user contact settings
   */
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: queryKeys.contacts.settings(),
    queryFn: async () => {
      const user = await requireUser();

      const { data, error } = await supabase
        .from("user_contact_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Return default settings if not found
      if (!data) {
        return {
          user_id: user.id,
          track_all_contacts: true,
          default_health_threshold_days: 14,
        } as UserContactSettings;
      }

      return data as UserContactSettings;
    },
    staleTime: 1000 * 60 * 5,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  /**
   * Create a new contact in the active org
   */
  const createContactMutation = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      if (!orgId) throw new Error("No active organization selected");
      const user = await requireUser();
      const email = normalizeEmail(input.email);

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
          org_id: orgId,
          email,
          name: input.name || null,
          contact_type: input.contact_type || null,
          track_health: input.track_health ?? false,
          notes: input.notes || null,
          tags: input.tags || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      toast.success(`Contact "${newContact.name || newContact.email}" created`);
    },
    onError: (error: Error) => {
      logger.error("Error creating contact", error);
      if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
        toast.error("A contact with this email already exists");
      } else {
        toast.error("Failed to create contact");
      }
    },
  });

  /**
   * Update an existing contact
   */
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateContactInput }) => {
      const { error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      const listKey = queryKeys.contacts.list(orgId ?? undefined);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: listKey });

      // Snapshot previous value
      const previousContacts = queryClient.getQueryData<ContactWithCallCount[]>(listKey);

      // Optimistically update
      if (previousContacts) {
        queryClient.setQueryData<ContactWithCallCount[]>(
          listKey,
          previousContacts.map((contact) =>
            contact.id === id
              ? { ...contact, ...updates, updated_at: new Date().toISOString() }
              : contact
          )
        );
      }

      return { previousContacts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      toast.success("Contact updated");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(queryKeys.contacts.list(orgId ?? undefined), context.previousContacts);
      }
      logger.error("Error updating contact", error);
      toast.error("Failed to update contact");
    },
  });

  /**
   * Delete a contact
   */
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onMutate: async (id) => {
      const listKey = queryKeys.contacts.list(orgId ?? undefined);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: listKey });

      // Snapshot previous value
      const previousContacts = queryClient.getQueryData<ContactWithCallCount[]>(listKey);

      // Optimistically remove
      if (previousContacts) {
        queryClient.setQueryData<ContactWithCallCount[]>(
          listKey,
          previousContacts.filter((contact) => contact.id !== id)
        );
      }

      return { previousContacts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      toast.success("Contact deleted");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(queryKeys.contacts.list(orgId ?? undefined), context.previousContacts);
      }
      logger.error("Error deleting contact", error);
      toast.error("Failed to delete contact");
    },
  });

  /**
   * Update user contact settings
   */
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<UserContactSettings, "user_id">>) => {
      const user = await requireUser();

      const { error } = await supabase
        .from("user_contact_settings")
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts.settings() });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<UserContactSettings>(
        queryKeys.contacts.settings()
      );

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData<UserContactSettings>(
          queryKeys.contacts.settings(),
          { ...previousSettings, ...updates }
        );
      }

      return { previousSettings };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.settings() });
      toast.success("Settings updated");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.contacts.settings(), context.previousSettings);
      }
      logger.error("Error updating settings", error);
      toast.error("Failed to update settings");
    },
  });

  /**
   * Import contacts from a specific call's attendees into the active org
   */
  const importFromCallMutation = useMutation({
    mutationFn: async (recordingId: number) => {
      if (!orgId) throw new Error("No active organization selected");
      const user = await requireUser();

      // Get call details with attendees
      const { data: call, error: callError } = await supabase
        .from("fathom_calls")
        .select("calendar_invitees, recording_start_time")
        .eq("recording_id", recordingId)
        .eq("user_id", user.id)
        .single();

      if (callError) throw callError;
      if (!call?.calendar_invitees) {
        return { imported: 0, skipped: 0 };
      }

      const invitees = call.calendar_invitees as CalendarInvitee[];
      let imported = 0;
      let skipped = 0;

      for (const invitee of invitees) {
        if (!invitee.email) {
          skipped++;
          continue;
        }

        const email = normalizeEmail(invitee.email);

        // Upsert contact - update last_seen if newer (scoped to this org)
        const { data: existingContact, error: checkError } = await supabase
          .from("contacts")
          .select("id, last_seen_at")
          .eq("user_id", user.id)
          .eq("org_id", orgId!)
          .eq("email", email)
          .maybeSingle();

        if (checkError) throw checkError;

        let contactId: string;

        if (existingContact) {
          // Update last_seen_at if this call is more recent
          const currentLastSeen = existingContact.last_seen_at;
          const callTime = call.recording_start_time;
          
          if (!currentLastSeen || (callTime && new Date(callTime) > new Date(currentLastSeen))) {
            await supabase
              .from("contacts")
              .update({
                last_seen_at: callTime,
                last_call_recording_id: recordingId,
                name: invitee.name || undefined, // Only update name if we have one
              })
              .eq("id", existingContact.id);
          }
          
          contactId = existingContact.id;
          skipped++;
        } else {
          // Create new contact in the active org
          const { data: newContact, error: insertError } = await supabase
            .from("contacts")
            .insert({
              user_id: user.id,
              org_id: orgId!,
              email,
              name: invitee.name || null,
              last_seen_at: call.recording_start_time,
              last_call_recording_id: recordingId,
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          contactId = newContact.id;
          imported++;
        }

        // Add appearance record (upsert to avoid duplicates)
        await supabase
          .from("contact_call_appearances")
          .upsert({
            contact_id: contactId,
            recording_id: recordingId,
            user_id: user.id,
            org_id: orgId!,
            appeared_at: call.recording_start_time,
          }, {
            onConflict: "contact_id,recording_id,user_id",
          });
      }

      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      if (imported > 0) {
        toast.success(`Imported ${imported} new contact${imported > 1 ? "s" : ""}`);
      } else if (skipped > 0) {
        toast.info("All attendees already exist as contacts");
      } else {
        toast.info("No attendees found in this call");
      }
    },
    onError: (error) => {
      logger.error("Error importing from call", error);
      toast.error("Failed to import contacts from call");
    },
  });

  /**
   * Import all contacts from all calls into the active org.
   * Pulls from call_participants (canonical source) which includes
   * calendar invitees, hosts, and speakers -- not just calendar_invitees.
   */
  const importAllContactsMutation = useMutation({
    mutationFn: async (options?: ImportAllContactsOptions) => {
      if (!orgId) throw new Error("No active organization selected");
      const user = await requireUser();

      // Pull from call_participants (canonical source: invitees + hosts + speakers)
      const { data: participants, error: participantsError } = await supabase
        .from("call_participants")
        .select("email, name, recording_id")
        .eq("organization_id", orgId!)
        .not("email", "is", null);

      if (participantsError) throw participantsError;
      if (!participants || participants.length === 0) {
        // No call_participants for this org — this org has no calls yet.
        // The legacy fathom_calls fallback was removed because fathom_raw_calls
        // has no org_id column, causing it to import contacts from ALL user orgs
        // into the wrong org (the "226 contacts from wrong source" bug).
        return { totalImported: 0, totalUpdated: 0, totalSkipped: 0, totalCalls: 0, silent: options?.silent ?? false };
      }

      // Get recording timestamps for last_seen_at (batch to avoid URL length limit)
      const recordingIds = [...new Set(participants.map(p => p.recording_id))];
      const recordingTimeMap = new Map<string, string | null>();
      const BATCH = IN_FILTER_CHUNK_SIZE;
      for (let i = 0; i < recordingIds.length; i += BATCH) {
        const batch = recordingIds.slice(i, i + BATCH);
        const { data: recordings } = await supabase
          .from("recordings")
          .select("id, recording_start_time")
          .eq("organization_id", orgId!)
          .in("id", batch);
        (recordings || []).forEach(r => {
          recordingTimeMap.set(r.id, r.recording_start_time);
        });
      }

      // Collect unique people by email
      const attendeeMap = new Map<string, {
        email: string;
        name: string | null;
        lastSeenAt: string | null;
        recordingIds: string[];
      }>();

      for (const p of participants) {
        if (!p.email) continue;
        const email = normalizeEmail(p.email);
        const callTime = recordingTimeMap.get(p.recording_id) ?? null;

        const existing = attendeeMap.get(email);
        if (!existing) {
          attendeeMap.set(email, {
            email,
            name: p.name || null,
            lastSeenAt: callTime,
            recordingIds: [p.recording_id],
          });
        } else {
          existing.recordingIds.push(p.recording_id);
          if (callTime && (!existing.lastSeenAt || new Date(callTime) > new Date(existing.lastSeenAt))) {
            existing.lastSeenAt = callTime;
          }
          if (p.name && !existing.name) {
            existing.name = p.name;
          }
        }
      }

      // Get existing contacts for this user in the active org
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, email, name, last_seen_at")
        .eq("user_id", user.id)
        .eq("org_id", orgId!);

      const existingEmailMap = new Map<string, { id: string; name: string | null; last_seen_at: string | null }>();
      (existingContacts || []).forEach(c => {
        existingEmailMap.set(normalizeEmail(c.email), {
          id: c.id,
          name: c.name,
          last_seen_at: c.last_seen_at,
        });
      });

      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      for (const [email, attendee] of attendeeMap) {
        const existingContact = existingEmailMap.get(email);
        if (existingContact) {
          const updates: { last_seen_at?: string | null; name?: string } = {};
          if (
            attendee.lastSeenAt &&
            (!existingContact.last_seen_at || new Date(attendee.lastSeenAt) > new Date(existingContact.last_seen_at))
          ) {
            updates.last_seen_at = attendee.lastSeenAt;
          }
          if (!existingContact.name && attendee.name) {
            updates.name = attendee.name;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("contacts")
              .update(updates)
              .eq("id", existingContact.id);
            totalUpdated++;
          } else {
            totalSkipped++;
          }

        } else {
          const { data: newContact, error } = await supabase
            .from("contacts")
            .insert({
              user_id: user.id,
              org_id: orgId!,
              email,
              name: attendee.name,
              last_seen_at: attendee.lastSeenAt,
            })
            .select("id")
            .single();

          if (error) {
            logger.warn("Failed to insert contact", { email, error });
            continue;
          }

          void newContact;
          totalImported++;
        }
      }

      return {
        totalImported,
        totalUpdated,
        totalSkipped,
        totalCalls: recordingIds.length,
        silent: options?.silent ?? false,
      };
    },
    onSuccess: ({ totalImported, totalUpdated, totalSkipped, totalCalls, silent }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      if (silent) return;
      if (totalImported > 0) {
        toast.success(`Synced ${totalImported} new contact${totalImported > 1 ? "s" : ""} from ${totalCalls} calls`);
      } else if (totalUpdated > 0) {
        toast.success(`Updated ${totalUpdated} contact${totalUpdated > 1 ? "s" : ""}`);
      } else if (totalSkipped > 0) {
        toast.info(`All ${totalSkipped} contacts are up to date`);
      } else {
        toast.info("No attendees found in any calls");
      }
    },
    onError: (error) => {
      logger.error("Error importing all contacts", error);
      toast.error("Failed to import contacts");
    },
  });

  /**
   * Get call appearances for a specific contact
   */
  const getContactAppearances = async (contactId: string): Promise<ContactCallAppearance[]> => {
    const { data, error } = await supabase
      .from("contact_call_appearances")
      .select("*")
      .eq("contact_id", contactId)
      .order("appeared_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ContactCallAppearance[];
  };

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Data
    contacts,
    settings,
    
    // Loading states
    isLoading: contactsLoading || settingsLoading,
    contactsLoading,
    settingsLoading,
    
    // Mutations
    createContact: (input: CreateContactInput) => createContactMutation.mutateAsync(input),
    updateContact: (id: string, updates: UpdateContactInput) => 
      updateContactMutation.mutateAsync({ id, updates }),
    deleteContact: (id: string) => deleteContactMutation.mutateAsync(id),
    updateSettings: (updates: Partial<Omit<UserContactSettings, "user_id">>) =>
      updateSettingsMutation.mutateAsync(updates),
    importFromCall: (recordingId: number) => importFromCallMutation.mutateAsync(recordingId),
    importAllContacts: (options?: ImportAllContactsOptions) => importAllContactsMutation.mutateAsync(options),
    
    // Loading states for mutations
    isCreating: createContactMutation.isPending,
    isUpdating: updateContactMutation.isPending,
    isDeleting: deleteContactMutation.isPending,
    isImporting: importFromCallMutation.isPending || importAllContactsMutation.isPending,
    
    // Utilities
    getContactAppearances,
    refetchContacts,
    refetchSettings,
  };
}
