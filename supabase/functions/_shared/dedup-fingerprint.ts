/**
 * Deduplication fingerprint generator for multi-source meeting detection.
 * Generates fingerprints and matches meetings from different sources (Zoom, Fathom, etc.)
 * using fuzzy matching on title, time, and participants.
 *
 * SCOPE: Used by zoom-sync-meetings and zoom-webhook for Zoom-specific deduplication.
 * Uses async crypto.subtle SHA-256 hashing and the fastest-levenshtein library.
 *
 * NOTE: deduplication.ts is a separate implementation for Fathom and Google Meet sync
 * that uses synchronous fingerprint generation with a simple hash function.
 * Both serve the same purpose but have different implementation details.
 * Future consolidation could merge these into a single module.
 *
 * @see deduplication.ts for Fathom/Google Meet implementation
 */

// Use esm.sh for npm packages in Deno
import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16';

/**
 * Fingerprint data for a meeting, used for deduplication matching.
 */
export interface MeetingFingerprint {
  title_normalized: string;      // Lowercase, no punctuation, trimmed
  start_time_bucket: string;     // ISO timestamp rounded to nearest 15 minutes
  duration_bucket: number;       // Duration in minutes rounded to nearest 5 minutes
  participant_hash: string;      // SHA-256 hash of sorted participant emails
  participant_emails: string[];  // Normalized, sorted list of participant emails (for overlap calculation)
}

/**
 * Input data for generating a meeting fingerprint.
 */
export interface MeetingData {
  title: string;
  start_time: Date | string;     // Meeting start time
  duration_minutes: number;      // Meeting duration in minutes
  participants?: string[];       // List of participant emails or names
}

/**
 * Result of a deduplication match check.
 */
export interface MatchResult {
  is_match: boolean;
  score: number;                 // Combined match score (0-1)
  criteria_met: {
    title: boolean;
    time: boolean;
    participants: boolean;
  };
  details: {
    title_similarity: number;
    time_overlap: number;
    participant_overlap: number;
  };
}

/**
 * Thresholds for matching criteria.
 * A match requires ANY TWO criteria to be met.
 */
export const MATCH_THRESHOLDS = {
  title_similarity: 0.80,        // 80% Levenshtein similarity
  time_overlap: 0.50,            // 50% overlap between time windows
  participant_overlap: 0.60,     // 60% of participants must match
} as const;

/**
 * Time bucket intervals in minutes.
 */
const TIME_BUCKET_INTERVAL = 15;  // 15-minute time buckets
const DURATION_BUCKET_INTERVAL = 5; // 5-minute duration buckets

/**
 * Normalizes a title for comparison.
 * - Converts to lowercase
 * - Removes punctuation
 * - Trims whitespace
 * - Collapses multiple spaces
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Collapse multiple spaces
    .trim();
}

/**
 * Rounds a timestamp to the nearest time bucket (15-minute intervals).
 */
export function roundToTimeBucket(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const minutes = d.getMinutes();
  const roundedMinutes = Math.floor(minutes / TIME_BUCKET_INTERVAL) * TIME_BUCKET_INTERVAL;

  const bucketDate = new Date(d);
  bucketDate.setMinutes(roundedMinutes, 0, 0);

  return bucketDate.toISOString();
}

/**
 * Rounds a duration to the nearest bucket (5-minute intervals).
 */
export function roundToDurationBucket(durationMinutes: number): number {
  return Math.round(durationMinutes / DURATION_BUCKET_INTERVAL) * DURATION_BUCKET_INTERVAL;
}

/**
 * Normalizes an email or participant identifier.
 * - Converts to lowercase
 * - Trims whitespace
 */
export function normalizeParticipant(participant: string): string {
  return participant.toLowerCase().trim();
}

/**
 * Generates a SHA-256 hash of the sorted participant list.
 */
