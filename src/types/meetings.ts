/**
 * Core Meeting and Transcript Types
 * Used throughout the application for type-safe meeting data handling
 */

import type { SourceAlias, SourceId } from "@/config/source-registry";

export type MeetingSourcePlatform = SourceId | SourceAlias;

export interface CalendarInvitee {
  email: string;
  name?: string;
  /** Whether this invitee is external to the organization (Fathom field) */
  external?: boolean;
  /** Alias used by some API versions — prefer `external` */
  is_external?: boolean;
  matched_speaker_display_name?: string;
}

export interface TranscriptSegment {
  id: string;
  recording_id: number;
  speaker_name: string;
  speaker_email?: string | null;
  text: string;
  timestamp: string;
  edited_text?: string | null;
  edited_speaker_name?: string | null;
  edited_speaker_email?: string | null;
  is_deleted?: boolean;
  edited_at?: string | null;
  edited_by?: string | null;
  created_at?: string;
}

export interface TranscriptSegmentDisplay extends TranscriptSegment {
  display_text: string;
  display_speaker_name: string;
  display_speaker_email: string | null;
  has_edits: boolean;
}

export interface Meeting {
  recording_id: string | number;
  /** Canonical UUID from recordings.id — always set for recordings-table rows. Used for UUID-keyed queries (call_tag_assignments, call_participants, etc.). */
  canonical_uuid?: string;
  /** Numeric Fathom recording_id (recordings.legacy_recording_id). Populated for rows that originated from Fathom; null for Zoom/manual/upload. Used as the lookup key for BIGINT-keyed maps (folderAssignments, fathom_*). */
  legacy_recording_id?: number | null;
  title: string;
  created_at: string;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  url?: string | null;
  share_url?: string | null;
  full_transcript?: string | null;
  summary?: string | null;
  recorded_by_name?: string | null;
  recorded_by_email?: string | null;
  calendar_invitees?: CalendarInvitee[] | null;
  synced?: boolean;
  user_id?: string;
  synced_at?: string;
  auto_tags?: string[] | null;
  // Multi-source deduplication fields
  meeting_fingerprint?: string | null;
  source_platform?: MeetingSourcePlatform | null;
  is_primary?: boolean | null;
  merged_from?: number[] | null;
  fuzzy_match_score?: number | null;
  // Google-specific source identifiers
  google_calendar_event_id?: string | null;
  google_drive_file_id?: string | null;
  transcript_source?: 'native' | 'whisper' | null;
  ai_generated_title?: string | null;
  source_metadata?: Record<string, any> | null;
  sync_state?: 'available' | 'imported' | 'updated_remotely';
  recording_uuid?: string;
  local_title?: string | null;
  remote_title?: string | null;
}

export interface MeetingWithTranscripts extends Meeting {
  unsyncedTranscripts?: TranscriptSegment[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  created_at: string;
  user_id?: string;
}

export interface CategoryAssignment {
  call_recording_id: number;
  category_id: string;
  auto_assigned?: boolean;
}

export interface Speaker {
  speaker_name: string;
  speaker_email?: string | null;
  participant_type?: string | null;
  contact_id?: string | null;
  contact_type?: string | null;
  contact_last_seen_at?: string | null;
  contact_track_health?: boolean | null;
  contact_notes?: string | null;
  contact_tags?: string[] | null;
}

export interface TranscriptStats {
  characters: number;
  tokens: number;
  words: number;
}
