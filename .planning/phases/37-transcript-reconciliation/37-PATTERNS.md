# Phase 37: Transcript Reconciliation - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 10 (new/modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/functions/_shared/transcript-reconciler.ts` | service (pure module) | transform | `supabase/functions/_shared/speaker-resolver.ts` | exact |
| `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` | test | transform | `supabase/functions/_shared/__tests__/speaker-resolver.test.ts` (if present; else co-located pattern from `dedup-fingerprint.ts` usage sites) | role-match |
| `supabase/functions/reconcile-transcripts/index.ts` | route (edge function) | batch / event-driven (sweep) | `supabase/functions/resolve-speakers/index.ts` | exact |
| `supabase/migrations/<timestamp>_create_reconciled_transcript_segments.sql` | migration | CRUD (ledger insert) | `supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql` | exact |
| `src/components/call-detail/CallReconciledTranscriptTab.tsx` | component | request-response (read-only fetch+render) | `src/components/call-detail/CallTranscriptTab.tsx` | role-match |
| `src/components/call-detail/CallDetailHeader.tsx` (MODIFIED — add badge) | component | request-response | `src/components/call-detail/CallDetailHeader.tsx` (self, existing badge patterns nearby) | exact |
| `src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx` (or `src/components/shared/`) | component | request-response | `src/components/shared/IdentityEvidenceBadge.tsx` | exact |
| `src/hooks/useReconciledTranscript.ts` | hook | request-response | `src/hooks/useIdentityEvidence.ts` | exact |
| `src/services/reconciledTranscript.service.ts` | service | CRUD (read) | `src/services/identity-evidence.service.ts` | role-match |
| `src/test/rls-regression.test.ts` (MODIFIED — register new table) | test | CRUD | itself, `speaker_resolution_decisions`/`event_match_decisions` bespoke-block entries | exact |
| `src/components/CallDetailDialog.tsx` (MODIFIED — new tab wiring) | component | request-response | itself (existing `Tabs`/`SelectionButton` tab-row pattern) | exact |

## Pattern Assignments

### `supabase/functions/_shared/transcript-reconciler.ts` (service, transform)

**Analog:** `supabase/functions/_shared/speaker-resolver.ts` (431 lines, live, Phase 35)

**Module doc-comment / no-DB-access declaration pattern** (lines 1-31):
```typescript
/**
 * speaker-resolver.ts -- Phase 35 Plan 01: contract types only.
 * ...
 * No DB access in this file (mirrors event-resolver.ts / identity-resolver.ts's
 * pure-functions style).
 */
```
Mirror this exactly for `transcript-reconciler.ts` — pure, DB-free, all types-first.

**Reused interval-alignment primitives — import, do not reimplement** (lines 199-266):
```typescript
const CLOCK_DRIFT_TOLERANCE_MS = 20_000;

function parseOffsetToMs(offset: string | null): number | null { /* ... */ }
function parseIsoToMs(value: string | null): number | null { /* ... */ }

export function deriveAbsoluteInterval(
  chunk: SpeakerChunk,
  recordingStartTime: string | null,
): AbsoluteInterval { /* anchor + offset -> ISO, fails closed to null */ }

function intervalGapMs(aStartMs, aEndMs, bStartMs, bEndMs): number { /* ... */ }
function intervalsOverlapWithTolerance(a, b, toleranceMs): boolean { /* ... */ }
function confidenceForGap(gapMs, toleranceMs): number { /* ... */ }
```
Per CONTEXT.md and RESEARCH.md Pattern 2, `transcript-reconciler.ts` must import/re-export these from `speaker-resolver.ts` (add exports there if needed) rather than duplicate. If `SpeakerChunk`'s shape doesn't fit chunk-group alignment 1:1, define a compatible local type but keep the DP/interval math imported.

