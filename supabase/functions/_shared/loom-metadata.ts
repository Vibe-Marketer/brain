import { extractLoomShareToken } from "./loom-parser.ts";

export interface LoomMetadata {
  source_url: string;
  share_token: string;
  source_app?: string;
  provider_name: string;
  title?: string;
  description?: string;
  summary?: string;
  thumbnail_url?: string;
  animated_thumbnail_url?: string;
  embed_url?: string;
  author_name?: string;
  created_at?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  transcript_text?: string;
  transcript_source?: string;
}

export type SourceLinkMetadata = LoomMetadata;

interface LoomOEmbed {
  title?: string;
  provider_name?: string;
  thumbnail_url?: string;
  duration?: number;
  width?: number;
  height?: number;
  html?: string;
}

const GENERIC_LOOM_DESCRIPTION =
  "Use Loom to record quick videos of your screen and cam.";

export function normalizeLoomShareUrl(rawUrl: string): { url: string; shareToken: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname !== "www.loom.com" && parsed.hostname !== "loom.com") return null;

  const shareToken = extractLoomShareToken(parsed.toString());
  if (!shareToken) return null;

  return {
    url: `https://www.loom.com/share/${shareToken}`,
    shareToken,
  };
}

export function normalizeSupportedSourceUrl(rawUrl: string): {
  url: string;
  shareToken: string;
  sourceApp: "loom" | "fathom-paste" | "zoom" | "otter";
  providerName: string;
  oembedUrl?: string;
} | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();
  const href = parsed.toString();

  const loom = normalizeLoomShareUrl(href);
  if (loom) {
    const oembedUrl = new URL("https://www.loom.com/v1/oembed");
    oembedUrl.searchParams.set("url", loom.url);
    oembedUrl.searchParams.set("format", "json");
    return {
      ...loom,
      sourceApp: "loom",
      providerName: "Loom",
      oembedUrl: oembedUrl.toString(),
    };
  }

  if ((host === "fathom.video" || host === "www.fathom.video") && parsed.pathname.startsWith("/share/")) {
    const token = parsed.pathname.split("/").filter(Boolean)[1] ?? href;
    return {
      url: href,
      shareToken: token,
      sourceApp: "fathom-paste",
      providerName: "Fathom",
    };
  }

  if (host === "otter.ai" || host.endsWith(".otter.ai")) {
    return {
      url: href,
      shareToken: parsed.pathname.split("/").filter(Boolean).join("/") || href,
      sourceApp: "otter",
      providerName: "Otter.ai",
    };
  }

  if (host === "zoom.us" || host.endsWith(".zoom.us")) {
    return {
      url: href,
      shareToken: parsed.pathname.split("/").filter(Boolean).join("/") || href,
      sourceApp: "zoom",
      providerName: "Zoom",
    };
  }

  return null;
}

export function parseLoomMetadataHtml(html: string, canonicalUrl: string, shareToken: string): Partial<LoomMetadata> {
  const meta = parseMetaTags(html);
  const jsonLd = parseJsonLd(html);
  const apollo = parseApolloState(html, shareToken);

  const title =
    asString(apollo.video?.name) ??
    asString(jsonLd.name) ??
    meta["og:title"] ??
    parseTitle(html);

  const description =
    cleanDescription(asString(apollo.video?.description) ?? asString(jsonLd.description) ?? meta["og:description"] ?? meta.description);
  const summary = findFirstSummaryText(apollo.video) ?? findFirstSummaryText(jsonLd) ?? description;

  const thumbnailUrl =
    asString(readPath(apollo.video, ["thumbnails", "default"])) ??
    asString(readPath(apollo.video, ["defaultThumbnails", "static"])) ??
    asString(readPath(apollo.video, ["signedDefaultThumbnails", "static"])) ??
    asString(jsonLd.thumbnailUrl) ??
    meta["og:image"];

  const animatedThumbnailUrl =
    asString(readPath(apollo.video, ["thumbnails", "defaultGif"])) ??
    asString(readPath(apollo.video, ["defaultThumbnails", "default"]));

  const durationSeconds =
    asNumber(apollo.video?.playable_duration) ??
    asNumber(readPath(apollo.video, ["video_properties", "duration"])) ??
    parseIsoDuration(asString(jsonLd.duration));

  return compactMetadata({
    source_url: canonicalUrl,
    share_token: shareToken,
    provider_name: "Loom",
    title,
    description,
    summary,
    thumbnail_url: thumbnailUrl,
    animated_thumbnail_url: animatedThumbnailUrl,
    embed_url: asString(jsonLd.embedUrl) ?? `https://www.loom.com/embed/${shareToken}`,
    author_name: apollo.ownerName,
    created_at: asString(apollo.video?.createdAt) ?? asString(jsonLd.uploadDate),
    duration_seconds: durationSeconds,
    width: asNumber(readPath(apollo.video, ["video_properties", "width"])),
    height: asNumber(readPath(apollo.video, ["video_properties", "height"])),
    transcript_source: apollo.transcriptSourceUrl ? "loom-transcript-json" : undefined,
  });
}

