import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("grain-webhook wiring", () => {
  it("routes incoming Grain hooks through import_sources.webhook_path_token", () => {
    expect(source).toMatch(/extractPathToken/);
    expect(source).toMatch(/\.eq\('source_app', 'grain'\)/);
    expect(source).toMatch(/\.eq\('webhook_path_token', pathToken\)/);
    expect(source).toMatch(/\.eq\('is_active', true\)/);
  });

  it("accepts documented recording_added and recording_updated hook payloads", () => {
    expect(source).toMatch(/recording_added/);
    expect(source).toMatch(/recording_updated/);
    expect(source).toMatch(/payload\.data\?\.id/);
  });

  it("imports webhook recordings through the canonical connector pipeline with idempotency", () => {
    expect(source).toMatch(/processed_webhooks/);
    expect(source).toMatch(/buildWebhookId\(payload\.type,\s*recordingId,\s*rawBody\)/);
    expect(source).toMatch(/crypto\.subtle\.digest\(\s*'SHA-256'/);
    expect(source).toMatch(/getRecording<GrainRecording>/);
    expect(source).toMatch(/getRecordingTranscript/);
    expect(source).toMatch(/grainRecordingToCanonical/);
    expect(source).toMatch(/runCanonicalConnectorPipeline/);
    expect(source).toMatch(/importSource:\s*'grain-webhook'/);
  });

  it("does not collapse all future recording_updated events for the same recording", () => {
    expect(source).not.toMatch(/`grain_\$\{payload\.type\}_\$\{recordingId\}`/);
    expect(source).toMatch(/rawBody/);
  });
});
