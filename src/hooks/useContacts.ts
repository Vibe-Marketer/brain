import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { requireUser } from "@/lib/auth-utils";
import type { 
  Contact, 
  ContactCallAppearance, 
  UserContactSettings,
  ContactWithCallCount,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contacts";
import type { CalendarInvitee } from "@/types/meetings";

// Re-export types for consumers
export type { 
  Contact, 
  ContactCallAppearance, 
  UserContactSettings,
  ContactWithCallCount,
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

interface ParticipantStatsRow {
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

export function buildContactParticipantStats(
  participants: ParticipantStatsRow[],
  recordingTimeMap: Map<string, string | null>,
): Record<string, ContactParticipantStats> {
  const grouped = new Map<string, Map<string, { invited: boolean; attended: boolean }>>();

  for (const participant of participants) {
    if (!participant.email) continue;

    const email = normalizeEmail(participant.email);
    const recordingId = participant.recording_id;
    const sources = participant.sources ?? [];
    const invited =
      participant.participant_type === "attendee" ||
      sources.includes("calendar_invitees");
    const attended =
      participant.participant_type === "speaker" ||
      participant.participant_type === "host" ||
      sources.includes("recorded_by") ||
      sources.includes("transcript") ||
      sources.includes("mcp_manual");

    const byRecording = grouped.get(email) ?? new Map<string, { invited: boolean; attended: boolean }>();
    const existing = byRecording.get(recordingId) ?? { invited: false, attended: false };
    byRecording.set(recordingId, {
      invited: existing.invited || invited,
      attended: existing.attended || attended,
    });
    grouped.set(email, byRecording);
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

      // Collect all contact emails for participant stats lookup
      const contactEmails = (contactsData || [])
        .map(c => c.email)
        .filter(Boolean);

      // Query call_participants for deduped invited/attended counts and accurate last_seen_at.
      const participantStats: Record<string, ContactParticipantStats> = {};

      if (contactEmails.length > 0) {
        const { data: participants } = await supabase
          .from("call_participants")
          .select("email, participant_type, recording_id, sources")
          .eq("organization_id", orgId!)
          .in("email", contactEmails);

        if (participants && participants.length > 0) {
          // Get recording timestamps for accurate last_seen_at (batch to avoid URL length limit)
          const recordingIds = [...new Set(participants.map(p => p.recording_id))];
          const recordingTimeMap = new Map<string, string | null>();
          const BATCH_SIZE = 200;
          for (let i = 0; i < recordingIds.length; i += BATCH_SIZE) {
            const batch = recordingIds.slice(i, i + BATCH_SIZE);
            const { data: recordings } = await supabase
              .from("recordings")
              .select("id, recording_start_time")
              .eq("organization_id", orgId!)
              .in("id", batch);
            (recordings || []).forEach(r => {
              recordingTimeMap.set(r.id, r.recording_start_time);
            });
          }

          Object.assign(
            participantStats,
            buildContactParticipantStats(participants, recordingTimeMap),
          );
        }
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
        };
      });

      return contactsWithCounts;
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
    mutationFn: async () => {
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
        return { totalImported: 0, totalSkipped: 0, totalCalls: 0 };
      }

      // Get recording timestamps for last_seen_at (batch to avoid URL length limit)
      const recordingIds = [...new Set(participants.map(p => p.recording_id))];
      const recordingTimeMap = new Map<string, string | null>();
      const BATCH = 200;
      for (let i = 0; i < recordingIds.length; i += BATCH) {
        const batch = recordingIds.slice(i, i + BATCH);
        const { data: recordings } = await supabase
          .from("recordings")
          .select("id, recording_start_time")
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
        .select("id, email")
        .eq("user_id", user.id)
        .eq("org_id", orgId!);

      const existingEmailMap = new Map<string, string>();
      (existingContacts || []).forEach(c => {
        existingEmailMap.set(c.email, c.id);
      });

      let totalImported = 0;
      let totalSkipped = 0;
      const contactIdMap = new Map<string, string>();

      for (const [email, attendee] of attendeeMap) {
        if (existingEmailMap.has(email)) {
          const contactId = existingEmailMap.get(email)!;
          contactIdMap.set(email, contactId);

          await supabase
            .from("contacts")
            .update({
              last_seen_at: attendee.lastSeenAt,
              name: attendee.name || undefined,
            })
            .eq("id", contactId);

          totalSkipped++;
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

          contactIdMap.set(email, newContact.id);
          totalImported++;
        }
      }

      return { totalImported, totalSkipped, totalCalls: recordingIds.length };
    },
    onSuccess: ({ totalImported, totalSkipped, totalCalls }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list(orgId ?? undefined) });
      if (totalImported > 0) {
        toast.success(`Imported ${totalImported} new contact${totalImported > 1 ? "s" : ""} from ${totalCalls} calls`);
      } else if (totalSkipped > 0) {
        toast.info(`All ${totalSkipped} attendees already exist as contacts`);
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
    importAllContacts: () => importAllContactsMutation.mutateAsync(),
    
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
