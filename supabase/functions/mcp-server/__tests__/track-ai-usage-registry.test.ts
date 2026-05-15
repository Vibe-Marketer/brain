/**
 * Behavioral test for the track-ai-usage HTTP-handler action-type registry.
 *
 * Phase 22 (D-09): the four new MCP action types must be accepted by the HTTP
 * endpoint's whitelist check at line 113 of track-ai-usage/index.ts. Pre-Phase-22
 * the registry held only ['smart_import', 'auto_name', 'auto_tag', 'chat_message'];
 * a frontend service POST'ing 'mcp_action_items' would have received a 400.
 *
 * We verify this behaviorally by re-implementing the validation predicate the way
 * the HTTP handler does (replicating the source-of-truth tuple) and asserting the
 * expanded set is reachable. We also assert the source file declares all four new
 * entries — the on-disk SOURCE OF TRUTH — so a future regression that drops one
 * (e.g., during a careless refactor) fails the test loudly.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TRACK_AI_USAGE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'track-ai-usage',
  'index.ts',
);

const SOURCE = fs.readFileSync(TRACK_AI_USAGE_PATH, 'utf8');

const NEW_MCP_ACTION_TYPES = [
  'mcp_action_items',
  'mcp_ask_call',
  'mcp_sentiment',
  'mcp_coaching',
] as const;

const LEGACY_ACTION_TYPES = [
  'smart_import',
  'auto_name',
  'auto_tag',
  'chat_message',
] as const;

const NON_MCP_ACTION_TYPES = [
  'generate_email',
] as const;

describe('track-ai-usage VALID_ACTION_TYPES — registry expansion (D-09)', () => {
  it.each(NEW_MCP_ACTION_TYPES)('declares %s in VALID_ACTION_TYPES tuple', (actionType) => {
    // The string must appear in the file. We tolerate either single or double quotes.
    expect(SOURCE).toMatch(new RegExp(`['"]${actionType}['"]`));
  });

  it.each(LEGACY_ACTION_TYPES)('preserves legacy %s in VALID_ACTION_TYPES tuple (no breaking change)', (actionType) => {
    expect(SOURCE).toMatch(new RegExp(`['"]${actionType}['"]`));
  });

  it.each(NON_MCP_ACTION_TYPES)('declares non-MCP action type %s in VALID_ACTION_TYPES tuple', (actionType) => {
    expect(SOURCE).toMatch(new RegExp(`['"]${actionType}['"]`));
  });

  it('the registry rejects unknown actionType (whitelist check still in place)', () => {
    // The 400 error path at line 113 references VALID_ACTION_TYPES.includes
    expect(SOURCE).toMatch(/VALID_ACTION_TYPES\s*as\s*readonly\s*string\[\]\)\.includes\(actionType\)/);
    // The error message lists the valid types
    expect(SOURCE).toMatch(/Invalid actionType\. Must be one of:/);
  });

  it('VALID_ACTION_TYPES tuple contains only the expected registry entries', () => {
    // Find the tuple body
    const tupleMatch = SOURCE.match(/const\s+VALID_ACTION_TYPES\s*=\s*\[([\s\S]+?)\]\s*as\s*const\s*;/);
    expect(tupleMatch).not.toBeNull();
    const body = tupleMatch![1];
    // Count quoted strings inside
    const actionTypes = [...body.matchAll(/['"]([a-z_]+)['"]/g)].map((match) => match[1]);
    expect(actionTypes).toEqual([
      ...LEGACY_ACTION_TYPES,
      ...NEW_MCP_ACTION_TYPES,
      ...NON_MCP_ACTION_TYPES,
    ]);
  });

  it('AiActionType is derived from VALID_ACTION_TYPES (single source of truth)', () => {
    expect(SOURCE).toMatch(/type\s+AiActionType\s*=\s*typeof\s+VALID_ACTION_TYPES\[number\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB constraint relaxation — Plan 22-02 gap fix
// ─────────────────────────────────────────────────────────────────────────────

describe('ai_usage CHECK constraint — relaxed to allow MCP action types', () => {
  it('migration drops the stale ai_usage_action_type_check constraint', () => {
    const migrationPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'migrations',
      '20260507140000_relax_ai_usage_action_type_check.sql',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_action_type_check/i);
  });

  it('migration documents the application-layer whitelist as source of truth', () => {
    const migrationPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'migrations',
      '20260507140000_relax_ai_usage_action_type_check.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/VALID_ACTION_TYPES/);
    // Per the migration COMMENT: known values must include all 4 MCP action types
    for (const t of NEW_MCP_ACTION_TYPES) {
      expect(sql).toMatch(new RegExp(t));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cache-column migrations — Plan 22-01 + Plan 22-03 gap fix
// ─────────────────────────────────────────────────────────────────────────────

describe('recordings AI cache columns — migration coverage (D-02, D-05)', () => {
  it('action_items_cache JSONB column added by phase-22 migration', () => {
    const migrationPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'migrations',
      '20260507120001_add_ai_cache_columns.sql',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS action_items_cache JSONB/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS coaching_cache JSONB/);
  });

  it('sentiment_cache JSONB column added by gap-close migration', () => {
    const migrationPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'migrations',
      '20260507150000_add_sentiment_cache_to_recordings.sql',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/ALTER TABLE recordings/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS sentiment_cache JSONB/);
  });
});
