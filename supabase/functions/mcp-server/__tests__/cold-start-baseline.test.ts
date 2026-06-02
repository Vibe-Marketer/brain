import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUNBOOK = readFileSync(
  resolve(process.cwd(), 'docs/operations/mcp-runbook.md'),
  'utf8',
);

describe('MCP Phase 2 live and cold-start runbook gate', () => {
  it('documents the public endpoint and token environment variable without secrets', () => {
    expect(RUNBOOK).toContain('## Phase 2 MCP refactor verification');
    expect(RUNBOOK).toContain('CALLVAULT_MCP_TOKEN');
    expect(RUNBOOK).toContain('https://mcp.callvaultai.com');
    expect(RUNBOOK).toContain('export CALLVAULT_MCP_TOKEN="<valid mcp token>"');
  });

  it('documents invalid bearer proof as HTTP 401 with WWW-Authenticate', () => {
    expect(RUNBOOK).toMatch(/Invalid bearer must return HTTP 401 and include `WWW-Authenticate`/);
    expect(RUNBOOK).toMatch(/Authorization: Bearer invalid-token/);
    expect(RUNBOOK).toMatch(/curl -i "\$MCP_URL"/);
  });

  it('documents valid initialize, tools/list, and read tool checks', () => {
    expect(RUNBOOK).toMatch(/"method":"initialize"/);
    expect(RUNBOOK).toMatch(/"method":"tools\/list"/);
    expect(RUNBOOK).toMatch(/\.result\.tools \| length/);
    expect(RUNBOOK).toMatch(/"name":"list_calls"/);
    expect(RUNBOOK).toMatch(/\.result\.content\[0\]\.type/);
  });

  it('requires before and after cold-start timing capture', () => {
    expect(RUNBOOK).toMatch(/baseline iteration=\$i http=%\{http_code\}/);
    expect(RUNBOOK).toMatch(/candidate iteration=\$i http=%\{http_code\}/);
    expect(RUNBOOK).toMatch(/time_starttransfer/);
    expect(RUNBOOK).toMatch(/time_total/);
  });

  it('forbids marking Phase 2 fully verified from build output alone', () => {
    expect(RUNBOOK).toMatch(/cannot be marked fully verified from build output alone/);
    expect(RUNBOOK).toMatch(/measured read-path cold-start improvement/);
    expect(RUNBOOK).toMatch(/cold-start verification as not verified/);
  });
});
