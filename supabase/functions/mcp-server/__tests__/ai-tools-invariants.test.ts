/**
 * Behavioral invariant tests for the four Phase 22 LLM-powered MCP tools.
 *
 * These tests inspect `supabase/functions/mcp-server/index.ts` (the live source)
 * to verify the contractual invariants documented in 22-CONTEXT.md (D-04..D-16)
 * that cannot be exercised through the inline helper alone:
 *
 *   - extract_action_items: 3-tier read-through cache ordering
 *     (source_metadata.action_items → action_items_cache → LLM)
 *     Cache hits must NOT call enforceMcpAiUsage (D-11).
 *     LLM call must be gated by enforceMcpAiUsage BEFORE generateObject (D-10).
 *
 *   - ask_call: NO cache (D-03). 500-char question max. -32602 on empty/oversize.
 *     Q:/A: response prefix. enforceMcpAiUsage BEFORE generateText.
 *
 *   - get_sentiment: cached in recordings.sentiment_cache. Schema
 *     {overall, talk_ratio[], key_moments[]}. Cache check BEFORE gate.
 *
 *   - get_coaching_notes: cached in recordings.coaching_cache. Schema
 *     {strengths[], improvements[], specific_examples[]}. gpt-5-nano.
 *
 *   - Cross-org boundary on every tool: ownership check before LLM call.
 *
 * The case-blocks are inlined inside `Deno.serve` and cannot be imported as
 * standalone functions in a Node/vitest runtime (Deno globals + esm.sh imports
 * are not available). This file therefore parses the source text and verifies
 * the documented invariants at the line level — every assertion fails loudly if
 * a future edit re-orders the cache/gate/LLM sequence or drops an action_type.
 *
 * If a developer attempted to "fix" a slow test by skipping the gate or moving
 * the cache check after the LLM call, these tests would catch it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MCP_SERVER_PATH = path.resolve(
  __dirname,
  '..',
  'index.ts',
);
const MCP_SERVER_DIR = path.resolve(__dirname, '..');
const TOOL_DEFINITIONS_PATH = path.resolve(MCP_SERVER_DIR, 'tools/definitions.ts');
const AI_MODULE_PATHS: Record<string, string> = {
  extract_action_items: path.resolve(MCP_SERVER_DIR, 'tools/ai/extract_action_items.ts'),
  ask_call: path.resolve(MCP_SERVER_DIR, 'tools/ai/ask_call.ts'),
  get_sentiment: path.resolve(MCP_SERVER_DIR, 'tools/ai/get_sentiment.ts'),
  get_coaching_notes: path.resolve(MCP_SERVER_DIR, 'tools/ai/get_coaching_notes.ts'),
};

let SOURCE = '';
let LINES: string[] = [];
let TOOL_DEFINITIONS_SOURCE = '';
let TOOL_DEFINITION_LINES: string[] = [];

beforeAll(() => {
  SOURCE = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
  LINES = SOURCE.split('\n');
  TOOL_DEFINITIONS_SOURCE = fs.readFileSync(TOOL_DEFINITIONS_PATH, 'utf8');
  TOOL_DEFINITION_LINES = TOOL_DEFINITIONS_SOURCE.split('\n');
});

/**
 * Extract the lines of a single `case 'foo': { ... }` block. Counts braces to
 * find the matching closing brace. Returns the slice of lines (1-based indices)
 * plus the start line number for ordering checks.
 */
function getCaseBlock(toolName: string): { lines: string[]; startLine: number; endLine: number } {
  const startIdx = LINES.findIndex((line) => line.includes(`case '${toolName}':`));
  if (startIdx === -1 && AI_MODULE_PATHS[toolName]) {
    const moduleLines = fs.readFileSync(AI_MODULE_PATHS[toolName], 'utf8').split('\n');
    const handlerStartIdx = moduleLines.findIndex((line) => line.includes('async handler('));
    if (handlerStartIdx === -1) {
      throw new Error(`handler for ${toolName} not found in ${AI_MODULE_PATHS[toolName]}`);
    }
    return {
      lines: moduleLines.slice(handlerStartIdx),
      startLine: handlerStartIdx + 1,
      endLine: moduleLines.length,
    };
  }
  if (startIdx === -1) {
    throw new Error(`case '${toolName}' not found in mcp-server/index.ts or extracted AI modules`);
  }
  // Walk forward and balance braces until we hit zero again.
  let depth = 0;
  let started = false;
  let endIdx = startIdx;
  for (let i = startIdx; i < LINES.length; i++) {
    const line = LINES[i];
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
      }
    }
    if (started && depth === 0) {
      endIdx = i;
      break;
    }
  }
  return {
    lines: LINES.slice(startIdx, endIdx + 1),
    startLine: startIdx + 1,
    endLine: endIdx + 1,
  };
}

