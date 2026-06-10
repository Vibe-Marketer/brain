import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path, "index.ts"), "utf8");
const sharedSource = (path: string) =>
  readFileSync(resolve(__dirname, "..", path), "utf8");

describe("connector routing override contracts", () => {
  it("passes Fathom and Zoom webhook connector bindings as fallback destinations", () => {
    for (const path of ["webhook", "zoom-webhook"]) {
      const source = functionSource(path);

      expect(source).toMatch(/resolveConnectorWorkspaceBinding/);
      expect(source).toMatch(/return binding\.workspaceId/);
      expect(source).toMatch(/fallback_workspace_id:\s*connectorWorkspaceId/);
      expect(source).not.toMatch(/\{\s*workspace_id:\s*connectorWorkspaceId/);
    }
  });

  it("passes canonical webhook connector bindings as fallback destinations", () => {
    for (const path of ["read-ai-webhook", "grain-webhook", "fireflies-webhook"]) {
      const source = functionSource(path);

      expect(source).toMatch(/runCanonicalConnectorPipeline/);
      expect(source).toMatch(/fallbackWorkspaceId:\s*workspaceBinding\.workspaceId/);
      expect(source).not.toMatch(/workspaceId:\s*workspaceBinding\.workspaceId/);
    }
  });

  it("keeps explicit requested workspaces authoritative while using connector bindings as sync fallbacks", () => {
    for (const path of ["grain-sync-recordings", "read-ai-sync-meetings", "fireflies-sync-meetings"]) {
      const source = functionSource(path);

      expect(source).toMatch(/const importWorkspaceId = validatedWorkspaceId/);
      expect(source).toMatch(/const fallbackWorkspaceId = workspaceBinding\.workspaceId/);
      expect(source).toMatch(/workspaceId:\s*importWorkspaceId/);
      expect(source).toMatch(/fallbackWorkspaceId/);
    }

    for (const path of ["sync-meetings", "zoom-sync-meetings"]) {
      const source = functionSource(path);

      expect(source).toMatch(/const validatedVaultId:\s*string \| null = validatedWorkspaceId/);
      expect(source).toMatch(/fallbackVaultId = binding\.workspaceId/);
      expect(source).toMatch(/fallback_workspace_id:\s*fallbackWorkspaceId/);
    }
  });

  it("persists Zoom VTT segments through the shared pipeline", () => {
    for (const path of ["zoom-sync-meetings", "zoom-webhook"]) {
      const source = functionSource(path);

      expect(source).toMatch(/zoomTranscriptSegmentsToStoredSegments/);
      expect(source).toMatch(/transcript_segments:\s*zoomTranscriptSegmentsToStoredSegments\(transcriptSegments\)/);
      expect(source).toMatch(/timestampToSeconds\(segment\.start_time\)/);
      expect(source).toMatch(/fathom_raw_transcripts/);
    }
  });

  it("supports fallback destinations in the shared pipeline and canonical adapter", () => {
    const pipelineSource = sharedSource("connector-pipeline.ts");
    const canonicalSource = sharedSource("canonical-recording.ts");

    expect(pipelineSource).toMatch(/fallback_workspace_id\?: string/);
    expect(pipelineSource).toMatch(/record\.fallback_workspace_id/);
    expect(canonicalSource).toMatch(/fallbackWorkspaceId\?: string \| null/);
    expect(canonicalSource).toMatch(/fallback_workspace_id: options\.fallbackWorkspaceId/);
  });
});
