import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupTranscriptsBySpeaker, parseYouTubeTranscript, isYouTubeTranscriptFormat } from "@/lib/transcriptUtils";
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

  // Calculate if call is hosted by user
  const isHostedByUser = Boolean(
    userSettings?.host_email &&
    call?.recorded_by_email &&
    userSettings.host_email.toLowerCase() === call.recorded_by_email.toLowerCase()
  );

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

      // PRIMARY METHOD: Use full_transcript from the Meeting object (already loaded from recordings table)
      // This works for both legacy (fathom_calls) and new pipeline (recordings) calls.
      let fullTranscript = call.full_transcript || null;

      // FALLBACK for legacy numeric IDs: try fathom_calls
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

      // FALLBACK for UUID-based recordings: fetch full_transcript from recordings table.
      // The list query omits full_transcript to reduce payload — fetch it lazily here.
      if (!fullTranscript && typeof call.recording_id === 'string') {
        const { data: recData, error: recError } = await supabase
          .from("recordings")
          .select("full_transcript")
          .eq("id", call.recording_id)
          .maybeSingle();

        if (recError) {
          logger.error("Error fetching full_transcript from recordings", recError);
        }
        fullTranscript = recData?.full_transcript || null;
      }

      // Parse full_transcript into segments
      if (fullTranscript) {
        const segmentRegex = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+([^\n]+)/g;
        const segments = [];
        let match;
        let segmentIndex = 0;

        while ((match = segmentRegex.exec(fullTranscript)) !== null) {
          segments.push({
            id: `parsed-${segmentIndex}`,
            recording_id: call.recording_id,
            timestamp: match[1] || '',
            speaker_name: (match[2] || '').trim(),
            speaker_email: null, // Will be populated from speaker mapping below
            text: (match[3] || '').trim(),
            edited_text: null,
            edited_speaker_name: null,
            edited_speaker_email: null,
            is_deleted: false,
            created_at: new Date().toISOString(),
          });
          segmentIndex++;
        }

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

        // Apply email mapping to parsed segments
        if (speakerEmailMap.size > 0) {
          segments.forEach(segment => {
            const email = speakerEmailMap.get(segment.speaker_name);
            if (email) {
              segment.speaker_email = email;
            }
          });
        }

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
  const { data: callCategories } = useQuery({
    queryKey: queryKeys.calls.categories(call?.recording_id),
    queryFn: async () => {
      if (!call || !userId) return [];
      // Use composite key (recording_id, user_id) for lookup
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
        .eq("recording_id", call.recording_id)
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map(d => d.call_tags).filter(Boolean) || [];
    },
    enabled: open && !!call && !!userId,
  });

  // Fetch tags for this call
  const { data: callTags } = useQuery({
    queryKey: queryKeys.calls.tags(call?.recording_id),
    queryFn: async () => {
      if (!call || !userId) return [];
      // Use composite key (recording_id, user_id) for lookup
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
        .eq("recording_id", call.recording_id)
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map(d => d.transcript_tags).filter(Boolean) || [];
    },
    enabled: open && !!call && !!userId,
  });

  // Fetch unique speakers from transcripts and enrich with calendar invitee data
  const { data: callSpeakers } = useQuery({
    queryKey: queryKeys.calls.speakers(call?.recording_id),
    queryFn: async () => {
      if (!call || !userId) return [];
      // Use composite key (recording_id, user_id) for lookup
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
        // If we don't have an email from transcript, try to match with calendar invitees
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
    // fathom_transcripts.recording_id is BIGINT — only query for legacy numeric IDs.
    enabled: open && !!call && !!userId && typeof call?.recording_id === 'number',
  });

  // For non-numeric IDs (new pipeline), callSpeakers query is disabled.
  // Fall back to speakers derived from the already-fetched allTranscripts.
  const speakersFromTranscripts = useMemo((): Speaker[] => {
    if (callSpeakers && callSpeakers.length > 0) return callSpeakers;
    if (!allTranscripts || allTranscripts.length === 0) return [];

    const speakerMap = new Map<string, string | null>();
    allTranscripts.forEach((t) => {
      const name = t.speaker_name;
      if (!name) return;
      if (!speakerMap.has(name)) {
        speakerMap.set(name, t.speaker_email ?? null);
      } else if (t.speaker_email && !speakerMap.get(name)) {
        speakerMap.set(name, t.speaker_email);
      }
    });

    return Array.from(speakerMap.entries()).map(([speaker_name, speaker_email]) => ({
      speaker_name,
      speaker_email,
    }));
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