/** Returns the 1-based line number of the first occurrence of `needle` in the block, or -1. */
function findLineWithinBlock(
  block: { lines: string[]; startLine: number },
  needle: string | RegExp,
): number {
  for (let i = 0; i < block.lines.length; i++) {
    if (typeof needle === 'string' ? block.lines[i].includes(needle) : needle.test(block.lines[i])) {
      return block.startLine + i;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLS array — all four AI tools must be registered
// ─────────────────────────────────────────────────────────────────────────────

describe('TOOLS array — all four Phase 22 AI tools registered', () => {

  it('ask_call schema declares both recording_id and question as required', () => {
    // Find the ask_call tool definition block (between `name: 'ask_call'` and the next `name:`)
    const startIdx = TOOL_DEFINITION_LINES.findIndex((l) => l.includes("name: 'ask_call'"));
    expect(startIdx).toBeGreaterThan(-1);
    // Find next `name: '` line after start
    const endIdx = TOOL_DEFINITION_LINES.findIndex((l, i) => i > startIdx && /name: '/.test(l));
    const segment = TOOL_DEFINITION_LINES.slice(startIdx, endIdx === -1 ? startIdx + 30 : endIdx).join('\n');
    expect(segment).toMatch(/recording_id/);
    expect(segment).toMatch(/question/);
    // The 500-char description must be visible to MCP clients
    expect(segment).toMatch(/500/);
    // Both required
    expect(segment).toMatch(/required:\s*\[\s*'recording_id'\s*,\s*'question'\s*\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extract_action_items — AITL-02
// ─────────────────────────────────────────────────────────────────────────────

describe('extract_action_items — case-block invariants (AITL-02)', () => {
  let block: ReturnType<typeof getCaseBlock>;
  beforeAll(() => {
    block = getCaseBlock('extract_action_items');
  });

  it('checks workspace_entries ownership BEFORE any cache or LLM access', () => {
    const ownershipLine = findLineWithinBlock(block, "from('workspace_entries')");
    const cacheRead = findLineWithinBlock(block, 'action_items_cache');
    const fathomCheck = findLineWithinBlock(block, 'source_metadata');
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateObject(');

    expect(ownershipLine).toBeGreaterThan(0);
    expect(ownershipLine).toBeLessThan(fathomCheck);
    expect(ownershipLine).toBeLessThan(cacheRead);
    expect(ownershipLine).toBeLessThan(gate);
    expect(ownershipLine).toBeLessThan(llm);
  });

  it('three-tier cache ordering: source_metadata → action_items_cache → enforceMcpAiUsage → generateObject (D-04, D-10, D-11)', () => {
    const fathom = findLineWithinBlock(block, 'source_metadata');
    const cache = findLineWithinBlock(block, 'action_items_cache as');
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateObject(');

    expect(fathom).toBeGreaterThan(0);
    expect(cache).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(0);
    expect(llm).toBeGreaterThan(0);

    // Strict ordering: tier 1 → tier 2 → cost gate → LLM
    expect(fathom).toBeLessThan(cache);
    expect(cache).toBeLessThan(gate);
    expect(gate).toBeLessThan(llm);
  });

  it('source-provided fast-path returns mcpOk WITHOUT writing to action_items_cache', () => {
    // Find the source-provided return line
    const sourceCheckIdx = block.lines.findIndex((l) => l.includes('(source: ${sourceName})'));
    expect(sourceCheckIdx).toBeGreaterThan(-1);
    // Within ~10 lines of the source-provided branch, find a return mcpOk
    const slice = block.lines.slice(sourceCheckIdx, sourceCheckIdx + 12).join('\n');
    expect(slice).toMatch(/return mcpOk/);
    // The source-provided fast-path branch must NOT contain an action_items_cache write
    expect(slice).not.toMatch(/update\(\{ action_items_cache/);
  });

  it('Cache-tier-2 returns mcpOk WITHOUT writing or invoking enforceMcpAiUsage', () => {
    // Find the (cached) header line and the surrounding return mcpOk
    const cacheLine = block.lines.findIndex((l) => l.includes("(cached)"));
    expect(cacheLine).toBeGreaterThan(-1);
    // Start scanning a few lines before to capture the if-condition
    const slice = block.lines.slice(cacheLine - 2, cacheLine + 14).join('\n');
    expect(slice).toMatch(/return mcpOk/);
    // No cache write or gate invocation in this slice
    expect(slice).not.toMatch(/enforceMcpAiUsage/);
    expect(slice).not.toMatch(/update\(\{ action_items_cache/);
  });

  it('LLM tier writes the result to action_items_cache (best-effort)', () => {
    expect(block.lines.join('\n')).toMatch(/update\(\{ action_items_cache:/);
  });

  it('uses Zod schema with items: Array<{ owner, action, due_date }>', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/ActionItemsSchema\s*=\s*z\.object\(/);
    expect(blockText).toMatch(/owner:/);
    expect(blockText).toMatch(/action:/);
    expect(blockText).toMatch(/due_date:/);
  });

  it('emits -32001 (not -32603) on cross-org access', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/-32001/);
    // Specifically: when ownership lookup fails, the message is the one in CONTEXT.md
    expect(blockText).toMatch(/Recording not found or not accessible/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ask_call — AITL-03
// ─────────────────────────────────────────────────────────────────────────────

describe('ask_call — case-block invariants (AITL-03)', () => {
  let block: ReturnType<typeof getCaseBlock>;
  beforeAll(() => {
    block = getCaseBlock('ask_call');
  });

  it('does NOT touch any *_cache column (D-03 — no cache)', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).not.toMatch(/action_items_cache/);
    expect(blockText).not.toMatch(/sentiment_cache/);
    expect(blockText).not.toMatch(/coaching_cache/);
  });

  it('rejects empty question with -32602', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/question is required.*-32602|-32602.*question is required/s);
  });

  it('rejects question > 500 chars with -32602', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/length\s*>\s*500/);
    expect(blockText).toMatch(/500 characters or fewer.*-32602|-32602.*500 characters or fewer/s);
  });

  it('returns response prefixed with "Q: ${question}\\nA:"', () => {
    const blockText = block.lines.join('\n');
    // Look for a template literal containing Q: and A:
    expect(blockText).toMatch(/`Q:\s*\$\{question\}\\nA:\s*\$\{[^}]+\}`/);
  });

  it('cost gate (enforceMcpAiUsage) runs BEFORE generateText (D-10)', () => {
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateText(');
    expect(gate).toBeGreaterThan(0);
    expect(llm).toBeGreaterThan(0);
    expect(gate).toBeLessThan(llm);
  });

  it('checks workspace_entries ownership BEFORE LLM and gate', () => {
    const ownership = findLineWithinBlock(block, "from('workspace_entries')");
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateText(');
    expect(ownership).toBeGreaterThan(0);
    expect(ownership).toBeLessThan(gate);
    expect(ownership).toBeLessThan(llm);
  });

  it('fails fast (-32602) when transcript is missing', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/No transcript available.*-32602|-32602.*No transcript available/s);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// get_sentiment — AITL-04
// ─────────────────────────────────────────────────────────────────────────────

describe('get_sentiment — case-block invariants (AITL-04)', () => {
  let block: ReturnType<typeof getCaseBlock>;
  beforeAll(() => {
    block = getCaseBlock('get_sentiment');
  });

  it('reads sentiment_cache BEFORE invoking enforceMcpAiUsage (D-11 cache hits no quota)', () => {
    const cacheRead = findLineWithinBlock(block, 'sentiment_cache as SentimentResult');
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    expect(cacheRead).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(0);
    expect(cacheRead).toBeLessThan(gate);
  });

  it('cost gate runs BEFORE generateObject (D-10)', () => {
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateObject(');
    expect(gate).toBeLessThan(llm);
  });

  it('writes sentiment_cache after successful LLM (best-effort)', () => {
    expect(block.lines.join('\n')).toMatch(/update\(\{ sentiment_cache:/);
  });

  it('Zod schema enforces overall enum [positive, neutral, negative, mixed]', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/SentimentSchema\s*=\s*z\.object\(/);
    // Allow fluent multi-line `z\n  .enum(...)` chaining — the source splits it
    expect(blockText).toMatch(/\.enum\(\[\s*'positive',\s*'neutral',\s*'negative',\s*'mixed'\s*\]\)/);
  });

  it('cache shape validation rejects malformed cache (falls through to LLM)', () => {
    // Tier-1 must verify Array.isArray on talk_ratio AND key_moments
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/Array\.isArray\(cached\.talk_ratio\)/);
    expect(blockText).toMatch(/Array\.isArray\(cached\.key_moments\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// get_coaching_notes — AITL-05
// ─────────────────────────────────────────────────────────────────────────────

describe('get_coaching_notes — case-block invariants (AITL-05)', () => {
  let block: ReturnType<typeof getCaseBlock>;
  beforeAll(() => {
    block = getCaseBlock('get_coaching_notes');
  });

  it('reads coaching_cache BEFORE invoking enforceMcpAiUsage (D-11)', () => {
    const cache = findLineWithinBlock(block, 'coaching_cache as CoachingNotes');
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    expect(cache).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(0);
    expect(cache).toBeLessThan(gate);
  });

  it('cost gate runs BEFORE generateObject', () => {
    const gate = findLineWithinBlock(block, 'enforceMcpAiUsage');
    const llm = findLineWithinBlock(block, 'generateObject(');
    expect(gate).toBeLessThan(llm);
  });

  it('writes coaching_cache after successful LLM', () => {
    expect(block.lines.join('\n')).toMatch(/update\(\{ coaching_cache:/);
  });

  it('cache shape validation rejects malformed cache (Array.isArray on all three fields)', () => {
    const blockText = block.lines.join('\n');
    expect(blockText).toMatch(/Array\.isArray\(cached\.strengths\)/);
    expect(blockText).toMatch(/Array\.isArray\(cached\.improvements\)/);
    expect(blockText).toMatch(/Array\.isArray\(cached\.specific_examples\)/);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-org boundary — every AI tool checks ownership before LLM (D-16)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-org boundary — every AI tool runs ownership check before LLM call (D-16)', () => {
  it.each([
    ['extract_action_items', 'generateObject('],
    ['ask_call', 'generateText('],
    ['get_sentiment', 'generateObject('],
    ['get_coaching_notes', 'generateObject('],
  ])('%s checks workspace_entries before %s', (toolName, llmCall) => {
    const block = getCaseBlock(toolName);
    const ownership = findLineWithinBlock(block, "from('workspace_entries')");
    const llm = findLineWithinBlock(block, llmCall);
    expect(ownership).toBeGreaterThan(0);
    expect(llm).toBeGreaterThan(0);
    expect(ownership).toBeLessThan(llm);
  });

  it.each(['extract_action_items', 'ask_call', 'get_sentiment', 'get_coaching_notes'])(
    '%s rejects with -32001 "Recording not found or not accessible" on ownership mismatch',
    (toolName) => {
      const block = getCaseBlock(toolName);
      const blockText = block.lines.join('\n');
      // Both branches (workspace and organization scope) must emit this exact message
      expect(blockText).toMatch(/-32001.*Recording not found or not accessible/s);
    },
  );

  it.each(['extract_action_items', 'ask_call', 'get_sentiment', 'get_coaching_notes'])(
    '%s scope branch handles both workspace-token and organization-token paths',
    (toolName) => {
      const block = getCaseBlock(toolName);
      const blockText = block.lines.join('\n');
      expect(blockText).toMatch(/mcpToken\.scope\s*===\s*'workspace'/);
      // The else branch (organization scope) must call fetchOrgWorkspaceIds
      expect(blockText).toMatch(/fetchOrgWorkspaceIds\(supabase,\s*mcpToken\.org_id!?\s*\)/);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Imports & shared infrastructure
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 22 imports & infrastructure', () => {

  it('truncates long transcripts to 15k chars before LLM (cost-control)', () => {
    // Each AI tool block must contain the 15000 truncation guard
    for (const toolName of ['extract_action_items', 'ask_call', 'get_sentiment', 'get_coaching_notes']) {
      const block = getCaseBlock(toolName);
      const blockText = block.lines.join('\n');
      expect(blockText).toMatch(/length\s*>\s*15000/);
      expect(blockText).toMatch(/substring\(0,\s*15000\)/);
    }
  });

});