**Discriminated-result / fail-closed type pattern** (lines 110-181):
```typescript
export interface PropagatedResolution { /* success shape */ }
export interface UnresolvedSpeaker {
  identity_id: null;
  resolved: false;
  reason: 'no_overlapping_donor' | 'ambiguous_overlap' | 'anchor_unavailable';
}
export type PropagationResult = PropagatedResolution | UnresolvedSpeaker;
```
Use the same discriminated-union-with-literal-null-fields shape for `TokenAlignmentResult`/`ReconciledSegmentResult` (e.g. `resolved: false` + `reason` enum for structural refusals — a true 3-way tie still produces a *resolved* output via the deterministic fallback, but any anchor-unavailable/insufficient-overlap case should fail closed the same way).

**Pure scoring/collapse function shape to mirror for `resolveTokenDisagreement()`** (lines 384-431, `collapsePhantomSpeaker`):
```typescript
export function collapsePhantomSpeaker(input: ConsensusInput): ConsensusResult {
  // 1. Fail-closed guards first (missing identity_id, missing interval, empty input)
  // 2. Core comparison loop
  // 3. Every branch returns a literal discriminated result — never a partial object
}
```

**fastest-levenshtein Deno import (proven, Phase 32)** — `supabase/functions/_shared/dedup-fingerprint.ts` lines 1-14, 159-172:
```typescript
import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16';

export function calculateTitleSimilarity(title1: string, title2: string): number {
  if (title1 === title2) return 1.0;
  if (title1.length === 0 || title2.length === 0) return 0.0;
  const levenshteinDistance = distance(title1, title2);
  const maxLength = Math.max(title1.length, title2.length);
  return 1 - (levenshteinDistance / maxLength);
}
```
Use `distance()` as the fuzzy-equality cost oracle inside a hand-rolled word-token alignment DP (RESEARCH.md Pattern 3) — `dedup-fingerprint.ts` proves the exact import string and usage shape, but its match is at the whole-title level; the new module needs token-level equality (`tokensMatch(a, b)` per RESEARCH.md's Pattern 3 code block, threshold ≤2 chars or length-scaled).

**Weighted-vote / hardcoded-priors precedent** — `dedup-fingerprint.ts` lines 59-63, 286-289 (`MATCH_THRESHOLDS`, weighted score combination):
```typescript
export const MATCH_THRESHOLDS = {
  title_similarity: 0.80,
  time_overlap: 0.50,
  participant_overlap: 0.60,
} as const;
// ...
const score = (titleSimilarity * 0.4) + (timeOverlap * 0.4) + (participantOverlap * 0.2);
```
Mirror this shape for RECON-02's hardcoded per-provider source-accuracy priors and the weighted-vote combination formula — named, exported constants object, not inline magic numbers.

---

### `supabase/functions/reconcile-transcripts/index.ts` (route/edge-function, batch)

**Analog:** `supabase/functions/resolve-speakers/index.ts` (532 lines, live, Phase 35)

**Full file structure to mirror:** doc-comment block (lines 1-61) describing trigger condition, write-target, non-destructive guarantee, deploy command, env vars — copy this doc-comment shape verbatim, adjusted for reconciliation's own gating/write rules.

**Shared-secret gate BEFORE any DB work** (lines 121-141):
```typescript
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const secret = req.headers.get('X-Reconcile-Secret');
    const expected = Deno.env.get('RECONCILE_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
```

**Zod forward-only request contract** (lines 77-83, 144-153):
```typescript
const requestSchema = z.object({
  mode: z.literal('forward'),
  since: z.string().datetime().optional(),
});
const DEFAULT_CUTOVER = '2026-09-08T12:00:00Z'; // this plan's own migration timestamp on TEST
// ...
const body = await req.json().catch(() => ({}));
const validation = requestSchema.safeParse(body);
if (!validation.success) { /* 400 */ }
const since = validation.data.since ?? DEFAULT_CUTOVER;
```

**Org/event bucketing BEFORE any pairing (SAFE-04)** (lines 199-269):
```typescript
const recordingsByEvent = new Map<string, RecordingRow[]>();
for (const r of recordings) {
  const list = recordingsByEvent.get(r.event_id) ?? [];
  list.push(r);
  recordingsByEvent.set(r.event_id, list);
}
// ... per event:
const recordingsByOrg = new Map<string, RecordingRow[]>();
for (const r of eventRecordings) {
  const orgId = orgByRecordingId.get(r.id);
  if (!orgId) continue; // fail closed
  const list = recordingsByOrg.get(orgId) ?? [];
  list.push(r);
  recordingsByOrg.set(orgId, list);
}
```
**IMPORTANT DEVIATION (Pitfall 2, RESEARCH.md):** `resolve-speakers` queries `recordings` with `.not('event_id', 'is', null)` only (lines 174-180). `reconcile-transcripts` MUST additionally join/filter on `event_match_decisions.decision = 'merge_applied'` — do not copy this query shape verbatim.

**Delegate-only-to-pure-module discipline** (lines 341-349):
```typescript
// Delegate ALL matching/interval-overlap logic to speaker-resolver.ts
// -- zero scoring logic lives in this edge function body.
const results: PropagationResult[] = propagateNamedLabel({ ... });
```

**Write pattern — DEVIATE from upsert, use delete+rebuild** (Pitfall 5, RESEARCH.md): the existing `.upsert(..., { onConflict: 'target_recording_id,target_chunk_index,tier' })` shape at lines 362-380 is the WRONG pattern to copy for the final write. Instead:
```typescript
// Per event, before inserting freshly computed segments:
const { error: deleteError } = await supabase
  .from('reconciled_transcript_segments')
  .delete()
  .eq('event_id', eventId);
if (deleteError) { /* fail closed, skip this event, log, continue sweep */ }
// then .insert() the freshly computed rows — NOT upsert/onConflict.
```

**Response summary shape** (lines 109-119, 160-170, 521-523):
```typescript
interface ResolveSummary {
  eventsScanned: number;
  bucketsScanned: number;
  chunksScanned: number;
  // ... phase-specific counters
  errors: number;
}
// ...
return new Response(JSON.stringify({ success: true, since, ...summary }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

**Error handling** (lines 524-531):
```typescript
} catch (error) {
  console.error('[resolve-speakers] handler error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: errorMessage }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

---

### `supabase/migrations/<timestamp>_create_reconciled_transcript_segments.sql` (migration)

**Analog:** `supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql` (138 lines, live)

**Table shape to mirror** (lines 40-57), adapted for RECON-05's `source_recording_ids`/`agreeing_recording_ids` array columns instead of single donor/target FKs:
```sql
CREATE TABLE IF NOT EXISTS speaker_resolution_decisions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        REFERENCES events(id) ON DELETE SET NULL,
  donor_recording_id    UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  ...
  tier                  TEXT        NOT NULL CHECK (tier IN ('propagation', 'consensus_collapse')),
  score                 NUMERIC     CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  signals               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  decision              TEXT        NOT NULL CHECK (decision IN ('resolution_proposed', 'resolution_applied', 'reversed', 'rejected')),
  decided_by            TEXT        NOT NULL CHECK (decided_by IN ('auto', 'user', 'admin')),
  applied               BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_recording_id, target_chunk_index, tier)
);
```
For `reconciled_transcript_segments`, replace the donor/target FK pair with `source_recording_ids UUID[] NOT NULL`, `agreeing_recording_ids UUID[] NOT NULL`, plus `segment_text TEXT NOT NULL`, an interval (`start_time`/`end_time TIMESTAMPTZ` or similar), and drop the `UNIQUE(target_recording_id, ...)` constraint in favor of full delete+rebuild per event (no upsert conflict target needed — RESEARCH.md Pitfall 5).

**FORCE RLS + service-role-only-write policy** (lines 76-98):
```sql
ALTER TABLE speaker_resolution_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_resolution_decisions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON speaker_resolution_decisions;
CREATE POLICY "Service role full access"
  ON speaker_resolution_decisions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```
**DEVIATION required (Security Domain, RESEARCH.md):** unlike `speaker_resolution_decisions`/`event_match_decisions` (service-role-only, zero client read policy), `reconciled_transcript_segments` needs an actual client-facing SELECT policy for the new "Reconciled" tab — this is genuinely new risk surface. Add a SECURITY DEFINER helper (mirroring `user_participates_in_event`/`user_can_view_identity` naming convention) gating SELECT to users who can already see the underlying `transcript_chunks`/`recordings` for that event's org. Do not copy the "no client policy at all" posture verbatim.

**Comment-block documentation style** (lines 104-133) — mirror the `COMMENT ON TABLE`/`COMMENT ON COLUMN` density and tone (explains ledger semantics, locked write-target, non-destructive posture) for the new table.

---

### `src/components/call-detail/CallReconciledTranscriptTab.tsx` (component, request-response)

**Analog:** `src/components/call-detail/CallTranscriptTab.tsx` (existing per-recording transcript tab)

**Grouped-props + memo pattern** (lines 1-108):
```typescript
import { memo } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
// ...
export interface TranscriptData {
  call: Meeting;
  transcripts: TranscriptSegmentDisplay[];
  userSettings: UserSettings | null;
  callSpeakers: Speaker[];
}
interface CallTranscriptTabProps {
  viewState: TranscriptViewState;
  onViewStateChange: (updates: Partial<TranscriptViewState>) => void;
  handlers: TranscriptHandlers;
  data: TranscriptData;
  duration: number | null;
}
export const CallTranscriptTab = memo(function CallTranscriptTab({ ... }: CallTranscriptTabProps) {
  // ...
});
```
Reuse the grouped-props + `memo()` + `TabsContent` wrapper shape. `CallReconciledTranscriptTab` is simpler (read-only, no editing state) — its props reduce to `{ eventId, isOpen }`-style data + `useReconciledTranscript` hook call inside the component (mirrors how `IdentityEvidenceBadge` calls its own hook internally rather than being fully prop-driven), since UI-SPEC's empty/loading/error states are self-contained per this tab.

**Loading/empty/error state precedent** — reuse `Skeleton` (`@/components/ui/skeleton`) exactly as `IdentityEvidenceBadge.tsx` lines 56-61 do, and follow UI-SPEC's Copywriting Contract literally for empty/error copy (see UI-SPEC section "Copywriting Contract").

---

### `src/components/CallDetailDialog.tsx` (MODIFIED — new tab wiring)

**Analog:** itself — existing `Tabs`/`SelectionButton` tab-row + `TabsContent` composition (lines 560-627):
```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full flex-1 flex flex-col overflow-hidden">
  <div className="flex-shrink-0 flex items-center gap-2 px-4">
    <SelectionButton orientation="horizontal" selected={activeTab === "overview"} icon={<RiInformationLine className="h-4 w-4" />} label="Overview" onClick={() => setActiveTab("overview")} />
    {/* ...transcript, invitees, participants... */}
  </div>
  <CallOverviewTab ... />
  <CallTranscriptTab ... />
  <CallInviteesTab ... />
  <CallParticipantsTab ... />
</Tabs>
```
Add a new `SelectionButton` (icon `RiGitMergeLine` per UI-SPEC) and a new `<CallReconciledTranscriptTab ... />` inside the same `<Tabs>` block, conditionally rendered per UI-SPEC's "Conditional rendering" rule (tab trigger absent entirely when the event has <2 resolved recordings — matches this file's existing pattern of always rendering all tabs unconditionally today, so the conditional-render logic is a genuinely new addition here, not copy-paste).

---

### `src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx` (component)

**Analog:** `src/components/shared/IdentityEvidenceBadge.tsx` (79 lines, full file read above)

**Full popover-trigger pattern to mirror** (lines 1-79):
```tsx
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useIdentityEvidence } from '@/hooks/useIdentityEvidence'
import { RiShieldCheckLine } from '@remixicon/react'

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
        {/* loading / error / empty / content branches */}
      </PopoverContent>
    </Popover>
  )
}
```
Copy this verbatim, swapping: `RiShieldCheckLine` → `RiGitMergeLine` (per UI-SPEC icon choice), `useIdentityEvidence` → `useReconciledTranscript`'s per-segment provenance shape (or a dedicated lightweight hook if segment provenance is already embedded in the tab's main fetch — likely no separate lazy RPC needed here since `agreeing_recording_ids` is already on the segment row, unlike identity evidence which needs a separate redacted RPC). Popover copy per UI-SPEC: "Confirmed by N recordings" heading + source-recording-label list body.

