# Supabase OAuth 2.1 Server — Research for MCP Authentication

**Researched:** 2026-02-19
**Domain:** Supabase Auth as OAuth 2.1 / OIDC Identity Provider for MCP clients
**Confidence:** MEDIUM-HIGH (Supabase OAuth server is in public beta; some behavior may shift before GA)

---

## Summary

Supabase Auth entered public beta as an OAuth 2.1 + OpenID Connect identity provider on November 26, 2025. This feature turns your Supabase project into a "Sign in with [Your App]" provider — exactly what CallVault needs so that MCP clients (Claude Desktop, Cursor, etc.) can authenticate users through the existing CallVault account system.

The design is standards-compliant: MCP clients discover endpoints via `/.well-known/oauth-authorization-server`, optionally self-register via Dynamic Client Registration, and then drive a PKCE authorization code flow. The resulting access token is a Supabase JWT that a Cloudflare Worker can validate using the public JWKS endpoint — no shared secret required.

Critical architecture note: Supabase delegates the **consent / authorization UI** entirely to the application. You must build a frontend page (e.g., `/oauth/consent`) that uses `supabase-js` to approve or deny authorization requests. This page lives in the CallVault frontend, not in the Cloudflare Worker.

**Primary recommendation:** Enable the Supabase OAuth 2.1 server in the dashboard, build a `/oauth/consent` page in the CallVault frontend using the three `supabase.auth.oauth.*` methods, and validate tokens in the Cloudflare Worker using `jose` + the Supabase JWKS endpoint.

---

## 1. Enabling the Supabase OAuth 2.1 Server

### Dashboard Steps

1. Go to **Authentication > OAuth Server** in the Supabase dashboard.
2. Toggle the feature on. It is **free during public beta** on all plans.
3. Set the **Authorization Path** — this is the path on your site URL where users will be sent to approve access. Example: `/oauth/consent`. Supabase concatenates this with your configured Site URL to produce the full redirect target.
4. Optionally enable **Dynamic Client Registration** on the same page. When enabled, MCP clients can register themselves without you manually creating OAuth app credentials in the dashboard.

### Registering OAuth Clients Manually (Alternative to DCR)

In **Authentication > OAuth Apps**, you can pre-register clients by providing:
- Client name
- Redirect URIs (exact matches only; no wildcards; HTTPS required for production)
- Client type: **Public** (no client secret, PKCE required) or **Confidential** (with client secret)

Client secrets are shown only once at creation time.

**Confidence:** HIGH — from official Supabase getting-started docs.

---

## 2. OAuth Endpoints

All endpoints are under your Supabase project URL:

| Endpoint | URL |
|----------|-----|
| Authorization | `https://<project-ref>.supabase.co/auth/v1/oauth/authorize` |
| Token | `https://<project-ref>.supabase.co/auth/v1/oauth/token` |
| UserInfo | `https://<project-ref>.supabase.co/auth/v1/oauth/userinfo` |
| JWKS | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| OAuth Discovery | `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` |
| OIDC Discovery | `https://<project-ref>.supabase.co/.well-known/openid-configuration` |
| Dynamic Client Registration | `POST https://<project-ref>.supabase.co/auth/v1/oauth/clients/register` |

**Important:** The discovery path is `/.well-known/oauth-authorization-server/auth/v1` (note the `/auth/v1` suffix), not the bare `/.well-known/oauth-authorization-server`. MCP clients that follow the spec will hit this path automatically. There is a known issue where custom domains may not correctly route this endpoint — use the default `*.supabase.co` URL for MCP auth unless confirmed otherwise.

**Confidence:** HIGH — from official docs and GitHub discussion #38022.

---

## 3. OAuth Discovery (`/.well-known/oauth-authorization-server`)

The discovery document follows RFC 8414. MCP clients fetch this before initiating any flow. It advertises all endpoint URLs, supported grant types, scopes, PKCE methods, and whether Dynamic Client Registration is supported.

Example structure returned by Supabase (reconstructed from docs):

```json
{
  "issuer": "https://<project-ref>.supabase.co/auth/v1",
  "authorization_endpoint": "https://<project-ref>.supabase.co/auth/v1/oauth/authorize",
  "token_endpoint": "https://<project-ref>.supabase.co/auth/v1/oauth/token",
  "userinfo_endpoint": "https://<project-ref>.supabase.co/auth/v1/oauth/userinfo",
  "jwks_uri": "https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json",
  "registration_endpoint": "https://<project-ref>.supabase.co/auth/v1/oauth/clients/register",
  "scopes_supported": ["openid", "email", "profile", "phone"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"]
}
```