async function hashParticipants(participants: string[]): Promise<string> {
  const sortedParticipants = [...participants].sort().join(',');

  if (sortedParticipants.length === 0) {
    return '';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(sortedParticipants);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a meeting fingerprint from meeting data.
 * This fingerprint is used for deduplication matching.
 */
export async function generateFingerprint(meeting: MeetingData): Promise<MeetingFingerprint> {
  const normalizedParticipants = (meeting.participants || [])
    .map(normalizeParticipant)
    .filter(p => p.length > 0)
    .sort();

  // Remove duplicates
  const uniqueParticipants = [...new Set(normalizedParticipants)];

  return {
    title_normalized: normalizeTitle(meeting.title),
    start_time_bucket: roundToTimeBucket(meeting.start_time),
    duration_bucket: roundToDurationBucket(meeting.duration_minutes),
    participant_hash: await hashParticipants(uniqueParticipants),
    participant_emails: uniqueParticipants,
  };
}

/**
 * Calculates the Levenshtein similarity between two strings (0-1 scale).
 * Uses the fastest-levenshtein library for efficient calculation.
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  if (title1 === title2) {
    return 1.0;
  }

  if (title1.length === 0 || title2.length === 0) {
    return 0.0;
  }

  const levenshteinDistance = distance(title1, title2);
  const maxLength = Math.max(title1.length, title2.length);

  return 1 - (levenshteinDistance / maxLength);
}

/**
 * Calculates the time overlap between two meetings.
 * Returns a value between 0 and 1 based on how much the time windows overlap.
 */
export function calculateTimeOverlap(
  start1: string,
  duration1: number,
  start2: string,
  duration2: number
): number {
  const s1 = new Date(start1).getTime();
  const e1 = s1 + (duration1 * 60 * 1000);

  const s2 = new Date(start2).getTime();
  const e2 = s2 + (duration2 * 60 * 1000);

  // Calculate overlap
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  const overlapDuration = Math.max(0, overlapEnd - overlapStart);

  // Calculate as percentage of the shorter meeting
  const shortestMeeting = Math.min(e1 - s1, e2 - s2);

  if (shortestMeeting <= 0) {
    return 0;
  }

  return overlapDuration / shortestMeeting;
}

/**
 * Calculates the participant overlap between two meetings.
 * Returns a value between 0 and 1 based on the Jaccard similarity of participant sets.
 */
export function calculateParticipantOverlap(
  participants1: string[],
  participants2: string[]
): number {
  if (participants1.length === 0 && participants2.length === 0) {
    // If both have no participants, consider it neutral (return 0 to not count as match)
    return 0;
  }

  if (participants1.length === 0 || participants2.length === 0) {
    return 0;
  }

  const set1 = new Set(participants1);
  const set2 = new Set(participants2);

  // Count intersection
  let intersectionSize = 0;
  for (const p of set1) {
    if (set2.has(p)) {
      intersectionSize++;
    }
  }

  // Jaccard similarity: intersection / union
  const unionSize = set1.size + set2.size - intersectionSize;

  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

/**
 * Checks if two meeting fingerprints match for deduplication purposes.
 * A match requires ANY TWO of three criteria to be met:
 * - Title similarity >= 80%
 * - Time overlap >= 50%
 * - Participant overlap >= 60%
 */
export function checkMatch(
  fingerprint1: MeetingFingerprint,
  fingerprint2: MeetingFingerprint
): MatchResult {
  // Calculate all similarities
  const titleSimilarity = calculateTitleSimilarity(
    fingerprint1.title_normalized,
    fingerprint2.title_normalized
  );

  const timeOverlap = calculateTimeOverlap(
    fingerprint1.start_time_bucket,
    fingerprint1.duration_bucket,
    fingerprint2.start_time_bucket,
    fingerprint2.duration_bucket
  );

  const participantOverlap = calculateParticipantOverlap(
    fingerprint1.participant_emails,
    fingerprint2.participant_emails
  );

  // Check which criteria are met
  const titleMet = titleSimilarity >= MATCH_THRESHOLDS.title_similarity;
  const timeMet = timeOverlap >= MATCH_THRESHOLDS.time_overlap;
  const participantsMet = participantOverlap >= MATCH_THRESHOLDS.participant_overlap;

  // Count how many criteria are met
  const criteriaMetCount = [titleMet, timeMet, participantsMet].filter(Boolean).length;

  // Match if ANY TWO criteria are met
  const isMatch = criteriaMetCount >= 2;

  // Calculate combined score (weighted average)
  const score = (titleSimilarity * 0.4) + (timeOverlap * 0.4) + (participantOverlap * 0.2);

  return {
    is_match: isMatch,
    score,
    criteria_met: {
      title: titleMet,
      time: timeMet,
      participants: participantsMet,
    },
    details: {
      title_similarity: titleSimilarity,
      time_overlap: timeOverlap,
      participant_overlap: participantOverlap,
    },
  };
}

/**
 * Generates a fingerprint string suitable for database storage.
 * This is a deterministic string that can be indexed for quick lookups.
 */
export function generateFingerprintString(fingerprint: MeetingFingerprint): string {
  // Create a compact representation for storage
  // Format: title_hash|time_bucket|duration|participant_hash
  const titleHash = fingerprint.title_normalized.slice(0, 50);
  const timeBucket = fingerprint.start_time_bucket;
  const duration = fingerprint.duration_bucket.toString();
  const participantHash = fingerprint.participant_hash.slice(0, 16) || 'none';

  return `${titleHash}|${timeBucket}|${duration}|${participantHash}`;
}

/**
 * Finds potential duplicate matches for a meeting in a list of existing fingerprints.
 * Returns all matches sorted by score (highest first).
 */
export function findDuplicates(
  newFingerprint: MeetingFingerprint,
  existingFingerprints: { id: number | string; fingerprint: MeetingFingerprint }[]
): { id: number | string; result: MatchResult }[] {
  const matches: { id: number | string; result: MatchResult }[] = [];

  for (const existing of existingFingerprints) {
    const result = checkMatch(newFingerprint, existing.fingerprint);
    if (result.is_match) {
      matches.push({ id: existing.id, result });
    }
  }

  // Sort by score, highest first
  matches.sort((a, b) => b.result.score - a.result.score);

  return matches;
}
