import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  groupTranscriptsBySpeaker,
  isYouTubeTranscriptFormat,
  normalizeTranscriptSegments,
  parseSpeakerTimestampTranscript,
  parseYouTubeTranscript,
} from "@/lib/transcriptUtils";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-config";
import { Meeting, TranscriptSegment, TranscriptSegmentDisplay, Speaker, Category } from "@/types";

interface UseCallDetailQueriesOptions {
  call: Meeting | null;
  userId?: string;
  open: boolean;
}

interface UseCallDetailQueriesResult {
  userSettings: { host_email: string | null } | null;
  allTranscripts: TranscriptSegment[];
  transcripts: TranscriptSegmentDisplay[];
  callCategories: Category[];
  callTags: Array<{ id: string; name: string; color: string }>;
  callSpeakers: Speaker[];
  transcriptStats: { characters: number; tokens: number; words: number };
  editedCount: number;
  deletedCount: number;
  hasTranscriptChanges: boolean;
  isHostedByUser: boolean;
}

interface ContactIdentity {
  id: string;
  name: string | null;
  email: string;
  contact_type: string | null;
  last_seen_at: string | null;
  track_health: boolean | null;
  notes: string | null;
  tags: string[] | null;
}

export function buildUniqueContactsByName(
  contacts: ContactIdentity[],
): Map<string, ContactIdentity> {
  const contactsByName = new Map<string, ContactIdentity>();
  const duplicateNames = new Set<string>();

  contacts.forEach((contact) => {
    const key = contact.name?.trim().toLowerCase();
    if (!key) return;

    if (contactsByName.has(key)) {
      duplicateNames.add(key);
      contactsByName.delete(key);
      return;
    }

    if (!duplicateNames.has(key)) {
      contactsByName.set(key, contact);
    }
  });

  return contactsByName;
}