**Confidence:** MEDIUM — the structure is inferred from official docs describing the endpoints and standards claimed. The exact JSON keys were not shown verbatim in docs but follow RFC 8414 which Supabase states it implements.

---

## 4. Dynamic Client Registration (DCR)

When DCR is enabled, MCP clients (Claude Desktop, Cursor, etc.) POST to the registration endpoint to create an OAuth client on the fly. No manual dashboard setup required for each MCP client.

### Request

```http
POST https://<project-ref>.supabase.co/auth/v1/oauth/clients/register
Content-Type: application/json

{
  "client_name": "Claude Desktop",
  "redirect_uris": ["https://claude.ai/oauth/callback"]
}
```

### Response (success)

Returns client credentials including `client_id` and optionally `client_secret`. The client secret is only returned once.

### Validation Rules (Current Beta Behavior)

- `redirect_uris` must use `https://` for non-localhost URIs.
- `http://localhost` is allowed for local development.
- Custom URI schemes (e.g., `cursor://`, `myapp://`) are currently **rejected with 400** due to a known validation bug in the beta (GitHub issue #2285). This is inconsistent with RFC 8252 (native apps). Watch for fixes before GA.

### Security Recommendation

Supabase recommends requiring user approval for new DCR clients and monitoring registered applications regularly via the dashboard.

**Confidence:** HIGH for structure; MEDIUM for custom URI scheme behavior (known bug, may be fixed).

---

## 5. Full OAuth Flow: MCP Client to Supabase

This is the end-to-end flow for a tool like Claude Desktop connecting to the CallVault MCP server:

```
MCP Client (Claude Desktop)
    │
    │ 1. Fetch discovery doc
    ▼
GET /.well-known/oauth-authorization-server/auth/v1
    │
    │ 2. (Optional) Register as OAuth client via DCR
    ▼
POST /auth/v1/oauth/clients/register
    │
    │ 3. Generate PKCE parameters (code_verifier + code_challenge)
    │    Open browser to:
    ▼
GET /auth/v1/oauth/authorize
    ?response_type=code
    &client_id=<client_id>
    &redirect_uri=<callback>
    &scope=openid email
    &code_challenge=<S256 hash of verifier>
    &code_challenge_method=S256
    &state=<random>
    │
    │ 4. Supabase Auth validates params, redirects to consent page:
    ▼
GET https://callvault.ai/oauth/consent?authorization_id=<id>
    │
    │ 5. CallVault consent page:
    │    a. Check user is logged in (redirect to login if not)
    │    b. supabase.auth.oauth.getAuthorizationDetails(id)
    │    c. Show app name + requested scopes
    │    d. User clicks Approve:
    │       supabase.auth.oauth.approveAuthorization(id)
    │       → returns { redirect_to: "<callback>?code=<auth_code>" }
    │    e. Redirect user browser to that URL
    │
    │ 6. MCP client receives authorization code at callback
    │
    │ 7. Exchange code for tokens:
    ▼
POST /auth/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=<client_id>
&redirect_uri=<callback>
&code_verifier=<original_verifier>
    │
    │ 8. Supabase returns:
    │    { access_token, refresh_token, token_type: "bearer",
    │      expires_in, id_token (if openid scope) }
    │
    │ 9. MCP client sends requests to CallVault Cloudflare Worker:
    ▼
Authorization: Bearer <access_token>
```

**Confidence:** HIGH — reconstructed from official flow docs, supabase-js API reference, and Getting Started guide.

---

## 6. Consent Screen Implementation

The consent page must live in the CallVault frontend (e.g., Next.js route `/oauth/consent`). This is not part of the Cloudflare Worker.

### Required `supabase-js` Methods

```typescript
// Retrieve details about the OAuth request
const { data: authDetails, error } =
  await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

// authDetails contains:
// - client.name: the requesting app's name
// - redirect_uri: where the user will be sent after
// - scope: space-separated string of requested scopes

// Approve (issues authorization code)
const { data, error } =
  await supabase.auth.oauth.approveAuthorization(authorizationId)
// data.redirect_to = "https://callback?code=<auth_code>"

// Deny (issues error response)
const { data, error } =
  await supabase.auth.oauth.denyAuthorization(authorizationId)
// data.redirect_to = "https://callback?error=access_denied"
```

### Minimal Consent Page Pattern

```typescript
// /oauth/consent page
export default function ConsentPage() {
  const [authDetails, setAuthDetails] = useState(null)
  const searchParams = useSearchParams()
  const authorizationId = searchParams.get('authorization_id')

  useEffect(() => {
    // Ensure user is authenticated first
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Redirect to login, preserve authorization_id
        router.push(`/login?next=/oauth/consent?authorization_id=${authorizationId}`)
        return
      }
      supabase.auth.oauth.getAuthorizationDetails(authorizationId)
        .then(({ data }) => setAuthDetails(data))
    })
  }, [authorizationId])

  const handleApprove = async () => {
    const { data } = await supabase.auth.oauth.approveAuthorization(authorizationId)
    window.location.href = data.redirect_to
  }

  const handleDeny = async () => {
    const { data } = await supabase.auth.oauth.denyAuthorization(authorizationId)
    window.location.href = data.redirect_to
  }

  return (
    // Show authDetails.client.name and authDetails.scope
    // with Approve / Deny buttons
  )
}
```

**Confidence:** HIGH — method signatures from official JS API reference.

---

## 7. PKCE Support

PKCE is **mandatory** in Supabase OAuth 2.1. There is no way to skip it.

### How It Works

```
// Client generates before redirecting to /authorize:
code_verifier  = random 43–128 char string (cryptographically secure)
code_challenge = base64url(sha256(code_verifier))

// Sent in /authorize request:
?code_challenge=<code_challenge>&code_challenge_method=S256

// Sent in /token exchange:
code_verifier=<original_code_verifier>
```

MCP clients (Claude Desktop, Cursor, etc.) that follow the MCP OAuth spec handle PKCE automatically. The MCP spec requires PKCE, so this aligns perfectly with Supabase's implementation.

**Confidence:** HIGH — explicitly stated in official Supabase OAuth flows documentation.

---

## 8. Token Validation in a Cloudflare Worker

### Switch to Asymmetric Signing First

Supabase defaults to **HS256** (shared secret) signing. For OAuth 2.1 server use, switch to **RS256** or **ES256** so the Cloudflare Worker can validate tokens using only the public key — no need to embed the JWT secret in Worker environment variables.

To switch: **Authentication > Signing Keys** in the Supabase dashboard, then generate and activate an asymmetric key.

### Validation Using `jose` (Recommended)

```typescript
// src/middleware/auth.ts (Cloudflare Worker)
import { jwtVerify, createRemoteJWKSet } from 'jose'

const PROJECT_REF = 'your-project-ref'
const JWKS_URL = `https://${PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json`
const ISSUER = `https://${PROJECT_REF}.supabase.co/auth/v1`

// createRemoteJWKSet caches keys automatically
const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

export async function validateSupabaseToken(request: Request): Promise<{
  valid: boolean
  payload?: Record<string, unknown>
  error?: string
}> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing Bearer token' }
  }

  const token = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: 'authenticated',
    })
    return { valid: true, payload }
  } catch (err) {
    return { valid: false, error: String(err) }
  }
}

