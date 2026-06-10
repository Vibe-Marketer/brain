import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from "./canonical-recording.ts";

const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

export const FIREFLIES_USER_QUERY = `
  query CallVaultFirefliesUser {
    user {
      user_id
      email
      name
      integrations
    }
  }
`;

export const FIREFLIES_TRANSCRIPTS_QUERY = `
  query CallVaultFirefliesTranscripts(
    $fromDate: DateTime
    $toDate: DateTime
    $limit: Int
    $skip: Int
  ) {
    transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, skip: $skip) {
      id
      title
      dateString
      date
      duration
      transcript_url
      audio_url
      video_url
      meeting_link
      host_email
      organizer_email
      participants
      meeting_attendees {
        displayName
        email
        name
      }
    }
  }
`;
export const FIREFLIES_TRANSCRIPT_QUERY = `
  query CallVaultFirefliesTranscript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      title
      dateString
      date
      transcript_url
      audio_url
      video_url
      duration
      host_email
      organizer_email
      participants
      meeting_link
      sentences {
        index
        speaker_name
        text
        start_time
        end_time
      }
      meeting_attendees {
        displayName
        email
        name
      }
      summary {
        overview
        short_summary
        short_overview
        gist
        bullet_gist
        action_items
        topics_discussed
      }
    }
  }
`;

export interface FirefliesTranscript {
  id: string;
  title?: string | null;
  dateString?: string | null;
  date?: number | string | null;
  transcript_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  duration?: number | null;
  host_email?: string | null;
  organizer_email?: string | null;
  participants?: unknown;
  meeting_link?: string | null;
  sentences?: FirefliesSentence[] | null;
  meeting_attendees?: FirefliesAttendee[] | null;
  summary?: FirefliesSummary | null;
}

export interface FirefliesSentence {
  index?: number | null;
  speaker_name?: string | null;
  speaker_id?: string | null;
  text?: string | null;
  raw_text?: string | null;
  start_time?: number | null;
  end_time?: number | null;
}

