import {
  formatCanonicalTranscript,
  normalizeEmailList,
  type CanonicalRecording,
  type CanonicalTranscriptTurn,
} from './canonical-recording.ts';

const FIREFLIES_GRAPHQL_URL = 'https://api.fireflies.ai/graphql';

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
  text?: string | null;
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
  data?: { transcript?: FirefliesTranscript | null };
  errors?: Array<{ message?: string }>;
}

export async function fetchFirefliesTranscript(
  apiKey: string,
  transcriptId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FirefliesTranscript> {
  if (!apiKey.trim()) throw new Error('Fireflies API key is required');
  if (!transcriptId.trim()) throw new Error('Fireflies transcript ID is required');

  const response = await fetchImpl(FIREFLIES_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: FIREFLIES_TRANSCRIPT_QUERY,
      variables: { transcriptId },
    }),
  });

  const payload = await response.json() as FirefliesGraphQLResponse;
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ')
      || `Fireflies API request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!payload.data?.transcript) {
    throw new Error(`Fireflies transcript not found: ${transcriptId}`);
  }

  return payload.data.transcript;
}

export function firefliesTranscriptToCanonical(transcript: FirefliesTranscript): CanonicalRecording {
  const turns = firefliesSentencesToTurns(transcript.sentences ?? []);
  const fullTranscript = formatCanonicalTranscript(turns);
  const recordingStartTime = coerceFirefliesDate(transcript.dateString ?? transcript.date);
  const durationSeconds = normalizeDurationSeconds(transcript.duration);
  const recordingEndTime = durationSeconds != null
    ? new Date(new Date(recordingStartTime).getTime() + durationSeconds * 1000).toISOString()
    : null;
  const attendeeEmails = (transcript.meeting_attendees ?? [])
    .map((attendee) => attendee.email)
    .filter((email): email is string => typeof email === 'string');

  return {
    externalId: transcript.id,
    sourceApp: 'fireflies',
    title: transcript.title?.trim() || 'Untitled Fireflies Call',
    fullTranscript,
    summary: summarizeFirefliesSummary(transcript.summary),
    recordingStartTime,
    recordingEndTime,
    durationSeconds,
    sourceUrl: transcript.transcript_url ?? transcript.meeting_link ?? null,
    shareUrl: transcript.transcript_url ?? transcript.meeting_link ?? null,
    recordedByEmail: transcript.host_email ?? transcript.organizer_email ?? null,
    participantEmails: normalizeEmailList([
      transcript.host_email ?? '',
      transcript.organizer_email ?? '',
      ...attendeeEmails,
      ...extractEmailsFromParticipants(transcript.participants),
    ]),
    calendarInvitees: transcript.meeting_attendees ?? [],
    sourceMetadata: {
      fireflies_transcript_id: transcript.id,
      fireflies_transcript_url: transcript.transcript_url ?? null,
      fireflies_audio_url: transcript.audio_url ?? null,
      fireflies_video_url: transcript.video_url ?? null,
      fireflies_meeting_link: transcript.meeting_link ?? null,
      recorded_by_email: transcript.host_email ?? transcript.organizer_email ?? null,
      recorded_by_name: findHostName(transcript),
    },
    rawPayload: transcript,
  };
}

function firefliesSentencesToTurns(sentences: FirefliesSentence[]): CanonicalTranscriptTurn[] {
  return [...sentences]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((sentence) => ({
      speakerName: sentence.speaker_name ?? 'Unknown',
      text: sentence.text ?? '',
      startSeconds: sentence.start_time ?? 0,
      endSeconds: sentence.end_time ?? null,
    }));
}

function coerceFirefliesDate(value: number | string | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  throw new Error('Fireflies transcript is missing a valid date/dateString');
}

function normalizeDurationSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function summarizeFirefliesSummary(summary: FirefliesSummary | null | undefined): string | null {
  if (!summary) return null;
  const sections = [
    summary.short_summary,
    summary.short_overview,
    summary.overview,
    summary.gist,
    stringifyList('Topics discussed', summary.topics_discussed),
    stringifyList('Action items', summary.action_items),
    stringifyList('Highlights', summary.bullet_gist),
  ].filter((section): section is string => typeof section === 'string' && section.trim().length > 0);

  return sections.length > 0 ? sections.join('\n\n') : null;
}

function stringifyList(label: string, value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? `${label}:\n${items.map((item) => `- ${item}`).join('\n')}` : null;
  }
  return typeof value === 'string' && value.trim() ? `${label}: ${value.trim()}` : null;
}

function extractEmailsFromParticipants(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((participant) => {
      if (typeof participant === 'string') return participant;
      if (participant && typeof participant === 'object' && 'email' in participant) {
        return String((participant as { email?: unknown }).email ?? '');
      }
      return '';
    })
    .filter(Boolean);
}

function findHostName(transcript: FirefliesTranscript): string | null {
  const hostEmail = transcript.host_email ?? transcript.organizer_email;
  if (!hostEmail) return null;
  const attendee = (transcript.meeting_attendees ?? []).find((item) => item.email === hostEmail);
  return attendee?.displayName ?? attendee?.name ?? null;
}