// Usage in Worker handler:
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = await validateSupabaseToken(request)
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userId = auth.payload?.sub as string
    const clientId = auth.payload?.client_id as string | undefined
    // Proceed with MCP request handling...
  }
}
```

### Claims to Check

| Claim | Expected Value | Purpose |
|-------|---------------|---------|
| `iss` | `https://<project-ref>.supabase.co/auth/v1` | Confirms this is a Supabase token |
| `aud` | `authenticated` | Confirms the token is for authenticated users |
| `exp` | future timestamp | Token not expired |
| `sub` | UUID string | The user's ID |
| `client_id` | OAuth client ID string | Which MCP client authenticated |
| `role` | `authenticated` | Standard Supabase claim |

**Confidence:** HIGH for the jose pattern (official approach). HIGH for claim structure (from token-security docs). MEDIUM for `audience: 'authenticated'` — this is the default Supabase JWT audience but verify it hasn't changed for OAuth tokens.

### JWKS Caching Behavior

`createRemoteJWKSet` from `jose` automatically caches public keys in memory. In Cloudflare Workers, each worker isolate has its own memory, so the first request per isolate fetches the JWKS; subsequent requests reuse the cached keys. This is acceptable — cold-start validation adds ~50-100ms; cached validation is ~2ms.

If stricter caching is needed, store the JWKS in **Cloudflare KV** and refresh on a schedule (e.g., every 24 hours), since Supabase key rotation is infrequent.

---

## 9. Scopes and Permissions

### Available OAuth Scopes

| Scope | What It Does |
|-------|-------------|
| `openid` | Enables OIDC; Supabase issues an ID token alongside the access token |
| `email` | Includes `email` claim in tokens and UserInfo response |
| `profile` | Includes profile information |
| `phone` | Includes phone number |

**Default:** If no scope is specified, `email` is used.

### Critical: Scopes Do NOT Control Database Access

