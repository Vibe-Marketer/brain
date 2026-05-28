import { describe, expect, it } from "vitest";
import {
  mergeLoomMetadata,
  normalizeSupportedSourceUrl,
  parseGenericSourceMetadataHtml,
  parseLoomMetadataHtml,
} from "../loom-metadata";

describe("source link metadata parsing", () => {
  it("normalizes supported source URLs without allowing arbitrary fetch targets", () => {
    expect(normalizeSupportedSourceUrl("https://www.loom.com/share/abc123")?.sourceApp).toBe("loom");
    expect(normalizeSupportedSourceUrl("https://fathom.video/share/fathom123")?.sourceApp).toBe("fathom-paste");
    expect(normalizeSupportedSourceUrl("https://otter.ai/u/otter123")?.sourceApp).toBe("otter");
    expect(normalizeSupportedSourceUrl("https://company.zoom.us/rec/share/zoom123")?.sourceApp).toBe("zoom");
    expect(normalizeSupportedSourceUrl("https://example.com/share/abc123")).toBeNull();
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
});
