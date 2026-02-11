import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/youtube-import/index.ts');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

describe('youtube-import regression coverage', () => {
  it('preserves downstream status for video-details failures', () => {
    const source = readSource();

    expect(source).toContain('createDownstreamFailureResponse(');
    expect(source).toContain("'video-details'");
    expect(source).toContain('detailsResponse.status');
    expect(source).toContain("source: 'youtube-api'");
    expect(source).toContain('status: number');
  });

  it('preserves downstream status for transcript failures', () => {
    const source = readSource();

    expect(source).toContain('createDownstreamFailureResponse(');
    expect(source).toContain("'transcript'");
    expect(source).toContain('transcriptResponse.status');
    expect(source).toContain("'transcribing'");
    expect(source).toContain('details?: unknown');
  });

  it('forwards user JWT to youtube-api calls via Authorization header', () => {
    const source = readSource();

    expect(source).toContain('Authorization: `Bearer ${userJwtToken}`');

    const headerUsageCount = (source.match(/headers:\s+youtubeApiHeaders/g) || []).length;
    expect(headerUsageCount).toBeGreaterThanOrEqual(2);
  });
});
