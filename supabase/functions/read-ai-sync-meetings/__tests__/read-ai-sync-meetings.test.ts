import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("read-ai-sync-meetings wiring", () => {
  it("resolves sources through the shared Read.ai ownership/type guard", () => {
    expect(source).toMatch(/resolveReadAiSource\(supabase,\s*userId,\s*sourceId\)/);
  });

  it("validates workspace membership before creating the sync job", () => {
    expect(source.indexOf("validateRequestedWorkspaceId")).toBeLessThan(source.indexOf("return await runConnectorSyncJob"));
    expect(source).toMatch(/validateRequestedWorkspaceId/);
  });

  it("runs selected meetings through the canonical connector pipeline and returns completion details", () => {
    expect(source).toMatch(/getMeeting<ReadAiMeeting>/);
    expect(source).toMatch(/runCanonicalConnectorPipeline/);
    expect(source).toMatch(/waitForCompletion/);
    expect(source).toMatch(/finalStatus/);
  });

  it("uses the shared connector sync id resolver for explicit ids and date-window fallback", () => {
    expect(source).toMatch(/resolveConnectorSyncIds/);
    expect(source).toMatch(/idFields:\s*\['meetingIds', 'recordingIds'\]/);
    expect(source).toMatch(/fetchFallbackIds:\s*\(\) => fetchRecentMeetingIds/);
    expect(source).toMatch(/ConnectorRequestValidationError/);
    expect(source).not.toMatch(/const explicitIds = body\.singleCallId/);
  });
});
