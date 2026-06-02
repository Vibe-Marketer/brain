type OAuthGrantRow = {
  id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
  enabled_categories: unknown;
  revoked_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceRow = {
  id: string;
  organization_id: string;
};

type AuthScopeToken = {
  scope: 'workspace' | 'organization';
  workspace_id: string | null;
};

export function selectOAuthGrant(
  grants: OAuthGrantRow[],
  requestedWorkspaceId: string | null,
  requestedWorkspace: WorkspaceRow | null,
): OAuthGrantRow | null {
  if (grants.length === 0) return null;

  if (requestedWorkspaceId) {
    const exactWorkspaceGrant = grants.find(
      (grant) => grant.workspace_id === requestedWorkspaceId,
    );
    if (exactWorkspaceGrant) return exactWorkspaceGrant;

    if (requestedWorkspace?.organization_id) {
      const orgGrant = grants.find(
        (grant) =>
          grant.workspace_id === null &&
          grant.org_id === requestedWorkspace.organization_id,
      );
      if (orgGrant) return orgGrant;
    }

    return null;
  }

  if (grants.length === 1) return grants[0];

  const orgGrant = grants.find((grant) => grant.workspace_id === null);
  if (orgGrant) return orgGrant;

  return grants[0];
}

export function applyRequestedWorkspaceScope<T extends AuthScopeToken>(
  mcpToken: T,
  requestedWorkspaceId: string | null,
): T {
  if (!requestedWorkspaceId || mcpToken.workspace_id) return mcpToken;

  return {
    ...mcpToken,
    scope: 'workspace',
    workspace_id: requestedWorkspaceId,
  };
}
