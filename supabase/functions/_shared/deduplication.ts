/**
 * Deduplication utility for multi-source meeting detection.
 * Implements fingerprinting and fuzzy matching to detect duplicate meetings
 * across different sources (Fathom, Google Meet, etc.)
 *
 * A meeting is considered a duplicate if ANY TWO of the following criteria match:
 * - Title similarity >= 80% (Levenshtein)
 * - Time overlap >= 50%
 * - Participant overlap >= 60%
 */

// ============================================================================
// Types
// ============================================================================

export interface MeetingFingerprint {
  title_normalized: string;
  start_time_bucket: string;
  duration_bucket: string;
  participant_hash: string;
}

export interface MeetingData {
  id?: number;
  title: string;
  started_at: string | Date;
  duration_seconds?: number;
  ended_at?: string | Date;
  participants?: string[];
  source_platform?: string;
  meeting_fingerprint?: string;
  transcript?: string;
  is_primary?: boolean;
  merged_from?: number[];
  fuzzy_match_score?: number;
}

export interface MatchResult {
  isMatch: boolean;
  score: number;
  titleSimilarity: number;
  timeOverlap: number;
  participantOverlap: number;
  matchingCriteria: string[];
}

export interface DedupPreferences {
  dedup_priority_mode: 'first_synced' | 'most_recent' | 'platform_hierarchy' | 'longest_transcript';
  dedup_platform_order: string[];
}

export const MATCH_THRESHOLDS = {
  title_similarity: 0.80,
  time_overlap: 0.50,
  participant_overlap: 0.60,
};

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Normalize a meeting title for comparison.
 * Lowercases, removes punctuation, and trims whitespace.
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings using Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const normalizedA = normalizeTitle(a);
  const normalizedB = normalizeTitle(b);

  if (normalizedA === normalizedB) return 1;

  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLen;
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Round a timestamp to the nearest 15-minute bucket.
 */
export function getTimeBucket(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  return date.toISOString();
}

/**
 * Round duration to the nearest 5-minute bucket.
 */
export function getDurationBucket(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const rounded = Math.round(minutes / 5) * 5;
  return `${rounded}min`;
}

/**
 * Calculate time overlap ratio between two meetings.
 * Returns a value between 0 (no overlap) and 1 (complete overlap).
 */
export function calculateTimeOverlap(
  meeting1: { started_at: string | Date; ended_at?: string | Date; duration_seconds?: number },
  meeting2: { started_at: string | Date; ended_at?: string | Date; duration_seconds?: number }
): number {
  const start1 = new Date(meeting1.started_at).getTime();
  const start2 = new Date(meeting2.started_at).getTime();

  let end1: number;
  let end2: number;

  if (meeting1.ended_at) {
    end1 = new Date(meeting1.ended_at).getTime();
  } else if (meeting1.duration_seconds) {
    end1 = start1 + meeting1.duration_seconds * 1000;
  } else {
    end1 = start1 + 60 * 60 * 1000; // Default to 1 hour
  }

  if (meeting2.ended_at) {
    end2 = new Date(meeting2.ended_at).getTime();
  } else if (meeting2.duration_seconds) {
    end2 = start2 + meeting2.duration_seconds * 1000;
  } else {
    end2 = start2 + 60 * 60 * 1000; // Default to 1 hour
  }

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlapDuration = Math.max(0, overlapEnd - overlapStart);

  const duration1 = end1 - start1;
  const duration2 = end2 - start2;
  const minDuration = Math.min(duration1, duration2);

  if (minDuration <= 0) return 0;

  return overlapDuration / minDuration;
}

// ============================================================================
// Participant Utilities
// ============================================================================

/**
 * Normalize an email address for comparison.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Create a hash of sorted participant emails.
 */
export function hashParticipants(participants: string[]): string {
  if (!participants || participants.length === 0) return '';

  const normalized = participants
    .map(normalizeEmail)
    .filter(Boolean)
    .sort();

  // Simple hash using join - in production, use crypto.subtle.digest
  return normalized.join('|');
}

/**
 * Calculate participant overlap ratio between two meetings.
 * Returns a value between 0 (no overlap) and 1 (complete overlap).
 */
export function calculateParticipantOverlap(
  participants1: string[] | undefined,
  participants2: string[] | undefined
): number {
  if (!participants1?.length || !participants2?.length) {
    return 0; // Can't compare if no participants
  }

  const set1 = new Set(participants1.map(normalizeEmail).filter(Boolean));
  const set2 = new Set(participants2.map(normalizeEmail).filter(Boolean));

  if (set1.size === 0 || set2.size === 0) return 0;

  let overlap = 0;
  for (const email of set1) {
    if (set2.has(email)) overlap++;
  }

  // Overlap relative to the smaller set
  const minSize = Math.min(set1.size, set2.size);
  return overlap / minSize;
}

// ============================================================================
// Fingerprinting
// ============================================================================

/**
 * Generate a fingerprint for a meeting.
 * Used for fast initial filtering before detailed matching.
 */
