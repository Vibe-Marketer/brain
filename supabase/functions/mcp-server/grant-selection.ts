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

export type GrantError = {
  code: string;
  message: string;
};

export type SelectGrantResult = {
  grant: OAuthGrantRow | null;
  error: GrantError | null;
};

export function selectOAuthGrant(
  grants: OAuthGrantRow[],
  requestedWorkspaceId: string | null,
  requestedWorkspace: WorkspaceRow | null,
): SelectGrantResult {
  if (grants.length === 0) return { grant: null, error: null };

  if (requestedWorkspaceId) {
    const exactWorkspaceGrant = grants.find(
      (grant) => grant.workspace_id === requestedWorkspaceId,
    );
    if (exactWorkspaceGrant) return { grant: exactWorkspaceGrant, error: null };

    if (requestedWorkspace?.organization_id) {
      const orgGrant = grants.find(
        (grant) =>
          grant.workspace_id === null &&
          grant.org_id === requestedWorkspace.organization_id,
      );
      if (orgGrant) return { grant: orgGrant, error: null };
    }

    return { grant: null, error: null };
  }

  if (grants.length === 1) return { grant: grants[0], error: null };

  // ISC-48–50: Multi-org ambiguity check.
  // When requestedWorkspaceId is null, detect if grants span more than one
  // distinct org. Silently returning grants[0] could give the user data from
  // the wrong org — return 403 with disambiguation message instead.
  const distinctOrgIds = new Set(grants.map((g) => g.org_id).filter(Boolean));
  if (distinctOrgIds.size > 1) {
    return {
      grant: null,
      error: {
        code: 'multi_org_ambiguity',
        message:
          'Multiple org grants found. Connect via your org-scoped URL: {orgslug}.callvaultai.com/mcp',
      },
    };
  }

  const orgGrant = grants.find((grant) => grant.workspace_id === null);
  if (orgGrant) return { grant: orgGrant, error: null };

  return { grant: grants[0], error: null };
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
