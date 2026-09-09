# Phase 36: Live Organizations - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 19 (13 new, 6 modified/extended)
**Analogs found:** 19 / 19 (17 exact/role-match analogs read directly this session; 2 draw primarily from 36-RESEARCH.md's own worked Code Examples, cross-checked against the closest real precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<ts>_create_organization_domains_and_aliases.sql` | migration | CRUD (schema) | `supabase/migrations/20260901000001_create_organization_feature_flags.sql` | exact |
| `supabase/migrations/<ts>_add_canonical_organization_id.sql` | migration | CRUD (schema) | `supabase/migrations/20260612020000_autogen_org_workspace_slugs.sql` (trigger mechanics) + 36-RESEARCH.md Code Examples (no direct self-FK-guard-trigger precedent exists in-repo) | partial / spec-derived |
| `supabase/migrations/<ts>_create_claim_organization_domain_rpc.sql` | migration (RPC) | request-response | `supabase/migrations/20260309210001_org_invitation_bugfixes.sql` (`accept_organization_invite`) | exact |
| `supabase/migrations/<ts>_create_merge_and_unclaim_admin_rpcs.sql` | migration (RPC) | request-response | `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql` + `20260901000003_create_event_match_apply_reverse_rpcs.sql` | exact |
| `supabase/functions/merge-organizations/index.ts` | controller (edge fn) | request-response | `supabase/functions/admin-manage-user/index.ts` | exact |
| `supabase/functions/unclaim-organization-domain/index.ts` | controller (edge fn) | request-response | `supabase/functions/admin-manage-user/index.ts` | exact |
| `src/services/organization-identity.service.ts` | service | request-response/CRUD | `src/services/identity-alias.service.ts` | exact |
| `src/hooks/useOrganizationIdentity.ts` | hook | request-response | `src/hooks/useIdentityAliases.ts` (+ `useIdentityEvidence.ts` for lazy-fetch) | exact |
| `src/components/settings/OrganizationIdentitySection.tsx` | component | request-response | `src/components/settings/AccountTab.tsx` ("Verified Emails" section, lines 425-542) | exact |
| `src/components/shared/VerifiedDomainBadge.tsx` | component | request-response | `src/components/shared/IdentityEvidenceBadge.tsx` | exact |
| `src/pages/admin/OrganizationsSection.tsx` | component (admin page) | request-response | `src/pages/admin/UsersSection.tsx` (+ `WorkspaceSidebarPane.tsx` for row-expand) | exact |
| `src/components/dialogs/MergeOrganizationsDialog.tsx` | component (dialog) | request-response | `src/components/dialogs/DeleteOrganizationDialog.tsx` | exact |
| `src/components/dialogs/UnclaimDomainDialog.tsx` | component (dialog) | request-response | `src/components/dialogs/DeleteOrganizationDialog.tsx` (lighter variant) | exact |
| `src/components/settings/OrganizationsTab.tsx` (modified) | component | request-response | itself (attachment point) | n/a — existing file |
| `src/components/panes/AdminCategoryPane.tsx` (modified) | component | request-response | itself (registration point) | n/a — existing file |
| `src/pages/admin/AdminCenter.tsx` (modified) | component | request-response | itself (registration point) | n/a — existing file |
| `src/test/rls-regression.test.ts` (modified) | test | request-response | itself, extending the `identities`/`identity_aliases` bespoke block (lines 1737-1828) | exact |
| `src/test/claim-organization-domain-rpc.integration.test.ts` | test | request-response | `src/test/identity-evidence-rpc.integration.test.ts` | exact |
| `supabase/functions/merge-organizations/__tests__/merge-organizations.integration.test.ts` + `supabase/functions/unclaim-organization-domain/__tests__/unclaim-organization-domain.integration.test.ts` | test | request-response | `supabase/functions/confirm-email-alias-verification/__tests__/confirm-email-alias.integration.test.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/<ts>_create_organization_domains_and_aliases.sql` (migration, schema/CRUD)

**Analog:** `supabase/migrations/20260901000001_create_organization_feature_flags.sql` (full file — simplest existing org-scoped additive table: single FK to `organizations(id)`, `FORCE ROW LEVEL SECURITY`, service-role-only write policy)

**Table shape pattern** (lines 20-28 of the analog):
```sql
CREATE TABLE IF NOT EXISTS organization_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, flag_key)
);
```

**RLS pattern — FORCE + service-role-only** (lines 50-61):
```sql
ALTER TABLE organization_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_feature_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON organization_feature_flags;
CREATE POLICY "Service role full access"
  ON organization_feature_flags FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```
`organization_domains`/`organization_aliases` need one more policy tier than this analog: an org-member SELECT policy (they DO have a user-facing surface, unlike feature flags). Copy that SELECT policy's `USING` clause verbatim from the live `organizations` table policy — see next excerpt.

**SELECT-by-membership pattern** (`supabase/migrations/20260301000002_recreate_rls_policies.sql`, lines 22-24):
```sql
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (is_organization_member(id, auth.uid()));
```
Apply as `USING (is_organization_member(organization_id, auth.uid()))` on both new tables' SELECT policy.

**Migration file structure/header convention** — every recent migration in this codebase (`create_organization_feature_flags.sql`, `create_identities_and_link_tables.sql`) opens with a purpose/lesson-learned comment block, uses numbered `-- ====` section dividers (TABLE / INDEXES / RLS / RLS POLICIES / TRIGGERS / COMMENTS), and closes with `-- END OF MIGRATION`. Follow this exactly — it is a hard house style, not incidental.

**No client INSERT/DELETE policy for cross-table-validated writes** — RESEARCH.md's Anti-Patterns section (and this repo's `identity_alias_verifications` precedent) is explicit: do not expose a raw client `WITH CHECK` for the claim logic. Only `service_role FOR ALL` + an org-member `SELECT` policy belong on these two tables; all INSERT/DELETE traffic goes through the `SECURITY DEFINER` RPCs in migrations #2-#4 below.

