# 03-06 Task 1 Verification

Date: 2026-05-28

Command:

```bash
VITEST_INTEGRATION_OK=true npm test -- --run \
  supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts \
  supabase/functions/mcp-server/__tests__/oauth-client-grants.integration.test.ts \
  supabase/functions/mcp-oauth-metadata/__tests__/workspace-resource.test.ts \
  src/components/settings/__tests__/McpConnectionsTab.test.tsx \
  src/components/settings/__tests__/McpSetupSnippets.test.tsx \
  && npm run build
```

Result:

- PASS: 5/5 test files, 18/18 tests.
- PASS: `npm run build` exited 0.
- Notes: Vite reported non-blocking chunk-size warnings and dynamic-import warnings.
