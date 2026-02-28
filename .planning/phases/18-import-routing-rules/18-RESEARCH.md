# Phase 18: Import Routing Rules - Research

**Researched:** 2026-02-27
**Domain:** Rule engine UI, drag-to-reorder lists, condition builder, pipeline integration, DB schema for routing rules
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Condition builder UX:**
- Sentence-like builder: "When [field] [operator] [value], route to [workspace/folder]" — reads like natural language, each part is a dropdown/input inline
- AND/OR logic with toggle between conditions — user can switch per condition group
- Up to 5 conditions per rule
- 6 condition types: title contains, participant is, source is, duration greater than, tag is, date range (after/before)
- "+ Add another condition" link below conditions

**Rule management & priority:**
- Card list layout: each rule is a card showing sentence-like summary, destination, match count. Drag handle on left
- Rules require a name (e.g., "Q1 Reviews", "Acme Meetings") — makes rule list scannable
- Editing opens in a slide-over panel from the right (consistent with CallVault's detail pane pattern) — rule list stays visible underneath
- Each rule has an enabled/disabled toggle — disabled rules stay in list but are skipped during import. Useful for seasonal/temporary rules
- Drag-to-reorder for priority (first-match-wins engine)

**Preview & feedback:**
- Live preview: match count updates in real-time as conditions are added/changed
- Expandable detail: "See matching calls" expander shows actual call titles that would match
- Preview checks against last 20 calls
- Zero-match warning: yellow warning "This rule didn't match any of your last 20 calls. It may match future imports." — allows save anyway
- Overlap warning at design time: when creating/editing a rule, if another rule also matches some of the same calls, show non-blocking warning: "Heads up: Rule 'X' also matches N of these calls and has higher priority. It will run first."
- Routing trace at runtime: each routed call shows subtle gray badge "Routed by: [Rule Name]" on the call row. Hover/click shows popover with rule name, matched conditions, and timestamp

**Default destination & empty states:**
- Default destination is a top-level setting ABOVE the rule list (not a rule card): "Unmatched calls go to: [Workspace > Folder]" with helper text
- Default destination must be set before rules can be created
- Guided empty state when no rules exist:
  - Illustration + headline "Route new calls automatically"
  - Subtext: "Send calls from each source to the right workspace and folder as soon as they're imported. No more dragging recordings around."
  - Primary CTA: "Create your first rule"
  - Secondary: "Learn how routing works" (help sheet)
  - First rule creation suggests a sensible pattern (e.g., Source = Fathom) but does NOT pre-create it

**Navigation & scope:**
- Rules live inside Import Hub as a tab: Import Hub > Sources | Rules
- Rules are organization-wide (one ruleset per org) with workspace/folder targets — not per-workspace
- The Import Hub is org-scoped: one place to see and manage all routing logic
- Each rule's destination is any workspace/folder in the org
- Mental model: "Org has one rule list. Each rule sends calls to a specific workspace/folder. If no rule matches, calls go to the org default destination."

### Claude's Discretion
- Drag-to-reorder implementation (library choice, animation)
- Exact sentence-like builder component architecture
- AND/OR toggle visual design
- Help sheet content for "Learn how routing works"
- Badge/popover styling for routing trace
- DB schema design for rules table (priority column, conditions JSONB, etc.)

### Deferred Ideas
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 18 builds the routing rules engine on top of the Phase 17 connector pipeline. The primary deliverables are: (1) a `import_routing_rules` database table with a `priority` integer column, (2) a `applyRoutingRules()` function added to `_shared/connector-pipeline.ts` that runs between dedup check and insert, (3) the Import Hub UI redesign that adds a "Rules" tab with drag-to-reorder rule cards and a slide-over editor.

The codebase already has every building block needed. The automation rules system (`/src/components/automation/`) provides a fully working `ConditionBuilder` component with AND/OR toggle, field dropdowns, and operator selection — Phase 18 needs a narrower version of this for 6 specific condition types. The `@dnd-kit/core` package is already installed (v6.3.1); however, `@dnd-kit/sortable` (the subpackage for list reordering with `useSortable` + `arrayMove`) is NOT installed and must be added. The `vaults` and `folders` tables exist with proper RLS for the destination picker. The `connector-pipeline.ts` currently hardcodes the personal vault as destination — Phase 18 adds `applyRoutingRules()` that checks the rules table before defaulting to the personal vault.

The most critical architectural constraint is that `connector-pipeline.ts`'s `insertRecording()` must be modified to accept an optional `targetVaultId` and `targetFolderId` from the routing engine, OR a new pre-step `resolveRoutingDestination()` function runs before `insertRecording()` and sets `record.vault_id` and an optional `record.folder_id`. Either pattern works — the second is cleaner because it doesn't change the `insertRecording()` signature. The DB schema for routing rules should mirror the `automation_rules` table pattern: JSONB conditions, integer priority with a compound index `(bank_id, priority)`, and `enabled` boolean.

**Primary recommendation:** Build the DB schema and `applyRoutingRules()` function in `_shared/connector-pipeline.ts` first, verify rules fire correctly via manual test, then build the UI in a single `ImportHub.tsx` page with two tabs (Sources, Rules). The slide-over editor uses Tailwind position:fixed (not the existing `panelStore` pattern) because the rule list must remain visible underneath.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | ^2.84.0 | DB queries, RLS, real-time preview | In use |
| `@tanstack/react-query` | ^5.90.10 | Server state, live preview queries | In use |
| `@dnd-kit/core` | ^6.3.1 | DnD context and sensor management | Installed |
| `shadcn/ui` (Card, Badge, Switch, Select, Popover) | current | Rule card, condition dropdowns, routing trace popover | In use |
| `@remixicon/react` | ^4.7.0 | Icons — RiDraggable, RiAddLine, RiAlertLine, etc. | In use |
| `sonner` | ^1.7.4 | Toast on save/error | In use |
| `framer-motion` (v12, imported as `motion/react`) | ^12.x | Slide-over panel animation | In use |
| `zustand` | ^5.0.9 | `routingRuleStore` for slide-over state | In use |
| Deno Edge Functions | deploy | `applyRoutingRules()` runs server-side in connector pipeline | In use |

### New for this Phase
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@dnd-kit/sortable` | ^8.0.0 (latest) | `useSortable`, `SortableContext`, `arrayMove` for reorder list | Must be installed — separate package from `@dnd-kit/core` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/sortable` | `react-beautiful-dnd` | dnd-kit is already in the project via core; adding sortable is the right extension. react-beautiful-dnd is deprecated |
| `@dnd-kit/sortable` | Manual `DndContext` with `useDroppable`/`useDraggable` | sortable preset has `arrayMove` and `verticalListSortingStrategy` built-in — significantly less code |
| Tailwind fixed slide-over | Existing `panelStore` + AppShell detail pane | The `panelStore` pane renders in the right-most AppShell pane (360px) — rule list disappears underneath. The slide-over must float OVER the rule list, not replace it. Fixed-position div is correct. |
| JSONB conditions array | Separate `rule_conditions` table | JSONB is simpler, RLS inherited from rules table, matches `automation_rules.conditions` pattern already in codebase |

**Installation:**
```bash
npm install @dnd-kit/sortable
```

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/functions/
  _shared/
    connector-pipeline.ts    # MODIFY: add applyRoutingRules() + resolveDestination()
    routing-engine.ts        # NEW: pure TypeScript rule evaluation, no side effects

src/
  pages/
    ImportHub.tsx            # MODIFY (extends Phase 17 work): add "Rules" tab
  components/
    import/
      RoutingRulesList.tsx      # NEW: drag-to-reorder card list
      RoutingRuleCard.tsx       # NEW: single rule card with drag handle
      RoutingRuleSlideOver.tsx  # NEW: fixed-position editor panel
      RoutingConditionBuilder.tsx # NEW: simplified 6-type condition builder
      DestinationPicker.tsx     # NEW: workspace + folder cascading select
      RulePreviewCount.tsx      # NEW: live match count badge
      DefaultDestinationBar.tsx # NEW: top-level unmatched calls setting
  hooks/
    useRoutingRules.ts          # NEW: CRUD + reorder + enable/disable mutations
    useRulePreview.ts           # NEW: real-time preview against last 20 calls
  stores/
    routingRuleStore.ts         # NEW: slide-over open/close + active rule ID

supabase/migrations/
  YYYYMMDD_create_import_routing_rules.sql  # NEW: rules table + org_default_destination
```

### Pattern 1: DB Schema — `import_routing_rules` Table

The schema follows `automation_rules` closely. Key difference: rules are org-scoped (one ruleset per `bank_id`), not user-scoped.

```sql
-- Source: modeled on automation_rules schema (migration 20260110000004)
CREATE TABLE import_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- "Q1 Reviews", "Acme Meetings"
  priority INTEGER NOT NULL DEFAULT 0,         -- Lower = higher priority. IMP-10 requirement.
  enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]',      -- Array of condition objects
  logic_operator TEXT NOT NULL DEFAULT 'AND',  -- 'AND' | 'OR'
  -- Destination (required)
  target_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  target_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compound index for pipeline engine query: fetch all enabled rules for a bank, ordered by priority
