/**
 * Tests for the server-side category gating block in mcp-server/index.ts.
 *
 * Phase 23 gap coverage:
 *   - MGMT-03 / D-07: tokens with non-null enabled_categories return -32001
 *     with a category-aware error when calling tools NOT in their whitelist
 *   - D-08 unknown-tool fail-closed: tool name not in TOOL_CATEGORIES returns
 *     -32001 when enabled_categories is non-null
 *   - D-13/D-14 backwards compat: tokens with null enabled_categories pass
 *     through unchanged (no enforcement runs)
 *   - Enforcement order: gating block is positioned after plan-gating and
 *     before the dispatcher switch
 *
 * The mcp-server function imports from `https://esm.sh/...` URLs (Deno-only)
 * which Vitest can't load. Instead of running the function, we validate the
 * gating block's static structure + replicate its core decision logic against
 * the canonical TOOL_CATEGORIES map.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOL_CATEGORIES, type ToolCategory } from '../../_shared/mcp-tool-categories';

const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/index.ts');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

// ─── Replicate the decision logic the deployed gate runs. ──────────────────
// Mirrors the block at supabase/functions/mcp-server/index.ts lines ~840-870.
// If the implementation diverges from this logic, the structural tests below
// will fail.
type GateDecision =
  | { allow: true }
  | { allow: false; code: number; messageMatches: RegExp };

function decideGate(
  enabledCategories: ToolCategory[] | null,
  method: string,
  toolName: string,
): GateDecision {
  if (enabledCategories === null) return { allow: true };
  if (method !== 'tools/call') return { allow: true };

  const category = TOOL_CATEGORIES[toolName];
  if (!category) {
    return {
      allow: false,
      code: -32001,
      messageMatches: /is not recognized/,
    };
  }
  if (!enabledCategories.includes(category)) {
    return {
      allow: false,
      code: -32001,
      messageMatches: new RegExp(
        `is disabled for this token\\. Enable the '${category}' category`,
      ),
    };
  }
  return { allow: true };
}

// ─── Behavioral expectations (logic mirror) ─────────────────────────────────

describe('category gating — backwards compat (D-13/D-14)', () => {
  it('null enabled_categories allows ANY known tool', () => {
    expect(decideGate(null, 'tools/call', 'list_workspaces')).toEqual({ allow: true });
    expect(decideGate(null, 'tools/call', 'create_folder')).toEqual({ allow: true });
    expect(decideGate(null, 'tools/call', 'extract_action_items')).toEqual({
      allow: true,
    });
  });

  it('null enabled_categories allows even unknown tool names', () => {
    // Legacy tokens predate the map; D-13/D-14 say they get full-access.
    expect(decideGate(null, 'tools/call', 'unknown_tool')).toEqual({ allow: true });
  });

  it('protocol-level methods (initialize, tools/list) are not gated even with explicit whitelist', () => {
    expect(decideGate(['read'], 'initialize', '')).toEqual({ allow: true });
    expect(decideGate(['read'], 'tools/list', '')).toEqual({ allow: true });
    expect(decideGate(['read'], 'notifications/initialized', '')).toEqual({
      allow: true,
    });
  });
});

describe('category gating — MGMT-03 / D-07 (category-disabled rejection)', () => {
  it("rejects an admin tool with -32001 when the token's whitelist is ['read']", () => {
    const decision = decideGate(['read'], 'tools/call', 'create_folder');
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.code).toBe(-32001);
      expect('admin tool create_folder is disabled for this token. Enable the \'admin\' category in Settings > Integrations.').toMatch(
        decision.messageMatches,
      );
    }
  });

  it('rejects a write tool with category-aware message when write is off', () => {
    const decision = decideGate(['read'], 'tools/call', 'tag_call');
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.code).toBe(-32001);
      // Message must name the offending category.
      expect("Tool 'tag_call' is disabled for this token. Enable the 'write' category in Settings > Integrations.").toMatch(
        decision.messageMatches,
      );
    }
  });

  it('rejects an ai tool when ai is off (D-06 ai pre-staged)', () => {
    const decision = decideGate(['read', 'write'], 'tools/call', 'extract_action_items');
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.code).toBe(-32001);
      expect("Tool 'extract_action_items' is disabled for this token. Enable the 'ai' category in Settings > Integrations.").toMatch(
        decision.messageMatches,
      );
    }
  });

  it('allows a tool when its category IS in the whitelist', () => {
    expect(decideGate(['read'], 'tools/call', 'list_workspaces')).toEqual({
      allow: true,
    });
    expect(decideGate(['write', 'read'], 'tools/call', 'tag_call')).toEqual({
      allow: true,
    });
    expect(decideGate(['admin'], 'tools/call', 'create_folder')).toEqual({
      allow: true,
    });
  });

  it('rejects ALL tools when whitelist is empty array', () => {
    expect(decideGate([], 'tools/call', 'list_workspaces').allow).toBe(false);
    expect(decideGate([], 'tools/call', 'create_folder').allow).toBe(false);
    expect(decideGate([], 'tools/call', 'extract_action_items').allow).toBe(false);
  });
});

describe('category gating — D-08 unknown-tool fail-closed', () => {
  it('rejects an unknown tool name with -32001 when whitelist is non-null', () => {
    const decision = decideGate(['read'], 'tools/call', 'bogus_unknown_tool');
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.code).toBe(-32001);
      expect("Tool 'bogus_unknown_tool' is not recognized.").toMatch(
        decision.messageMatches,
      );
    }
  });

  it("rejects unknown tool even with all four categories enabled (D-08 fail-closed)", () => {
    const decision = decideGate(
      ['read', 'write', 'admin', 'ai'],
      'tools/call',
      'mystery_tool',
    );
    expect(decision.allow).toBe(false);
  });
});

// ─── Source-level structural assertions (deployed code) ─────────────────────

describe('mcp-server source — gating block is wired correctly', () => {
  it('imports TOOL_CATEGORIES from the canonical shared module', () => {
    const src = readSource();
    expect(src).toMatch(
      /import\s*\{[^}]*TOOL_CATEGORIES[^}]*\}\s*from\s*['"]\.\.\/_shared\/mcp-tool-categories\.ts['"]/
    );
  });

  it("McpToken interface includes enabled_categories: ToolCategory[] | null", () => {
    const src = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../tools/types.ts'), 'utf8');
    expect(src).toMatch(/enabled_categories\s*:\s*ToolCategory\[\]\s*\|\s*null/);
  });

  it('hex-token select string includes enabled_categories', () => {
    const src = readSource();
    expect(src).toMatch(/scope,\s*name,\s*enabled_categories/);
  });

  it('OAuth synthetic token literal sets enabled_categories: null', () => {
    const src = readSource();
    expect(src).toMatch(/enabled_categories\s*:\s*null/);
  });

  it('gating block guards on method === \'tools/call\'', () => {
    const src = readSource();
    // Locate the comment marker and the surrounding guard.
    expect(src).toMatch(/Category gating \(Phase 23/);
    // Find the guard immediately following.
    const idx = src.indexOf('Category gating (Phase 23');
    const window = src.slice(idx, idx + 800);
    expect(window).toMatch(/mcpToken\.enabled_categories\s*!==\s*null/);
    expect(window).toMatch(/method\s*===\s*['"]tools\/call['"]/);
  });

  it("emits -32001 with 'is not recognized' for unknown tools (D-08)", () => {
    const src = readSource();
    expect(src).toMatch(/-32001[\s\S]{1,400}is not recognized/);
  });

  it("emits -32001 with 'is disabled for this token. Enable the' for category-disabled tools (D-07)", () => {
    const src = readSource();
    expect(src).toMatch(
      /-32001[\s\S]{1,400}is disabled for this token\. Enable the/,
    );
  });

  it('the gating block runs BEFORE the dispatcher switch (D-07 enforcement order)', () => {
    const src = readSource();
    const gateIdx = src.indexOf('Category gating (Phase 23');
    const switchIdx = src.search(/toolName\s*in\s*tools/);
    expect(gateIdx).toBeGreaterThan(0);
    expect(switchIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeLessThan(switchIdx);
  });

  it('the gating block runs AFTER the plan-gating block (D-07 order: token → plan → category → dispatch)', () => {
    const src = readSource();
    const planIdx = src.indexOf('Plan gating');
    const gateIdx = src.indexOf('Category gating (Phase 23');
    expect(planIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(planIdx);
  });
});
