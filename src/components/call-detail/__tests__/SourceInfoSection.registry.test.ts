import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/call-detail/SourceInfoSection.tsx"),
  "utf8",
);

describe("SourceInfoSection source icon wiring", () => {
  it("uses shared source platform icons instead of a local source switch", () => {
    expect(source).toMatch(/getSourcePlatformIcon\(sourceApp\)/);
    expect(source).not.toMatch(/switch \(sourceApp\)/);
    expect(source).not.toMatch(/RiCloudLine|RiVideoLine|RiYoutubeLine|RiUploadCloud2Line/);
  });

  it("routes source detail renderers through a keyed map instead of raw-data shape checks", () => {
    expect(source).toMatch(/SOURCE_DETAIL_RENDERERS/);
    expect(source).toMatch(/getCanonicalDisplaySource\(sourceApp\)/);
    expect(source).not.toMatch(/'recorded_by_name' in rawData/);
    expect(source).not.toMatch(/'zoom_meeting_id' in rawData/);
    expect(source).not.toMatch(/'youtube_video_id' in rawData/);
    expect(source).not.toMatch(/'original_filename' in rawData/);
  });
});
