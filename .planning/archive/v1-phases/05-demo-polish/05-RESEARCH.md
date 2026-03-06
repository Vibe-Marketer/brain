# Phase 5: Demo Polish - Research

**Researched:** 2026-01-31
**Domain:** Bug fixes, routing, type mismatches, UI consistency
**Confidence:** HIGH (codebase investigation complete)

## Summary

This phase focuses on fixing broken pages, wiring orphaned components, resolving runtime errors, and ensuring UI consistency. Research was conducted by direct codebase investigation rather than external documentation, as all fixes involve existing patterns and established code.

**Key findings:**
1. **AutomationRules page is NOT in App.tsx routing** - requires adding 4 routes
2. **CallDetailPage queries non-existent `calls` table** - should query `fathom_calls`
3. **BulkActionToolbar uses Mac-style bottom portal** - needs to move to 4th pane pattern
4. **Analytics tabs work correctly** - no crashes detected in code review
5. **Tags/Rules tabs appear functional** - may be data-dependent errors
6. **Supabase types are correctly defined** - AutomationRules.tsx types mostly align

**Primary recommendation:** Fix routing first (WIRE-01/WIRE-02), then database query (IMPL-03), then UI consistency (FIX-06).

## Standard Stack

This phase requires no new libraries. All fixes use existing codebase patterns:

### Core (Already Installed)
| Library | Purpose | Pattern Location |
|---------|---------|------------------|
| React Router | Routing | `src/App.tsx` |
| Supabase Client | Database queries | `src/integrations/supabase/client.ts` |
| Zustand | Panel state | `src/stores/panelStore.ts` |
| React Query | Data fetching | `src/hooks/useCallAnalytics.ts` |

### No New Installations Required

All fixes use existing patterns from the codebase.

## Architecture Patterns

### Pattern 1: Route Definition in App.tsx

**Source:** `src/App.tsx:58-112`

```typescript
// Standard route pattern
<Route 
  path="/automation-rules" 
  element={
    <ProtectedRoute>
      <Layout>
        <AutomationRules />
      </Layout>
    </ProtectedRoute>
  } 
/>
```

**Import required:**
```typescript
import AutomationRules from '@/pages/AutomationRules';
// Also need: RuleBuilder, ExecutionHistory (for sub-routes)
```

**Routes to add:**
- `/automation-rules` - Main list page
- `/automation-rules/new` - New rule builder
- `/automation-rules/:id` - Edit existing rule
- `/automation-rules/:id/history` - Execution history

### Pattern 2: Database Query - fathom_calls Table

**Source:** `supabase/functions/chat-stream-v2/index.ts:473`, `src/integrations/supabase/types.ts:1032`

**Current (BROKEN) in CallDetailPage.tsx:45-49:**
```typescript
const { data, error } = await supabase
  .from('calls')  // WRONG: Table doesn't exist
  .select('*')
  .eq('id', callId)
  .single();
```

**Fixed pattern:**
```typescript
const { data, error } = await supabase
  .from('fathom_calls')  // CORRECT: Actual table name
  .select('*')
  .eq('recording_id', callId)  // Primary key is recording_id, not id
  .single();
```

**Note:** `fathom_calls` uses composite key `(recording_id, user_id)`. May need to add user filter for RLS.

### Pattern 3: AppShell Layout (4-Pane System)

**Source:** `src/components/layout/AppShell.tsx`

```typescript
<AppShell
  config={{
    secondaryPane: <CategoryPane />,
    showDetailPane: true,  // Enables 4th pane outlet
  }}
>
  <MainContent />
</AppShell>
```

**Pane widths (from CLAUDE.md):**
- NavRail: 220px expanded, 72px collapsed
- Secondary Panel: 280px
- Main Content: flex-1
- Detail Panel: 360px desktop, 320px tablet

### Pattern 4: BulkActionToolbar - Current vs Target

