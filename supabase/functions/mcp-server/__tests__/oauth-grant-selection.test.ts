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

  it('prefers the exact workspace grant for workspace-scoped MCP URLs', () => {
    const selected = selectOAuthGrant(
      [wsGrantB, wsGrantA, orgGrant],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(selected?.id).toBe('ws-grant-a');
  });

  it('falls back to an organization grant when the request targets a workspace within that org', () => {
    const selected = selectOAuthGrant(
      [wsGrantB, orgGrant],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(selected?.id).toBe('org-grant');
  });

  it('fails closed when the requested workspace matches no workspace or org grant', () => {
    const selected = selectOAuthGrant(
      [wsGrantB],
      'ws-a',
      { id: 'ws-a', organization_id: 'org-1' },
    );

    expect(selected).toBeNull();
  });

  it('prefers an organization grant on the base MCP URL when several grants exist', () => {
    const selected = selectOAuthGrant([wsGrantB, orgGrant, wsGrantA], null, null);

    expect(selected?.id).toBe('org-grant');
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
