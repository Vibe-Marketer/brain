import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateFathomRecord } from "../fathom-content.ts";
import type { ConnectorRecordLike } from "../canonical-recording.ts";
import type { FathomFetchOptions } from "../fathom-client.ts";
import { FathomClient, FathomRateLimitError, fathomListPage } from "../fathom-client.ts";

const metadataOnly: ConnectorRecordLike = {
  external_id: "123456789",
  source_app: "fathom",
  title: "Weekly team call",
  full_transcript: "",
  recording_start_time: "2026-07-28T13:00:00.000Z",
  recording_end_time: "2026-07-28T13:30:00.000Z",
  organization_id: "source-org",
  source_metadata: {
    recording_id: 123456789,
    url: "https://fathom.video/calls/987654321",
    share_url: "https://fathom.video/share/example",
    recorded_by: { name: "John", email: "john@example.com" },
    import_source: "connector-sync-all",
  },
};

const transcript = {
  transcript: [
    {
      speaker: { display_name: "John", matched_calendar_invitee_email: "john@example.com" },
      text: "First action item.",
      timestamp: "00:00:12",
    },
    { speaker: { display_name: "Andrew" }, text: "Second action item.", timestamp: "00:01:03" },
  ],
};

function contentFetcher(
  transcriptResponse: () => Response = () => Response.json(transcript),
  summaryResponse: () => Response = () => Response.json({ summary: { markdown_formatted: "## Decisions\nFollow up." } }),
) {
  return vi.fn(async (url: string, _options: FathomFetchOptions) =>
    url.endsWith("/transcript") ? transcriptResponse() : summaryResponse(),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Fathom Sync All content hydration", () => {
  it("fetches actual content for a metadata-only list item and preserves speaker timing, summary and source URLs", async () => {
    const fetchContent = contentFetcher();
    const result = await hydrateFathomRecord(metadataOnly, "test-token", { fetchContent });

    expect(fetchContent.mock.calls.map(([url]) => url).sort()).toEqual([
      "https://api.fathom.ai/external/v1/recordings/123456789/summary",
      "https://api.fathom.ai/external/v1/recordings/123456789/transcript",
    ]);
    expect(fetchContent.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer test-token" },
      maxRetries: 1,
    });
    expect(result).toMatchObject({
      external_id: metadataOnly.external_id,
      organization_id: "source-org",
      title: metadataOnly.title,
      full_transcript: "[0:12] John: First action item.\n\n[1:03] Andrew: Second action item.",
      summary: "## Decisions\nFollow up.",
      duration: 1800,
      transcript_segments: [
        { speaker_name: "John", speaker_email: "john@example.com", start_seconds: 12, text: "First action item." },
        { speaker_name: "Andrew", start_seconds: 63, text: "Second action item." },
      ],
      source_metadata: {
        fathom_call_id: "123456789",
        fathom_url: "https://fathom.video/calls/987654321",
        fathom_share_url: "https://fathom.video/share/example",
        import_source: "connector-sync-all",
        recorded_by_name: "John",
        transcript_speaker_names: ["John", "Andrew"],
      },
    });
    expect(metadataOnly.full_transcript).toBe("");
  });

  it.each([401, 403, 404, 503])("fails transcript HTTP %s instead of saving an empty transcript", async (status) => {
    const fetchContent = contentFetcher(() => new Response(null, { status }));
    await expect(hydrateFathomRecord(metadataOnly, "test-token", { fetchContent }))
      .rejects.toThrow(`FATHOM_TRANSCRIPT_HTTP_${status}`);
  });

  it.each([401, 503])("fails summary HTTP %s rather than claiming a complete import", async (status) => {
    const fetchContent = contentFetcher(undefined, () => new Response(null, { status }));
    await expect(hydrateFathomRecord(metadataOnly, "test-token", { fetchContent }))
      .rejects.toThrow(`FATHOM_SUMMARY_HTTP_${status}`);
  });

  it.each([
    () => new Response(null, { status: 404 }),
    () => Response.json({ summary: null }),
  ])("allows an explicitly unavailable optional summary when transcript is present", async (summaryResponse) => {
    const result = await hydrateFathomRecord(metadataOnly, "test-token", {
      fetchContent: contentFetcher(undefined, summaryResponse),
    });
    expect(result.summary).toBeNull();
    expect(result.full_transcript).toContain("First action item.");
  });

  it.each([
    { transcript: [] },
    { transcript: [{ speaker: { display_name: "John" }, text: "   " }] },
  ])("rejects empty or blank transcripts", async (payload) => {
    await expect(hydrateFathomRecord(metadataOnly, "test-token", {
      fetchContent: contentFetcher(() => Response.json(payload)),
    })).rejects.toThrow("FATHOM_TRANSCRIPT_EMPTY");
  });

  it.each([{}, { transcript: "unexpected string" }, { transcript: [{ unexpected: "shape" }] }])(
    "rejects malformed transcript responses",
    async (payload) => {
      await expect(hydrateFathomRecord(metadataOnly, "test-token", {
        fetchContent: contentFetcher(() => Response.json(payload)),
      })).rejects.toThrow("FATHOM_TRANSCRIPT_INVALID_RESPONSE");
    },
  );

  it("rejects malformed summary responses", async () => {
    await expect(hydrateFathomRecord(metadataOnly, "test-token", {
      fetchContent: contentFetcher(undefined, () => Response.json({ summary: { text: "unrecognized" } })),
    })).rejects.toThrow("FATHOM_SUMMARY_INVALID_RESPONSE");
  });

  it("limits stalled content requests with a shared abort deadline", async () => {
    vi.useFakeTimers();
    const fetchContent = vi.fn((_url: string, options: FathomFetchOptions) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = hydrateFathomRecord(metadataOnly, "test-token", { fetchContent, timeoutMs: 500 });
    const assertion = expect(pending).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(fetchContent.mock.calls.every(([, options]) => options.signal?.aborted)).toBe(true);
  });

  it.each(["transcript", "summary"])("defers %s rate limits using Retry-After instead of losing the item", async (kind) => {
    const fetchContent = async (url: string) => url.endsWith(`/${kind}`)
      ? new Response(null, { status: 429, headers: { "Retry-After": "12" } })
      : url.endsWith("/transcript") ? Response.json(transcript) : Response.json({ summary: null });
    await expect(hydrateFathomRecord(metadataOnly, "test-token", { fetchContent }))
      .rejects.toMatchObject({ name: "FathomRateLimitError", retryAfterSeconds: 12 });
  });

  it("does not spend inline retries against a known provider rate limit", async () => {
    const upstream = vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "12" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await FathomClient.fetchWithRetry("https://api.fathom.ai/example", { retryRateLimits: false });
    expect(response.status).toBe(429);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("does not report list rate limits or server failures as an exhausted stream", async () => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
    const params = { accessToken: "fixture", cursor: "saved-cursor", dateStart: null, dateEnd: null };
    await expect(fathomListPage(params, async () => new Response(null, {
      status: 429, headers: { "Retry-After": "12" },
    }))).rejects.toMatchObject({ name: "FathomRateLimitError", retryAfterSeconds: 12 });
    await expect(fathomListPage(params, async () => new Response(null, { status: 503 })))
      .rejects.toThrow("FATHOM_LIST_HTTP_503");
  });

  it("caps unusually long retry delays below the Edge runtime ceiling", () => {
    const error = new FathomRateLimitError(new Response(null, { status: 429, headers: { "Retry-After": "3600" } }));
    expect(error.retryAfterSeconds).toBe(60);
  });
});
