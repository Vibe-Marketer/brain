import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/youtube-api/index.ts');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

describe('youtube-api regression coverage', () => {
  it('uses transcriptapi.com endpoint instead of deprecated host', () => {
    const source = readSource();

    expect(source).toContain("const TRANSCRIPT_API_BASE = 'https://transcriptapi.com/api/v2/youtube/transcript';");
    expect(source).not.toContain('https://api.youdotcom/v1/transcript');
    expect(source).toContain("url.searchParams.set('video_url', videoId);");
    expect(source).toContain("url.searchParams.set('format', 'text');");
  });

  it('normalizes quoted secrets before downstream calls', () => {
    const source = readSource();

    expect(source).toContain('function normalizeSecret(value: string | null): string | null');
    expect(source).toContain("trimmed.replace(/^['\"]|['\"]$/g, '')");
    expect(source).toContain("normalizeSecret(Deno.env.get('YOUTUBE_DATA_API_KEY'))");
    expect(source).toContain("normalizeSecret(Deno.env.get('TRANSCRIPT_API_KEY'))");
  });

  it('returns provider status for HTTP failures', () => {
    const source = readSource();

    expect(source).toContain('class ApiHttpError extends Error');
    expect(source).toContain('throw createApiHttpError');
    expect(source).toContain('if (error instanceof ApiHttpError)');
    expect(source).toContain('{ status: error.status');
  });
});
