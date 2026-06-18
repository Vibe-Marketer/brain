import { describe, expect, it, vi } from "vitest";
import {
  mapPlaudSharePayload,
  normalizePlaudShareUrl,
  parsePlaudMetadata,
} from "../plaud-metadata.ts";
import { normalizeSupportedSourceUrl } from "../loom-metadata.ts";
import samplePayloadJson from "./plaud-share-sample.json" with { type: "json" };

const SHARE_TOKEN =
  "pub_54becd16-4d97-46f6-936d-ad0c3bee6706::QW4QwYlbThKIaOQIM5QUNgGIZWG1GuqlsPt1kuERoPJ7xycp1m7lEJ8udSPZcy6Thcyk1TxxsGvGCMkC";

const samplePayload = samplePayloadJson as unknown as Record<string, unknown>;

describe("plaud share metadata parsing", () => {
  it("extracts the share token from /s/ URLs", () => {
    const normalized = normalizePlaudShareUrl(`https://web.plaud.ai/s/${SHARE_TOKEN}`);
    expect(normalized?.shareToken).toBe(SHARE_TOKEN);
    expect(normalized?.url).toBe(`https://web.plaud.ai/s/${SHARE_TOKEN}`);
  });

  it("extracts the share token from /nshare/ URLs and strips query/hash", () => {
    const normalized = normalizePlaudShareUrl(`https://web.plaud.ai/nshare/${SHARE_TOKEN}?utm=x#frag`);
    expect(normalized?.shareToken).toBe(SHARE_TOKEN);
    expect(normalized?.url).toBe(`https://web.plaud.ai/nshare/${SHARE_TOKEN}`);
  });

  it("accepts a bare pub_<uuid> share link with no :: suffix", () => {
    const bareToken = "pub_54becd16-4d97-46f6-936d-ad0c3bee6706";
    const normalized = normalizePlaudShareUrl(`https://web.plaud.ai/s/${bareToken}`);
    expect(normalized?.shareToken).toBe(bareToken);
    expect(normalized?.url).toBe(`https://web.plaud.ai/s/${bareToken}`);
    expect(normalizeSupportedSourceUrl(`https://web.plaud.ai/s/${bareToken}`)).toMatchObject({
      sourceApp: "plaud",
      shareToken: bareToken,
    });
  });

  it("rejects non-plaud hosts and tokens that are neither pub_ nor :: shaped", () => {
    expect(normalizePlaudShareUrl("https://example.com/s/abc::def")).toBeNull();
    expect(normalizePlaudShareUrl("https://web.plaud.ai/s/not-a-real-token")).toBeNull();
    expect(normalizePlaudShareUrl("https://web.plaud.ai/")).toBeNull();
  });

  it("routes Plaud share URLs through the shared source allow-list", () => {
    const normalized = normalizeSupportedSourceUrl(`https://web.plaud.ai/s/${SHARE_TOKEN}`);
    expect(normalized).toMatchObject({
      sourceApp: "plaud",
      providerName: "Plaud",
      shareToken: SHARE_TOKEN,
    });
    expect(normalizeSupportedSourceUrl(`https://web.plaud.ai/nshare/${SHARE_TOKEN}`)?.sourceApp).toBe("plaud");
  });

  it("maps the Plaud share payload to source link metadata", () => {
    const metadata = mapPlaudSharePayload(
      samplePayload,
      `https://web.plaud.ai/s/${SHARE_TOKEN}`,
      SHARE_TOKEN,
    );

    expect(metadata).toMatchObject({
      source_app: "plaud",
      provider_name: "Plaud",
      title: "06-07 Lecture: ADHD External Brain and Executive Function",
      language: "en",
      created_at: "2026-06-08T02:13:30.000Z",
      duration_seconds: 8843,
      transcript_source: "plaud-share-json",
    });
  });

  it("builds the transcript from the polished segments as Speaker: content lines", () => {
    const metadata = mapPlaudSharePayload(
      samplePayload,
      `https://web.plaud.ai/s/${SHARE_TOKEN}`,
      SHARE_TOKEN,
    );

    expect(metadata.transcript_text).toBeTruthy();
    const lines = metadata.transcript_text!.split("\n");
    expect(lines[0]).toMatch(/^Speaker 1: So looking at ADHD/);
    // Prefers polished text (no leading "Alright, " filler from trans_result[0]).
    expect(metadata.transcript_text).not.toContain("Alright, so looking at ADHD");
  });

  it("falls back to the outline when no AI notes summary is present", () => {
    const fileWithoutNotes = {
      ...samplePayload,
      data_file: {
        ...(samplePayload.data_file as Record<string, unknown>),
        notes_list: [],
      },
    };

    const metadata = mapPlaudSharePayload(
      fileWithoutNotes,
      `https://web.plaud.ai/s/${SHARE_TOKEN}`,
      SHARE_TOKEN,
    );

    expect(metadata.summary).toContain("- Idea Capture Tools");
  });

  it("uses the AI notes summary when present", () => {
    const metadata = mapPlaudSharePayload(
      samplePayload,
      `https://web.plaud.ai/s/${SHARE_TOKEN}`,
      SHARE_TOKEN,
    );
    expect(metadata.summary).toContain("# Building an External Brain for ADHD Productivity");
  });

  it("fetches the public share API with the token and no auth headers", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(samplePayload), { status: 200 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const metadata = await parsePlaudMetadata(
      SHARE_TOKEN,
      `https://web.plaud.ai/s/${SHARE_TOKEN}`,
      fetchImpl,
    );

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const [url, init] = calls[0];
    expect(String(url)).toBe(`https://api.plaud.ai/share/access/${encodeURIComponent(SHARE_TOKEN)}`);
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(metadata.title).toBe("06-07 Lecture: ADHD External Brain and Executive Function");
  });

  it("throws when the public share API returns a non-200 response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 404 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await expect(
      parsePlaudMetadata(SHARE_TOKEN, `https://web.plaud.ai/s/${SHARE_TOKEN}`, fetchImpl),
    ).rejects.toThrow("Plaud share HTTP 404");
  });
});