export function parseGenericSourceMetadataHtml(
  html: string,
  canonicalUrl: string,
  shareToken: string,
  providerName: string,
  sourceApp: string,
): Partial<SourceLinkMetadata> {
  const meta = parseMetaTags(html);
  const jsonLd = parseJsonLd(html);
  const title = meta["og:title"] ?? meta["twitter:title"] ?? asString(jsonLd.name) ?? parseTitle(html);
  const description = cleanDescription(
    meta["og:description"] ?? meta["twitter:description"] ?? asString(jsonLd.description) ?? meta.description,
  );
  const thumbnailUrl = meta["og:image"] ?? meta["twitter:image"] ?? asString(jsonLd.thumbnailUrl);
  const createdAt = asString(jsonLd.uploadDate) ?? asString(jsonLd.datePublished);
  const duration = parseIsoDuration(asString(jsonLd.duration));

  return compactMetadata({
    source_url: canonicalUrl,
    share_token: shareToken,
    source_app: sourceApp,
    provider_name: providerName,
    title: cleanGenericTitle(title, providerName),
    description,
    summary: description,
    thumbnail_url: thumbnailUrl,
    embed_url: asString(jsonLd.embedUrl),
    author_name: readJsonLdAuthor(jsonLd),
    created_at: createdAt,
    duration_seconds: duration,
  });
}

export function mergeLoomMetadata(
  canonicalUrl: string,
  shareToken: string,
  oembed: Partial<LoomOEmbed> | null,
  htmlMetadata: Partial<LoomMetadata>,
): LoomMetadata {
  const oembedEmbedUrl = extractIframeSrc(oembed?.html);
  return compactMetadata({
    source_url: canonicalUrl,
    share_token: shareToken,
    source_app: "loom",
    provider_name: oembed?.provider_name ?? htmlMetadata.provider_name ?? "Loom",
    title: htmlMetadata.title ?? oembed?.title,
    description: htmlMetadata.description,
    summary: htmlMetadata.summary,
    thumbnail_url: htmlMetadata.thumbnail_url ?? oembed?.thumbnail_url,
    animated_thumbnail_url: htmlMetadata.animated_thumbnail_url,
    embed_url: htmlMetadata.embed_url ?? oembedEmbedUrl ?? `https://www.loom.com/embed/${shareToken}`,
    author_name: htmlMetadata.author_name,
    created_at: htmlMetadata.created_at,
    duration_seconds: htmlMetadata.duration_seconds ?? oembed?.duration,
    width: htmlMetadata.width ?? oembed?.width,
    height: htmlMetadata.height ?? oembed?.height,
  }) as LoomMetadata;
}

export function sanitizeLoomMetadata(input: unknown): Partial<LoomMetadata> {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  return compactMetadata({
    source_url: asString(record.source_url),
    share_token: asString(record.share_token),
    source_app: asString(record.source_app),
    provider_name: asString(record.provider_name),
    title: asString(record.title),
    description: cleanDescription(asString(record.description)),
    summary: cleanDescription(asString(record.summary)),
    thumbnail_url: asString(record.thumbnail_url),
    animated_thumbnail_url: asString(record.animated_thumbnail_url),
    embed_url: asString(record.embed_url),
    author_name: asString(record.author_name),
    created_at: asString(record.created_at),
    duration_seconds: asNumber(record.duration_seconds),
    width: asNumber(record.width),
    height: asNumber(record.height),
    transcript_text: asString(record.transcript_text),
    transcript_source: asString(record.transcript_source),
  });
}

export const sanitizeSourceLinkMetadata = sanitizeLoomMetadata;