**Current Pattern (bottom portal):**
Source: `src/components/transcript-library/BulkActionToolbarEnhanced.tsx:212-214`
```typescript
return createPortal(
  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 ...">
    {/* Toolbar content */}
  </div>,
  document.body
);
```

**Target Pattern (4th pane):**
Should follow `DetailPaneOutlet` pattern from `src/components/layout/DetailPaneOutlet.tsx`
```typescript
// No portal - render inline with slide-in animation
<div className="w-[360px] border-l border-border ...">
  {/* Selection actions */}
</div>
```

### Pattern 5: Supabase Type Alignment

**Source:** `src/integrations/supabase/types.ts:264-319`

`automation_rules` table schema:
```typescript
Row: {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  trigger_type: string;      // NOT TriggerType enum
  trigger_config: Json;      // NOT Record<string, unknown>
  conditions: Json;          // NOT Record<string, unknown>
  actions: Json;             // NOT Array<Record<string, unknown>>
  enabled: boolean;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string;
  schedule_config: Json | null;
  next_run_at: string | null;
}
```

**AutomationRules.tsx Type Fixes Needed:**
1. `trigger_config: Record<string, unknown>` → `trigger_config: Json`
2. `conditions: Record<string, unknown>` → `conditions: Json`
3. `actions: Array<Record<string, unknown>>` → `actions: Json`
4. Add missing fields: `schedule_config`, `next_run_at`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Route protection | Custom auth check | `ProtectedRoute` component |
| Panel slide-in | Custom animation | `DetailPaneOutlet` component |
| Database types | Local interfaces | `Database['public']['Tables']` from types.ts |
| Query keys | Ad-hoc strings | `queryKeys` from `lib/query-config.ts` |

## Common Pitfalls

### Pitfall 1: Wrong Table Name for Calls

