import {
  canonicalTurnsToSegments,
  formatCanonicalTranscript,
  type CanonicalTranscriptTurn,
  type ConnectorRecordLike,
} from "./canonical-recording.ts";
import { FATHOM_API_BASE, FathomClient, FathomRateLimitError, type FathomFetchOptions } from "./fathom-client.ts";

interface HydrationOptions {
  fetchContent?: (url: string, options: FathomFetchOptions) => Promise<Response>;
  apiBase?: string;
  timeoutMs?: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestampSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+:\d{2}(?::\d{2})?(?:\.\d+)?$/.test(value)) return null;
  return value.split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

function parseTranscript(payload: unknown): CanonicalTranscriptTurn[] {
  const segments = asObject(payload)?.transcript;
  if (!Array.isArray(segments)) throw new Error("FATHOM_TRANSCRIPT_INVALID_RESPONSE");

  const turns: CanonicalTranscriptTurn[] = [];
  for (const value of segments) {
    const segment = asObject(value);
    if (!segment || typeof segment.text !== "string") {
      throw new Error("FATHOM_TRANSCRIPT_INVALID_RESPONSE");
    }
    const content = text(segment.text);
    if (!content) continue;
    const speaker = asObject(segment.speaker);
    turns.push({
      text: content,
      speakerName: text(speaker?.display_name),
      speakerEmail: text(speaker?.matched_calendar_invitee_email) ?? text(speaker?.email),
      startSeconds: timestampSeconds(segment.timestamp),
    });
  }
  if (!turns.length) throw new Error("FATHOM_TRANSCRIPT_EMPTY");
  return turns;
}

function parseSummary(payload: unknown): string | null {
  const data = asObject(payload);
  if (!data || !("summary" in data)) throw new Error("FATHOM_SUMMARY_INVALID_RESPONSE");
  if (data.summary === null) return null;
  const summary = asObject(data.summary);
  if (!summary || typeof summary.markdown_formatted !== "string") {
    throw new Error("FATHOM_SUMMARY_INVALID_RESPONSE");
  }
  return text(summary.markdown_formatted);
}

/**
 * Fathom's meetings list is metadata-only. Import is successful only after its
 * separate transcript endpoint supplies usable content; a missing optional
 * summary is allowed, but upstream/auth failures must stay retryable failures.
 */
export async function hydrateFathomRecord(
  record: Omit<ConnectorRecordLike, "transcript_segments"> & { transcript_segments?: unknown[] | null },
  accessToken: string,
  options: HydrationOptions = {},
): Promise<ConnectorRecordLike> {
  if (!/^\d+$/.test(record.external_id)) throw new Error("FATHOM_INVALID_RECORDING_ID");

  const fetchContent = options.fetchContent ?? FathomClient.fetchWithRetry.bind(FathomClient);
  const base = (options.apiBase ?? FATHOM_API_BASE).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const request = async (kind: "transcript" | "summary"): Promise<unknown> => {
    const response = await fetchContent(
      `${base}/external/v1/recordings/${encodeURIComponent(record.external_id)}/${kind}`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: controller.signal,
        maxRetries: 1,
        baseDelay: 250,
        retryRateLimits: false,
      },
    );
    if (response.status === 429) throw new FathomRateLimitError(response);
    if (kind === "summary" && response.status === 404) return { summary: null };
    if (!response.ok) throw new Error(`FATHOM_${kind.toUpperCase()}_HTTP_${response.status}`);
    return response.json();
  };

  try {
    const [transcriptPayload, summaryPayload] = await Promise.all([
      request("transcript"),
      request("summary"),
    ]);
    const turns = parseTranscript(transcriptPayload);
    const summary = parseSummary(summaryPayload);
    const metadata = record.source_metadata;
    const recordedBy = asObject(metadata.recorded_by);
    const duration = record.recording_end_time
      ? (Date.parse(record.recording_end_time) - Date.parse(record.recording_start_time)) / 1000
      : null;

    return {
      ...record,
      full_transcript: formatCanonicalTranscript(turns),
      transcript_segments: canonicalTurnsToSegments(turns),
      summary,
      ...(duration !== null && Number.isFinite(duration) && duration >= 0
        ? { duration: Math.floor(duration) }
        : {}),
      source_metadata: {
        ...metadata,
        fathom_call_id: record.external_id,
        fathom_url: text(metadata.url),
        fathom_share_url: text(metadata.share_url),
        recorded_by_name: text(recordedBy?.name),
        recorded_by_email: text(recordedBy?.email),
        transcript_speaker_names: [...new Set(turns.map((turn) => turn.speakerName).filter(Boolean))],
        summary,
      },
    };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