export interface FirefliesAttendee {
  displayName?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface FirefliesSummary {
  overview?: string | null;
  short_summary?: string | null;
  short_overview?: string | null;
  gist?: string | null;
  bullet_gist?: string | string[] | null;
  action_items?: string | string[] | null;
  topics_discussed?: string | string[] | null;
}

export interface FirefliesGraphQLResponse {
  data?: {
    transcript?: FirefliesTranscript | null;
    transcripts?: FirefliesTranscript[] | null;
    user?: FirefliesUser | null;
  };
  errors?: Array<{ message?: string }>;
}

export interface FirefliesUser {
  user_id?: string | null;
  email?: string | null;
  name?: string | null;
  integrations?: unknown;
}

export async function fetchFirefliesTranscript(
  apiKey: string,
  transcriptId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FirefliesTranscript> {
  const normalizedApiKey = normalizeFirefliesApiKey(apiKey);
  if (!normalizedApiKey) throw new Error("Fireflies API key is required");
  if (!transcriptId.trim())
    throw new Error("Fireflies transcript ID is required");

  const response = await fetchImpl(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedApiKey}`,
    },
    body: JSON.stringify({
      query: FIREFLIES_TRANSCRIPT_QUERY,
      variables: { transcriptId },
    }),
  });

  const payload = (await response.json()) as FirefliesGraphQLResponse;
  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") ||
      `Fireflies API request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!payload.data?.transcript) {
    throw new Error(`Fireflies transcript not found: ${transcriptId}`);
  }

  return payload.data.transcript;
}

export async function fetchFirefliesUser(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FirefliesUser> {
  const payload = await firefliesGraphqlRequest<{
    user?: FirefliesUser | null;
  }>(apiKey, FIREFLIES_USER_QUERY, {}, fetchImpl);
  if (!payload.user) {
    throw new Error("Fireflies user lookup failed");
  }
  return payload.user;
}

export async function fetchFirefliesTranscripts(
  apiKey: string,
  params: {
    fromDate?: string | null;
    toDate?: string | null;
    limit?: number;
    skip?: number;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<FirefliesTranscript[]> {
  const payload = await firefliesGraphqlRequest<{
    transcripts?: FirefliesTranscript[] | null;
  }>(
    apiKey,
    FIREFLIES_TRANSCRIPTS_QUERY,
    {
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      limit: params.limit ?? 50,
      skip: params.skip ?? 0,
    },
    fetchImpl,
  );
  return payload.transcripts ?? [];
}

export function firefliesTranscriptToCanonical(
  transcript: FirefliesTranscript,
): CanonicalRecording {
  const turns = firefliesSentencesToTurns(transcript.sentences ?? []);
  const fullTranscript = formatCanonicalTranscript(turns);
  const recordingStartTime = coerceFirefliesDate(
    transcript.dateString ?? transcript.date,
  );
  const durationSeconds = normalizeDurationSeconds(
    transcript.duration,
    transcript.sentences ?? [],
  );
  const recordingEndTime =
    durationSeconds != null
      ? new Date(
          new Date(recordingStartTime).getTime() + durationSeconds * 1000,
        ).toISOString()
      : null;
  const attendeeEmails = (transcript.meeting_attendees ?? [])
    .map((attendee) => attendee.email)
    .filter((email): email is string => typeof email === "string");

  return {
    externalId: transcript.id,
    sourceApp: "fireflies",
    title: transcript.title?.trim() || "Untitled Fireflies Call",
    fullTranscript,
    summary: summarizeFirefliesSummary(transcript.summary),
    recordingStartTime,
    recordingEndTime,
    durationSeconds,
    sourceUrl: transcript.transcript_url ?? transcript.meeting_link ?? null,
    shareUrl: transcript.transcript_url ?? transcript.meeting_link ?? null,
    recordedByEmail:
      transcript.host_email ?? transcript.organizer_email ?? null,
    participantEmails: normalizeEmailList([
      transcript.host_email ?? "",
      transcript.organizer_email ?? "",
      ...attendeeEmails,
      ...extractEmailsFromParticipants(transcript.participants),
    ]),
    calendarInvitees: transcript.meeting_attendees ?? [],
    transcriptTurns: turns,
    sourceMetadata: {
      fireflies_transcript_id: transcript.id,
      fireflies_transcript_url: transcript.transcript_url ?? null,
      fireflies_audio_url: transcript.audio_url ?? null,
      fireflies_video_url: transcript.video_url ?? null,
      fireflies_meeting_link: transcript.meeting_link ?? null,
      recorded_by_email:
        transcript.host_email ?? transcript.organizer_email ?? null,
      recorded_by_name: findHostName(transcript),
      transcript_speaker_names: extractSpeakerNames(transcript.sentences ?? []),
      action_items: normalizeSummaryList(transcript.summary?.action_items),
      topics_discussed: normalizeSummaryList(
        transcript.summary?.topics_discussed,
      ),
    },
    rawPayload: transcript,
  };
}

function firefliesSentencesToTurns(
  sentences: FirefliesSentence[],
): CanonicalTranscriptTurn[] {
  return sortFirefliesSentences(sentences)
    .map((sentence) => ({
      speakerName: normalizeSpeakerName(sentence),
      text: sentence.text ?? sentence.raw_text ?? "",
      startSeconds: sentence.start_time ?? 0,
      endSeconds: sentence.end_time ?? null,
    }));
}

/**
 * Coerce a Fireflies `date` / `dateString` value into an ISO-8601 string.
 *
 * Fireflies sends `date` as either epoch seconds *or* epoch milliseconds
 * depending on the payload variant. We disambiguate using the standard
 * convention: anything <= 10_000_000_000 (2286-11-20 in seconds, 1970-04-26
 * in millis) is treated as seconds. `dateString` is always ISO-8601 when
 * present and takes precedence on the call site.
 *
 * Exported so the edge-function mapper can share the exact same coercion
 * and so the seconds/millis branch is testable.
 */
export function coerceFirefliesDate(
  value: number | string | null | undefined,
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  throw new Error("Fireflies transcript is missing a valid date/dateString");
}

/**
 * Normalize a Fireflies `duration` value (seconds, possibly null/NaN/negative)
 * into a non-negative integer or null. Exported for reuse by the edge-function
 * list mapper.
 */
export function normalizeDurationSeconds(
  value: number | null | undefined,
  sentences: FirefliesSentence[] = [],
): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const sentenceMaxSeconds = getMaxSentenceOffsetSeconds(sentences);
  const durationAsMinutes = value * 60;

  // Fireflies' Transcript.duration is minutes. Some list/detail payloads also
  // include sentence offsets in seconds; use those as a sanity check so older
  // or odd payload variants still produce a plausible duration.
  if (
    sentenceMaxSeconds != null &&
    sentenceMaxSeconds > 0 &&
    durationAsMinutes < sentenceMaxSeconds * 0.75
  ) {
    return Math.round(sentenceMaxSeconds);
  }

  return Math.round(durationAsMinutes);
}

function summarizeFirefliesSummary(
  summary: FirefliesSummary | null | undefined,
): string | null {
  if (!summary) return null;
  const sections = [
    summary.short_summary,
    summary.short_overview,
    summary.overview,
    summary.gist,
    stringifyList("Topics discussed", summary.topics_discussed),
    stringifyList("Action items", summary.action_items),
    stringifyList("Highlights", summary.bullet_gist),
  ].filter(
    (section): section is string =>
      typeof section === "string" && section.trim().length > 0,
  );

  return sections.length > 0 ? sections.join("\n\n") : null;
}

function stringifyList(
  label: string,
  value: string | string[] | null | undefined,
): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0
      ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`
      : null;
  }
  return typeof value === "string" && value.trim()
    ? `${label}: ${value.trim()}`
    : null;
}

function normalizeSummaryList(
  value: string | string[] | null | undefined,
): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function extractEmailsFromParticipants(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((participant) => {
      if (typeof participant === "string") return participant;
      if (
        participant &&
        typeof participant === "object" &&
        "email" in participant
      ) {
        return String((participant as { email?: unknown }).email ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeSpeakerName(sentence: FirefliesSentence): string {
  const speakerName = sentence.speaker_name?.trim();
  if (speakerName) return speakerName;

  const speakerId = sentence.speaker_id?.trim();
  return speakerId ? `Speaker ${speakerId}` : "Unknown";
}

function extractSpeakerNames(sentences: FirefliesSentence[]): string[] {
  const seen = new Set<string>();
  const speakers: string[] = [];

  for (const sentence of sortFirefliesSentences(sentences)) {
    const speaker = normalizeSpeakerName(sentence);
    if (!speaker || speaker === "Unknown") continue;
    const key = speaker.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    speakers.push(speaker);
  }

  return speakers;
}

function sortFirefliesSentences(sentences: FirefliesSentence[]): FirefliesSentence[] {
  return [...sentences].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function getMaxSentenceOffsetSeconds(
  sentences: FirefliesSentence[],
): number | null {
  let max: number | null = null;

  for (const sentence of sentences) {
    for (const value of [sentence.end_time, sentence.start_time]) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        continue;
      }
      max = max == null ? value : Math.max(max, value);
    }
  }

  return max;
}

function findHostName(transcript: FirefliesTranscript): string | null {
  const hostEmail = transcript.host_email ?? transcript.organizer_email;
  if (!hostEmail) return null;
  const attendee = (transcript.meeting_attendees ?? []).find(
    (item) => item.email === hostEmail,
  );
  return attendee?.displayName ?? attendee?.name ?? null;
}

async function firefliesGraphqlRequest<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<T> {
  const normalizedApiKey = normalizeFirefliesApiKey(apiKey);
  if (!normalizedApiKey) throw new Error("Fireflies API key is required");

  const response = await fetchImpl(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedApiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await readFirefliesGraphqlPayload(response);
  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") ||
      `Fireflies API request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return (payload.data ?? {}) as T;
}

function normalizeFirefliesApiKey(apiKey: string): string {
  return apiKey.trim().replace(/^Bearer\s+/i, "").trim();
}

async function readFirefliesGraphqlPayload(
  response: Response,
): Promise<FirefliesGraphQLResponse> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as FirefliesGraphQLResponse;
  } catch {
    if (!response.ok) {
      throw new Error(
        `Fireflies API request failed with HTTP ${response.status}: ${text.slice(0, 200)}`,
      );
    }
    throw new Error("Fireflies API returned an invalid JSON response");
  }
}
