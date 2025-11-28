import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupTranscriptsBySpeaker } from "@/lib/transcriptUtils";
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
  const isHostedByUser = userSettings?.host_email && call?.recorded_by_email &&
    userSettings.host_email.toLowerCase() === call.recorded_by_email.toLowerCase();

  // Fetch transcripts for this call - always fetch fresh to show updates
  // For unsynced meetings, use the provided transcript data instead of querying DB
  const { data: allTranscripts } = useQuery({
    queryKey: queryKeys.calls.transcripts(call?.recording_id),
    queryFn: async () => {
      if (!call) return [];

      // If this is an unsynced meeting with provided transcripts, use those
      if (call.unsyncedTranscripts) {
        return call.unsyncedTranscripts;
      }

      // PRIMARY METHOD: Parse from full_transcript field (complete data, single query)
      const { data: callData, error: callError } = await supabase
        .from("fathom_calls")
        .select("full_transcript")
        .eq("recording_id", call.recording_id)
        .single();

      if (callError) {
        logger.error("Error fetching full_transcript", callError);
      }

      // Parse full_transcript into segments
      if (callData?.full_transcript) {
        const segmentRegex = /\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+([^\n]+)/g;
        const segments = [];
        let match;
        let segmentIndex = 0;

        while ((match = segmentRegex.exec(callData.full_transcript)) !== null) {
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

        // Fetch speaker email mapping from fathom_transcripts to restore email data
        const { data: speakerData, error: speakerError } = await supabase
          .from("fathom_transcripts")
          .select("speaker_name, speaker_email")
          .eq("recording_id", call.recording_id);

        if (!speakerError && speakerData) {
          // Create speaker name -> email mapping (use first non-null email for each speaker)
          const speakerEmailMap = new Map<string, string>();
          speakerData.forEach((row: any) => {
            if (row.speaker_email && !speakerEmailMap.has(row.speaker_name)) {
              speakerEmailMap.set(row.speaker_name, row.speaker_email);
            }
          });

          // Apply email mapping to parsed segments
          segments.forEach(segment => {
            const email = speakerEmailMap.get(segment.speaker_name);
            if (email) {
              segment.speaker_email = email;
            }
          });

          logger.info(`Parsed ${segments.length} segments with ${speakerEmailMap.size} speaker email mappings`);
        } else {
          logger.info(`Parsed ${segments.length} segments from full_transcript (no email mapping available)`);
        }

        return segments;
      }

      // FALLBACK METHOD: Fetch from fathom_transcripts with pagination to handle 10K limit
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
    enabled: open && !!call,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Process transcripts to use edited values when available and filter deleted
  const transcripts = allTranscripts?.filter((t: any) => !t.is_deleted).map((t: any) => ({
    ...t,
    display_text: t.edited_text || t.text,
    display_speaker_name: t.edited_speaker_name || t.speaker_name,
    display_speaker_email: t.edited_speaker_email || t.speaker_email,
    has_edits: !!(t.edited_text || t.edited_speaker_name)
  })) || [];

  const editedCount = allTranscripts?.filter((t: any) => t.edited_text || t.edited_speaker_name).length || 0;
  const deletedCount = allTranscripts?.filter((t: any) => t.is_deleted).length || 0;
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

  // Fetch categories for this call
  const { data: callCategories } = useQuery({
    queryKey: queryKeys.calls.categories(call?.recording_id),
    queryFn: async () => {
      if (!call) return [];
      const { data, error } = await supabase
        .from("call_category_assignments")
        .select(`
          category_id,
          call_categories (
            id,
            name,
            icon
          )
        `)
        .eq("call_recording_id", call.recording_id);
      if (error) throw error;
      return data?.map(d => d.call_categories).filter(Boolean) || [];
    },
    enabled: open && !!call,
  });

  // Fetch tags for this call
  const { data: callTags } = useQuery({
    queryKey: queryKeys.calls.tags(call?.recording_id),
    queryFn: async () => {
      if (!call) return [];
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
        .eq("call_recording_id", call.recording_id);
      if (error) throw error;
      return data?.map(d => d.transcript_tags).filter(Boolean) || [];
    },
    enabled: open && !!call,
  });

  // Fetch unique speakers from transcripts and enrich with calendar invitee data
  const { data: callSpeakers } = useQuery({
    queryKey: queryKeys.calls.speakers(call?.recording_id),
    queryFn: async () => {
      if (!call) return [];
      const { data: transcriptData, error } = await supabase
        .from("fathom_transcripts")
        .select("speaker_name, speaker_email")
        .eq("recording_id", call.recording_id);

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
        // If we don't have an email from transcript, try to match with calendar invitees
        if (!email && call.calendar_invitees) {
          const matchedInvitee = call.calendar_invitees.find((inv: any) =>
            inv.matched_speaker_display_name === name ||
            inv.name === name
          );
          if (matchedInvitee) {
            email = matchedInvitee.email;
          }
        }
        return {
          speaker_name: name,
          speaker_email: email
        };
      });

      return speakers;
    },
    enabled: open && !!call,
  });

  return {
    userSettings,
    allTranscripts: allTranscripts || [],
    transcripts,
    callCategories: callCategories || [],
    callTags: callTags || [],
    callSpeakers: callSpeakers || [],
    transcriptStats,
    editedCount,
    deletedCount,
    hasTranscriptChanges,
    isHostedByUser,
  };
}
