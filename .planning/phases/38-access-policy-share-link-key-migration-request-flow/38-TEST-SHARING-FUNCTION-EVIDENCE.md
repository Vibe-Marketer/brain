# Phase 38 Dedicated Test Sharing Function Evidence

## Execution identity

- **Captured:** 2026-09-19
- **Worktree branch:** `worktree-agent-phase38-07`
- **Source SHA deployed:** `b0cdd27a9e92d9c70263035641d792bd7921a4a5`
- **Supabase CLI:** `2.101.0`
- **Dedicated test project:** `swjzxiddcrtaqixsfaac` (`callvault-test`)
- **Production project:** `vltmrnjsubfzrgrtdqey` (`callvault-ai`), read only in this plan

No credential or token value is included in this evidence.

## Target guards and dedicated test deployments

The CLI was linked to `swjzxiddcrtaqixsfaac` before deployment. Each deployment ran in a separate fail closed shell block that independently required both:

1. `supabase/.temp/project-ref` equaled `swjzxiddcrtaqixsfaac` and did not equal the production ref.
2. `supabase projects list` marked `swjzxiddcrtaqixsfaac | callvault-test` as the active project.

Commands used the repository's established gateway setting:

```text
supabase functions deploy share-call --project-ref swjzxiddcrtaqixsfaac --use-api --no-verify-jwt
supabase functions deploy mcp-server --project-ref swjzxiddcrtaqixsfaac --use-api --no-verify-jwt
```

Both commands reported `Deployed Functions on project swjzxiddcrtaqixsfaac`. Post deployment metadata was:

| Function | Function ID | Version | Status | JWT gateway | Updated UTC |
|---|---|---:|---|---|---|
| `share-call` | `9e09e907-09b3-4d29-8a8b-f8738f1ab7fa` | 2 | ACTIVE | disabled | 2026-09-19T18:17:20.386Z |
| `mcp-server` | `f77d3d93-d9f0-4f14-a8ac-cebfcb7c3828` | 1 | ACTIVE | disabled | 2026-09-19T18:17:29.739Z |

## Compatibility probes

### Deployed `share-call` endpoint

The focused real database and Edge endpoint suite passed **10/10**.

- An existing legacy row retained its row ID, token, recipient, status, and access log relationship.
- Anonymous `/s/<token>` resolution retained the safe teaser response.
- Wrong recipient rejection, correct recipient access, owner access, revoked response, signup prefill, and expired list filtering retained their prior outcomes.
- A signed in owner created a share for a UUID only non Fathom recording through the deployed `POST /share-call` endpoint.
- The new row stored `recording_id`, left `call_recording_id` null, resolved through the public token endpoint, remained listable by UUID, and was revoked through the deployed `DELETE /share-call` endpoint.

Result:

```text
Test Files  1 passed (1)
Tests       10 passed (10)
Duration    10.73s
```

### MCP UUID bridge

The live dedicated test database MCP bridge suite passed **2/2** after deployment.

- A UUID only non Fathom recording completed create, list, and revoke.
- The returned tool result contained only the MCP `content[].text` envelope.
- The text was markdown, was not parseable as JSON, and used `https://app.callvaultai.com/s/<token>`.
- A legacy only row remained listable and revocable through the exact owner scoped fallback.

The golden replay and tool category contract run passed **29 tests** with one unrelated category test skipped; the three test files passed or skipped cleanly before live credentials were loaded. Deno type checks passed for all four changed Edge/MCP modules.

## Complete integration run

The serial repository integration command ran against the dedicated test project after deployment. It reported **207 passed and 24 skipped**. The Phase 38 share suite passed. The command did not exit zero because of unrelated existing suite state outside Plan 38-07:

- three event resolution files could not resolve the pinned `fastest-levenshtein` URL in this isolated worktree's generated local `node_modules` directory;
- six `public-recording` assertions still carry stale `it.fails` markers even though their behavior now passes;
- one merge organizations fixture lost its auth user to shared cleanup;
- one reporter communications case exceeded its five second timeout.

These failures do not touch the sharing modules and were not changed in this isolated plan worktree. The focused sharing gates above are fully green.

## Production unchanged and final relink

After the dedicated test proofs, the CLI was relinked to production and both the local ref file and active project marker identified `vltmrnjsubfzrgrtdqey | callvault-ai`.

No function deploy command used the production ref. Read only production metadata after the relink still showed deployments from 2026-09-10, before this plan:

| Function | Function ID | Version | Updated UTC |
|---|---|---:|---|
| `share-call` | `17b2e257-1836-4b5d-8cce-a35301670a6f` | 215 | 2026-09-10T17:16:32.813Z |
| `mcp-server` | `290f67b4-e4d4-43d9-9e0f-4725eed53324` | 250 | 2026-09-10T17:15:38.146Z |

Production function state was unchanged.