export function generateFingerprint(meeting: MeetingData): MeetingFingerprint {
  const durationSeconds = meeting.duration_seconds ??
    (meeting.ended_at && meeting.started_at
      ? Math.floor((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 1000)
      : 3600); // Default to 1 hour

  return {
    title_normalized: normalizeTitle(meeting.title),
    start_time_bucket: getTimeBucket(meeting.started_at),
    duration_bucket: getDurationBucket(durationSeconds),
    participant_hash: hashParticipants(meeting.participants || []),
  };
}

/**
 * Generate a hash string from a fingerprint for database storage.
 */
export function fingerprintToHash(fingerprint: MeetingFingerprint): string {
  // Simple deterministic hash for database storage
  const str = [
    fingerprint.title_normalized,
    fingerprint.start_time_bucket,
    fingerprint.duration_bucket,
  ].join('::');

  // Use a simple hash function for the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

// ============================================================================
// Matching
// ============================================================================

/**
 * Check if two meetings are potential duplicates.
 * Returns true if ANY TWO criteria meet their thresholds.
 */
export function matchMeetings(
  meeting1: MeetingData,
  meeting2: MeetingData,
  thresholds = MATCH_THRESHOLDS
): MatchResult {
  const titleSimilarity = stringSimilarity(meeting1.title, meeting2.title);
  const timeOverlap = calculateTimeOverlap(meeting1, meeting2);
  const participantOverlap = calculateParticipantOverlap(
    meeting1.participants,
    meeting2.participants
  );

  const matchingCriteria: string[] = [];

  if (titleSimilarity >= thresholds.title_similarity) {
    matchingCriteria.push('title');
  }
  if (timeOverlap >= thresholds.time_overlap) {
    matchingCriteria.push('time');
  }
  if (participantOverlap >= thresholds.participant_overlap) {
    matchingCriteria.push('participants');
  }

  // Match if ANY TWO criteria are met
  const isMatch = matchingCriteria.length >= 2;

  // Calculate overall score (weighted average)
  const score = (titleSimilarity * 0.4) + (timeOverlap * 0.35) + (participantOverlap * 0.25);

  return {
    isMatch,
    score,
    titleSimilarity,
    timeOverlap,
    participantOverlap,
    matchingCriteria,
  };
}

/**
 * Find a duplicate meeting in a list of existing meetings.
 * Returns the best match if found, null otherwise.
 */
export function findDuplicate(
  newMeeting: MeetingData,
  existingMeetings: MeetingData[],
  thresholds = MATCH_THRESHOLDS
): { meeting: MeetingData; matchResult: MatchResult } | null {
  let bestMatch: { meeting: MeetingData; matchResult: MatchResult } | null = null;
  let bestScore = 0;

  for (const existing of existingMeetings) {
    const matchResult = matchMeetings(newMeeting, existing, thresholds);

    if (matchResult.isMatch && matchResult.score > bestScore) {
      bestScore = matchResult.score;
      bestMatch = { meeting: existing, matchResult };
    }
  }

  return bestMatch;
}

// ============================================================================
// Primary Selection
// ============================================================================

/**
 * Select which meeting should be the primary source based on user preferences.
 */
export function selectPrimarySource(
  meeting1: MeetingData,
  meeting2: MeetingData,
  preferences: DedupPreferences,
  meeting1SyncedAt?: Date,
  meeting2SyncedAt?: Date
): MeetingData {
  switch (preferences.dedup_priority_mode) {
    case 'first_synced': {
      if (!meeting1SyncedAt || !meeting2SyncedAt) {
        // If no sync times, prefer the one with an ID (already in DB)
        return meeting1.id ? meeting1 : meeting2;
      }
      return meeting1SyncedAt <= meeting2SyncedAt ? meeting1 : meeting2;
    }

    case 'most_recent': {
      const date1 = new Date(meeting1.started_at).getTime();
      const date2 = new Date(meeting2.started_at).getTime();
      return date1 >= date2 ? meeting1 : meeting2;
    }

    case 'platform_hierarchy': {
      const order = preferences.dedup_platform_order || [];
      const platform1 = meeting1.source_platform || 'unknown';
      const platform2 = meeting2.source_platform || 'unknown';
      const index1 = order.indexOf(platform1);
      const index2 = order.indexOf(platform2);

      // Lower index = higher priority. -1 means not in list (lowest priority)
      const priority1 = index1 === -1 ? Infinity : index1;
      const priority2 = index2 === -1 ? Infinity : index2;

      return priority1 <= priority2 ? meeting1 : meeting2;
    }

    case 'longest_transcript': {
      const len1 = meeting1.transcript?.length || 0;
      const len2 = meeting2.transcript?.length || 0;
      return len1 >= len2 ? meeting1 : meeting2;
    }

    default:
      return meeting1;
  }
}

// ============================================================================
// Merge Logic
// ============================================================================

/**
 * Merge data from a secondary meeting into the primary meeting.
 * The primary meeting is updated in place.
 */
export function mergeMeetingData(
  primary: MeetingData,
  secondary: MeetingData,
  matchResult: MatchResult
): MeetingData {
  // Initialize merged_from array if not present
  const mergedFrom = new Set(primary.merged_from || []);

  // Add secondary meeting ID to merged_from
  if (secondary.id) {
    mergedFrom.add(secondary.id);
  }

  // Merge participants (union of both sets)
  const allParticipants = new Set<string>();
  (primary.participants || []).forEach(p => allParticipants.add(normalizeEmail(p)));
  (secondary.participants || []).forEach(p => allParticipants.add(normalizeEmail(p)));

  // Use longer transcript if primary doesn't have one or secondary is longer
  let transcript = primary.transcript;
  if (!transcript && secondary.transcript) {
    transcript = secondary.transcript;
  } else if (transcript && secondary.transcript && secondary.transcript.length > transcript.length) {
    // Optionally keep longer transcript - depends on preference
    // For now, we keep primary's transcript
  }

  return {
    ...primary,
    is_primary: true,
    merged_from: Array.from(mergedFrom),
    fuzzy_match_score: matchResult.score,
    participants: Array.from(allParticipants).filter(Boolean),
    transcript,
  };
}