This is the most important pitfall. OAuth scopes in Supabase control only what appears in the JWT token claims and UserInfo response. They do **not** restrict what data the MCP client can access in the database.

Database access is controlled entirely by **Row Level Security (RLS) policies**, using the `client_id` claim from the JWT.

### Restricting MCP Clients via RLS

```sql
-- Allow an MCP client read-only access to calls
CREATE POLICY "mcp_clients_read_calls"
ON calls
FOR SELECT
TO authenticated
USING (
  -- Match the user who owns the data
  auth.uid() = user_id
  AND (
    -- Allow direct user sessions (client_id is null)
    (auth.jwt() ->> 'client_id') IS NULL
    OR
    -- Allow specific MCP client IDs
    (auth.jwt() ->> 'client_id') IN (
      'your-mcp-client-id-1',
      'your-mcp-client-id-2'
    )
  )
);

-- Prevent MCP clients from writing
CREATE POLICY "mcp_clients_no_writes"
ON calls
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'client_id') IS NULL
);
```

**Confidence:** HIGH — from official token-security documentation with RLS examples.

---

## 10. Interaction with Existing Google OAuth

### How They Coexist

Supabase OAuth 2.1 server (making Supabase the provider) and Google OAuth login (making Google the provider for Supabase) are **orthogonal features**. They operate at different layers:

| Feature | Direction | Role |
|---------|-----------|------|
| Google OAuth (existing) | Google → Supabase | Supabase is the OAuth *client* consuming Google tokens |
| OAuth 2.1 Server (new) | Supabase → MCP clients | Supabase is the OAuth *server* issuing tokens to MCP clients |

**Enabling the OAuth 2.1 server does not affect or disable Google login.** Users who authenticate via Google OAuth still get a Supabase session. When an MCP client initiates the OAuth flow, it redirects the user to your `/oauth/consent` page — where the user logs in via Google as usual — and the resulting Supabase session is used to issue the OAuth authorization code.

In other words: the MCP client gets a Supabase JWT; that JWT was obtained through a Supabase session that was itself created via Google login. These chains compose cleanly.

### Practical Impact on the Consent Page

When a user lands on `/oauth/consent` without an active session, your page should redirect them to the normal Supabase auth flow (which shows the Google login button). After login, they return to the consent page with the `authorization_id` still in the URL (use the `next` query param pattern or session storage to preserve it).

**Confidence:** MEDIUM — coexistence is strongly implied by docs describing OAuth 2.1 server working "with any enabled authentication method." No explicit documentation was found confirming zero interaction issues. Low risk but worth verifying in a test project before production rollout.

---

## 11. Authorization Code Expiry

- Authorization codes are valid for **10 minutes** and are **single-use**.
- After exchange, they are invalidated immediately.
- Access tokens follow standard Supabase JWT expiry (default: 1 hour).
- Refresh tokens rotate on use — always store the latest token returned.

---

## 12. Common Pitfalls

### Pitfall 1: Building the Consent UI in the Wrong Place

**What goes wrong:** Trying to implement the consent screen inside the Cloudflare Worker.
**Why it happens:** The Worker handles API requests; the consent UI requires a browser and supabase-js client-side methods.
**How to avoid:** The consent page must be a frontend route (Next.js, Nuxt, etc.) at the path configured in the Supabase dashboard.

### Pitfall 2: Not Switching to Asymmetric JWT Signing

**What goes wrong:** Worker tries to validate HS256 tokens using JWKS — this fails because HS256 tokens don't use asymmetric keys.
**Why it happens:** Supabase defaults to HS256 (shared secret).
**How to avoid:** Go to Authentication > Signing Keys, generate an RS256 or ES256 key, and activate it before deploying the Worker.
**Warning signs:** JWKS endpoint returns empty or the Worker gets signature verification errors.

### Pitfall 3: Treating Scopes as Access Control

**What goes wrong:** Assuming `scope=email` prevents MCP clients from reading other tables.
**Why it happens:** Conflating OAuth scopes (claim control) with database authorization.
**How to avoid:** Write explicit RLS policies using `auth.jwt() ->> 'client_id'`. Test with a fresh OAuth token that you check against the database.

### Pitfall 4: Custom Redirect URI Schemes Rejected by DCR

**What goes wrong:** MCP clients using `cursor://` or similar custom schemes fail DCR registration with 400.
**Why it happens:** Known beta bug — validation hasn't been updated to allow RFC 8252 custom schemes.
**How to avoid:** For affected clients, pre-register them manually in the dashboard (which does support custom schemes in its UI) rather than using DCR.

### Pitfall 5: Discovery Endpoint on Custom Domain

