---
plan: 08-01
phase: 08-full-suite-test-recovery
status: complete
completed: 2026-06-10
commit: 66d5a80
---

## What Was Built

Converted `supabase/functions/_shared/__tests__/connector-function-utils.test.ts` from a hand-rolled Deno.test harness to standard Vitest imports.

## Changes Made

- Removed 80 lines of inline `describe`/`it`/`expect`/`assertDeepEqual`/`assertMatchObject`/`matchesObject` shims that called `Deno.test()` internally
- Replaced with a single `import { describe, it, expect } from 'vitest';` line
- All 13 test assertions now use Vitest's native `.resolves`, `.rejects`, `.toEqual`, `.toMatchObject`, `.toBeInstanceOf`, `.toThrow` — zero behavior change

## Verification

```
npx vitest run supabase/functions/_shared/__tests__/connector-function-utils.test.ts
PASS (13) FAIL (0)
grep -c "Deno.test" → 0
```

## Self-Check: PASSED
