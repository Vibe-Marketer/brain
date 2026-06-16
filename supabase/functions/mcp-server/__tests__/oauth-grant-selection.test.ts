import { describe, expect, it } from 'vitest';
import { applyRequestedWorkspaceScope, selectOAuthGrant } from '../grant-selection.ts';

describe('selectOAuthGrant', () => {
  const orgGrant = {
    id: 'org-grant',
    org_id: 'org-1',
    workspace_id: null,
    scope: 'organization' as const,
    enabled_categories: ['read'],
    revoked_at: null,
  };

  const wsGrantA = {
    id: 'ws-grant-a',
    org_id: 'org-1',
    workspace_id: 'ws-a',
    scope: 'workspace' as const,
    enabled_categories: ['read'],
    revoked_at: null,
  };

  const wsGrantB = {
    id: 'ws-grant-b',
    org_id: 'org-1',
    workspace_id: 'ws-b',
    scope: 'workspace' as const,
    enabled_categories: ['read'],
    revoked_at: null,
  };

  // Grants from a different org (multi-org scenario)
  const orgGrantOrg2 = {
    id: 'org-grant-2',
    org_id: 'org-2',
    workspace_id: null,
    scope: 'organization' as const,
    enabled_categories: ['read'],
    revoked_at: null,
  };

  const wsGrantOrg2 = {
    id: 'ws-grant-org2',
    org_id: 'org-2',
    workspace_id: 'ws-org2',
    scope: 'workspace' as const,
    enabled_categories: ['read'],
    revoked_at: null,
  };

  it('prefers the exact workspace grant for workspace-scoped MCP URLs', () => {
    const result = selectOAuthGrant(
      [wsGrantB, wsGrantA, orgGrant],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(result.grant?.id).toBe('ws-grant-a');
    expect(result.error).toBeNull();
  });

  it('falls back to an organization grant when the request targets a workspace within that org', () => {
    const result = selectOAuthGrant(
      [wsGrantB, orgGrant],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(result.grant?.id).toBe('org-grant');
    expect(result.error).toBeNull();
  });

  it('fails closed when the requested workspace matches no workspace or org grant', () => {
    const result = selectOAuthGrant(
      [wsGrantB],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(result.grant).toBeNull();
    expect(result.error).toBeNull();
  });

  it('prefers an organization grant on the base MCP URL when several grants exist for a single org', () => {
    const result = selectOAuthGrant([wsGrantB, orgGrant, wsGrantA], null, null);

    expect(result.grant?.id).toBe('org-grant');
    expect(result.error).toBeNull();
  });

  it('returns multi_org_ambiguity error when requestedWorkspaceId is null and grants span multiple orgs', () => {
    const result = selectOAuthGrant(
      [orgGrant, orgGrantOrg2],
      null,
      null,
    );

    expect(result.grant).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('multi_org_ambiguity');
  });

  it('returns multi_org_ambiguity error when workspace grants span multiple orgs and no workspace scope is set', () => {
    const result = selectOAuthGrant(
      [wsGrantA, wsGrantOrg2],
      null,
      null,
    );

    expect(result.grant).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('multi_org_ambiguity');
  });

  it('does NOT silently return grants[0] when grants span multiple org_ids', () => {
    const result = selectOAuthGrant(
      [orgGrant, orgGrantOrg2],
      null,
      null,
    );

    // Must NOT return a grant — must return the error signal instead
    expect(result.grant).toBeNull();
    expect(result.error?.code).toBe('multi_org_ambiguity');
  });

  it('picks the requested org grant on an org subdomain instead of multi_org_ambiguity', () => {
    // User has Claude grants in two orgs; connecting via org-2 subdomain must
    // resolve to org-2 rather than 403, because the subdomain names the org.
    const result = selectOAuthGrant([orgGrant, orgGrantOrg2], null, null, 'org-2');

    expect(result.grant?.id).toBe('org-grant-2');
    expect(result.error).toBeNull();
  });

  it('disambiguates by requested org across many mixed grants', () => {
    const result = selectOAuthGrant(
      [wsGrantA, orgGrant, orgGrantOrg2, wsGrantOrg2],
      null,
      null,
      'org-1',
    );

    expect(result.grant?.id).toBe('org-grant');
    expect(result.error).toBeNull();
  });

  it('returns missing grant (no error, no ambiguity) when the requested org has no org-scoped grant', () => {
    // Only a workspace grant exists for org-2; an org URL needs an org grant and
    // must not borrow a workspace grant — caller turns null into a re-authorize msg.
    const result = selectOAuthGrant([orgGrant, wsGrantOrg2], null, null, 'org-2');

    expect(result.grant).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns single-org grant when multiple workspace grants exist for the same org (requestedWorkspaceId null)', () => {
    const result = selectOAuthGrant([wsGrantA, wsGrantB], null, null);

    // Both grants are org-1 — safe to return first one, no ambiguity
    expect(result.grant).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it('normalizes an organization token to the requested workspace after audience validation', () => {
    const scoped = applyRequestedWorkspaceScope(
      {
        scope: 'organization' as const,
        workspace_id: null,
        org_id: 'org-1',
      },
      'ws-a',
    );

    expect(scoped.scope).toBe('workspace');
    expect(scoped.workspace_id).toBe('ws-a');
    expect(scoped.org_id).toBe('org-1');
  });
});