CREATE INDEX idx_routing_rules_bank_priority
  ON import_routing_rules(bank_id, priority)
  WHERE enabled = true;

-- Separate table for org default destination
-- One row per bank. Upserted when user saves the default destination setting.
CREATE TABLE import_routing_defaults (
  bank_id UUID PRIMARY KEY REFERENCES banks(id) ON DELETE CASCADE,
  target_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  target_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Priority pattern:** `priority` is a compact integer. Drag-to-reorder reassigns sequential integers (1, 2, 3...) across all rules in the list. This avoids sparse gaps. On `onDragEnd`, call a single RPC `update_rule_priorities(rule_ids UUID[])` that does a batch UPDATE with generated integers.

### Pattern 2: Routing Engine in `_shared/connector-pipeline.ts`

The routing engine is a pure TypeScript function with no side effects. It evaluates conditions against a `ConnectorRecord` and returns the winning rule's destination, or null (use default). This function lives in `_shared/routing-engine.ts` and is imported by `connector-pipeline.ts`.

```typescript
// supabase/functions/_shared/routing-engine.ts
// Source: new code modeled on existing automation_engine.ts patterns

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ConnectorRecord } from './connector-pipeline.ts';

export interface RoutingDestination {
  vaultId: string;
  folderId: string | null;
  matchedRuleId: string;
  matchedRuleName: string;
}

/**
 * First-match-wins: fetches all enabled rules for the bank, ordered by priority ASC.
 * Evaluates each rule's conditions against the record.
 * Returns the first matching rule's destination, or null if no rule matches.
 * Falls back to null — caller resolves default destination from import_routing_defaults.
 */
export async function resolveRoutingDestination(
  supabase: SupabaseClient,
  bankId: string,
  record: ConnectorRecord
): Promise<RoutingDestination | null> {
  const { data: rules, error } = await supabase
    .from('import_routing_rules')
    .select('id, name, priority, conditions, logic_operator, target_vault_id, target_folder_id')
    .eq('bank_id', bankId)
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (error || !rules?.length) return null;

  for (const rule of rules) {
    if (evaluateRule(rule, record)) {
      return {
        vaultId: rule.target_vault_id,
        folderId: rule.target_folder_id,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
      };
    }
  }

  return null;
}

function evaluateRule(rule: { conditions: unknown; logic_operator: string }, record: ConnectorRecord): boolean {
  const conditions = rule.conditions as Array<{ field: string; operator: string; value: unknown }>;
  if (!conditions?.length) return false;

  const results = conditions.map(c => evaluateCondition(c, record));
  return rule.logic_operator === 'OR'
    ? results.some(Boolean)
    : results.every(Boolean);
}

function evaluateCondition(
  condition: { field: string; operator: string; value: unknown },
  record: ConnectorRecord
): boolean {
  const { field, operator, value } = condition;
  switch (field) {
    case 'title':
      return evaluateString(record.title, operator, String(value));
    case 'source':
      return evaluateString(record.source_app, operator, String(value));
    case 'duration':
      return evaluateNumber(record.duration ?? 0, operator, Number(value));
    case 'participant': {
      const participants = extractParticipants(record);
      return participants.some(p => evaluateString(p, operator, String(value)));
    }
    case 'tag': {
      const tags = (record.source_metadata?.tags as string[]) ?? [];
      return tags.some(t => evaluateString(t, operator, String(value)));
    }
    case 'date': {
      const ts = new Date(record.recording_start_time).getTime();
      const cmp = new Date(String(value)).getTime();
      return operator === 'after' ? ts > cmp : ts < cmp;
    }
    default:
      return false;
  }
}

function evaluateString(actual: string, operator: string, expected: string): boolean {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  switch (operator) {
    case 'contains': return a.includes(e);
    case 'not_contains': return !a.includes(e);
    case 'equals': return a === e;
    case 'starts_with': return a.startsWith(e);
    default: return false;
  }
}

function evaluateNumber(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case 'greater_than': return actual > expected;
    case 'less_than': return actual < expected;
    case 'equals': return actual === expected;
    default: return false;
  }
}

function extractParticipants(record: ConnectorRecord): string[] {
  // Participants live in source_metadata as calendar_invitees, attendees, participants
  // depending on source. Extract all email/name values found.
  const meta = record.source_metadata;
  const invitees = (meta?.calendar_invitees as Array<{ email?: string; name?: string }>) ?? [];
  return invitees.flatMap(i => [i.email, i.name].filter(Boolean) as string[]);
}
```

**Integration into connector-pipeline.ts:** The `insertRecording()` function currently hardcodes the personal vault. Phase 18 adds a step before `insertRecording()` is called:

```typescript
// In connector-pipeline.ts insertRecording():
// If record.vault_id is NOT provided, check routing rules before falling back to personal vault.
// This preserves backward compatibility: connectors that pass vault_id explicitly bypass routing.

// In each connector (or in runPipeline()):
const routing = await resolveRoutingDestination(supabase, bankId, record);
if (routing) {
  record.vault_id = routing.vaultId;
  // Store routing trace in source_metadata for badge display
  record.source_metadata = {
    ...record.source_metadata,
    routed_by_rule_id: routing.matchedRuleId,
    routed_by_rule_name: routing.matchedRuleName,
    routed_at: new Date().toISOString(),
  };
}
// If no routing match, insertRecording() falls back to org default destination (or personal vault)
```

The routing trace is stored in `source_metadata` — no new column needed. The "Routed by: [Rule Name]" badge reads from `source_metadata->>'routed_by_rule_name'`.

### Pattern 3: Drag-to-Reorder with `@dnd-kit/sortable`

The `@dnd-kit/sortable` package provides `SortableContext`, `useSortable`, and `arrayMove`. These import from `@dnd-kit/sortable`. The outer `DndContext` still comes from `@dnd-kit/core`.

```typescript
// Source: official @dnd-kit/sortable docs (https://dndkit.com/presets/sortable)
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// In RoutingRulesList.tsx:
function RoutingRulesList({ rules, onReorder }: Props) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [items, setItems] = useState(rules);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(r => r.id === active.id);
    const newIndex = items.findIndex(r => r.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);  // Optimistic local update
    onReorder(reordered.map(r => r.id));  // Persist to DB
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(r => r.id)} strategy={verticalListSortingStrategy}>
        {items.map(rule => (
          <SortableRuleCard key={rule.id} rule={rule} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// In RoutingRuleCard.tsx:
function SortableRuleCard({ rule }: { rule: RoutingRule }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="...">
      {/* Drag handle: apply listeners to handle only, not entire card */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing px-2 py-1">
        <RiDraggable className="h-4 w-4 text-muted-foreground" />
      </div>
      {/* Card content */}
    </div>
  );
}
```

### Pattern 4: Live Rule Preview (Last 20 Calls)

The preview queries `recordings` filtered by the current user's bank, ordered by `recording_start_time DESC`, limited to 20. Conditions are evaluated client-side against the returned records — no server-side evaluation needed for the preview. This keeps the edge function lightweight.

```typescript
// src/hooks/useRulePreview.ts
export function useRulePreview(conditions: RuleCondition[], logicOperator: 'AND' | 'OR') {
  const { activeBankId } = useBankContext();
  const { user } = useAuth();

  // Fetch last 20 calls once — stale time 5 minutes
  const { data: recentCalls } = useQuery({
    queryKey: ['routing-preview-calls', activeBankId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, title, source_app, duration, recording_start_time, source_metadata, global_tags')
        .eq('owner_user_id', user!.id)
        .order('recording_start_time', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!activeBankId && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Evaluate conditions client-side against fetched calls (no server round trip)
  const matchingCalls = useMemo(() => {
    if (!recentCalls || !conditions.length) return [];
    return recentCalls.filter(call => evaluateConditionsClientSide(conditions, logicOperator, call));
  }, [recentCalls, conditions, logicOperator]);

  return { matchingCount: matchingCalls.length, matchingCalls, totalChecked: recentCalls?.length ?? 0 };
}
```

The `evaluateConditionsClientSide` function mirrors `evaluateRule()` from `routing-engine.ts` but runs in the browser. Keep both in sync. The condition field names are the same: `title`, `source`, `duration`, `participant`, `tag`, `date`.

### Pattern 5: Slide-Over Panel (Fixed Position, Not panelStore)

The locked decision is that the rule list stays visible underneath the editor. The existing `panelStore` pattern renders the detail panel in AppShell's 4th pane (360px), which replaces the main content area. Phase 18 needs a true slide-over that floats on top of the rules list.

**Implementation:** Use `framer-motion` (`motion/react`) with `AnimatePresence` for the slide-in animation. The slide-over is position:fixed, right-0, top-0, bottom-0, width 480px. Z-index: 50 (above everything). On mobile it goes full-screen.

```tsx
// src/components/import/RoutingRuleSlideOver.tsx
import { AnimatePresence, motion } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ruleId: string | null;  // null = create new
}

export function RoutingRuleSlideOver({ isOpen, onClose, ruleId }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (non-blocking, just dims) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            <RoutingRuleEditor ruleId={ruleId} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Note on `motion/react`:** The project uses `motion/react` (not `framer-motion`) per STATE.md decision (2026-02-27): "motion/react (not framer-motion) for all animations — motion v12 import path is motion/react". Do NOT import from `framer-motion`.

### Pattern 6: Routing Trace Badge

The "Routed by: [Rule Name]" badge reads from `source_metadata`. It is rendered in the call row list component alongside the call title.

```tsx
// In call list row component — check source_metadata for routing trace
const routedBy = recording.source_metadata?.routed_by_rule_name as string | undefined;

{routedBy && (
  <Popover>
    <PopoverTrigger asChild>
      <Badge variant="secondary" className="text-xs text-muted-foreground cursor-pointer">
        Routed by: {routedBy}
      </Badge>
    </PopoverTrigger>
    <PopoverContent className="w-64 text-sm">
      <p><strong>Rule:</strong> {routedBy}</p>
      <p><strong>When:</strong> {formatDate(recording.source_metadata?.routed_at)}</p>
    </PopoverContent>
  </Popover>
)}
```

### Pattern 7: Destination Picker — Workspace + Folder Cascade

The destination picker uses the existing `useVaults` and `useFolders` hooks. Vaults (workspaces) are fetched for the active bank. Folders are fetched for the selected vault. This is a two-step cascading select.

```tsx
// src/components/import/DestinationPicker.tsx
function DestinationPicker({ value, onChange }: Props) {
  const [selectedVaultId, setSelectedVaultId] = useState(value?.vaultId ?? '');
  const { data: vaults } = useVaults();  // All workspaces in active bank
  const { data: folders } = useFolders(selectedVaultId);  // Folders for selected workspace

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedVaultId} onValueChange={id => { setSelectedVaultId(id); onChange({ vaultId: id, folderId: null }); }}>
        <SelectTrigger><SelectValue placeholder="Select workspace..." /></SelectTrigger>
        <SelectContent>
          {vaults?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {selectedVaultId && (
        <Select value={value?.folderId ?? ''} onValueChange={fid => onChange({ vaultId: selectedVaultId, folderId: fid || null })}>
          <SelectTrigger><SelectValue placeholder="No folder (root)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">No folder (root)</SelectItem>
            {folders?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
```

### Pattern 8: Batch Priority Update RPC

When the user reorders rules by drag, the full priority list must be persisted atomically. Use a Supabase RPC (SECURITY DEFINER function) rather than N individual UPDATEs.

```sql
-- In migration file
CREATE OR REPLACE FUNCTION update_routing_rule_priorities(
  p_bank_id UUID,
  p_rule_ids UUID[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is a member of this bank
  IF NOT EXISTS (
    SELECT 1 FROM bank_memberships
    WHERE bank_id = p_bank_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update priorities sequentially by array position
  FOR i IN 1..array_length(p_rule_ids, 1) LOOP
    UPDATE import_routing_rules
    SET priority = i, updated_at = now()
    WHERE id = p_rule_ids[i] AND bank_id = p_bank_id;
  END LOOP;
END;
$$;
```

### Anti-Patterns to Avoid

- **Importing from `framer-motion`:** Always use `motion/react` (v12 path). Every existing animation import in the project uses this.
- **Using `panelStore` for the rule editor:** The panelStore detail pane replaces content. The slide-over must float over the rule list. Use fixed-position with `AnimatePresence` instead.
- **Using `@dnd-kit/core` `useDroppable`/`useDraggable` directly for the sortable list:** `useSortable` from `@dnd-kit/sortable` is purpose-built for this. The existing `DragDropZones.tsx` uses `useDroppable` (for drag-to-folder), which is a different use case. The rule list reorder is a separate sortable pattern.
- **Storing routing trace in a separate column:** Use `source_metadata` JSONB for routing trace. No schema migration needed. Key: `routed_by_rule_id`, `routed_by_rule_name`, `routed_at`.
- **Evaluating conditions server-side for preview:** Client-side evaluation against the 20 fetched recordings is sufficient for preview. Server round trips for preview add latency and complexity.
- **Making `import_routing_rules` user-scoped (not bank-scoped):** Rules are org-wide. The `bank_id` column (not `user_id`) is the scope. RLS must enforce bank membership, not user ownership. Use the `bank_memberships` join pattern for RLS.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List drag-to-reorder | Custom drag events with mousedown/mousemove | `@dnd-kit/sortable` (`useSortable`, `arrayMove`) | Handles keyboard accessibility, touch, pointer sensors, animation transforms |
| Condition builder | Build from scratch | Adapt existing `ConditionBuilder.tsx` in `/src/components/automation/` | Full working implementation with AND/OR toggle, dropdowns, value inputs — just needs different condition type config |
| Workspace/folder picker | Custom search with manual queries | `useVaults` + `useFolders` hooks (already exist) | Established hooks with proper cache invalidation |
| Slide-over animation | CSS transform + JS events | `motion/react` `AnimatePresence` + spring transition | Spring physics feel consistent with existing app animations |
| Batch priority persistence | N individual UPDATE calls | PostgreSQL RPC with array parameter | Single transaction, consistent priority numbering, authorization enforced in DB |

**Key insight:** Three of the five hardest UI problems in this phase are already solved elsewhere in the codebase: condition building (`automation/ConditionBuilder.tsx`), destination data (`useVaults`/`useFolders`), and drag context (`@dnd-kit/core` already wired in `TranscriptsNew.tsx`). The planner should reference these existing implementations directly.

---

## Common Pitfalls

### Pitfall 1: `@dnd-kit/sortable` Not Installed

**What goes wrong:** Build fails with "Cannot find module '@dnd-kit/sortable'". Only `@dnd-kit/core` and `@dnd-kit/utilities` are installed.

**Why it happens:** The project has `@dnd-kit/core` for the transcript folder drag-and-drop (`DragDropZones.tsx`). That use case only needs `useDroppable` from core. Sortable list reordering requires the separate `@dnd-kit/sortable` package.

**How to avoid:** First task in the plan: `npm install @dnd-kit/sortable`. Verify `node_modules/@dnd-kit/sortable` exists before writing any import.

**Warning signs:** TypeScript error `Cannot find module '@dnd-kit/sortable' or its corresponding type declarations`.

### Pitfall 2: Rules are User-Scoped Instead of Bank-Scoped

**What goes wrong:** Rules created by user A are invisible to user B even though both are in the same organization (bank). Rules added after a team is formed don't apply to other team members' imports.

**Why it happens:** It's tempting to add `user_id` instead of `bank_id` to the rules table (mirrors `automation_rules` pattern). But routing rules are org-wide by locked decision.

**How to avoid:** The `import_routing_rules` table uses `bank_id`, not `user_id`. RLS policy uses `bank_memberships` join: `USING (EXISTS (SELECT 1 FROM bank_memberships WHERE bank_id = import_routing_rules.bank_id AND user_id = auth.uid()))`.

**Warning signs:** Users in the same organization see different rule lists.

### Pitfall 3: Priority Gaps Break Drag-to-Reorder

**What goes wrong:** Rules are created with priorities 1, 2, 3. User deletes rule 2. Priorities are now 1, 3. Next drag operation sends `[rule-id-3, rule-id-1]` to the RPC, which sets priorities to 1, 2. That's correct — but if the UI is computing positions from the existing `priority` column instead of the array index, it may display rules in wrong order during the optimistic update.

**Why it happens:** Mixing DB-stored priority values with array-index-based reordering.

**How to avoid:** The local state (`items` in `RoutingRulesList`) is always an ordered array. Priority values in DB are implementation details. The UI never reads `priority` to determine display order — it reads the array order. `arrayMove()` produces the new order; the RPC assigns sequential integers.

**Warning signs:** After delete + reorder, the priority numbers in DB don't match the visual order.

### Pitfall 4: Live Preview Uses Server-Side Evaluation

**What goes wrong:** Each keystroke in a condition value field fires a Supabase RPC call to evaluate conditions server-side. With debouncing this is manageable, but adds latency and complexity.

**Why it happens:** The routing engine lives in an edge function (server-side). Calling it from the browser seems natural.

**How to avoid:** Client-side evaluation against the 20 pre-fetched recordings is sufficient. The preview is approximate — it intentionally checks a sample, not all historical calls. Keep `evaluateConditionsClientSide()` as a shared TypeScript module (not an edge function call). The preview badge updates in under 50ms with no network round trips.

**Warning signs:** Preview count lags noticeably behind user input; network tab shows requests on each keystroke.

### Pitfall 5: Connector Pipeline Modifies `insertRecording()` Signature

**What goes wrong:** `insertRecording()` is changed to accept routing parameters as extra arguments. All existing connectors (Zoom, Fathom, YouTube, file-upload) need to be updated to pass the new arguments, even when they don't use routing.

**Why it happens:** Routing seems like a pipeline concern, so adding it to `insertRecording()` seems natural.

**How to avoid:** Add `resolveRoutingDestination()` as a pre-step in `runPipeline()` only. `insertRecording()` already supports `record.vault_id` override — routing simply sets this field before calling `insertRecording()`. No signature change to `insertRecording()`. Existing connectors that call `insertRecording()` directly (bypassing `runPipeline()`) skip routing, which is acceptable for MVP.

**Warning signs:** Five existing connector files need updating just to support routing.

### Pitfall 6: Default Destination Not Enforced Before Rule Creation

**What goes wrong:** User creates rules without setting a default destination. Calls that don't match any rule have no fallback — they route to the personal vault (old behavior) with no user awareness.

**Why it happens:** The default destination enforcement is a UX gate, not a DB constraint.

**How to avoid:** The "Create your first rule" CTA is disabled if no `import_routing_defaults` row exists for the bank. Show a message: "Set a default destination above before creating rules." This is a client-side gate, not a DB constraint.

**Warning signs:** Users with rules but no default destination call `insertRecording()` which falls back to personal vault silently — breaking the user's expectation that the default they configured will catch unmatched calls.

### Pitfall 7: `motion/react` Import Instead of `framer-motion`

**What goes wrong:** `import { AnimatePresence } from 'framer-motion'` — this builds but produces a warning or uses the wrong version.

**Why it happens:** Most documentation and examples use `framer-motion`. The project made a deliberate switch to `motion/react` (v12).

**How to avoid:** Always: `import { AnimatePresence, motion } from 'motion/react'`. This is established in STATE.md and ThemeSwitcher.tsx.

---

## Code Examples

Verified patterns from codebase analysis:

### Existing ConditionBuilder Usage (for reference/adaptation)

```typescript
// Source: /src/components/automation/ConditionBuilder.tsx (already in codebase)
// The routing condition builder is a SIMPLIFIED version of this component
// Using only 6 condition types: title, participant, source, duration, tag, date

// In the existing ConditionBuilder, these are the relevant parts to adapt:
// 1. ConditionRow with AND/OR toggle between conditions — REUSE this pattern exactly
// 2. Select for field, operator, value — REUSE same shadcn/ui pattern
// 3. "Add Condition" button with RiAddLine icon — REUSE

// Phase 18 routing condition fields (simpler than automation's full set):
const ROUTING_CONDITION_FIELDS = [
  { value: 'title',       label: 'Title',           operators: ['contains', 'not_contains', 'equals', 'starts_with'], valueType: 'text' },
  { value: 'participant', label: 'Participant is',   operators: ['contains', 'equals'],                               valueType: 'text' },
  { value: 'source',      label: 'Source is',        operators: ['equals'],                                           valueType: 'select' },
  { value: 'duration',    label: 'Duration',         operators: ['greater_than', 'less_than'],                        valueType: 'number_minutes' },
  { value: 'tag',         label: 'Tag is',           operators: ['equals', 'contains'],                               valueType: 'text' },
  { value: 'date',        label: 'Date',             operators: ['after', 'before'],                                  valueType: 'date' },
] as const;

// Source values for the 'source' field:
const SOURCE_VALUES = [
  { value: 'fathom',       label: 'Fathom' },
  { value: 'zoom',         label: 'Zoom' },
  { value: 'youtube',      label: 'YouTube' },
  { value: 'file-upload',  label: 'File Upload' },
  { value: 'google_meet',  label: 'Google Meet' },
];
```

### Priority Batch Update RPC Call

```typescript
// Source: pattern from existing RPC calls (workspace_redesign_schema.sql accept_workspace_invite)
// src/hooks/useRoutingRules.ts

const reorderMutation = useMutation({
  mutationFn: async (orderedIds: string[]) => {
    const { error } = await supabase.rpc('update_routing_rule_priorities', {
      p_bank_id: activeBankId,
      p_rule_ids: orderedIds,
    });
    if (error) throw error;
  },
  onMutate: async (orderedIds) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.routingRules.list(activeBankId) });
    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.routingRules.list(activeBankId));
    // Optimistic: reorder rules in cache
    queryClient.setQueryData(queryKeys.routingRules.list(activeBankId), (old: RoutingRule[]) =>
      orderedIds.map(id => old.find(r => r.id === id)!).filter(Boolean)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKeys.routingRules.list(activeBankId), context.previous);
    }
    toast.error('Failed to save rule order');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.routingRules.list(activeBankId) });
  },
});
```

### RLS Policy Pattern for Bank-Scoped Table

```sql
-- Source: adapted from bank_memberships join pattern in vault_memberships RLS
ALTER TABLE import_routing_rules ENABLE ROW LEVEL SECURITY;

-- Members of the bank can see all rules for that bank
CREATE POLICY "bank_members_select_routing_rules"
  ON import_routing_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_memberships.bank_id = import_routing_rules.bank_id
        AND bank_memberships.user_id = auth.uid()
    )
  );

