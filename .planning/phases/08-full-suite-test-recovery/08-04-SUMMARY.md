---
plan: 08-04
phase: 08-full-suite-test-recovery
status: complete
completed: 2026-06-10
commit: 36ed0ad
---

## What Was Built

Added `vi.mock('@/hooks/useApiTokens')` and `vi.mock('@/hooks/useOrganizations')` to IntegrationsTab.test.tsx, fixing the AuthProvider error on mount.

## Changes Made

- Added useApiTokens mock (stubs useApiTokensList, useGenerateApiToken, useRevokeApiToken)
- Added useOrganizations mock (stubs useOrganizations hook)
- Both placed before `import IntegrationsTab` for correct Vitest hoisting

## Verification

```
npx vitest run src/components/settings/__tests__/IntegrationsTab.test.tsx
PASS (3) FAIL (0)
```

No "useAuth must be used within AuthProvider" error.

## Self-Check: PASSED
