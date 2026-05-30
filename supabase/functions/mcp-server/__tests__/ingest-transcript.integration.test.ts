import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { integrationDbReachable } from '../../../../src/test/integration-setup';

const DEFINITIONS_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/tools/definitions.ts');
const PIPELINE_PATH = resolve(process.cwd(), 'supabase/functions/_shared/connector-pipeline.ts');
const CATEGORIES_PATH = resolve(process.cwd(), 'supabase/functions/_shared/mcp-tool-categories.ts');
const REGISTRY_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/tools/registry.ts');
const INGEST_TOOL_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/tools/write/ingest_transcript.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('ingest_transcript Wave 0 contract', () => {
  it('declares ingest_transcript in write category and keeps markdown text output shape', () => {
    const defs = read(DEFINITIONS_PATH);
    const categories = read(CATEGORIES_PATH);
    const registry = read(REGISTRY_PATH);

    expect(defs).toMatch(/name:\s*'ingest_transcript'/);
    expect(defs).toMatch(/name:\s*'ingest_transcript'[\s\S]{1,1800}outputSchema:[\s\S]{1,600}required:\s*\[\s*'text'\s*\]/);
    expect(categories).toMatch(/ingest_transcript:\s*'write'/);
    expect(defs).toMatch(/Required for organization-scoped tokens/i);
    expect(registry).toMatch(/import\s+\{\s*ingestTranscriptTool\s*\}\s+from\s+'\.\/write\/ingest_transcript\.ts'/);
    expect(registry).toMatch(/ingestTranscriptTool/);
  });

  it('pins low-context ingest + Manual MCP Import provenance requirements in tool contract text', () => {
    const defs = read(DEFINITIONS_PATH);
    expect(defs).toMatch(/Low-context link-only\/title-only ingest is allowed/i);
    expect(defs).toMatch(/Manual MCP Import/i);
    expect(defs).toMatch(/source_date/i);
  });

  it('pins non-critical enrichment warning mode and recording-first success path', () => {
    const pipeline = read(PIPELINE_PATH);
    const ingestTool = read(INGEST_TOOL_PATH);
    expect(pipeline).toMatch(/Vault entry creation is non-blocking/i);
    expect(pipeline).toMatch(/recording is already committed/i);
    expect(ingestTool).toMatch(/runPipeline\(supabase,\s*mcpToken\.user_id,\s*record\)/);
    expect(ingestTool).toMatch(/warnings\.push/);
    expect(ingestTool).toMatch(/formatIngestMarkdownSummary/);
    expect(ingestTool).toMatch(/mcpOk\(/);
    expect(ingestTool).toMatch(/mcpError\(/);
  });
});

describe.skipIf(!integrationDbReachable)('ingest_transcript integration env guard', () => {
  it('runs only against the dedicated test Supabase project (no production fallback)', () => {
    expect(integrationDbReachable).toBe(true);
  });
});