---

### `supabase/migrations/<ts>_add_canonical_organization_id.sql` (migration, schema/CRUD)

**No exact in-repo precedent** for "add a nullable self-referencing FK + a trigger that rejects chains" — flagged in 36-RESEARCH.md as "novel to this phase" (Pitfall 2). The closest structural analog for trigger *mechanics* (BEFORE INSERT/UPDATE trigger creation, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `COMMENT ON FUNCTION`) is:

**Trigger creation pattern** (`supabase/migrations/20260612020000_autogen_org_workspace_slugs.sql`, lines 105-123):
```sql
CREATE OR REPLACE FUNCTION public.autogen_org_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_org_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_autogen_org_slug ON public.organizations;
CREATE TRIGGER tr_autogen_org_slug
BEFORE INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.autogen_org_slug();
```

**Use 36-RESEARCH.md's own worked example as the primary source for this file** (already vetted against the live schema in that research session — `organization_memberships` UNIQUE(org_id,user_id) confirmed, `organizations` confirmed to have zero canonical/merge columns today):
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS canonical_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_canonical_not_self
  CHECK (canonical_organization_id IS NULL OR canonical_organization_id != id);

CREATE OR REPLACE FUNCTION public.prevent_canonical_organization_chain()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.canonical_organization_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM organizations
      WHERE id = NEW.canonical_organization_id AND canonical_organization_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot merge into an organization that is itself merged (no chains)';
    END IF;
    IF EXISTS (SELECT 1 FROM organizations WHERE canonical_organization_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot merge an organization that other organizations already point to (no chains)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_prevent_canonical_chain
  BEFORE INSERT OR UPDATE OF canonical_organization_id ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_canonical_organization_chain();
```

**Critical non-goal (Pitfall 1, CRITICAL severity):** this migration must touch ONLY `organizations` DDL. It must never edit `is_organization_member`/`is_organization_admin_or_owner` (defined at `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql` lines 91-115, reproduced below) to dereference `canonical_organization_id`. These two functions gate ~15 dependent tables (`recordings`, `workspaces`, `call_participants`, `contacts`, `sync_jobs`, `import_routing_rules`, `organizations` itself, etc.) — any edit here is a cross-org capture-access leak.
```sql
-- supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql, lines 91-115
CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id AND user_id = p_user_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_organization_admin_or_owner(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND role IN ('organization_owner', 'organization_admin')
  )
$function$;
```

---

### `supabase/migrations/<ts>_create_claim_organization_domain_rpc.sql` (migration/RPC, request-response)

**Analog:** `supabase/migrations/20260309210001_org_invitation_bugfixes.sql` — `accept_organization_invite` (lines 77-163): a direct client-callable `SECURITY DEFINER` RPC, `GRANT EXECUTE ... TO authenticated`, reads `auth.uid()` internally rather than trusting a passed-in user id.

**Direct-client RPC shape to copy** (lines 77-96):
```sql
CREATE OR REPLACE FUNCTION public.accept_organization_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation organization_invitations%ROWTYPE;
  ...
BEGIN
  -- Verify the calling user matches the p_user_id parameter
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'User ID mismatch';
  END IF;
  ...
```
```sql
-- line 163
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(TEXT, UUID) TO authenticated;
```
Phase 36's version (per 36-RESEARCH.md Assumptions A2) should drop the `p_user_id` parameter entirely and use `auth.uid()` throughout the body instead — simpler than `accept_organization_invite`'s mismatch-check pattern, and avoids a spoofable parameter.

**Normalization pattern** (`supabase/migrations/20260612020000_autogen_org_workspace_slugs.sql`, line 36 and 77 — `LOWER`/regex-based normalization already established in this schema):
```sql
v_base := COALESCE(
  NULLIF(LEFT(lower(regexp_replace(COALESCE(p_name, ''), '[^a-z0-9]', '', 'gi')), 40), ''),
  'org'
);
```
Use the simpler `LOWER(TRIM(p_domain))` form (RESEARCH.md Pitfall 4) — domains don't need regex stripping, just case/whitespace normalization before every blocklist/uniqueness check and at storage time.

**Distinguishable machine-readable error codes** — mirror `confirm-email-alias-verification/index.ts`'s `{ success, error, code }` shape (see edge function section below) even though this is a SQL RPC not an edge function; return `jsonb_build_object('success', false, 'code', 'FORBIDDEN' | 'BLOCKLISTED' | 'NO_VERIFIED_EMAIL' | 'CONFLICT')` — never let a raw Postgres unique-violation message escape (catch `unique_violation` explicitly, exactly as `confirm-email-alias-verification/index.ts` lines 205-213 catch a concurrent alias race):
```typescript
// supabase/functions/confirm-email-alias-verification/index.ts, lines 205-213
if (insertAlias.error) {
  // A concurrent confirm could race past the pre-check above and hit
  // the partial unique index -- treat that as the same 409 double-claim outcome.
  return new Response(
    JSON.stringify({ success: false, error: 'This email is already verified on another account.', code: 'ALREADY_CLAIMED' }),
    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Grant convention** — `GRANT EXECUTE ON FUNCTION public.claim_organization_domain(UUID, TEXT) TO authenticated;` (this is the one new RPC in this phase that IS meant to be client-callable — do not `REVOKE EXECUTE` on it, unlike the admin RPCs below).

---

### `supabase/migrations/<ts>_create_merge_and_unclaim_admin_rpcs.sql` (migration/RPC, request-response)

**Analog:** `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql` (full file, 115 lines) — admin-only atomic RPC, `SECURITY DEFINER`, `REVOKE EXECUTE FROM PUBLIC/anon/authenticated`, service-role-only reachability. Also `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` (lines 60-256) for the "authority validated by parameter, never `auth.uid()`" atomic-RPC shape.

**REVOKE EXECUTE boilerplate to copy verbatim** (`20260902000002...`, lines 106-111):
```sql
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM anon;
REVOKE EXECUTE ON FUNCTION public.kill_switch_revert_event_merges FROM authenticated;
-- (The service role bypasses EXECUTE grants, so this plan's direct
-- integration test -- and any future admin-review edge function -- still
-- works.)
```

**Authority-by-parameter pattern, never `auth.uid()`** (`20260901000003...`, lines 82-93 — `apply_event_match_atomic`):
```sql
CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID, p_recording_id_b UUID, p_event_id UUID,
  p_decided_by TEXT, p_signals JSONB, p_owner_user_id UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Ownership validated BY PARAMETER against BOTH recordings.
  IF NOT EXISTS (
    SELECT 1 FROM recordings WHERE id = p_recording_id_a AND owner_user_id = p_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', p_recording_id_a;
  END IF;
  ...
```

**The correct authorization helper for THIS RPC pair is `has_role`, not `is_organization_admin_or_owner`** (RESEARCH.md Pitfall 5 — this is the single most likely copy-paste mistake in this phase). `has_role`'s live definition:
```sql
-- supabase/migrations/00000000000000_consolidated_schema.sql, lines 319-332
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
```
`merge_organizations_atomic`/`unclaim_organization_domain_atomic` must open with `IF NOT public.has_role(p_admin_user_id, 'ADMIN') THEN RAISE EXCEPTION ...` — never a check against `organization_memberships`. 36-RESEARCH.md's own worked example (verified against this exact `has_role` signature) is the direct template:
```sql
CREATE OR REPLACE FUNCTION public.merge_organizations_atomic(
  p_losing_org_id UUID, p_winning_org_id UUID, p_admin_user_id UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(p_admin_user_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;
  IF p_losing_org_id = p_winning_org_id THEN
    RAISE EXCEPTION 'Cannot merge an organization into itself';
  END IF;

  UPDATE organizations
  SET canonical_organization_id = p_winning_org_id, merged_at = NOW(), merged_by = p_admin_user_id
  WHERE id = p_losing_org_id;
  -- Chain/self-reference safety enforced by the trigger from migration #2, not repeated here.
END;
$$;
```
**Anti-pattern to explicitly avoid** (Anti-Patterns list): touching `recordings.organization_id` or any other FK inside this RPC. It must ONLY write `organizations.canonical_organization_id`/`merged_at`/`merged_by` (and, per Open Question #1's recommendation, nothing on `organization_memberships` this phase — surface that as an explicit plan-time checkpoint rather than silently deciding).

---

### `supabase/functions/merge-organizations/index.ts` + `supabase/functions/unclaim-organization-domain/index.ts` (controller/edge fn, request-response)

**Analog:** `supabase/functions/admin-manage-user/index.ts` (full file, 288 lines) — exact structural match: dual-client auth (anon client verifies JWT via shared helper, service-role client does the privileged work), `has_role` gate, Zod-validated payload, audit-log write.

**IMPORTANT — supersedes the static-`corsHeaders`-object template in `supabase/CLAUDE.md`:** the two most recently-shipped edge functions in this codebase (`admin-manage-user`, `confirm-email-alias-verification`) both use `getCorsHeaders(origin)` from `_shared/cors.ts`, which echoes back an allow-listed request origin instead of a hardcoded static object. Per root `CLAUDE.md`'s "reality over documentation" rule, follow the live code, not the older static-object template still shown in `supabase/CLAUDE.md`'s "index.ts Structure Template" section.
```typescript
// supabase/functions/_shared/cors.ts, lines 28-44
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  let origin = allowedOrigins[0];
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    origin = requestOrigin;
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
```

**Dual-client auth + has_role gate to copy** (`admin-manage-user/index.ts`, lines 69-97):
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Anon client used purely to verify the caller's JWT.
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const authResult = await authenticateRequest(req, supabase, corsHeaders);
if (authResult instanceof Response) return authResult;

// Service-role client for the role check, the privileged mutations, and
// the audit write. The admin check keys on the VERIFIED userId from the
// JWT -- has_role is SECURITY DEFINER and reads user_roles directly.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('has_role', {
  _user_id: authResult.userId,
  _role: 'ADMIN',
});
if (adminCheckError || !isAdmin) {
  if (adminCheckError) console.error('has_role check failed:', adminCheckError);
  return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Shared JWT auth helper** (`supabase/functions/_shared/auth.ts`, full file, 45 lines) — import this, never inline the Bearer-parsing boilerplate:
```typescript
export async function authenticateRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<{ userId: string; user: User } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, ... });
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid authorization header format' }), { status: 401, ... });
  }
  const token = match[1].trim();
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
  }
  return { userId: user.id, user };
}
```

**Zod discriminated-union payload validation** (`admin-manage-user/index.ts`, lines 26-52) — `merge-organizations` needs only a single action shape (no union needed), but `unclaim-organization-domain` should follow the same top-level Zod-schema-then-`safeParse`-then-400 shape:
```typescript
const payloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('change_role'), target_user_id: z.string().uuid(), new_role: z.enum([...]) }),
  ...
]);
...
const validation = payloadSchema.safeParse(rawBody);
if (!validation.success) {
  const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
  return new Response(JSON.stringify({ success: false, error: firstIssue }), { status: 400, ... });
}
```

**Service-role RPC call after the gate passes** — call `merge_organizations_atomic`/`unclaim_organization_domain_atomic` via `supabaseAdmin.rpc(...)`, passing `p_admin_user_id: authResult.userId` explicitly (never let the RPC read `auth.uid()`, since it's NULL under a service-role connection). Wrap the RPC error in the same generic-message translation `admin-manage-user` uses for every mutation (lines 128-134, 152-158, etc. — log the real Postgres error server-side, return a short generic client-facing message).

**Audit trail** (`admin-manage-user/index.ts`, lines 263-275) — if this codebase's `admin_audit_log` convention should extend to org merge/unclaim (recommended, low-cost, matches the "operator-tool" precedent), copy this exactly:
```typescript
const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
  actor_user_id: authResult.userId,
  action: `manage_user_${action}`,
  target_type: 'user',
  target_id: target_user_id,
  metadata,
});
if (auditError) {
  console.error('AUDIT LOG WRITE FAILED for admin-manage-user:', auditError);
}
```

---

### `src/services/organization-identity.service.ts` (service, request-response/CRUD)

**Analog:** `src/services/identity-alias.service.ts` (full file, 110 lines) — exact match: pure async wrapper, custom `Error` subclass carrying a machine-readable `code`, `supabase.functions.invoke` for edge-function calls plus a direct `.from().select()` for the RLS-scoped read.

**Custom error class + edge-function-error extraction to copy verbatim** (lines 24-54):
```typescript
export class IdentityAliasError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'IdentityAliasError'
    this.code = code
  }
}

async function toIdentityAliasError(error: unknown, fallbackMessage: string): Promise<IdentityAliasError> {
  const context = (error as { context?: Response })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body?.error) {
        return new IdentityAliasError(body.error, body.code ?? 'UNKNOWN_ERROR')
      }
    } catch {
      // Body wasn't JSON — fall through to the generic message below.
    }
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  return new IdentityAliasError(message, 'UNKNOWN_ERROR')
}
```
Rename to `OrganizationIdentityError` for the new service. The new service needs distinct codes: `FORBIDDEN`, `BLOCKLISTED`, `NO_VERIFIED_EMAIL`, `CONFLICT` (from the claim RPC's `jsonb` response) — since `claim_organization_domain` is a direct `.rpc()` call (not `.functions.invoke()`), the error-shape extraction differs slightly: read the RPC's returned JSONB body directly (it returns `{success, code}` even on the "soft" failure paths, not a thrown Postgres exception), so the service function should branch on `data.success === false` rather than only on `error`.

**Direct RLS-scoped read pattern** (lines 61-73):
```typescript
export async function listVerifiedEmails(): Promise<VerifiedEmailAlias[]> {
  const { data, error } = await supabase
    .from('identity_aliases')
    .select('value, verified, verified_at')
    .eq('alias_type', 'email')
    .eq('verified', true)
    .order('verified_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch verified emails: ${error.message}`)
  }
  return data ?? []
}
```
Use this shape for `listOrganizationDomains(organizationId)` / `listOrganizationAliases(organizationId)` — direct `.from('organization_domains').select('*').eq('organization_id', organizationId)`, relying on the org-member SELECT RLS policy from migration #1.

**Direct RPC call pattern for the claim action** — since `claim_organization_domain` is `supabase.rpc(...)`, not `supabase.functions.invoke(...)`, model this half after `useOrganizationMutations.ts`'s `create_business_organization` call (lines 55-64):
```typescript
const { data: createResult, error: createError } = await supabase
  .rpc('create_business_organization', { p_name: orgName, ... })
  .single()

if (createError) throw createError
```

---

### `src/hooks/useOrganizationIdentity.ts` (hook, request-response)

**Analog:** `src/hooks/useIdentityAliases.ts` (full file, 62 lines) — exact match: `useQuery` for the list + `useMutation`s for the actions, invalidation on success.

**Full pattern to copy** (lines 28-62):
```typescript
export function useIdentityAliases(): UseIdentityAliasesResult {
  const queryClient = useQueryClient()

  const { data: verifiedEmails, isLoading, error } = useQuery({
    queryKey: queryKeys.identityAliases.verifiedEmails(),
    queryFn: listVerifiedEmails,
    staleTime: 60 * 1000,
  })

  const requestMutation = useMutation({
    mutationFn: (email: string) => requestEmailVerification(email),
  })

  const confirmMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => confirmEmailVerification(email, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.identityAliases.verifiedEmails() })
    },
  })

  return { verifiedEmails, isLoading, error: error as Error | null, ... }
}
```

**Query key factory entry to add** (`src/lib/query-config.ts`, lines 234-236 — this is the existing convention; add a sibling `organizationIdentity` block in the same file):
```typescript
identityAliases: {
  verifiedEmails: () => ['identity-aliases', 'verified-emails'] as const,
},
```

**Lazy-fetch-on-open pattern** (for the domains/aliases list feeding `VerifiedDomainBadge`'s popover — `src/hooks/useIdentityEvidence.ts`, full file, 32 lines):
```typescript
export function useIdentityEvidence(identityId: string, enabled: boolean): UseIdentityEvidenceResult {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.identityEvidence.detail(identityId),
    queryFn: () => getIdentityEvidence(identityId),
    enabled: enabled && !!identityId,
    staleTime: 5 * 60 * 1000,
  })
  return { data, isLoading, error: error as Error | null }
}
```
Use this exact `enabled: enabled && !!id` gate for whatever query backs the verified-domain badge's popover (per UI-SPEC: "Evidence is fetched lazily, only once the popover is opened" — same T-34-05-03 rationale applies directly: don't fire N domain-list RPCs for N org badges rendered at once).

---

### `src/components/settings/OrganizationIdentitySection.tsx` (component, request-response)

**Analog:** `src/components/settings/AccountTab.tsx` — the "Verified Emails" section (lines 425-542) is the near-exact structural and interaction template (h2+description grid → list → toggle-to-form → two-step request/confirm flow with distinct loading labels).

**Section header + 2-column grid layout to copy** (lines 425-436):
```tsx
<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
  <div>
    <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
      <RiMailLine className="h-4 w-4 shrink-0" />
      Verified Emails
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Add other email addresses you own so calls recorded under any of them resolve to you
    </p>
  </div>
  <div className="lg:col-span-2 space-y-4">
    ...
