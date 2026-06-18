import { describe, expect, it } from "vitest";
import {
  formatLoomTranscriptJson,
  mergeLoomMetadata,
  normalizeSupportedSourceUrl,
  parseGenericSourceMetadataHtml,
  parseLoomMetadataHtml,
  parseZoomPlayInfoMetadata,
  parseZoomRecordingMobilePlayData,
} from "../loom-metadata";

describe("source link metadata parsing", () => {
  it("normalizes supported source URLs without allowing arbitrary fetch targets", () => {
    expect(normalizeSupportedSourceUrl("https://www.loom.com/share/abc123")?.sourceApp).toBe("loom");
    expect(normalizeSupportedSourceUrl("https://fathom.video/share/fathom123")?.sourceApp).toBe("fathom-paste");
    expect(normalizeSupportedSourceUrl("https://otter.ai/u/otter123")?.sourceApp).toBe("otter");
    expect(normalizeSupportedSourceUrl("https://company.zoom.us/rec/share/zoom123")?.sourceApp).toBe("zoom");
    expect(normalizeSupportedSourceUrl("https://grain.com/note/grain-id/link-secret")?.sourceApp).toBe("grain");
    expect(normalizeSupportedSourceUrl("https://app.fireflies.ai/view/fireflies123")?.sourceApp).toBe("fireflies");
    expect(normalizeSupportedSourceUrl("https://app.read.ai/analytics/meetings/read123")?.sourceApp).toBe("read-ai");
    expect(normalizeSupportedSourceUrl("https://calendly.com/s/meetings/calendly123")?.sourceApp).toBe("calendly");
    expect(normalizeSupportedSourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.sourceApp).toBe("youtube");
    expect(normalizeSupportedSourceUrl("https://youtu.be/dQw4w9WgXcQ")?.shareToken).toBe("dQw4w9WgXcQ");
    expect(normalizeSupportedSourceUrl("https://example.com/share/abc123")).toBeNull();
  });

  it("builds a YouTube oEmbed target for fast link previews", () => {
    const normalized = normalizeSupportedSourceUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share");

    expect(normalized).toMatchObject({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      shareToken: "dQw4w9WgXcQ",
      sourceApp: "youtube",
      providerName: "YouTube",
    });
    expect(normalized?.oembedUrl).toContain("https://www.youtube.com/oembed");
    expect(normalized?.oembedUrl).toContain("dQw4w9WgXcQ");
  });

  it("extracts rich Loom metadata from oEmbed plus page HTML without transcript URLs", () => {
    const html = `
      <title>New Grain Features for AI | Loom</title>
      <meta property="og:title" content="New Grain Features for AI">
      <script type="application/ld+json">{
        "uploadDate": "2026-04-08T23:41:33.883Z",
        "duration": "PT89.356S",
        "thumbnailUrl": "https://cdn.loom.com/thumb.jpg"
      }</script>
      <script>
        window.__APOLLO_STATE__ = {
          "RegularUser:15452822": {"display_name": "Jeff Whitlock"},
          "RegularUserVideo:abc123": {
            "name": "New Grain Features for AI",
            "owner": {"__ref": "RegularUser:15452822"},
            "createdAt": "2026-04-08T23:41:33.883Z",
            "playable_duration": 89.356,
            "thumbnails": {"default": "https://cdn.loom.com/thumb.jpg", "defaultGif": "https://cdn.loom.com/thumb.gif"},
            "video_properties": {"width": 1670, "height": 1080}
          }
        };
      </script>`;

    const metadata = mergeLoomMetadata(
      "https://www.loom.com/share/abc123",
      "abc123",
      { provider_name: "Loom", title: "New Grain Features for AI", duration: 96.516 },
      parseLoomMetadataHtml(html, "https://www.loom.com/share/abc123", "abc123"),
    );

    expect(metadata).toMatchObject({
      provider_name: "Loom",
      title: "New Grain Features for AI",
      thumbnail_url: "https://cdn.loom.com/thumb.jpg",
      animated_thumbnail_url: "https://cdn.loom.com/thumb.gif",
      author_name: "Jeff Whitlock",
      created_at: "2026-04-08T23:41:33.883Z",
      duration_seconds: 89.356,
      width: 1670,
      height: 1080,
    });
    expect(JSON.stringify(metadata)).not.toContain("transcript");
  });

  it("extracts generic Open Graph metadata for other supported links", () => {
    const metadata = parseGenericSourceMetadataHtml(
      `
        <title>Weekly Customer Call</title>
        <meta property="og:title" content="Weekly Customer Call">
        <meta property="og:description" content="Customer call recap">
        <meta property="og:image" content="https://example.com/thumb.jpg">
      `,
      "https://fathom.video/share/abc123",
      "abc123",
      "Fathom",
      "fathom-paste",
    );

    expect(metadata).toMatchObject({
      provider_name: "Fathom",
      title: "Weekly Customer Call",
      description: "Customer call recap",
      thumbnail_url: "https://example.com/thumb.jpg",
    });
  });

  it("formats Loom transcript JSON into timestamped paste text", () => {
    const transcript = formatLoomTranscriptJson({
      phrases: [
        { ts: 0.011, value: "Hey, this is Jeff from Grain." },
        { ts: 12.42, value: "Here is the next feature." },
      ],
    });

    expect(transcript).toBe("0:00 Hey, this is Jeff from Grain.\n0:12 Here is the next feature.");
  });

  it("extracts Grain recording metadata and transcript text from public page JSON", () => {
    const recording = JSON.stringify({
      id: "grain-id",
      owner: { name: "Andrew Naegele" },
      title: "Logistics & Identity Map",
      duration: 3555084,
      startDatetime: "2026-05-26T14:00:00.000Z",
      fullJpegThumbnailUrl: "https://media.grain.com/thumb.jpg",
      intelligence: {
        notes: {
          blob: {
            markdownBlob: "## Logistics & Program Schedule\n- Completed Basecamp One.",
          },
        },
      },
      transcript: {
        data: {
          results: [[1930, "Andrew.", 2250], [6090, "Can", 6250], [6490, "you", 6570], [6570, "hear", 6650], [6970, "me?", 7050]],
          speakers: [{ id: "speaker-1", name: "Patrick Jones" }],
          speakerRanges: [{ speakerId: "speaker-1", startIndex: 0, endIndex: 4, startMs: 1930 }],
        },
      },
    })
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");

    const metadata = parseGenericSourceMetadataHtml(
      `<meta name="grain:recording:json" content="${recording}">`,
      "https://grain.com/note/grain-id/link-secret",
      "note/grain-id/link-secret",
      "Grain",
      "grain",
    );

    expect(metadata).toMatchObject({
      provider_name: "Grain",
      title: "Logistics & Identity Map",
      author_name: "Andrew Naegele",
      created_at: "2026-05-26T14:00:00.000Z",
      duration_seconds: 3555,
      summary: "## Logistics & Program Schedule\n- Completed Basecamp One.",
      transcript_source: "grain-recording-json",
    });
    expect(metadata.transcript_text).toBe("0:01 Patrick Jones: Andrew. Can you hear me?");
  });

  it("extracts Fireflies meeting metadata from Next.js page data", () => {
    const metadata = parseGenericSourceMetadataHtml(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            initialMeetingNote: {
              _id: "fireflies123",
              title: "AI-Ready Broker: Live Install",
              durationMins: "115.83999633789062",
              ownerProfile: { name: "Andrew Naegele" },
              date: "2026-05-19T18:00:00.000Z",
              summary: { gist: "The meeting introduced AI tools." },
            },
          },
        },
      })}</script>`,
      "https://app.fireflies.ai/view/fireflies123",
      "fireflies123",
      "Fireflies",
      "fireflies",
    );

    expect(metadata).toMatchObject({
      provider_name: "Fireflies",
      title: "AI-Ready Broker: Live Install",
      summary: "The meeting introduced AI tools.",
      author_name: "Andrew Naegele",
      created_at: "2026-05-19T18:00:00.000Z",
      duration_seconds: 6950,
    });
  });

  it("drops the broken Fireflies og-preview unfurl image as a thumbnail", () => {
    const metadata = parseGenericSourceMetadataHtml(
      `<meta property="og:image" content="https://share.fireflies.ai/og-preview?title=Demo&name=Ed">
       <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            initialMeetingNote: {
              _id: "fireflies456",
              title: "Demo",
              summary: { gist: "A demo meeting." },
            },
          },
        },
      })}</script>`,
      "https://app.fireflies.ai/view/fireflies456",
      "fireflies456",
      "Fireflies",
      "fireflies",
    );

    // og-preview returns HTTP 500 and is not a usable content thumbnail — it must be omitted.
    expect(metadata.thumbnail_url).toBeUndefined();
    expect(metadata.title).toBe("Demo");
  });

  it("extracts Zoom player bootstrap IDs from public recording pages", () => {
    const data = parseZoomRecordingMobilePlayData(`
      <script>
      window.recordingMobilePlayData = {
        meetingId: 'meeting-token',
        fileId: '',
        nwsDomain: '',
        siteName: 'Zoom'
      };
      </script>
    `);

    expect(data).toEqual({
      meetingId: "meeting-token",
    });
  });

  it("extracts Zoom play-info metadata from public recording JSON", () => {
    const metadata = parseZoomPlayInfoMetadata(
      {
        result: {
          meet: {
            topic: "THE LAB",
            meetingStartTimeStr: "May 5, 2026 02:04 PM",
          },
          duration: 7875,
          viewMp4UrlThumbnail: {
            thumbnail_urls: ["https://zoom.us/thumb.jpg"],
          },
        },
      },
      "https://zoom.us/rec/share/zoom123",
      "rec/share/zoom123",
    );

    expect(metadata).toMatchObject({
      provider_name: "Zoom",
      title: "THE LAB",
      description: "THE LAB",
      created_at: "2026-05-05T14:04:00.000Z",
      duration_seconds: 7875,
      thumbnail_url: "https://zoom.us/thumb.jpg",
    });
    expect(metadata.transcript_text).toBeUndefined();
  });
});