-- Members can insert rules for their bank
CREATE POLICY "bank_members_insert_routing_rules"
  ON import_routing_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_memberships.bank_id = import_routing_rules.bank_id
        AND bank_memberships.user_id = auth.uid()
    )
    AND auth.uid() = created_by
  );

-- Similar UPDATE and DELETE policies...
```

### Routing Engine Integration in `runPipeline()`

```typescript
// Source: /supabase/functions/_shared/connector-pipeline.ts (to modify)
// Add routing resolution BEFORE insertRecording in runPipeline()

export async function runPipeline(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord,
): Promise<PipelineResult> {
  try {
    // Stage 3: Dedup check (unchanged)
    const { isDuplicate } = await checkDuplicate(supabase, userId, record.source_app, record.external_id);
    if (isDuplicate) return { success: false, skipped: true };

    // NEW: Resolve routing destination if record doesn't already have a vault_id
    if (!record.vault_id) {
      // Get the user's bank_id from bank_memberships
      const { data: membership } = await supabase
        .from('bank_memberships')
        .select('bank_id, banks!inner(id, type)')
        .eq('user_id', userId)
        .eq('banks.type', 'personal')
        .maybeSingle();
      const bankId = (membership as any)?.bank_id;

      if (bankId) {
        const routing = await resolveRoutingDestination(supabase, bankId, record);
        if (routing) {
          record.vault_id = routing.vaultId;
          record.source_metadata = {
            ...record.source_metadata,
            routed_by_rule_id: routing.matchedRuleId,
            routed_by_rule_name: routing.matchedRuleName,
            routed_at: new Date().toISOString(),
          };
        } else {
          // No rule matched — check org default destination
          const { data: orgDefault } = await supabase
            .from('import_routing_defaults')
            .select('target_vault_id, target_folder_id')
            .eq('bank_id', bankId)
            .maybeSingle();
          if (orgDefault) {
            record.vault_id = orgDefault.target_vault_id;
            // Note: folder_id handled separately in insertRecording if needed
          }
        }
      }
    }

    // Stage 5: Insert (unchanged — vault_id is now set if routing matched)
    const { id } = await insertRecording(supabase, userId, record);
    return { success: true, recordingId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Relevant to Phase 18 |
|--------------|------------------|---------------------|
| Personal vault hardcoded in `insertRecording()` | `resolveRoutingDestination()` pre-step in `runPipeline()` | Phase 18 adds this pre-step |
| `automation_rules.conditions` JSONB for automation | Same JSONB pattern for `import_routing_rules.conditions` | Same pattern, different domain |
| `@dnd-kit/core` for drop-to-folder (DragDropZones.tsx) | `@dnd-kit/sortable` for drag-to-reorder list | Different subpackage, same ecosystem |
| No rule panel — AutomationRules navigates to full page | Fixed-position slide-over with `motion/react` | New pattern for Phase 18 rules editor |

---

## Open Questions

1. **Where to store `folder_id` for routed calls**
   - What we know: `vault_entries.folder_id` is a nullable FK to `folders`. Routing rules can specify a target folder. `insertRecording()` creates the `vault_entries` row but currently does not set `folder_id`.
   - What's unclear: Whether `insertRecording()` should be extended to accept `folder_id`, or if folder assignment is a post-insert operation.
   - Recommendation: Add `folder_id?: string` to `ConnectorRecord` interface. `insertRecording()` passes it to the `vault_entries` INSERT if provided. This is a small additive change with no breaking impact.

2. **Overlap warning implementation detail**
   - What we know: When editing a rule, show "Rule 'X' also matches N of these calls and has higher priority."
   - What's unclear: The overlap check requires knowing which OTHER rules also match the preview calls — this means fetching all other rules and evaluating them client-side.
   - Recommendation: For MVP, limit overlap warning to "at least 1 other rule matches some of these calls" without computing the exact count. Fetch all rules client-side and run `evaluateConditionsClientSide` for each. The 20-call preview set is small enough that this is O(rules × 20) — typically under 100 evaluations.

3. **Default destination required gate — org admin vs any member**
   - What we know: Rules are org-wide. Default destination is set per org.
   - What's unclear: Whether setting the org default destination should be restricted to org admins, or any member can set it.
   - Recommendation: For MVP, any bank member can set the org default. Add a `CHECK` constraint or admin-only policy later if needed. Phase 18 context says "rules are organization-wide" — the simplest interpretation is any member can configure them.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `/src/components/automation/ConditionBuilder.tsx` — existing condition builder with AND/OR toggle, exact component to adapt
- Codebase: `/src/components/automation/RuleBuilder.tsx` — existing rule form pattern, slide-over architecture reference
- Codebase: `/supabase/functions/_shared/connector-pipeline.ts` — existing pipeline, exact integration point for routing
- Codebase: `/supabase/migrations/20260110000004_automation_rules_schema.sql` — automation_rules schema with priority column pattern
- Codebase: `/supabase/migrations/20260228000001_workspace_redesign_schema.sql` — workspace/vault/folder relationships for destination picker
- Codebase: `/supabase/migrations/20260228000002_create_import_sources.sql` — import_sources table pattern (RLS, naming)
- Codebase: `/src/components/transcript-library/DragDropZones.tsx` — existing `@dnd-kit/core` usage pattern
- Codebase: `/src/pages/TranscriptsNew.tsx` — existing `DndContext` wiring pattern
- Codebase: `/src/hooks/useVaults.ts` + `/src/hooks/useFolders.ts` — destination picker data hooks
- Codebase: `package.json` — confirmed `@dnd-kit/core@^6.3.1` installed, `@dnd-kit/sortable` NOT installed
- Codebase: `.planning/STATE.md` — confirms `motion/react` (not framer-motion), bank/vault/folder architecture

### Secondary (MEDIUM confidence)
- Official dnd-kit docs (WebSearch verified): `@dnd-kit/sortable` is a separate package from core; provides `useSortable`, `SortableContext`, `arrayMove`, `verticalListSortingStrategy`
- Official dnd-kit docs: `CSS.Transform.toString(transform)` from `@dnd-kit/utilities` (already installed at v3.2.2)
- WebSearch (multiple sources confirmed): `arrayMove` is exported from `@dnd-kit/sortable` — not from `@dnd-kit/utilities`

### Tertiary (LOW confidence, needs validation)
- `@dnd-kit/sortable` latest version assumed ~8.0.0 based on major version history — verify on npm before pinning
- Overlap warning implementation estimated as O(rules × 20) client-side — acceptable for small rule sets; may need debouncing for orgs with 20+ rules

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in codebase; sortable package confirmed not installed
- Architecture: HIGH — all patterns derived from existing codebase code (ConditionBuilder, connector-pipeline, vault hooks)
- DB schema: HIGH — follows automation_rules pattern exactly; bank_id scoping verified against bank_memberships pattern
- Pitfalls: HIGH — sourced from real codebase analysis (wrong import path, wrong scope, missing package)
- `@dnd-kit/sortable` API: MEDIUM — confirmed from official docs search; exact version number should be verified on npm

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable tech; dnd-kit API is stable; no fast-moving dependencies)