```
(UI-SPEC names `RiShieldCheckLine` as this phase's icon instead of `RiMailLine`, and the CardTitle/heading location differs slightly — UI-SPEC places this INSIDE `OrganizationsTab.tsx`'s existing per-org `<Card>`, not as an `AccountTab`-style top-level page section. Use `AccountTab`'s internal grid/list/form structure, but nest it inside the `<CardContent>` of `OrganizationsTab.tsx`'s existing `<Card>` per UI-SPEC's Implementation Pointers.)

**Toggle-button-to-inline-form pattern with distinct loading labels** (lines 457-496 — directly reusable for "Claim domain" and "Add alias"):
```tsx
{!showAddEmailForm ? (
  <Button variant="hollow" onClick={() => setShowAddEmailForm(true)}>
    Add email
  </Button>
) : (
  <div className="space-y-4 max-w-md">
    ...
    <Button onClick={handleSendCode} disabled={!isValidNewEmail || isRequesting}>
      {isRequesting ? (
        <>
          <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        "Send code"
      )}
    </Button>
    <Button variant="hollow" onClick={resetAddEmailForm}>
      Cancel
    </Button>
  </div>
)}
```
UI-SPEC's copy contract requires the exact same shape for "Claim domain" → `RiLoader2Line` spin + "Claiming…" + disabled — copy the conditional-render/disabled-until-valid structure verbatim, swap copy strings.

**Verified-item list row pattern** (lines 438-455):
```tsx
<ul className="space-y-2">
  <li className="flex items-center gap-2 text-sm text-foreground">
    <RiCheckboxCircleFill className="h-4 w-4 shrink-0 text-vibe-orange" />
    <span>{userEmail}</span>
    <span className="text-xs text-muted-foreground">(primary)</span>
  </li>
  {(verifiedEmails ?? []).map((alias) => (
    <li key={alias.value} className="flex items-center gap-2 text-sm text-foreground">
      <RiCheckboxCircleFill className="h-4 w-4 shrink-0 text-vibe-orange" />
      <span>{alias.value}</span>
    </li>
  ))}