---

### `src/hooks/useReconciledTranscript.ts` (hook)

**Analog:** `src/hooks/useIdentityEvidence.ts` (32 lines, full file read above)

```typescript
import { useQuery } from '@tanstack/react-query'
import { getIdentityEvidence, type IdentityEvidenceRow } from '@/services/identity-evidence.service'
import { queryKeys } from '@/lib/query-config'

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
`useReconciledTranscript(eventId: string)` follows the same `useQuery` + `queryKeys.<domain>.detail(id)` + typed result-object shape. Add a `queryKeys.reconciledTranscript.detail(eventId)` entry to `src/lib/query-config.ts` (check that file's existing factory shape before adding — not read this session, but the `queryKeys.identityEvidence.detail(identityId)` call site above confirms the factory pattern exists and should be extended, not reinvented).

---

### `src/services/reconciledTranscript.service.ts` (service, CRUD-read)

**Analog:** `src/services/identity-evidence.service.ts` (39 lines, full file read above)

```typescript
import { supabase } from '@/integrations/supabase/client'

export interface IdentityEvidenceRow {
  alias_type: string
  confidence: number
  evidence: string
}

export async function getIdentityEvidence(identityId: string): Promise<IdentityEvidenceRow[]> {
  const { data, error } = await supabase.rpc('get_identity_evidence', {
    p_identity_id: identityId,
  })
  if (error) {
    throw new Error(`Failed to fetch identity evidence: ${error.message}`)
  }
  return data ?? []
}
```
`reconciledTranscript.service.ts` follows the same pure-async-function-over-supabase-client shape. Given RLS on `reconciled_transcript_segments` will (per this phase's plan) gate via a SECURITY DEFINER helper rather than a redacted RPC, this service likely does a direct `.from('reconciled_transcript_segments').select(...).eq('event_id', eventId).order(...)` rather than an `.rpc()` call — mirror the `throw new Error(...)` error-handling convention and `?? []` empty-array fallback regardless of read mechanism.

---

### `src/test/rls-regression.test.ts` (MODIFIED — register new table)

**Analog:** itself — the `speaker_resolution_decisions` registration is the direct precedent since it's also a Phase-35-era, multi-FK-parent, bespoke-seeded table:
```typescript
// in CLIENT_DENY_TABLES array (if reconciled_transcript_segments ends up
// service-role-write-only with a SEPARATE client SELECT policy, it does NOT
// belong in CLIENT_DENY_TABLES/BESPOKE_CLIENT_DENY_TABLES -- those are for
// tables with ZERO client policy. Since this phase's UI-SPEC requires an
// actual client read path, register it in CROSS_ORG_TABLES instead IF its
// pivot column is a simple organization_id/recording_id FK, or as a new
// bespoke isolation block (mirroring the `events`/`identities` bespoke
// blocks) if it needs a SECURITY DEFINER helper-gated read test instead of
// the generic column-equality assumption CROSS_ORG_TABLES' loop makes.
"speaker_resolution_decisions", // <- precedent entry, service-role-only shape
```
Read `CROSS_ORG_TABLES` array (lines 40-86) and `CLIENT_DENY_TABLES`/`BESPOKE_CLIENT_DENY_TABLES` (lines 94-131) comments carefully at plan time — `reconciled_transcript_segments` is the FIRST table in this milestone's ledger family to need a real client SELECT policy (not deny-all), so it likely needs a NEW bespoke isolation block (seed via service-role, then assert User A's JWT sees it but User B's does not) rather than fitting either existing registry cleanly. Flag this as a Task-1 design decision for the plan, not a copy-paste.

---

## Shared Patterns

### Interval alignment (RECON-01)
**Source:** `supabase/functions/_shared/speaker-resolver.ts` lines 197-266, 226-243
**Apply to:** `transcript-reconciler.ts`'s `alignChunksToTimeline()`
```typescript
const CLOCK_DRIFT_TOLERANCE_MS = 20_000; // locked, reuse verbatim — do not redefine
export function deriveAbsoluteInterval(chunk, recordingStartTime): AbsoluteInterval { /* ... */ }
```
Import/re-export from `speaker-resolver.ts` rather than duplicating (Task-1 design-gate decision per RESEARCH.md).

### Shared-secret edge-function gate
**Source:** `supabase/functions/resolve-speakers/index.ts` lines 130-141
**Apply to:** `reconcile-transcripts/index.ts` — identical `X-Reconcile-Secret` header check before any DB work or body parse, using the existing `RECONCILE_SECRET` env var (no new secret).

### Org/event bucketing before pairing (SAFE-04)
**Source:** `supabase/functions/resolve-speakers/index.ts` lines 199-269
**Apply to:** `reconcile-transcripts/index.ts` — bucket recordings by `event_id` then `organization_id` before any chunk-pairing, exactly as `resolve-speakers` does. Never pair cross-org data.

### Full delete+rebuild write (NOT upsert) — deviation from every prior sweep
**Source:** RESEARCH.md Pitfall 5, contrasted against `resolve-speakers/index.ts` lines 362-380 (`.upsert(..., onConflict)`)
**Apply to:** `reconcile-transcripts/index.ts`'s write step — `DELETE FROM reconciled_transcript_segments WHERE event_id = $1` then `.insert()`, every sweep run, every event, unconditionally.

### Error handling / response shape
**Source:** `supabase/functions/resolve-speakers/index.ts` lines 109-119, 524-531
**Apply to:** `reconcile-transcripts/index.ts` — typed summary object accumulated through the sweep, `try/catch` wrapping the whole handler, `console.error('[reconcile-transcripts] ...')` prefix convention, `error instanceof Error ? error.message : 'Unknown error'` fallback.

### Provenance-badge popover (icon-trigger + lazy content)
**Source:** `src/components/shared/IdentityEvidenceBadge.tsx` (full file)
**Apply to:** `ReconciledSegmentProvenanceBadge.tsx` — `Popover`/`PopoverTrigger`/`PopoverContent` (`w-64 p-3`), `h-5 w-5` icon-only trigger button, `Skeleton` loading state, `text-muted-foreground` styling (never vibe-orange, per UI-SPEC Color section).

### Ledger-table migration shape (append-only, FORCE RLS)
**Source:** `supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql` (full file)
**Apply to:** `reconciled_transcript_segments` migration — `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, dense `COMMENT ON TABLE`/`COMMENT ON COLUMN` documentation. **Deviate** on the RLS policy: this table needs a real client SELECT policy (new risk surface), not deny-all.

