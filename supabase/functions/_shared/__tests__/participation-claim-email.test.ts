import { describe, expect, it } from 'vitest';

import { buildParticipationClaimUrl, renderParticipationClaimEmail } from '../participation-claim-email';

const testUrl = 'https://swjzxiddcrtaqixsfaac.supabase.co';
const productionUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const previewOrigin = 'https://callvault-test.example.com';

describe('participation invitation email routing', () => {
  it.each([previewOrigin, 'https://user:password@example.com', 'not a URL'])('ignores TEST override on production: %s', (testAppOrigin) => {
    expect(buildParticipationClaimUrl('credential', {
      supabaseUrl: productionUrl, testAppOrigin, testEmailMode: 'success',
    })).toBe('https://app.callvaultai.com/claim-participation?token=credential');
  });

  it('does not enable the override on another backend or a lookalike hostname', () => {
    for (const supabaseUrl of ['https://other.supabase.co', `${testUrl}.example.com`]) {
      expect(buildParticipationClaimUrl('credential', { supabaseUrl, testAppOrigin: previewOrigin }))
        .toBe('https://app.callvaultai.com/claim-participation?token=credential');
    }
  });

  it.each([testUrl, `${testUrl}/`])('requires an isolated origin before real TEST delivery: %s', (supabaseUrl) => {
    for (const testEmailMode of [undefined, '', 'real', 'SUCCESS']) {
      expect(() => buildParticipationClaimUrl('credential', { supabaseUrl, testEmailMode }))
        .toThrow('TEST_EMAIL_ROUTING_NOT_CONFIGURED');
    }
  });

  it.each(['success', 'failure'])('preserves the nondelivering TEST %s harness', (testEmailMode) => {
    expect(buildParticipationClaimUrl('credential', { supabaseUrl: testUrl, testEmailMode }))
      .toBe('https://app.callvaultai.com/claim-participation?token=credential');
  });

  it.each([
    'http://example.com', 'javascript:alert(1)', '//example.com',
    'https://user:password@example.com', 'https://example.com/path',
    'https://example.com?next=other', 'https://example.com/#fragment',
    'https://app.callvaultai.com', 'https://app.callvaultai.com:443/',
    'https://app.callvaultai.com.',
    'https://app.callvaultai.com:8443', ' https://example.com',
    'https://example.com/../', 'not a URL',
  ])('rejects unsafe or non-origin TEST routing: %s', (testAppOrigin) => {
    expect(() => buildParticipationClaimUrl('credential', { supabaseUrl: testUrl, testAppOrigin }))
      .toThrow('TEST_EMAIL_ROUTING_NOT_CONFIGURED');
  });

  it('routes both real initial and reminder content to the isolated app and encodes the credential', () => {
    const claimUrl = buildParticipationClaimUrl('a&next=/private?#', {
      supabaseUrl: testUrl, testAppOrigin: `${previewOrigin}/`,
    });
    expect(claimUrl).toBe(`${previewOrigin}/claim-participation?token=a%26next%3D%2Fprivate%3F%23`);
    for (const reminder of [false, true]) {
      const email = renderParticipationClaimEmail({ claimUrl, expiresAt: '2026-10-01T00:00:00Z', reminder });
      expect(email.html).toContain(`href="${claimUrl}"`);
      expect(email.text).toContain(claimUrl);
      expect(email.html + email.text).not.toContain('https://app.callvaultai.com');
    }
  });
});