function normalizeSpeakerName(name: string | null | undefined): string | null {
  const normalized = name?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function mergeCallSpeakers(
  callSpeakers: Speaker[] | undefined,
  transcriptSpeakers: Array<Pick<Speaker, "speaker_name" | "speaker_email">> | undefined,
): Speaker[] {
  const speakersByEmail = new Map<string, Speaker>();
  const speakersByName = new Map<string, Speaker>();
  const duplicateNames = new Set<string>();

  const indexSpeaker = (speaker: Speaker) => {
    const emailKey = speaker.speaker_email?.trim().toLowerCase();
    if (emailKey) {
      speakersByEmail.set(emailKey, speaker);
    }

    const nameKey = normalizeSpeakerName(speaker.speaker_name);
    if (nameKey) {
      const existingByName = speakersByName.get(nameKey);
      if (existingByName && existingByName !== speaker) {
        duplicateNames.add(nameKey);
        speakersByName.delete(nameKey);
        return;
      }

      if (duplicateNames.has(nameKey)) {
        return;
      }

      speakersByName.set(nameKey, speaker);
    }
  };

  callSpeakers?.forEach((speaker) => {
    indexSpeaker(speaker);
  });

  transcriptSpeakers?.forEach((speaker) => {
    const emailKey = speaker.speaker_email?.trim().toLowerCase();
    const nameKey = normalizeSpeakerName(speaker.speaker_name);
    const nameMatchedSpeaker =
      nameKey && !duplicateNames.has(nameKey)
        ? speakersByName.get(nameKey)
        : undefined;
    const existing =
      (emailKey ? speakersByEmail.get(emailKey) : undefined) ??
      nameMatchedSpeaker;

    if (!existing) {
      indexSpeaker({
        speaker_name: speaker.speaker_name,
        speaker_email: speaker.speaker_email,
        participant_type: "speaker",
      });
      return;
    }

    if (!existing.speaker_email && speaker.speaker_email) {
      existing.speaker_email = speaker.speaker_email;
      speakersByEmail.set(speaker.speaker_email.trim().toLowerCase(), existing);
    }
  });

  return Array.from(new Set([...speakersByEmail.values(), ...speakersByName.values()]));
}

export function useCallDetailQueries(options: UseCallDetailQueriesOptions): UseCallDetailQueriesResult {
  const { call, userId, open } = options;

  // Debug: Log when queries are executed
  // logger.info("useCallDetailQueries called", { callId: call?.recording_id, userId, open });

  // Fetch user settings to get host email
  const { data: userSettings } = useQuery({
    queryKey: queryKeys.user.settings(userId!),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("host_email")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId,
  });

  // Fetch all connected Fathom account emails for multi-account speaker matching
  const { data: connectedEmails } = useQuery({
    queryKey: ["import_sources_emails", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("import_sources")
        .select("account_email")
        .eq("source_app", "fathom")
        .eq("is_active", true);
      if (error) return [];
      return (data ?? []).map((r) => r.account_email?.toLowerCase()).filter(Boolean) as string[];
    },
    enabled: open && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate if call is hosted by user — checks host_email AND all connected Fathom accounts
  const isHostedByUser = (() => {
    const callEmail = call?.recorded_by_email?.toLowerCase();
    if (!callEmail) return false;
    if (userSettings?.host_email && userSettings.host_email.toLowerCase() === callEmail) return true;
    if (connectedEmails?.includes(callEmail)) return true;
    return false;
  })();

  // Fetch transcripts for this call - always fetch fresh to show updates
  // For unsynced meetings, use the provided transcript data instead of querying DB
  const { data: allTranscripts } = useQuery({
    queryKey: queryKeys.calls.transcripts(call?.recording_id),
    queryFn: async () => {
      if (!call || !userId) return [];

      // If this is an unsynced meeting with provided transcripts, use those
      if (call.unsyncedTranscripts) {
        return call.unsyncedTranscripts;
      }

      // PRIMARY METHOD: Use structured transcript_segments before falling back
      // to reparsing full_transcript. This preserves provider speaker identity.
      let structuredSegments = normalizeTranscriptSegments(
        call.transcript_segments,
        call.recording_id,
      );

      // SECONDARY METHOD: Use full_transcript from the Meeting object (already loaded from recordings table)
      // This works for both legacy (fathom_calls) and new pipeline (recordings) calls.
      let fullTranscript = call.full_transcript || null;

      // FALLBACK A: For UUID recordings where full_transcript or transcript_segments
      // were omitted from the Meeting object, fetch directly from recordings table.
      if (
        (structuredSegments.length === 0 || !fullTranscript) &&
        (call.canonical_uuid || typeof call.recording_id === 'string')
      ) {
        const uuid = call.canonical_uuid ?? (call.recording_id as string);
        const { data: recData, error: recError } = await supabase
          .from("recordings")
          .select("full_transcript, transcript_segments")
          .eq("id", uuid)
          .maybeSingle();

        if (recError) {
          logger.error("Error fetching transcript data from recordings", recError);
        }
        if (structuredSegments.length === 0) {
          structuredSegments = normalizeTranscriptSegments(
            recData?.transcript_segments,
            call.recording_id,
          );
        }
        fullTranscript = fullTranscript || recData?.full_transcript || null;
      }

      if (structuredSegments.length > 0) {
        logger.info(`Loaded ${structuredSegments.length} structured transcript segments`);
        return structuredSegments;
      }

      // FALLBACK B: For legacy numeric IDs, try fathom_calls
      if (!fullTranscript && typeof call.recording_id === 'number') {
        const { data: callData, error: callError } = await supabase
          .from("fathom_calls")
          .select("full_transcript")
          .eq("recording_id", call.recording_id)
          .eq("user_id", userId)
          .single();

        if (callError) {
          logger.error("Error fetching full_transcript from fathom_calls", callError);
        }
        fullTranscript = callData?.full_transcript || null;
      }

      // Parse full_transcript into segments
      if (fullTranscript) {
        // Build speaker email mapping from available sources
        const speakerEmailMap = new Map<string, string>();

        // Source 1: fathom_transcripts (only for legacy numeric recording IDs)
        if (typeof call.recording_id === 'number') {
          const { data: speakerData, error: speakerError } = await supabase
            .from("fathom_transcripts")
            .select("speaker_name, speaker_email")
            .eq("recording_id", call.recording_id)
            .eq("user_id", userId);

          if (!speakerError && speakerData) {
            speakerData.forEach((row: { speaker_name: string; speaker_email: string | null }) => {
              if (row.speaker_email && !speakerEmailMap.has(row.speaker_name)) {
                speakerEmailMap.set(row.speaker_name, row.speaker_email);
              }
            });
          }
        }

        // Source 2: calendar_invitees from Meeting object (works for all pipeline types)
        if (call.calendar_invitees) {
          for (const inv of call.calendar_invitees) {
            const name = inv.matched_speaker_display_name || inv.name;
            if (name && inv.email && !speakerEmailMap.has(name)) {
              speakerEmailMap.set(name, inv.email);
            }
          }
        }

        const segments = parseSpeakerTimestampTranscript(
          fullTranscript,
          call.recording_id,
          speakerEmailMap,
        );

        // If the Fathom/Zoom regex found no segments, try YouTube format
        if (segments.length === 0 && isYouTubeTranscriptFormat(fullTranscript)) {
          const ytSegments = parseYouTubeTranscript(fullTranscript, call.recording_id);
          logger.info(`Parsed ${ytSegments.length} YouTube transcript segments`);
          return ytSegments;
        }

        logger.info(`Parsed ${segments.length} segments with ${speakerEmailMap.size} speaker email mappings`);

        return segments;
      }

      // FALLBACK METHOD: Fetch from fathom_transcripts (only works for legacy numeric IDs)
      if (typeof call.recording_id !== 'number') {
        logger.info("No transcript available for non-legacy call");
        return [];
      }

      logger.info("full_transcript not available, using paginated query fallback");
      const segments = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("fathom_transcripts")
          .select("*")
          .eq("recording_id", call.recording_id)
          .eq("user_id", userId)
          .order("timestamp")
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          segments.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      logger.info(`Fetched ${segments.length} segments via pagination`);
      return segments;
    },
    enabled: open && !!call && !!userId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Process transcripts to use edited values when available and filter deleted
  const transcripts = useMemo(() => {
    return allTranscripts?.filter((t) => !t.is_deleted).map((t): TranscriptSegmentDisplay => ({
      ...t,
      display_text: t.edited_text || t.text,
      display_speaker_name: t.edited_speaker_name || t.speaker_name,
      display_speaker_email: t.edited_speaker_email || t.speaker_email,
      has_edits: !!(t.edited_text || t.edited_speaker_name)
    })) || [];
  }, [allTranscripts]);

  const editedCount = allTranscripts?.filter((t) => t.edited_text || t.edited_speaker_name).length || 0;
  const deletedCount = allTranscripts?.filter((t) => t.is_deleted).length || 0;
  const hasTranscriptChanges = editedCount > 0 || deletedCount > 0;

  // Calculate character and token counts for the entire transcript
  const transcriptStats = useMemo(() => {
    if (!transcripts || transcripts.length === 0) {
      return { characters: 0, tokens: 0, words: 0 };
    }

    // Build the full transcript text (grouped by speaker)
    const groups = groupTranscriptsBySpeaker(transcripts);
    let fullText = "";

    groups.forEach(group => {
      fullText += `${group.speaker}:\n`;
      group.messages.forEach(msg => {
        fullText += `${msg.text}\n`;
      });
      fullText += "\n";
    });

    const characters = fullText.length;
    const words = fullText.trim().split(/\s+/).length;
    // Token estimation: ~4 characters per token (common approximation for GPT models)
    const tokens = Math.ceil(characters / 4);

    return { characters, tokens, words };
  }, [transcripts]);

  // Fetch tags for this call (system tags like TEAM, etc.)
  // After migration 20260310125000, call_tag_assignments.recording_id is UUID.
  // Use canonical_uuid when available (covers both legacy-migrated and new recordings).
  const { data: callCategories } = useQuery({
    queryKey: [...queryKeys.calls.categories(call?.recording_id), call?.canonical_uuid],
    queryFn: async () => {
      if (!call || !userId) return [];
      // Resolve UUID — canonical_uuid is set by mapRecordingToMeeting for all recordings-table rows.
      // For UUID recordings recording_id is already a string; for legacy it's a number but
      // call_tag_assignments.recording_id is now UUID, so we must use the canonical UUID.
      const recordingUuid = call.canonical_uuid ?? (typeof call.recording_id === 'string' ? call.recording_id : null);
      if (!recordingUuid) return [];
      const { data, error } = await supabase
        .from("call_tag_assignments")
        .select(`
          tag_id,
          call_tags (
            id,
            name,
            color
          )
        `)
        .eq("recording_id", recordingUuid)
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map(d => d.call_tags).filter(Boolean) || [];
    },
    enabled: open && !!call && !!userId,
  });

  // Fetch tags for this call
  // After migration 20260310125000, transcript_tag_assignments.recording_id is UUID.
  const { data: callTags } = useQuery({
    queryKey: [...queryKeys.calls.tags(call?.recording_id), call?.canonical_uuid],
    queryFn: async () => {
      if (!call || !userId) return [];
      const recordingUuid = call.canonical_uuid ?? (typeof call.recording_id === 'string' ? call.recording_id : null);
      if (!recordingUuid) return [];
      const { data, error } = await supabase
        .from("transcript_tag_assignments")
        .select(`
          tag_id,
          transcript_tags (
            id,
            name,
            color
          )
        `)
        .eq("recording_id", recordingUuid)
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map(d => d.transcript_tags).filter(Boolean) || [];
    },
    enabled: open && !!call && !!userId,
  });

  // Fetch unique speakers from transcripts and enrich with calendar invitee data.
  // For UUID recordings: query call_participants (canonical table, migration #120).
  // For legacy numeric recordings: query fathom_transcripts (BIGINT recording_id).
  const { data: callSpeakers } = useQuery({
    queryKey: [...queryKeys.calls.speakers(call?.recording_id), call?.canonical_uuid],
    queryFn: async () => {
      if (!call || !userId) return [];

      // UUID recordings path: call_participants is the canonical source
      const recordingUuid = call.canonical_uuid ?? (typeof call.recording_id === 'string' ? call.recording_id : null);
      if (recordingUuid) {
        const { data, error } = await supabase
          .from("call_participants")
          .select("name, email, participant_type, organization_id")
          .eq("recording_id", recordingUuid);

        if (error) throw error;

        const participants = data || [];
        const participantEmails = [
          ...new Set(
            participants
              .map((p) => p.email)
              .filter((email): email is string => !!email),
          ),
        ];
        const participantNames = [
          ...new Set(
            participants
              .map((p) => p.name)
              .filter((name): name is string => !!name),
          ),
        ];
        const organizationId = participants[0]?.organization_id ?? null;

        let contactsByEmail = new Map<string, ContactIdentity>();
        let contactsByName = new Map<string, ContactIdentity>();

        const contactRows: ContactIdentity[] = [];

        if (organizationId && participantEmails.length > 0) {
          const { data: contacts, error: contactsError } = await supabase
            .from("contacts")
            .select("id, name, email, contact_type, last_seen_at, track_health, notes, tags")
            .eq("org_id", organizationId)
            .in("email", participantEmails);

          if (contactsError) throw contactsError;

          contactRows.push(...(contacts || []));
        }

        if (organizationId && participantNames.length > 0) {
          const { data: contacts, error: contactsError } = await supabase
            .from("contacts")
            .select("id, name, email, contact_type, last_seen_at, track_health, notes, tags")
            .eq("org_id", organizationId)
            .in("name", participantNames);

          if (contactsError) throw contactsError;

          contactRows.push(...(contacts || []));
        }

        if (contactRows.length > 0) {
          const uniqueContactsByEmail = new Map<string, ContactIdentity>();
          contactRows.forEach((contact) => {
            uniqueContactsByEmail.set(contact.email.toLowerCase(), contact);
          });

          contactsByEmail = new Map(
            Array.from(uniqueContactsByEmail.values()).map((contact) => [
              contact.email.toLowerCase(),
              contact,
            ]),
          );
          contactsByName = buildUniqueContactsByName(Array.from(uniqueContactsByEmail.values()));
        }

        return participants
          .filter((p) => p.name || p.email)
          .map((p) => {
            const contact =
              (p.email ? contactsByEmail.get(p.email.toLowerCase()) : undefined) ??
              (p.name ? contactsByName.get(p.name.trim().toLowerCase()) : undefined);
            return {
              speaker_name: p.name || contact?.name || p.email || "Unknown",
              speaker_email: p.email || contact?.email || null,
              participant_type: p.participant_type || null,
              contact_id: contact?.id || null,
              contact_type: contact?.contact_type || null,
              contact_last_seen_at: contact?.last_seen_at || null,
              contact_track_health: contact?.track_health ?? null,
              contact_notes: contact?.notes || null,
              contact_tags: contact?.tags || null,
            };
          });
      }

      // Legacy path: fathom_transcripts (BIGINT recording_id, numeric IDs only)
      if (typeof call.recording_id !== 'number') {
        return [];
      }

      const { data: transcriptData, error } = await supabase
        .from("fathom_transcripts")
        .select("speaker_name, speaker_email")
        .eq("recording_id", call.recording_id)
        .eq("user_id", userId);

      if (error) throw error;

      // Get unique speakers with their emails from transcripts
      const speakerMap = new Map();
      transcriptData?.forEach((t) => {
        if (!speakerMap.has(t.speaker_name)) {
          speakerMap.set(t.speaker_name, t.speaker_email || null);
        } else if (t.speaker_email && !speakerMap.get(t.speaker_name)) {
          speakerMap.set(t.speaker_name, t.speaker_email);
        }
      });

      // Enrich with calendar invitee data if email is missing
      const speakers = Array.from(speakerMap.entries()).map(([name, email]) => {
        let finalEmail = email;
        if (!finalEmail && call.calendar_invitees) {
          const matchedInvitee = call.calendar_invitees.find((inv) =>
            inv.matched_speaker_display_name === name ||
            inv.name === name
          );
          if (matchedInvitee) {
            finalEmail = matchedInvitee.email;
          }
        }
        return {
          speaker_name: name,
          speaker_email: finalEmail
        };
      });

      return speakers;
    },
    // Enabled for all recordings — UUID path uses call_participants, legacy path uses fathom_transcripts
    enabled: open && !!call && !!userId,
  });

  // Merge canonical participant rows with speakers parsed from the transcript.
  // Some provider calls only store the host/invitee in call_participants, while
  // the transcript contains additional ad-hoc speakers.
  const speakersFromTranscripts = useMemo((): Speaker[] => {
    return mergeCallSpeakers(callSpeakers, allTranscripts);
  }, [callSpeakers, allTranscripts]);

  return {
    userSettings,
    allTranscripts: allTranscripts || [],
    transcripts,
    callCategories: callCategories || [],
    callTags: callTags || [],
    callSpeakers: speakersFromTranscripts,
    transcriptStats,
    editedCount,
    deletedCount,
    hasTranscriptChanges,
    isHostedByUser,
  };
}