### Hardcoded weighted-scoring constants
**Source:** `supabase/functions/_shared/dedup-fingerprint.ts` lines 59-63, 286-289
**Apply to:** `transcript-reconciler.ts`'s source-accuracy priors — named, exported `const` object (e.g. `PROVIDER_ACCURACY_PRIORS`), not inline magic numbers; weighted-sum formula pattern (`(a * wA) + (b * wB) + (c * wC)`).

## No Analog Found

None — every file in this phase's scope has a strong (exact or role-match) precedent from Phases 32/34/35 already live in the repo.

## Metadata

**Analog search scope:** `supabase/functions/_shared/`, `supabase/functions/resolve-speakers/`, `supabase/migrations/`, `src/components/call-detail/`, `src/components/shared/`, `src/components/CallDetailDialog.tsx`, `src/hooks/`, `src/services/`, `src/test/rls-regression.test.ts`
**Files scanned:** ~12 (speaker-resolver.ts, resolve-speakers/index.ts, dedup-fingerprint.ts, speaker_resolution_decisions migration, event_match_decisions migration reference, IdentityEvidenceBadge.tsx, identity-evidence.service.ts, useIdentityEvidence.ts, CallTranscriptTab.tsx, CallDetailHeader.tsx, CallDetailDialog.tsx, rls-regression.test.ts)
**Pattern extraction date:** 2026-09-10
