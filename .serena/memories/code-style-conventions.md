# Code Style & Conventions - Conversion Brain

## Naming Conventions

### Files & Folders
| Type | Convention | Example |
|------|------------|---------|
| Edge Function folders | kebab-case | `fetch-meetings/` |
| React components | PascalCase.tsx | `CallDetailDialog.tsx` |
| Hooks | useCamelCase.ts or use-kebab-case.ts | `useMeetingsSync.ts` |
| Utilities | kebab-case.ts | `api-client.ts` |
| Types | PascalCase.ts | `types.ts` |

### Code Elements
| Type | Convention | Example |
|------|------------|---------|
| Functions | camelCase | `fetchMeetings()` |
| Hooks | use + CamelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id`, `created_at` |
| JS object properties | camelCase | `totalCalls`, `avgDuration` |
| Query keys | kebab-case arrays | `["call-transcripts", id]` |

### Function Prefixes
- `fetch*` - Retrieve from API
- `sync*` - Synchronize data
- `save*` - Persist settings
- `get*` - Retrieve config/status
- `test*` - Verify connections
- `create*` - Create resources
- `delete*` - Remove data
- `load*` - Load internal data
- `check*` - Verify status

## TypeScript
- Strict mode enabled
- Use type annotations where not inferable
- Prefer `interface` for object shapes, `type` for unions/primitives
- Unused variables prefixed with `_` are allowed (ESLint config)

## React Patterns
- Functional components only
- TanStack Query for server state
- Context for global app state
- Custom hooks for reusable logic
- Import aliases: `@/` maps to `src/`

## Imports
```typescript
// Path aliases
import { Component } from "@/components/Component";
import { supabase } from "@/integrations/supabase/client";
import { useHook } from "@/hooks/useHook";
```

## Edge Functions
- Standard Deno handler: `Deno.serve(async (req) => {})`
- CORS headers handling required
- Return JSON responses with proper Content-Type
- Use `_shared/` for shared utilities

## ESLint Rules
- React hooks rules enforced
- react-refresh for HMR compatibility
- Unused vars warning (not error), underscore prefix allowed