**What goes wrong:** Querying `calls` table returns no data (table doesn't exist)
**Why it happens:** Legacy naming - codebase migrated from `calls` to `fathom_calls`
**How to avoid:** Always use `fathom_calls` for call data
**Warning signs:** Empty results, "relation does not exist" errors

### Pitfall 2: Wrong Primary Key for fathom_calls

**What goes wrong:** `.eq('id', callId)` fails - no `id` column
**Why it happens:** `fathom_calls` uses `recording_id` as primary key
**How to avoid:** Use `.eq('recording_id', callId)`
**Warning signs:** No rows returned despite valid call ID

### Pitfall 3: Missing Layout Wrapper for Routes

**What goes wrong:** Page renders without sidebar/panes
**Why it happens:** Route missing `<Layout>` wrapper
**How to avoid:** Follow pattern: `<ProtectedRoute><Layout><Page /></Layout></ProtectedRoute>`
**Warning signs:** Full-page render without navigation

### Pitfall 4: AppShell Inside Layout Card Wrapper

**What goes wrong:** Double borders, incorrect padding
**Why it happens:** Pages using AppShell must bypass Layout's card wrapper
**How to avoid:** Add route to `usesCustomLayout` check in Layout.tsx
**Warning signs:** Console warning from AppShell's `useCardWrapperDetection`

### Pitfall 5: Portal-Based Components Don't Respect Pane Layout

**What goes wrong:** Floating toolbar overlaps panes or appears at wrong z-index
**Why it happens:** `createPortal` renders to document.body, ignoring pane system
**How to avoid:** Use inline rendering with AppShell's pane system
**Warning signs:** z-index fights, position conflicts

## Code Examples

### Example 1: Adding Routes to App.tsx

```typescript
// src/App.tsx - Add these imports
import AutomationRules from '@/pages/AutomationRules';
import RuleBuilder from '@/components/automation/RuleBuilder';
import ExecutionHistory from '@/components/automation/ExecutionHistory';

// Add these routes (inside <Routes>)
<Route 
  path="/automation-rules" 
  element={<ProtectedRoute><Layout><AutomationRules /></Layout></ProtectedRoute>} 
/>
<Route 
  path="/automation-rules/new" 
  element={<ProtectedRoute><Layout><RuleBuilder /></Layout></ProtectedRoute>} 
/>
<Route 
  path="/automation-rules/:id" 
  element={<ProtectedRoute><Layout><RuleBuilder /></Layout></ProtectedRoute>} 
/>
<Route 
  path="/automation-rules/:id/history" 
  element={<ProtectedRoute><Layout><ExecutionHistory /></Layout></ProtectedRoute>} 
/>
```

### Example 2: Fixed CallDetailPage Query

```typescript
// src/pages/CallDetailPage.tsx - Fix the query
const { data: call, isLoading: callLoading } = useQuery({
  queryKey: ['call', callId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('fathom_calls')           // Fixed: correct table
      .select('*')
      .eq('recording_id', callId)      // Fixed: correct column
      .single();

    if (error) throw error;
    return data;
  },
  enabled: !!callId,
});
```

### Example 3: Type-Safe Automation Rules

```typescript
// Use Database types directly
import type { Database } from '@/integrations/supabase/types';

type AutomationRule = Database['public']['Tables']['automation_rules']['Row'];

// Or use Json type for flexibility
import type { Json } from '@/integrations/supabase/types';

interface AutomationRuleDisplay {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Json;
  conditions: Json;
  actions: Json;
  // ...
}
```

### Example 4: BulkActionToolbar as 4th Pane

```typescript
// Instead of portal, render inline
export function BulkActionPane({ 
  selectedCount, 
  onClear 
}: BulkActionPaneProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "w-[360px] bg-card border-l border-border",
      "animate-in slide-in-from-right duration-300"
    )}>
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">
          {selectedCount} selected
        </h3>
      </div>
      <div className="p-4 space-y-2">
        {/* Action buttons */}
      </div>
    </div>
  );
}
```

## Requirement-Specific Analysis

### WIRE-01: Route Automation Rules page

**Status:** Missing routes in App.tsx
**Fix:** Add 4 routes (list, new, edit, history)
**Files:** `src/App.tsx`
**Complexity:** Low

### WIRE-02: Wire analytics tabs

**Status:** Routes exist (`/analytics/:category`), tabs work
**Investigation:** Analytics tabs (OverviewTab, TagsTab, TalkTimeTab, etc.) are already wired via AnalyticsDetailPane
**Action:** Verify runtime, may already be working

### FIX-01: Fix Tags tab error (spec-027)

**Status:** TagsTab.tsx appears functional
**Investigation:** Uses `call_tags` table with correct queries
**Possible issues:** 
- Missing tag data (empty state works)
- RLS policy blocking access
**Action:** Test with real data, check console for errors

### FIX-02: Fix Rules tab error (spec-028)

**Status:** RulesTab.tsx appears functional  
**Investigation:** Uses `tag_rules` table with correct queries
**Possible issues:**
- Missing RPC `apply_tag_rules_to_untagged`
- RLS policy issues
**Action:** Test with real data, verify RPC exists

### FIX-03: Fix Analytics tabs crashes (spec-035)

**Status:** No obvious crash causes in code
**Investigation:** All analytics tabs have proper error handling, loading states
**Possible issues:**
- `useCallAnalytics` hook returns undefined data
- Missing data in `fathom_calls`
**Action:** Test with real data, add defensive null checks

### FIX-04: Fix Users tab non-functional elements (spec-042)

**Status:** UsersTab.tsx is functional but basic
**Investigation:** Role changes work, user listing works
**Possible issues:**
- ADMIN-only operations blocked for TEAM users
- Missing user invite functionality
**Action:** Review with actual permissions

### FIX-05: Fix Billing section if charging (spec-043)

**Status:** BillingTab.tsx shows plan info and usage
**Investigation:** Uses `useEmbeddingCosts` hook, role-based display
**Possible issues:**
- No actual Stripe integration
- Upgrade buttons are placeholders
**Action:** Clarify if billing needs payment processing or just display

### FIX-06: Move bulk action toolbar

**Status:** BulkActionToolbarEnhanced uses bottom portal
**Target:** Move to 4th pane (right-side slide-in)
**Files:** 
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`
- `src/components/transcripts/TranscriptsTab.tsx`
- `src/components/transcripts/SyncedTranscriptsSection.tsx`
**Complexity:** Medium-High (affects layout architecture)

### REFACTOR-04: Fix type mismatches in AutomationRules.tsx

**Status:** Local types diverge from Supabase schema
**Issues identified:**
1. `trigger_type: TriggerType` vs `trigger_type: string`
2. `trigger_config: Record<string, unknown>` vs `Json`
3. `conditions: Record<string, unknown>` vs `Json`
4. `actions: Array<Record<string, unknown>>` vs `Json`
5. Missing: `schedule_config`, `next_run_at`
**Action:** Import Database types, use Row type directly

### IMPL-03: Fix CallDetailPage table reference

**Status:** Queries `calls` table (doesn't exist)
**Fix:** Change to `fathom_calls`, use `recording_id`
**Files:** `src/pages/CallDetailPage.tsx`
**Complexity:** Low

### DOC-01: Document export system

**Status:** Export utilities exist in `src/lib/export-utils.ts`
**Pattern:** `ExportableCall = Pick<Meeting, ...fields...>`
**Formats:** PDF, DOCX, TXT, JSON, ZIP, Markdown, CSV
**Action:** Create user-facing documentation

### DOC-02: Document multi-source deduplication

**Status:** Deduplication logic in `supabase/functions/_shared/deduplication.ts`
**Pattern:** Fingerprint matching (title 80%, time overlap 50%, participants 60%)
**Priority modes:** `first_synced`, `most_recent`, `platform_hierarchy`, `longest_transcript`
**Action:** Create user-facing documentation explaining how duplicates are handled

## Open Questions

1. **Analytics crashes (FIX-03):**
   - What's unclear: Specific error messages not provided
   - Recommendation: Run app with test data, capture console errors

2. **Users tab elements (FIX-04):**
   - What's unclear: Which elements are "non-functional"
   - Recommendation: Manual testing to identify broken interactions

3. **Billing integration (FIX-05):**
   - What's unclear: Does "fix billing" mean add Stripe or just fix display?
   - Recommendation: Clarify scope before implementing

4. **Bulk action pane layout (FIX-06):**
   - What's unclear: Should it replace bottom bar entirely or be an alternative?
   - Recommendation: Confirm UX decision before implementing

## Sources

### Primary (HIGH confidence)
- `src/App.tsx` - Route configuration (verified missing automation routes)
- `src/pages/CallDetailPage.tsx` - Wrong table query (verified `calls` vs `fathom_calls`)
- `src/integrations/supabase/types.ts` - Supabase schema (verified type definitions)
- `src/components/layout/AppShell.tsx` - Pane layout pattern (verified architecture)
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` - Current toolbar implementation

### Secondary (MEDIUM confidence)
- `src/components/tags/TagsTab.tsx` - Tags display (appears functional, needs runtime test)
- `src/components/tags/RulesTab.tsx` - Rules display (appears functional, needs runtime test)
- `src/components/analytics/*.tsx` - Analytics tabs (appear functional, needs runtime test)

## Metadata

**Confidence breakdown:**
- Routing fixes (WIRE-01, WIRE-02): HIGH - direct code analysis
- Database fixes (IMPL-03): HIGH - verified table names
- Type fixes (REFACTOR-04): HIGH - compared to schema
- Tab errors (FIX-01 to FIX-05): MEDIUM - need runtime testing
- UI consistency (FIX-06): MEDIUM - pattern clear, implementation TBD
- Documentation: HIGH - code patterns documented

**Research date:** 2026-01-31
**Valid until:** Indefinite (fixes internal codebase issues)