**What goes wrong:** `/.well-known/oauth-authorization-server` doesn't resolve on a custom domain.
**Why it happens:** Known beta limitation — the well-known path doesn't always flow through custom domain routing.
**How to avoid:** Use the raw `*.supabase.co` URL in MCP server configuration, or verify custom domain routing works before relying on it.

### Pitfall 6: Authorization ID Not Preserved Through Login Redirect

**What goes wrong:** User lands on consent page, gets redirected to login, and on return the `authorization_id` is gone. `getAuthorizationDetails` fails with an invalid/expired ID.
**Why it happens:** The `authorization_id` has a limited lifetime. If it expires during a slow login, the OAuth flow must restart.
**How to avoid:** Pass `authorization_id` through the login redirect via query param. Complete login quickly. Display an error if the ID has expired and prompt the user to retry from the MCP client.

---

## 13. Configuration Summary for CallVault

### Dashboard Settings

```
Authentication > OAuth Server:
  - Enabled: ON
  - Authorization Path: /oauth/consent
  - Dynamic Client Registration: ON

Authentication > Signing Keys:
  - Algorithm: RS256 (switch from default HS256)
  - Activate the new key after generation
```

### Cloudflare Worker Environment

```toml
# wrangler.toml
[vars]
SUPABASE_PROJECT_REF = "your-project-ref"
SUPABASE_URL = "https://your-project-ref.supabase.co"
# No SUPABASE_JWT_SECRET needed when using RS256 + JWKS
```

### Dependency

```bash
npm install jose
```

---

## 14. Open Questions

1. **Audience claim in OAuth tokens**
   - What we know: Standard Supabase JWTs use `aud: "authenticated"`.
   - What's unclear: Whether OAuth 2.1 server tokens use the same audience or a different one (e.g., the client_id).
   - Recommendation: Verify by inspecting an actual OAuth token in jwt.io after completing a test flow.

2. **Custom domain Discovery endpoint**
   - What we know: There is a known beta issue with custom domains and the well-known endpoint.
   - What's unclear: Whether this affects the `*.supabase.co` URL too, or only custom domains.
   - Recommendation: Test discovery from an MCP client against the raw Supabase URL before using a custom domain.

3. **Token scope for database operations**
   - What we know: The Worker receives the token; it needs to make Supabase queries on behalf of the user.
   - What's unclear: Whether passing the OAuth access token directly to Supabase client for RLS works identically to a regular session token.
   - Recommendation: Test `supabase.auth.setSession({ access_token, refresh_token: '' })` with an OAuth token; confirm RLS applies correctly.

4. **Refresh token handling in MCP clients**
   - What we know: Supabase issues refresh tokens; MCP clients should use them to get new access tokens.
   - What's unclear: Whether the MCP SDK handles refresh token rotation automatically or requires manual implementation.
   - Recommendation: Test the full token lifecycle with Claude Desktop, including what happens 1 hour after initial auth.

---

## Sources

### Primary (HIGH confidence)
- [Supabase OAuth 2.1 Server overview](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase OAuth 2.1 Getting Started](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase OAuth 2.1 Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Supabase Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase blog: Build "Sign in with Your App"](https://supabase.com/blog/oauth2-provider)

### Secondary (MEDIUM confidence)
- [GitHub Discussion #38022: OAuth 2.1 Server Capabilities](https://github.com/orgs/supabase/discussions/38022) — architecture details and discovery endpoint format
- [Security Boulevard: JWT validation at edge with JOSE](https://securityboulevard.com/2025/11/how-to-validate-jwts-efficiently-at-the-edge-with-cloudflare-workers-and-vercel/) — JWKS + jose pattern for Cloudflare Workers

### Tertiary (LOW confidence — needs validation)
- [GitHub Issue #2285: DCR rejects custom URI schemes](https://github.com/supabase/auth/issues/2285) — confirms beta bug, may be fixed by release date

---

## Metadata

**Confidence breakdown:**
- OAuth server setup (dashboard): HIGH — official docs
- Endpoint URLs: HIGH — official docs
- DCR request format: HIGH — GitHub issue + docs
- Discovery response format: MEDIUM — inferred from RFC 8414 + docs (exact JSON not shown verbatim)
- Consent screen implementation: HIGH — official supabase-js API reference
- PKCE behavior: HIGH — official docs
- Cloudflare Worker JWT validation: HIGH — standard jose pattern + official JWKS endpoint
- Scope behavior: HIGH — official token-security docs
- Google OAuth coexistence: MEDIUM — strongly implied, not explicitly documented

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — beta features may change; recheck before production deployment)
