import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/send-support-ticket/index.ts');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

function extractObjectBlock(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `expected to find ${declaration}`).toBeGreaterThanOrEqual(0);

  const open = source.indexOf('{', start);
  expect(open, `expected ${declaration} to start an object`).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }

  throw new Error(`Could not extract object block for ${declaration}`);
}

describe('send-support-ticket source stamping', () => {
  it('does not expose source in the browser request schema', () => {
    const source = readSource();
    const schemaBlock = extractObjectBlock(source, 'const supportTicketSchema = z.object');

    expect(schemaBlock).not.toMatch(/\bsource\s*:/);
    expect(schemaBlock).toContain('message:');
    expect(schemaBlock).toContain('severity:');
  });

  it('stamps in-app reported tickets as in_app_user at the insert boundary', () => {
    const source = readSource();
    const insertBlock = extractObjectBlock(source, '.insert({');

    expect(insertBlock).toMatch(/\bsource:\s*['"]in_app_user['"]/);
    expect(insertBlock).not.toMatch(/\bsource:\s*payload\.source\b/);
    expect(insertBlock).not.toMatch(/\bsource:\s*rawBody\.source\b/);
  });

  it('authenticates through the shared helper before parsing client input', () => {
    const source = readSource();
    const authIndex = source.indexOf('authenticateRequest(req, supabase, corsHeaders)');
    const bodyIndex = source.indexOf('const rawBody = await req.json()');

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(bodyIndex).toBeGreaterThan(authIndex);
  });
});
