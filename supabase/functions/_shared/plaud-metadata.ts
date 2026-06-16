import type { SourceLinkMetadata } from "./loom-metadata.ts";

const PLAUD_SHARE_API_BASE = "https://api.plaud.ai/share/access/";

/**
 * Normalizes a Plaud public share URL and extracts its share token.
 *
 * Both supported URL shapes carry the same `pub_<uuid>::<base62>` token:
 *   - https://web.plaud.ai/s/<TOKEN>
 *   - https://web.plaud.ai/nshare/<TOKEN>
 *
 * Everything after `/s/` or `/nshare/` is the token; trailing query/hash is stripped.
 */
export function normalizePlaudShareUrl(rawUrl: string): { url: string; shareToken: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname.toLowerCase() !== "web.plaud.ai") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "s" && parts[0] !== "nshare") return null;

  const shareToken = decodeURIComponent(parts.slice(1).join("/"));
  if (!shareToken || !shareToken.includes("::")) return null;

  return {
    url: `https://web.plaud.ai/${parts[0]}/${shareToken}`,
    shareToken,
  };
}

/**
 * Fetches the Plaud public share payload and maps it to the shared
 * SourceLinkMetadata shape. The Plaud public share API responds 200 with the
 * full recording document unauthenticated when given the share token.
 */
export async function parsePlaudMetadata(
  shareToken: string,
  canonicalUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Partial<SourceLinkMetadata>> {
  const res = await fetchImpl(`${PLAUD_SHARE_API_BASE}${encodeURIComponent(shareToken)}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "CallVaultBot/1.0 (+https://callvaultai.com)",
    },
  });
  if (!res.ok) throw new Error(`Plaud share HTTP ${res.status}`);
  const payload = await res.json() as unknown;
  return mapPlaudSharePayload(payload, canonicalUrl, shareToken);
}

export function mapPlaudSharePayload(
  payload: unknown,
  canonicalUrl: string,
  shareToken: string,
): Partial<SourceLinkMetadata> {
  const envelope = asRecord(payload) ?? {};
  const dataFile = asRecord(envelope.data_file) ?? {};

  const durationMs = asNumber(dataFile.duration);
  const startTimeMs = asNumber(dataFile.start_time);
  const transcript = formatPlaudTranscript(dataFile);
  const summary = buildPlaudSummary(dataFile);

  return compactMetadata({
    source_url: canonicalUrl,
    share_token: shareToken,
    source_app: "plaud",
    provider_name: "Plaud",
    title: asString(dataFile.filename),
    description: summary ? firstMeaningfulLine(summary) : undefined,
    summary,
    author_name: asString(envelope.owner_name),
    created_at: startTimeMs == null ? undefined : new Date(startTimeMs).toISOString(),
    duration_seconds: durationMs == null ? undefined : Math.round(durationMs / 1000),
    language: asString(dataFile.file_language),
    transcript_text: transcript,
    transcript_source: transcript ? "plaud-share-json" : undefined,
  });
}

/**
 * Builds a clean plain-text transcript as `Speaker: content` lines. Prefers the
 * polished `transaction_polish` segments and falls back to the raw
 * `trans_result` segments when the polished list is empty.
 */
function formatPlaudTranscript(dataFile: Record<string, unknown>): string | undefined {
  const polished = asArray(dataFile.transaction_polish);
  const raw = asArray(dataFile.trans_result);
  const segments = polished.length > 0 ? polished : raw;

  const lines: string[] = [];
  for (const segment of segments) {
    const record = asRecord(segment);
    if (!record) continue;
    const content = asString(record.content);
    if (!content) continue;
    const speaker = asString(record.speaker) ?? asString(record.original_speaker);
    lines.push(speaker ? `${speaker}: ${content}` : content);
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

/**
 * Prefers the AI notes summary (`notes_list[].data_content`) when present, then
 * falls back to a readable outline joined from `outline_result[].topic`.
 */
function buildPlaudSummary(dataFile: Record<string, unknown>): string | undefined {
  for (const note of asArray(dataFile.notes_list)) {
    const record = asRecord(note);
    const content = asString(record?.data_content);
    if (content) return content;
  }

  const topics: string[] = [];
  for (const item of asArray(dataFile.outline_result)) {
    const record = asRecord(item);
    const topic = asString(record?.topic);
    if (topic) topics.push(topic);
  }
  if (topics.length > 0) return topics.map((topic) => `- ${topic}`).join("\n");

  return undefined;
}

function firstMeaningfulLine(value: string): string | undefined {
  return value
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("!["));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
}

function compactMetadata<T extends Record<string, unknown>>(input: T): Partial<T> {
  const output: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") {
      output[key as keyof T] = value as T[keyof T];
    }
  }
  return output;
}
