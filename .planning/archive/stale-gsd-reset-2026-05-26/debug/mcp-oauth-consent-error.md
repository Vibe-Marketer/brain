---
status: investigating
trigger: "MCP connect flow reaches https://app.callvaultai.com/oauth/consent?authorization_id=ytp43xc7xulyodw4qx4wwbhmayt5adnb and shows 'Something went wrong' / 'Failed to load the authorization request. Please try connecting again from your MCP client.' after recent work to support client-id/client-secret style connectors for hard-to-connect platforms like Perplexity. User reports ChatGPT adds the MCP, starts connecting, lands on auth page, then errors. Claude may still connect/authorize, but not verified due usage limit."
created: "2026-05-15"
updated: "2026-05-15"
---

# MCP OAuth Consent Error

## Symptoms

### Expected behavior

MCP clients such as ChatGPT should discover the MCP OAuth metadata, register/connect if needed, redirect the user to `/oauth/consent?authorization_id=<id>`, load authorization details, allow approval, and complete authorization back to the client.

### Actual behavior

The client appears to add the MCP and start connecting, but the browser lands on the consent page and displays:

- "SOMETHING WENT WRONG"
- "Failed to load the authorization request. Please try connecting again from your MCP client."

### Error messages

Browser page error at:

`https://app.callvaultai.com/oauth/consent?authorization_id=ytp43xc7xulyodw4qx4wwbhmayt5adnb`

### Timeline

Regression started after MCP work intended to support hard-to-connect platforms using client ID and client secret, initially motivated by Perplexity connector failures.

### Reproduction

Connect CallVault MCP from a client such as ChatGPT. The client adds the MCP, begins the OAuth connection flow, redirects to CallVault `/oauth/consent`, then the consent page fails to load the authorization request.

## Current Focus

- hypothesis: Recent MCP OAuth/register/metadata changes create or advertise an authorization flow incompatible with the frontend consent page's `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` lookup, causing the consent page to fail after redirect.
- test: Inspect OAuth consent frontend, MCP metadata/register functions, route rewrites, and tests/runbook for mismatches in issuer/base URL, authorization endpoint, dynamic client registration, authorization ID source, and Supabase OAuth provider expectations.
- expecting: A concrete mismatch that explains why a valid-looking `authorization_id` cannot be loaded by the app consent page.
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-15T14:10:57Z
  observation: The screenshot authorization ID exists in production Supabase Auth.
  details: `auth.oauth_authorizations.authorization_id = ytp43xc7xulyodw4qx4wwbhmayt5adnb`, `client_name = ChatGPT`, `token_endpoint_auth_method = none`, `client_type = public`, `resource = https://api.callvaultai.com/mcp`, `status = approved`.

- timestamp: 2026-05-15T14:10:57Z
  observation: ChatGPT has an existing consent grant.
  details: `auth.oauth_consents` has a non-revoked ChatGPT grant from `2026-05-09T05:19:58Z` with scopes `openid email profile phone`.

- timestamp: 2026-05-15T14:11:00Z
  observation: The authorization request was approved quickly and has an authorization code.
  details: `approved_at = 2026-05-15T13:29:56Z`, roughly 1.5 seconds after creation, and `authorization_code is not null`.

- timestamp: 2026-05-15T14:11:30Z
  observation: Supabase JS documents the already-consented path.
  details: `node_modules/@supabase/auth-js/src/lib/types.ts` says `OAuthAuthorizationDetails.redirect_url` is present when the user already consented and should be used to trigger immediate redirect.

- timestamp: 2026-05-15T14:12:00Z
  observation: The frontend ignored `redirect_url`.
  details: `src/pages/OAuthConsentPage.tsx` called `getAuthorizationDetails()`, but always set consent UI state and never redirected when `data.redirect_url` was returned.

## Eliminated

- hypothesis: ChatGPT never created an authorization request.
  reason: Production DB contains the exact screenshot `authorization_id`.

- hypothesis: DCR/client-secret changes are the direct failing step for this ChatGPT report.
  reason: The screenshot row is a ChatGPT public client (`token_endpoint_auth_method = none`) and already reached/approved the authorization step.

## Resolution

- root_cause: ChatGPT already had a non-revoked OAuth consent grant, so Supabase could auto-approve the new authorization and return a `redirect_url` from `getAuthorizationDetails()` instead of requiring manual consent. The consent page did not implement this SDK contract, so already-consented ChatGPT flows could remain on `/oauth/consent` and surface a generic failure instead of redirecting back to ChatGPT.
- fix: `OAuthConsentPage.fetchAuthorizationDetails()` now checks `data.redirect_url` and immediately `window.location.assign()`s it before rendering consent UI. Added console logging for authorization-detail failures to make future consent-page errors diagnosable.
- verification: `npm run type-check` passed. `npm run build` passed.
- files_changed: `src/pages/OAuthConsentPage.tsx`
