# Phase 03: Per-Workspace MCP Endpoints + Connectors Setup - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 19
**Analogs found:** 19 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/[mcp-oauth-grants migration].sql` | migration | CRUD | `supabase/migrations/20260310160000_mcp_tokens.sql`, `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql` | role-match |
| `supabase/functions/mcp-server/auth.ts` | service utility | request-response | current `supabase/functions/mcp-server/auth.ts` | exact |
| `supabase/functions/mcp-server/index.ts` | edge orchestrator | request-response | current `supabase/functions/mcp-server/index.ts` | exact |
| `supabase/functions/mcp-server/protocol.ts` | utility | request-response | current `supabase/functions/mcp-server/protocol.ts` | exact |
| `supabase/functions/mcp-server/gating.ts` | utility / policy | request-response | current `supabase/functions/mcp-server/gating.ts` | exact |
| `supabase/functions/mcp-server/tools/registry.ts` | utility / registry | transform / dispatch | current `supabase/functions/mcp-server/tools/registry.ts` | exact |
| `supabase/functions/mcp-oauth-metadata/index.ts` | edge handler | request-response | current `supabase/functions/mcp-oauth-metadata/index.ts` | exact |
| `supabase/functions/mcp-oauth-register/index.ts` | edge handler | request-response | current `supabase/functions/mcp-oauth-register/index.ts` | exact |
| `cloudflare/api-proxy/worker.ts` | worker / config | request-response routing | current `cloudflare/api-proxy/worker.ts` | exact |
| `src/pages/OAuthConsentPage.tsx` | page | request-response / form flow | current `src/pages/OAuthConsentPage.tsx`, `src/components/settings/MCPTab.tsx` | exact + role-match |
| `src/components/settings/MCPTab.tsx` | component | CRUD / request-response | current `src/components/settings/MCPTab.tsx`, `src/components/settings/IntegrationsTab.tsx` | exact + role-match |
| `src/services/mcp-tokens.service.ts` | service | CRUD | current `src/services/mcp-tokens.service.ts` | exact |
| `src/services/mcp-token-capabilities.service.ts` | service | CRUD | current `src/services/mcp-token-capabilities.service.ts` | exact |
| `src/hooks/useMcpTokens.ts` | hook | CRUD | current `src/hooks/useMcpTokens.ts` | exact |
| `src/hooks/useMcpTokenCapabilities.ts` | hook | CRUD | current `src/hooks/useMcpTokenCapabilities.ts` | exact |
| `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` | test | request-response / integration | `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` | role-match |
| `supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts` | test | request-response / integration | `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` | role-match |
| `src/pages/__tests__/OAuthConsentPage.workspace-scope.test.ts` | test | request-response / component | `src/components/dialogs/__tests__/CreateWorkspaceDialog.test.tsx`, `src/components/import/__tests__/DestinationPicker.test.tsx` | role-match |
| `src/components/settings/__tests__/McpConnectionsTab.test.tsx` | test | request-response / component | `src/components/settings/__tests__/MCPTab.permissions.test.tsx`, `src/components/settings/__tests__/IntegrationsTab.test.tsx` | role-match |

## Pattern Assignments

### `supabase/migrations/[mcp-oauth-grants migration].sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260310160000_mcp_tokens.sql`, `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql`

**Table + RLS shape** (`20260310160000_mcp_tokens.sql:6-29`):
```sql
CREATE TABLE mcp_tokens (... scope TEXT NOT NULL CHECK (scope IN ('workspace', 'organization')) ...);
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON mcp_tokens FOR ALL USING (user_id = auth.uid());
```

**Sidecar grant shape** (`20260415120000_mcp_oauth_org_bindings.sql:18-44`):
```sql
CREATE TABLE IF NOT EXISTS mcp_oauth_org_bindings (... UNIQUE(user_id));
CREATE POLICY "Users manage own bindings" ON mcp_oauth_org_bindings FOR ALL USING (user_id = auth.uid());
```

**What to copy:** use a timestamped migration with a first-class grant table, `SECURITY DEFINER` only where needed, explicit indexes on lookup columns, and a comment block that states the scope model in plain language.

---

### `supabase/functions/mcp-server/auth.ts` (service utility, request-response)

**Analog:** current `supabase/functions/mcp-server/auth.ts`

**Bearer split** (`auth.ts:17-45`):
```ts
const isHexToken = /^[0-9a-f]{64}$/.test(rawToken);
const { data: { user: jwtUser }, error: jwtError } = await authClient.auth.getUser(rawToken);
```

**OAuth synthetic token** (`auth.ts:54-95`):
```ts
return {
  ok: true,
  mcpToken: { ... enabled_categories: null },
};
```

**What to copy:** keep the manual-token path and OAuth-JWT path separate, keep service-role access on the DB lookup, and preserve the `enabled_categories: null` legacy-full-access default for OAuth when no explicit whitelist exists.

---

### `supabase/functions/mcp-server/index.ts` (edge orchestrator, request-response)

**Analog:** current `supabase/functions/mcp-server/index.ts`

**Order to preserve** (`index.ts:103-227`):
```ts
const authResult = await authenticateMcpRequest(...);
if (!authResult.ok) return authResult.response;
if (method === 'initialize') ...
if (method === 'tools/list') ...
const planGateResponse = await enforcePlanGate(...);
const categoryGateResponse = enforceCategoryGate(...);
const toolModule = getToolModule(toolName);
```

**What to copy:** keep auth before protocol methods, keep `initialize` / `tools/list` as structured JSON, keep plan gating before category gating, and keep dispatch after both gates. For Phase 03, add workspace-path parsing and grant resolution in this same file rather than splitting MCP into multiple Edge Functions.

---

### `supabase/functions/mcp-server/protocol.ts` (utility, request-response)

**Analog:** current `supabase/functions/mcp-server/protocol.ts`

**Tool-call envelope** (`protocol.ts:3-12`):
```ts
result: {
  content: [{ type: 'text', text }],
}
```

**Unauthorized path** (`protocol.ts:36-53`):
```ts
status: 401,
headers: { ...corsHeaders, 'WWW-Authenticate': `Bearer realm="callvault", resource_metadata="${resourceMetadataUrl}"` }
```

**What to copy:** keep tool results in `content[].text` markdown, keep protocol-level methods on raw JSON results, and keep the 401 + `WWW-Authenticate` discovery hint intact for unauthenticated probes.

---

### `supabase/functions/mcp-server/gating.ts` (utility / policy, request-response)

**Analog:** current `supabase/functions/mcp-server/gating.ts`

**Plan gate** (`gating.ts:28-46`):
```ts
return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. ...', corsHeaders);
```

**Category gate** (`gating.ts:31-56`):
```ts
if (mcpToken.enabled_categories !== null && method === 'tools/call') { ... }
```

**What to copy:** keep plan checks before category checks, keep unknown tools fail-closed when a whitelist exists, and keep the null whitelist meaning "legacy full access".

---

### `supabase/functions/mcp-server/tools/registry.ts` (utility / registry, transform / dispatch)

**Analog:** current `supabase/functions/mcp-server/tools/registry.ts`

**Registry shape** (`registry.ts:45-112`):
```ts
const EXTRACTED_TOOLS: ToolModule[] = [ ... ];
const TOOL_MODULES = new Map(...);
export function getToolModule(toolName: string): ToolModule | undefined { ... }
```

**What to copy:** keep tool metadata centralized, keep `buildToolDefinitions()` as the single source of truth for `tools/list`, and keep the registry map keyed by the tool definition `name`.

---

### `supabase/functions/mcp-oauth-metadata/index.ts` (edge handler, request-response)

**Analog:** current `supabase/functions/mcp-oauth-metadata/index.ts`

**Host-aware discovery** (`mcp-oauth-metadata/index.ts:18-87`):
```ts
const ALLOWED_HOSTS = new Set(['api.callvaultai.com', 'mcp.callvaultai.com']);
const host = resolveOriginHost(req);
const canonicalOrigin = `https://${host}`;
```

**Document fanout** (`mcp-oauth-metadata/index.ts:90-133`):
```ts
if (doc === 'protected-resource') ...
else if (doc === 'openid-configuration') ...
else ...
```

**What to copy:** keep discovery public, keep advertised URLs host-aware via the worker header, and keep the protected-resource / authorization-server / OIDC docs as separate JSON shapes.

---

### `supabase/functions/mcp-oauth-register/index.ts` (edge handler, request-response)

**Analog:** current `supabase/functions/mcp-oauth-register/index.ts`

**Compatibility proxy** (`mcp-oauth-register/index.ts:29-129`):
```ts
parsedBody.token_endpoint_auth_method = 'client_secret_post';
parsedBody.grant_types = filtered.length > 0 ? filtered : ['authorization_code', 'refresh_token'];
parsedBody.response_types = filtered.length > 0 ? filtered : ['code'];
```

**Response augmentation** (`mcp-oauth-register/index.ts:138-188`):
```ts
json.client_id_issued_at = ...
json.client_secret_expires_at = 0;
```

**What to copy:** keep the proxy forgiving on client metadata, keep the response RFC-friendly for strict MCP clients, and keep the registration endpoint public with CORS that browser MCP clients can read.

---

### `cloudflare/api-proxy/worker.ts` (worker / config, request-response routing)

**Analog:** current `cloudflare/api-proxy/worker.ts`

**Path routing** (`worker.ts:141-180`):
```ts
if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) ...
if (url.pathname === "/.well-known/oauth-protected-resource") ...
if (url.pathname.startsWith("/auth/v1/")) ...
```

**Host forwarding** (`worker.ts:76-91`):
```ts
forwardHeaders.set("x-forwarded-host", url.hostname);
forwardHeaders.set("x-callvault-host", url.hostname);
```

**What to copy:** keep `/mcp`, well-known docs, `/mcp-register`, and `/auth/v1/*` on the same public proxy surface; add `/mcp/w/{workspace_uuid}` routing here as a first-class path, and preserve the custom host header because Supabase strips standard `X-Forwarded-Host`.

---

### `src/pages/OAuthConsentPage.tsx` (page, request-response / form flow)

**Analog:** current `src/pages/OAuthConsentPage.tsx`, plus `src/components/settings/MCPTab.tsx` for the conditional workspace selector pattern

**Consent fetch and redirect** (`OAuthConsentPage.tsx:85-139`):
```tsx
const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
if (data?.redirect_url) window.location.assign(data.redirect_url);
```

**Current approval path** (`OAuthConsentPage.tsx:141-177`):
```tsx
await supabase.from('mcp_oauth_org_bindings').upsert({ user_id: user!.id, org_id: selectedOrgId }, { onConflict: 'user_id' });
const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);
```

**Conditional select pattern to copy** (`MCPTab.tsx:478-522`):
```tsx
<Select value={scope} onValueChange={(v) => setScope(v as McpTokenScope)}>
  ...
  {scope === "workspace" && <Select ... />}
</Select>
```

**What to copy:** keep the auth redirect preservation, keep a single approval action that writes scope state before approval, and reuse the existing conditional select/reveal pattern for the workspace checkbox + workspace dropdown.

---

### `src/components/settings/MCPTab.tsx` (component, CRUD / request-response)

**Analog:** current `src/components/settings/MCPTab.tsx`, plus `src/components/settings/IntegrationsTab.tsx`

**Token row / action rail** (`MCPTab.tsx:283-370`):
```tsx
<CopyButton text={token.token} label="Copy token" />
<Button ... aria-label={`Regenerate token ${token.name}`} />
<Button ... aria-label={`Delete token ${token.name}`} />
```

**New token dialog pattern** (`MCPTab.tsx:383-545`):
```tsx
<Select value={scope} onValueChange={(v) => setScope(v as McpTokenScope)}>
  ...
  {scope === "workspace" && <Select value={selectedWorkspaceId} ... />}
</Select>
```

**Settings section header pattern** (`IntegrationsTab.tsx:83-117`):
```tsx
<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
  <h2 className="flex items-center gap-2 font-montserrat ...">Integrations</h2>
</div>
```

**What to copy:** keep the row-list layout with icon actions, keep the reveal/copy dialog pattern for endpoint snippets, and keep the Settings two-column section header layout when you split the page into "Connected AI clients" and "Manual token connectors".

---

### `src/services/mcp-tokens.service.ts` (service, CRUD)

**Analog:** current `src/services/mcp-tokens.service.ts`

**List / create / delete / rotate shape** (`mcp-tokens.service.ts:46-148`):
```ts
return supabase.from('mcp_tokens').select(...).order('created_at', { ascending: false });
await supabase.from('mcp_tokens').insert(insert).select(...).single();
await supabase.rpc('regenerate_mcp_token', { p_token_id: id });
```

**What to copy:** keep the service layer pure and async, keep DB-field projection explicit, and keep "create returns full token once" behavior for any new token-like resource.

---

### `src/services/mcp-token-capabilities.service.ts` (service, CRUD)

**Analog:** current `src/services/mcp-token-capabilities.service.ts`

**Single-field update** (`mcp-token-capabilities.service.ts:35-50`):
```ts
await supabase.from('mcp_tokens').update({ enabled_categories: value }).eq('id', tokenId).select(...).single();
```

**What to copy:** keep the service small, keep the column update explicit, and let the hook own optimism / rollback.

---

### `src/hooks/useMcpTokens.ts` (hook, CRUD)

**Analog:** current `src/hooks/useMcpTokens.ts`

**Query + mutation pattern** (`useMcpTokens.ts:33-114`):
```ts
const { data, isLoading, error } = useQuery({ queryKey: MCP_TOKEN_KEYS.list(), queryFn: getMcpTokens, enabled: !!user });
queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all });
toast.success('MCP token created');
```

**What to copy:** keep query keys centralized, keep `enabled: !!user`, and invalidate the whole `mcp-tokens` namespace after any mutation.

---

### `src/hooks/useMcpTokenCapabilities.ts` (hook, CRUD)

**Analog:** current `src/hooks/useMcpTokenCapabilities.ts`

**Optimistic update** (`useMcpTokenCapabilities.ts:41-73`):
```ts
await queryClient.cancelQueries({ queryKey: MCP_TOKEN_KEYS.list() });
queryClient.setQueryData(MCP_TOKEN_KEYS.list(), previousTokens.map(...));
```

**Rollback + resync** (`useMcpTokenCapabilities.ts:61-72`):
```ts
if (context?.previousTokens) queryClient.setQueryData(MCP_TOKEN_KEYS.list(), context.previousTokens);
queryClient.invalidateQueries({ queryKey: MCP_TOKEN_KEYS.all });
```

**What to copy:** keep the optimistic patch, keep rollback on error, and still invalidate on settle so server state wins after any race.

---

### `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` (test, request-response / integration)

**Analog:** `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/golden-replay.test.ts`

**Source-anchor style** (`category-gating.test.ts:25-44`, `golden-replay.test.ts:21-31`):
```ts
const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/index.ts');
const authIdx = INDEX_TS.indexOf('const authResult = await authenticateMcpRequest');
```

**What to copy:** keep the test source-driven, assert ordering in the deployed source rather than trying to import Deno-only modules, and validate the workspace path / mismatch behavior with explicit file anchors.

---

### `supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts` (test, request-response / integration)

**Analog:** `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/contract-surface.test.ts`

**Contract checks** (`contract-surface.test.ts:77-156`, `golden-replay.test.ts:94-132`):
```ts
expect(blocks.map((block) => block.name)).toHaveLength(41);
expect(INDEX_TS).toMatch(/if\s*\(\s*method\s*===\s*'tools\/list'\s*\)[\s\S]{1,160}return mcpJsonResult/);
```

**What to copy:** keep a contract-level test that proves the new grant model still preserves JSON-RPC protocol behavior and tool registration, then add targeted grant assertions on top.

---

### `src/pages/__tests__/OAuthConsentPage.workspace-scope.test.ts` (test, request-response / component)

**Analog:** `src/components/dialogs/__tests__/CreateWorkspaceDialog.test.tsx`, `src/components/import/__tests__/DestinationPicker.test.tsx`, `src/components/share/__tests__/PublicShareLanding.test.tsx`

**Form / select test shape** (`DestinationPicker.test.tsx:58-183`):
```ts
const workspaceSelect = screen.getByLabelText('Select workspace');
fireEvent.change(workspaceSelect, { target: { value: 'ws-1' } });
```

**Simple CTA assertions** (`PublicShareLanding.test.tsx:21-48`):
```ts
expect(screen.getByRole('button', { name: /Sign up to view/i })).toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /Open in existing account/i }));
```

**What to copy:** mock the query/data hooks, assert the default scope and the conditional workspace dropdown, and keep approval/deny CTA assertions crisp and user-visible.

---

### `src/components/settings/__tests__/McpConnectionsTab.test.tsx` (test, request-response / component)

**Analog:** `src/components/settings/__tests__/MCPTab.permissions.test.tsx`, `src/components/settings/__tests__/IntegrationsTab.test.tsx`

**Hook mocking + row assertions** (`MCPTab.permissions.test.tsx:19-231`):
```ts
vi.mock('@/hooks/useMcpTokens', () => ({ useMcpTokensList: () => ({ tokens: [tokenFixture], isLoading: false, error: null }) }));
expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(4);
```

**Settings wrapper pattern** (`IntegrationsTab.test.tsx:68-118`):
```ts
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 } } });
return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
```

**What to copy:** keep the component test shallow enough to mock data hooks, but deep enough to prove the new section ordering, row actions, and workspace/url snippets render correctly.

## Shared Patterns

### Service + Hook Separation
**Source:** `src/services/mcp-tokens.service.ts`, `src/hooks/useMcpTokens.ts`, `src/services/mcp-token-capabilities.service.ts`, `src/hooks/useMcpTokenCapabilities.ts`

**Copy to:** any new OAuth-grant service/hook pair, any future token/grant CRUD flow

```ts
// service: pure async Supabase calls
// hook: React Query wrapper, optimistic update, toast, invalidation
```

### MCP Server Pipeline
**Source:** `supabase/functions/mcp-server/index.ts`, `protocol.ts`, `auth.ts`, `gating.ts`, `tools/registry.ts`

**Copy to:** all Phase 03 backend work

```ts
auth -> protocol methods -> plan gate -> category / scope gate -> registry dispatch
```

### Public MCP Routing
**Source:** `cloudflare/api-proxy/worker.ts`, `supabase/functions/mcp-oauth-metadata/index.ts`, `supabase/functions/mcp-oauth-register/index.ts`

**Copy to:** `/mcp`, `/mcp/w/{workspace_uuid}`, `/.well-known/*`, and `/mcp-register`

```ts
forwardHeaders.set("x-forwarded-host", url.hostname);
forwardHeaders.set("x-callvault-host", url.hostname);
```

### Settings Section Layout
**Source:** `src/components/settings/IntegrationsTab.tsx`, `src/components/settings/MCPTab.tsx`

**Copy to:** AI connectors section, manual token section, provider setup snippets

```tsx
<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
```

### OAuth Continuation / Return-To
**Source:** `src/components/connectors/setup/oauth-return-to.ts`, `src/components/connectors/setup/ConnectorSetupCluster.tsx`

**Copy to:** any "Connect AI client" outbound flow, workspace-started consent handoff

```ts
storeOAuthReturnTo(state, returnTo ?? window.location.pathname);
```

### Testing Style
**Source:** `supabase/functions/mcp-server/__tests__/category-gating.test.ts`, `supabase/functions/mcp-server/__tests__/golden-replay.test.ts`, `src/components/settings/__tests__/MCPTab.permissions.test.tsx`

**Copy to:** new MCP backend and settings tests

```ts
// backend: read source files and assert ordering
// frontend: mock hooks, wrap in QueryClientProvider, assert visible rows and actions
```

## No Analog Found

None. Every planned Phase 03 file has at least a role-match analog already in the repo.

## Metadata

**Analog search scope:** `supabase/functions/mcp-server/`, `supabase/functions/`, `cloudflare/api-proxy/`, `src/pages/`, `src/components/settings/`, `src/services/`, `src/hooks/`, `src/components/connectors/setup/`, `supabase/migrations/`

**Files scanned:** 24+
**Pattern extraction date:** 2026-05-28