function parseMetaTags(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const metaRe = /<meta\b[^>]*>/gi;
  const attrRe = /\s([a-zA-Z:-]+)=["']([^"']*)["']/g;
  for (const [tag] of html.matchAll(metaRe)) {
    const attrs: Record<string, string> = {};
    for (const [, key, value] of tag.matchAll(attrRe)) {
      attrs[key.toLowerCase()] = decodeHtml(value);
    }
    const name = attrs.property ?? attrs.name;
    if (name && attrs.content) result[name] = attrs.content;
  }
  return result;
}

function parseTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeHtml(match[1]).replace(/\s+\|\s+Loom$/i, "").trim() : "";
  return title || undefined;
}

function parseJsonLd(html: string): Record<string, unknown> {
  const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1].trim()) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseApolloState(html: string, shareToken: string): {
  video?: Record<string, unknown>;
  ownerName?: string;
  transcriptSourceUrl?: string;
} {
  const match = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.|$)/);
  if (!match) return {};
  try {
    const state = JSON.parse(match[1]) as Record<string, unknown>;
    const video = state[`RegularUserVideo:${shareToken}`] as Record<string, unknown> | undefined;
    const ownerRef = video?.owner && typeof video.owner === "object"
      ? (video.owner as Record<string, unknown>).__ref
      : undefined;
    const owner = typeof ownerRef === "string" ? state[ownerRef] as Record<string, unknown> | undefined : undefined;
    return {
      video,
      ownerName: asString(owner?.display_name) ?? asString(owner?.first_name),
      transcriptSourceUrl: findTranscriptSourceUrl(state),
    };
  } catch {
    return {};
  }
}

export function extractLoomTranscriptSourceUrl(html: string): string | undefined {
  const apollo = parseApolloState(html, "");
  return apollo.transcriptSourceUrl;
}

export function formatLoomTranscriptJson(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const phrases = (input as { phrases?: unknown }).phrases;
  if (!Array.isArray(phrases)) return null;
  const lines: string[] = [];
  for (const phrase of phrases) {
    if (!phrase || typeof phrase !== "object") continue;
    const record = phrase as Record<string, unknown>;
    const text = asString(record.value);
    const seconds = asNumber(record.ts);
    if (!text || seconds == null) continue;
    lines.push(`${formatShortTimestamp(seconds)} ${text}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function findTranscriptSourceUrl(state: Record<string, unknown>): string | undefined {
  for (const value of Object.values(state)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (record.__typename === "VideoTranscriptDetails") {
      const sourceUrl = asString(record.source_url);
      if (sourceUrl && /^https:\/\/cdn\.loom\.com\/mediametadata\/transcription\//.test(sourceUrl)) {
        return sourceUrl;
      }
    }
  }
  return undefined;
}

function findFirstSummaryText(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["summary", "ai_summary", "overview", "gist", "short_summary", "description"]) {
    const direct = cleanDescription(asString(record[key]));
    if (direct) return direct;
  }
  for (const [key, nested] of Object.entries(record)) {
    if (!/summary|overview|gist|recap|takeaway|description/i.test(key)) continue;
    const nestedText = findFirstSummaryText(nested);
    if (nestedText) return nestedText;
  }
  return undefined;
}

function formatShortTimestamp(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function extractIframeSrc(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/\ssrc=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]) : undefined;
}

function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return undefined;
  const hours = Number.parseFloat(match[1] ?? "0");
  const minutes = Number.parseFloat(match[2] ?? "0");
  const seconds = Number.parseFloat(match[3] ?? "0");
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total > 0 ? total : undefined;
}

function readJsonLdAuthor(jsonLd: Record<string, unknown>): string | undefined {
  const author = jsonLd.author;
  if (typeof author === "string") return author;
  if (author && typeof author === "object" && !Array.isArray(author)) {
    return asString((author as Record<string, unknown>).name);
  }
  return undefined;
}

function cleanGenericTitle(value: string | undefined, providerName: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^error\s*-/i.test(trimmed)) return undefined;
  return trimmed.replace(new RegExp(`\\s+[-|]\\s+${escapeRegExp(providerName)}$`, "i"), "").trim();
}

function cleanDescription(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith(GENERIC_LOOM_DESCRIPTION)) return undefined;
  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function readPath(record: Record<string, unknown> | undefined, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
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

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