</ul>
```
For the Aliases list specifically, UI-SPEC requires a per-row remove affordance (`RiCloseLine`, ghost, `aria-label="Remove alias"`) that this exact analog does NOT have (Verified Emails has no remove action) — add a trailing ghost icon-button per `<li>`, there is no existing per-row-remove list analog in this file; model the button itself on `OrganizationsTab.tsx`'s delete-icon button (lines 116-124):
```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label="Delete organization"
  onClick={() => setDeletingOrg(selectedOrg)}
  className="text-destructive hover:text-destructive hover:bg-destructive/10"
>
  <RiDeleteBinLine className="h-4 w-4" />
</Button>
```

**Attachment point** — `src/components/settings/OrganizationsTab.tsx` (full file, 205 lines, read this session). Insert the new section inside the existing per-org `<Card>`, before `<WorkspaceManagement>` (line 185), gated by the same `canManageOrg(selectedOrg.membership?.role ?? null)` boolean already computed at line 62-64:
```tsx
// OrganizationsTab.tsx, lines 61-64 (existing, reuse as-is)
const canManageOrg = (role: string | null) => {
  return role === 'organization_owner' || role === 'organization_admin'
}
```
Domain claim + alias-add both need this same gate (RESEARCH.md Open Question #2 resolves aliases to the same admin/owner gate as domain claim, for consistency with this file's existing `canManageOrg` boolean). Badge display, however, is NOT gated — any org member should see the verified badge, matching `IdentityEvidenceBadge`'s own "any authorized viewer" posture.

---

### `src/components/shared/VerifiedDomainBadge.tsx` (component, request-response)

**Analog:** `src/components/shared/IdentityEvidenceBadge.tsx` (full file, 79 lines) — UI-SPEC calls for "near-verbatim structure" reuse; this is the closest 1:1 component-copy in the entire phase.

**Full pattern to copy nearly verbatim**:
```tsx
export function IdentityEvidenceBadge({ identityId }: IdentityEvidenceBadgeProps) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, error } = useIdentityEvidence(identityId, open)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((prev) => !prev) }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View identity match confidence and evidence"
        >
          <RiShieldCheckLine className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-64 p-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        {!isLoading && error && (
          <p className="text-sm text-muted-foreground">Unable to load match evidence.</p>
        )}
        {!isLoading && !error && !topEvidence && (
          <p className="text-sm text-muted-foreground">No match evidence recorded.</p>
        )}
        {!isLoading && !error && topEvidence && (
          <div className="space-y-1">...</div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```
Differences to apply per UI-SPEC/CONTEXT.md: (1) `identityId` prop → `organizationId`; (2) the popover body lists ALL verified domains (zero-one-many E4 requirement), not a single top-evidence item — iterate `data` directly instead of picking the highest-confidence row; (3) icon stays `RiShieldCheckLine` (UI-SPEC explicitly locks the same icon for visual consistency), color stays `text-muted-foreground` (UI-SPEC: "not orange, matching `IdentityEvidenceBadge.tsx`'s icon treatment exactly"); (4) this badge should render nothing / return `null` when the org has zero verified domains (unlike `IdentityEvidenceBadge`, which is only ever mounted when a speaker IS resolved — mirror that same caller-side gating convention: only render `<VerifiedDomainBadge>` when the org has ≥1 verified domain, established server-side or via a cheap boolean check, not inside the component itself doing an empty-state render).

---

### `src/pages/admin/OrganizationsSection.tsx` (component/admin page, request-response)

**Analog:** `src/pages/admin/UsersSection.tsx` (full file, 182 lines) — exact match for search/filter header + table + empty/loading/error states.

**Header + summary-line pattern to copy** (lines 55-65):
```tsx
<div className="flex flex-wrap items-center justify-between gap-4">
  <div>
    <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
      Users
    </h2>
    <p className="text-xs text-muted-foreground tabular-nums mt-1">
      {totalUsers} users · {adminCount} admins
    </p>
  </div>
  <div className="flex flex-wrap items-center gap-3">
    ...search/filter controls...
  </div>
</div>
```
UI-SPEC's summary line for this phase: `"{N} organizations · {M} verified domains"` (`tabular-nums`) — same structure, swap the two counts.

**Loading/error/empty states to copy verbatim** (lines 108-125):
```tsx
{isLoading ? (
  <div className="space-y-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
) : error ? (
  <div className="py-12 text-center text-sm text-destructive">Failed to load users.</div>
) : filtered.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
      <RiTeamLine className="h-6 w-6 text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-foreground">No users found</p>
    <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
  </div>
) : (
  <div className="border border-border rounded-lg overflow-hidden bg-card">
    <table className="w-full text-sm text-left">
      <thead className="text-xs uppercase bg-muted/50 border-b border-border">...</thead>
      <tbody className="divide-y divide-border">...</tbody>
    </table>
  </div>
)}
```
UI-SPEC's empty copy for this phase: "No organizations match your search" / "Try a different name or domain." Table columns per UI-SPEC: `Organization | Domains | Aliases | Created | (expand chevron)`.

**Row-expand-to-reveal-domains pattern** — `UsersSection.tsx`'s table has no row-expand (rows navigate to a pane-detail instead, via `onClick={() => openUser(user.id)}`, lines 140-144). This phase's admin table instead needs an inline expand — analog is `src/components/panes/WorkspaceSidebarPane.tsx`'s `Collapsible` usage (lines 283-350, 400-406):
```tsx
import * as Collapsible from '@radix-ui/react-collapsible'
...
<Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-1">
  <div role="button" tabIndex={0} onClick={() => setIsOpen((open) => !open)} ...>
    ...
    <Collapsible.Trigger asChild>
      <button onClick={(e) => e.stopPropagation()} aria-label={isOpen ? `Collapse ...` : `Expand ...`} className="p-1 hover:bg-muted rounded transition-colors">
        <RiArrowRightSLine size={14} className={cn('text-muted-foreground transition-transform duration-300', isOpen && 'rotate-90')} />
      </button>
    </Collapsible.Trigger>
  </div>
  {folders.length > 0 && (
    <Collapsible.Content className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 mt-1">
      <div className="flex flex-col gap-0.5 ml-1 border-l border-border/40 pb-1">...</div>
    </Collapsible.Content>
  )}
</Collapsible.Root>
```
Wrap each `<tr>`'s expand content in a sibling `<tr>` whose single `<td colSpan={5}>` holds a `Collapsible.Content` — the rotating-chevron trigger pattern (`RiArrowRightSLine` + `rotate-90` on open) transfers directly.

**Registration** — `src/components/panes/AdminCategoryPane.tsx` (full file, 184 lines, read this session). Add `"organizations"` to the `AdminCategory` union (line 17) and a new entry in `ADMIN_CATEGORIES` (lines 26-57), icon `RiBuilding4Line` per UI-SPEC:
```tsx
// existing shape to extend, lines 17 and 39-44
export type AdminCategory = "dashboard" | "tickets" | "users" | "qa" | "audit";
...
{
  id: "users",
  label: "Users",
  description: "Roles, access, and plans",
  icon: RiTeamLine,
},
```
`src/pages/admin/AdminCenter.tsx` (full file, 152 lines, read this session) — add a `case "organizations": return <OrganizationsSection />;` branch inside `renderSection()` (lines 70-84):
```tsx
const renderSection = () => {
  switch (activeSection) {
    case "tickets":
      return <TicketsSection />;
    case "users":
      return <UsersSection />;
    case "qa":
      return <QaSection />;
    case "audit":
      return <AuditSection />;
    case "dashboard":
    default:
      return <DashboardSection />;
  }
};
```
`VALID_SECTIONS` (line 47) is derived automatically from `ADMIN_CATEGORIES.map((c) => c.id)`, so no separate edit is needed there once the category is registered in `AdminCategoryPane.tsx`.

---

### `src/components/dialogs/MergeOrganizationsDialog.tsx` (component/dialog, request-response)

**Analog:** `src/components/dialogs/DeleteOrganizationDialog.tsx` (full file, 182 lines) — exact match for the type-to-confirm destructive-dialog pattern UI-SPEC explicitly calls for.

**Type-to-confirm gating pattern to copy verbatim** (lines 39-44, 145-157):
```tsx
const [confirmText, setConfirmText] = useState('')
const isConfirmed = organization ? confirmText === organization.name : false
const canDelete = isConfirmed
...
<div className="space-y-2">
  <Label htmlFor="delete-org-confirm">
    Type <strong>{organization.name}</strong> to confirm
  </Label>
  <Input
    id="delete-org-confirm"
    value={confirmText}
    onChange={(e) => setConfirmText(e.target.value)}
    placeholder={organization.name}
    autoComplete="off"
    autoFocus
  />
</div>
```
UI-SPEC: "Requires typing the losing org's name to confirm" — same pattern, confirm against the losing org (pre-selected from the admin table row), not the org being viewed.

**Destructive dialog shell + disabled-until-valid submit** (lines 77-90, 160-176):
```tsx
<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogContent>
    <DialogHeader>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
          <RiAlertLine className="h-4 w-4 text-destructive" />
        </div>
        <DialogTitle>Delete Organization</DialogTitle>
      </div>
      <DialogDescription>This action cannot be undone. ...</DialogDescription>
    </DialogHeader>
    ...
    <DialogFooter>
      <Button variant="hollow" onClick={() => handleOpenChange(false)} disabled={deleteOrg.isPending}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || deleteOrg.isPending}>
        {deleteOrg.isPending ? 'Deleting...' : 'Delete Organization'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
UI-SPEC's copy for this dialog: title "Merge Organizations", body states plainly that recordings/memberships are not moved, reversible by clearing the pointer; submit button "Merge organizations" (`variant="destructive"`, disabled until typed name matches). Note this dialog is reversible (unlike delete), so the body copy differs substantially from `DeleteOrganizationDialog`'s irreversible warning language — copy the STRUCTURE (header icon circle, warning box, confirm input, footer buttons), not the destructive/irreversible wording.

**Mutation-hook wiring convention** (`src/hooks/useOrganizationMutations.ts`, lines 154-221 — `useDeleteOrganization`, the hook `DeleteOrganizationDialog` consumes) shows the established `useMutation` + `onSuccess` (toast + query invalidation) + `onError` (toast) shape:
```tsx
return useMutation({
  mutationFn: async (input: DeleteOrganizationInput) => { ... },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    toast.success('Organization deleted successfully')
  },
  onError: (error: Error) => {
    toast.error(`Failed to delete organization: ${error.message}`)
  },
})
```
The merge mutation should call `supabase.functions.invoke('merge-organizations', { body: { losing_organization_id, winning_organization_id } })` (edge function, since `has_role` platform-admin authority can't be validated client-side) and follow this exact success/error toast shape. UI-SPEC's failure copy: `"Merge failed — {org} was not changed. No data was altered."`

---

### `src/components/dialogs/UnclaimDomainDialog.tsx` (component/dialog, request-response)

**Analog:** `src/components/dialogs/DeleteOrganizationDialog.tsx` — same file as above, but UI-SPEC explicitly calls for the LIGHTER variant: "no type-to-confirm text field (metadata-only, reversible, admin-gated)." Copy only the dialog shell (header icon circle + `DialogDescription` + `DialogFooter` two-button layout), drop the `confirmText`/`Input` state entirely — the confirm button is enabled immediately on open.
```tsx
<DialogFooter>
  <Button variant="hollow" onClick={() => handleOpenChange(false)} disabled={unclaimDomain.isPending}>
    Cancel
  </Button>
  <Button variant="destructive" onClick={handleUnclaim} disabled={unclaimDomain.isPending}>
    {unclaimDomain.isPending ? 'Unclaiming...' : 'Unclaim domain'}
  </Button>
</DialogFooter>
```
UI-SPEC copy: title "Unclaim Domain", body "Unclaim {domain}? {org} will lose its verified badge. Any organization with a verified email on this domain can claim it again later." Mutation calls `supabase.functions.invoke('unclaim-organization-domain', { body: { domain_id } })`.

---

## Shared Patterns

### Dual-tier admin authorization (do not conflate)
**Source:** `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql` line 103 (`is_organization_admin_or_owner`) vs. `supabase/migrations/00000000000000_consolidated_schema.sql` line 319 (`has_role`)
**Apply to:** `claim_organization_domain` RPC + `OrganizationIdentitySection.tsx` (self-serve, org-scoped) MUST use `is_organization_admin_or_owner`. `merge_organizations_atomic`/`unclaim_organization_domain_atomic` RPCs + `merge-organizations`/`unclaim-organization-domain` edge functions (platform-operator, cross-org) MUST use `has_role(user_id, 'ADMIN')`. This codebase has a shipped incident (`20260316120000_fix_admin_role_leak.sql`) from exactly this class of confusion — treat as a known failure mode.

### SECURITY DEFINER from the start for any new cross-table RLS predicate
**Source:** `supabase/migrations/20260905140000_create_identities_and_link_tables.sql`, lines 116-121 (comment) + 122-139 (`user_can_view_identity`)
**Apply to:** any new helper this phase writes that reads a restrictively-RLS'd table (e.g. checking `identity_aliases` inside `claim_organization_domain`). Never bolt `SECURITY DEFINER` on reactively after a leak is found — this exact lesson was learned once already (events' `user_participates_in_event` / CR-01) and once again explicitly for identities; Phase 36 is the third time this pattern applies.

### Atomic reversible RPC, authority by parameter, REVOKE EXECUTE from client roles
**Source:** `supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` (full pattern) + `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql` (admin variant)
**Apply to:** `merge_organizations_atomic`, `unclaim_organization_domain_atomic`. Every multi-statement security-sensitive mutation is one PL/pgSQL function, never sequential client `.update()` calls. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC/anon/authenticated` is mandatory (Postgres grants EXECUTE to PUBLIC by default).

### FORCE ROW LEVEL SECURITY on every new table
**Source:** every RLS-enabled table read this session (`organization_feature_flags`, `identities`, `identity_aliases`) pairs `ENABLE ROW LEVEL SECURITY` with `FORCE ROW LEVEL SECURITY`.
**Apply to:** `organization_domains`, `organization_aliases`. `ENABLE` alone still lets the migration-runner/table-owner role bypass RLS.

### Normalize before every check (LOWER/TRIM)
**Source:** `supabase/migrations/20260612020000_autogen_org_workspace_slugs.sql`, lines 36, 77
**Apply to:** every blocklist check, uniqueness check, and storage write for `organization_domains.domain` in `claim_organization_domain`. Use `LOWER(TRIM(p_domain))` before comparison and storage.

### Shared edge-function auth + CORS helpers
**Source:** `supabase/functions/_shared/auth.ts` (`authenticateRequest`) + `supabase/functions/_shared/cors.ts` (`getCorsHeaders`)
**Apply to:** `merge-organizations/index.ts`, `unclaim-organization-domain/index.ts`. Never inline `req.headers.get('Authorization')` + `supabase.auth.getUser(token)` boilerplate, and never hand-roll a static `corsHeaders` object — both shared helpers already exist and are the current (not just documented) convention.

### Toast + query-invalidation on mutation success/error
**Source:** `src/hooks/useOrganizationMutations.ts`, lines 79-98, 120-133, 202-220 (every mutation in this file)
**Apply to:** every new mutation hook this phase (`useClaimOrganizationDomain`, `useAddOrganizationAlias`, `useMergeOrganizations`, `useUnclaimOrganizationDomain`). Pattern: `onSuccess` → `queryClient.invalidateQueries(...)` + `toast.success(...)`; `onError` → `toast.error(...)`. Import `{ toast } from 'sonner'`.

### Button loading-state copy convention
**Source:** `src/components/settings/AccountTab.tsx`, lines 483-490, 524-531 and `src/components/dialogs/DeleteOrganizationDialog.tsx`, line 173
**Apply to:** every async submit button this phase adds. Shape: `{isPending ? (<><RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />Verb-ing…</>) : "Verb"}`, `disabled={!isValid || isPending}`.

### `@/` path-alias imports, no relative paths
**Source:** every file read this session uses `@/components/...`, `@/hooks/...`, `@/services/...`, `@/lib/...` — confirmed as house style in `src/CLAUDE.md`.
**Apply to:** all 13 new frontend files.

---

## No Analog Found

No file in this phase's scope has zero analog. The two migration files below have the weakest in-repo precedent and lean most heavily on 36-RESEARCH.md's own worked SQL (already grounded in the live schema, not invented):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/migrations/<ts>_add_canonical_organization_id.sql` | migration | schema/CRUD | No existing migration adds a nullable self-referencing FK guarded by a chain-prevention trigger — RESEARCH.md flags this as "novel to this phase" (Pitfall 2). Trigger *mechanics* (BEFORE INSERT/UPDATE, `DROP TRIGGER IF EXISTS`) are well-precedented (`autogen_org_workspace_slugs.sql`); the chain-prevention *logic* is not. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/functions/`, `supabase/functions/_shared/`, `src/services/`, `src/hooks/`, `src/components/settings/`, `src/components/shared/`, `src/components/dialogs/`, `src/components/panes/`, `src/components/header/`, `src/pages/admin/`, `src/test/`
**Files read directly this session (with line numbers verified against live content, not assumed from 36-RESEARCH.md citations):** 27 — `20260901000001_create_organization_feature_flags.sql`, `20260902000002_kill_switch_revert_event_merges.sql`, `20260309210001_org_invitation_bugfixes.sql`, `20260612020000_autogen_org_workspace_slugs.sql`, `20260316120000_fix_admin_role_leak.sql`, `20260901000003_create_event_match_apply_reverse_rpcs.sql`, `20260905140000_create_identities_and_link_tables.sql`, `20260301000001_rename_vaults_to_workspaces.sql` (targeted), `20260301000002_recreate_rls_policies.sql` (targeted), `00000000000000_consolidated_schema.sql` (targeted), `admin-manage-user/index.ts`, `confirm-email-alias-verification/index.ts`, `confirm-email-alias-verification/__tests__/confirm-email-alias.integration.test.ts`, `_shared/auth.ts`, `_shared/cors.ts`, `identity-alias.service.ts`, `useIdentityAliases.ts`, `useIdentityEvidence.ts`, `useUserRole.ts`, `useOrganizationMutations.ts`, `OrganizationsTab.tsx`, `AccountTab.tsx` (targeted), `IdentityEvidenceBadge.tsx`, `DeleteOrganizationDialog.tsx`, `UsersSection.tsx`, `AdminCenter.tsx`, `AdminCategoryPane.tsx`, `WorkspaceSidebarPane.tsx` (targeted), `OrganizationSwitcher.tsx` (targeted), `rls-regression.test.ts` (targeted), `identity-evidence-rpc.integration.test.ts` (targeted), `query-config.ts` (targeted), `types/supabase.ts` (targeted)
**Project docs consulted:** `/Users/admin/dev/brain/main/CLAUDE.md`, `/Users/admin/dev/brain/main/src/CLAUDE.md`, `/Users/admin/dev/brain/main/supabase/CLAUDE.md` (one discrepancy found and flagged — see "Shared edge-function auth + CORS helpers" above: supabase/CLAUDE.md's static `corsHeaders` template is superseded by the live `getCorsHeaders()` pattern in the two most recent edge functions)
**Pattern extraction date:** 2026-09-08
