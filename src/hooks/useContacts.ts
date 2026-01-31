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

/**
 * Hook for managing contacts database
 * Provides CRUD operations and import functionality from call attendees
 */
export function useContacts() {
  const queryClient = useQueryClient();

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Fetch all contacts with call counts
   */
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: queryKeys.contacts.list(),
    queryFn: async () => {
      const user = await requireUser();

      // Get contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false, nullsFirst: false });

      if (contactsError) throw contactsError;

      // Get call counts for each contact
      const { data: appearanceCounts, error: countsError } = await supabase
        .from("contact_call_appearances")
        .select("contact_id")
        .eq("user_id", user.id);

      if (countsError) throw countsError;

      // Count appearances per contact
      const countMap: Record<string, number> = {};
      (appearanceCounts || []).forEach(({ contact_id }) => {
        countMap[contact_id] = (countMap[contact_id] || 0) + 1;
      });

      // Merge counts into contacts
      const contactsWithCounts: ContactWithCallCount[] = (contactsData || []).map((contact) => ({
        ...contact,
        call_count: countMap[contact.id] || 0,
      }));

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
   * Create a new contact
   */
  const createContactMutation = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const user = await requireUser();
      const email = normalizeEmail(input.email);

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list() });
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts.list() });

      // Snapshot previous value
      const previousContacts = queryClient.getQueryData<ContactWithCallCount[]>(
        queryKeys.contacts.list()
      );

      // Optimistically update
      if (previousContacts) {
        queryClient.setQueryData<ContactWithCallCount[]>(
          queryKeys.contacts.list(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list() });
      toast.success("Contact updated");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(queryKeys.contacts.list(), context.previousContacts);
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts.list() });

      // Snapshot previous value
      const previousContacts = queryClient.getQueryData<ContactWithCallCount[]>(
        queryKeys.contacts.list()
      );

      // Optimistically remove
      if (previousContacts) {
        queryClient.setQueryData<ContactWithCallCount[]>(
          queryKeys.contacts.list(),
          previousContacts.filter((contact) => contact.id !== id)
        );
      }

      return { previousContacts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list() });
      toast.success("Contact deleted");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousContacts) {
        queryClient.setQueryData(queryKeys.contacts.list(), context.previousContacts);
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
   * Import contacts from a specific call's attendees
   */
  const importFromCallMutation = useMutation({
    mutationFn: async (recordingId: number) => {
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

        // Upsert contact - update last_seen if newer
        const { data: existingContact, error: checkError } = await supabase
          .from("contacts")
          .select("id, last_seen_at")
          .eq("user_id", user.id)
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
          // Create new contact
          const { data: newContact, error: insertError } = await supabase
            .from("contacts")
            .insert({
              user_id: user.id,
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
            appeared_at: call.recording_start_time,
          }, {
            onConflict: "contact_id,recording_id,user_id",
          });
      }

      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list() });
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
   * Import all contacts from all calls
   */
  const importAllContactsMutation = useMutation({
    mutationFn: async () => {
      const user = await requireUser();

      // Get all calls with attendees
      const { data: calls, error: callsError } = await supabase
        .from("fathom_calls")
        .select("recording_id, calendar_invitees, recording_start_time")
        .eq("user_id", user.id)
        .not("calendar_invitees", "is", null);

      if (callsError) throw callsError;
      if (!calls || calls.length === 0) {
        return { totalImported: 0, totalSkipped: 0, totalCalls: 0 };
      }

      let totalImported = 0;
      let totalSkipped = 0;
      const processedEmails = new Set<string>();
      const contactIdMap = new Map<string, string>(); // email -> contact_id

      // First pass: collect all unique attendees and their most recent appearance
      const attendeeMap = new Map<string, {
        email: string;
        name: string | null;
        lastSeenAt: string | null;
        lastRecordingId: number;
        appearances: Array<{ recordingId: number; appearedAt: string | null }>;
      }>();

      for (const call of calls) {
        const invitees = call.calendar_invitees as CalendarInvitee[];
        if (!invitees) continue;

        for (const invitee of invitees) {
          if (!invitee.email) continue;
          const email = normalizeEmail(invitee.email);

          const existing = attendeeMap.get(email);
          const callTime = call.recording_start_time;

          if (!existing) {
            attendeeMap.set(email, {
              email,
              name: invitee.name || null,
              lastSeenAt: callTime,
              lastRecordingId: call.recording_id,
              appearances: [{ recordingId: call.recording_id, appearedAt: callTime }],
            });
          } else {
            // Add this appearance
            existing.appearances.push({ recordingId: call.recording_id, appearedAt: callTime });
            
            // Update last seen if more recent
            if (callTime && (!existing.lastSeenAt || new Date(callTime) > new Date(existing.lastSeenAt))) {
              existing.lastSeenAt = callTime;
              existing.lastRecordingId = call.recording_id;
              if (invitee.name && !existing.name) {
                existing.name = invitee.name;
              }
            }
          }
        }
      }

      // Get existing contacts for this user
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, email")
        .eq("user_id", user.id);

      const existingEmailMap = new Map<string, string>();
      (existingContacts || []).forEach(c => {
        existingEmailMap.set(c.email, c.id);
      });

      // Process attendees
      for (const [email, attendee] of attendeeMap) {
        if (existingEmailMap.has(email)) {
          // Update existing contact
          const contactId = existingEmailMap.get(email)!;
          contactIdMap.set(email, contactId);
          
          await supabase
            .from("contacts")
            .update({
              last_seen_at: attendee.lastSeenAt,
              last_call_recording_id: attendee.lastRecordingId,
            })
            .eq("id", contactId);
          
          totalSkipped++;
        } else {
          // Create new contact
          const { data: newContact, error } = await supabase
            .from("contacts")
            .insert({
              user_id: user.id,
              email,
              name: attendee.name,
              last_seen_at: attendee.lastSeenAt,
              last_call_recording_id: attendee.lastRecordingId,
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

        // Add all appearances
        const contactId = contactIdMap.get(email);
        if (contactId) {
          const appearances = attendee.appearances.map(a => ({
            contact_id: contactId,
            recording_id: a.recordingId,
            user_id: user.id,
            appeared_at: a.appearedAt,
          }));

          // Batch upsert appearances
          await supabase
            .from("contact_call_appearances")
            .upsert(appearances, {
              onConflict: "contact_id,recording_id,user_id",
            });
        }
      }

      return { totalImported, totalSkipped, totalCalls: calls.length };
    },
    onSuccess: ({ totalImported, totalSkipped, totalCalls }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.list() });
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
