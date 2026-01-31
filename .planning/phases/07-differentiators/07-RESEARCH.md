# Phase 7: High-Value Differentiators - Research

**Researched:** 2026-01-31
**Domain:** AI-powered feature extraction, chat filtering, contacts management, health alerting, analytics
**Confidence:** HIGH

## Summary

This phase implements five differentiating features that distinguish CallVault from generic transcription tools. The research reveals that substantial infrastructure already exists for all five features:

1. **PROFITS Framework** - The 7-part psychology extraction framework (Pain, Results, Obstacles, Fears, Identity, Triggers, Success) is defined in README.md but has no extraction implementation. The CallDetailPage has a placeholder tab. A new Edge Function following the `content-insight-miner` pattern will extract PROFITS with transcript citations.

2. **Folder-Level Chat** - The folders infrastructure is complete (`useFolders.ts`, folder_assignments table). The chat_sessions table already has filter columns but no `filter_folder_ids`. The `ChatFilterPopover` component needs a folder section added, and `chat-stream-v2` needs folder filter support.

3. **Contacts Database** - No contacts/attendees table exists. The `fathom_calls.calendar_invitees` JSONB field contains attendee data `{email, name, external?}`. A new `contacts` table with health tracking columns is needed, plus a Settings > Contacts UI.

4. **Client Health Alerts** - The automation-engine action system exists with email support via Resend API. A scheduled health-check function and new notification infrastructure are needed.

5. **Real Analytics Data** - The `useCallAnalytics` hook returns real data from `fathom_calls`. The AnalyticsTab displays this data. Analytics are already wired to real data - may need minor enhancements only.

**Primary recommendation:** Leverage existing infrastructure extensively. Focus implementation on: PROFITS extraction Edge Function with citation support, folder filter additions to chat, new contacts schema + UI, scheduled health alert system.

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel AI SDK | 5.0.102 | Streaming AI responses, tool definitions | Established pattern in chat-stream-v2 |
| OpenRouter | via @openrouter/ai-sdk-provider | LLM API routing | Established for all AI features |
| Resend | API | Email delivery | Already configured in automation-email function |
| TanStack Query | 5.x | Server state management | useCallAnalytics, useFolders patterns |
| Zustand | latest | Client state | panelStore pattern for UI state |
| Zod | 3.23.8 | Schema validation | Used in all Edge Functions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | latest | Date formatting/calculation | Health alert thresholds |
| sonner | latest | Toast notifications | User feedback |
| Recharts | latest | Analytics charts | Already used in AnalyticsTab |

**Installation:** No new packages required - all dependencies exist.

## Architecture Patterns

### PROFITS Framework Pattern

The PROFITS extraction should follow the existing AI processing pattern:

```typescript
// New Edge Function: supabase/functions/extract-profits/index.ts
// Pattern from: content-insight-miner

interface PROFITSSection {
  letter: 'P' | 'R' | 'O' | 'F' | 'I' | 'T' | 'S';
  title: string;  // "Pain", "Results", etc.
  findings: Array<{
    text: string;
    quote: string;  // Exact quote from transcript
    citation: {
      transcript_id: string;
      chunk_index: number;
      timestamp?: string;
    };
    confidence: number;
  }>;
}

interface PROFITSReport {
  recording_id: number;
  sections: PROFITSSection[];
  generated_at: string;
  model_used: string;
}
```

**Storage:** New `profits_reports` table linked to `fathom_calls`, OR use existing `fathom_calls.profits_framework` JSONB column (exists but unused).

### Folder-Level Chat Pattern

Extend existing session filters:

```typescript
// Current chat_sessions schema has:
// filter_date_start, filter_date_end, filter_speakers, 
// filter_categories, filter_recording_ids

// NEED TO ADD:
// filter_folder_ids UUID[]  -- New column for folder filtering

// Backend merges folder filtering with recording_ids:
// 1. If folder_ids present, fetch all recording_ids in those folders
// 2. Merge with any existing filter_recording_ids
// 3. Pass merged list to search pipeline
```

### Contacts Schema Pattern

```sql
-- New table: contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  
  -- Tracking config
  track_health BOOLEAN DEFAULT false,
  contact_type TEXT CHECK (contact_type IN ('client', 'customer', 'lead', 'other')),
  
  -- Health tracking
  last_seen_at TIMESTAMPTZ,
  last_call_recording_id BIGINT,
  health_alert_threshold_days INTEGER,  -- NULL = use global default
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, email)
);

-- Junction: contact_call_appearances
CREATE TABLE contact_call_appearances (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appeared_at TIMESTAMPTZ,
  FOREIGN KEY (recording_id, user_id) REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, recording_id, user_id)
);
```

### Health Alert Pattern

```typescript
// New Edge Function: supabase/functions/check-client-health/index.ts
// Triggered by pg_cron or Supabase scheduled function

// For each user with health tracking enabled:
// 1. Get contacts with track_health = true
// 2. Check last_seen_at against threshold
// 3. For overdue contacts, create notification + optionally send email
// 4. Use existing automation-email function for delivery

// Notification storage:
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT,  -- 'health_alert', 'system', etc.
  title TEXT,
  body TEXT,
  metadata JSONB,  -- { contact_id, days_since_seen, etc. }
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

### Recommended Project Structure

```
supabase/functions/
├── extract-profits/          # NEW: PROFITS extraction
│   └── index.ts
├── check-client-health/      # NEW: Scheduled health checks
│   └── index.ts
└── chat-stream-v2/           # MODIFY: Add folder filter support
    └── index.ts

src/
├── components/
│   ├── chat/
│   │   └── ChatFilterPopover.tsx    # MODIFY: Add folders section
│   ├── contacts/                     # NEW: Contacts management
│   │   ├── ContactsTable.tsx
│   │   ├── ContactCard.tsx
│   │   └── HealthAlertBanner.tsx
│   └── profits/                      # NEW: PROFITS report display
│       ├── PROFITSReport.tsx
│       └── PROFITSSection.tsx
├── hooks/
│   ├── useContacts.ts               # NEW
│   ├── useHealthAlerts.ts           # NEW
│   └── usePROFITS.ts                # NEW
└── pages/
    └── CallDetailPage.tsx           # MODIFY: Wire PROFITS tab
```

### Anti-Patterns to Avoid

- **Don't create separate tables for each PROFITS letter** — Store as structured JSONB in single row
- **Don't poll for health alerts** — Use scheduled Edge Function with notifications table
- **Don't duplicate folder logic in chat** — Resolve folder_ids to recording_ids at query time
- **Don't build custom email** — Use existing automation-email function

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | SMTP integration | `automation-email` function + Resend | Already built, handles rate limits |
| Folder → calls lookup | Custom query logic | JOIN on folder_assignments | Schema supports this |
| Citation linking | Custom timestamp parser | fathom_transcripts.timestamp field | Already exists |
| AI streaming | Manual SSE | `streamText()` + `tool()` | Established pattern |
| Date range filtering | Custom logic | date-fns | Handles edge cases |

**Key insight:** The automation-engine and chat-stream-v2 patterns solve most infrastructure needs. Contacts and health alerts are the only genuinely new systems.

## Common Pitfalls

### Pitfall 1: Inefficient Folder Filter Queries
**What goes wrong:** N+1 queries when resolving folder_ids to recording_ids
**Why it happens:** Fetching folder contents individually
**How to avoid:** Single JOIN query with folder_assignments table
**Warning signs:** Slow chat initialization with folder filters

### Pitfall 2: PROFITS Extraction Context Limits
**What goes wrong:** Long transcripts exceed LLM context window
**Why it happens:** Sending full transcript without chunking
**How to avoid:** Use existing fathom_transcripts chunks, process in batches, aggregate
**Warning signs:** Timeouts, incomplete extractions

### Pitfall 3: Citation Misalignment
**What goes wrong:** PROFITS quotes don't match clickable transcript moments
**Why it happens:** Extracting quotes without preserving source chunk references
**How to avoid:** Include transcript segment ID + timestamp in extraction prompt
**Warning signs:** "Jump to quote" links go to wrong place

### Pitfall 4: Health Alert Spam
**What goes wrong:** Users get too many alerts
**Why it happens:** No cooldown period, alerting on every check
**How to avoid:** Track `last_alerted_at` per contact, enforce cooldown (e.g., 7 days)
**Warning signs:** Users disable all alerts

### Pitfall 5: Contact Duplication
**What goes wrong:** Same person added multiple times with email variations
**Why it happens:** email vs EMAIL, extra spaces
**How to avoid:** Normalize emails (lowercase, trim) at insert time
**Warning signs:** Duplicate contact cards

## Code Examples

### Adding Folder Filter to ChatFilterPopover

```typescript
// Source: src/components/chat/ChatFilterPopover.tsx
// Add after the Categories section:

<Separator className="my-4" />

{/* Folders */}
<div className="mb-4">
  <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
    Folders ({availableFolders.length})
  </label>
  <ScrollArea className="h-32">
    <div className="space-y-1">
      {availableFolders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => toggleFolder(folder.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            filters.folderIds.includes(folder.id)
              ? 'bg-vibe-orange/10 text-ink'
              : 'hover:bg-hover text-ink-soft'
          }`}
        >
          <span 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: folder.color }}
          />
          <span className="truncate flex-1">{folder.name}</span>
          <RiCloseLine 
            className={cn(
              "w-4 h-4",
              filters.folderIds.includes(folder.id) ? "opacity-100" : "opacity-0"
            )}
          />
        </button>
      ))}
    </div>
  </ScrollArea>
</div>
```

### PROFITS Extraction Prompt Pattern

```typescript
// Source: Follows content-insight-miner pattern
const PROFITS_SYSTEM_PROMPT = `You are a sales psychology analyst extracting insights from meeting transcripts.

For each letter in PROFITS, extract relevant findings WITH exact quotes:
- P (Pain): What struggles, problems, or pain points were mentioned?
- R (Results): What outcomes, goals, or desired results did they express?
- O (Obstacles): What barriers or blockers are preventing progress?
- F (Fears): What concerns, worries, or fears are holding them back?
- I (Identity): How do they describe themselves, their role, or their company?
- T (Triggers): What motivated them to take action or reach out?
- S (Success): What wins, achievements, or positive outcomes were mentioned?

For EACH finding, you MUST include:
1. A brief summary of the finding
2. The EXACT quote from the transcript (verbatim)
3. The segment index where this quote appears (use the provided segment numbers)

Output as JSON following this schema:
{
  "sections": [
    {
      "letter": "P",
      "title": "Pain",
      "findings": [
        {
          "text": "Summary of the pain point",
          "quote": "The exact words from the transcript",
          "segment_index": 42,
          "confidence": 0.85
        }
      ]
    }
  ]
}

If no findings for a category, return an empty findings array for that section.`;
```

### Folder Filter Resolution in chat-stream-v2

```typescript
// Source: supabase/functions/chat-stream-v2/index.ts
// Add to createTools() or as helper function

async function resolveFolderFilter(
  supabase: SupabaseClient,
  userId: string,
  folderIds: string[] | undefined,
  existingRecordingIds: number[] | undefined
): Promise<number[] | undefined> {
  if (!folderIds || folderIds.length === 0) {
    return existingRecordingIds;
  }

  // Get all recording_ids in the specified folders
  const { data: assignments, error } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', folderIds)
    .eq('user_id', userId);

  if (error || !assignments) {
    console.error('[chat-stream-v2] Folder filter error:', error);
    return existingRecordingIds;
  }

  const folderRecordingIds = assignments.map(a => a.call_recording_id);
  
  // If existing recording_ids filter, intersect with folder contents
  if (existingRecordingIds && existingRecordingIds.length > 0) {
    return folderRecordingIds.filter(id => existingRecordingIds.includes(id));
  }

  return folderRecordingIds;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual PROFITS extraction prompt | Structured extraction with citations | This phase | Clickable quotes |
| Global chat scope only | Filter by date/speaker/category/calls | Phase 2 | Folder adds to existing |
| No attendee tracking | calendar_invitees JSONB | Existing | Foundation for contacts |

**Deprecated/outdated:**
- Legacy `ai-agent.ts` PROFITS code - references non-existent `calls` table, must be reimplemented
- `fathom_calls.profits_framework` column exists but is unused - can be leveraged

## Key Findings

### PROFITS Framework
- **Definition exists:** README.md lines 17-28 defines P/R/O/F/I/T/S
- **Placeholder exists:** CallDetailPage.tsx lines 251-259 has empty PROFITS tab
- **Storage ready:** `fathom_calls.profits_framework` JSONB column exists (migration 20251214000002)
- **Pattern available:** Follow `content-insight-miner` Edge Function pattern
- **Citation source:** `fathom_transcripts` has segment data with timestamps

### Folder-Level Chat
- **Schema complete:** `folders` and `folder_assignments` tables exist
- **Hook complete:** `useFolders.ts` provides full CRUD + assignment operations
- **Filter UI exists:** `ChatFilterPopover.tsx` has date/speaker/category/calls sections
- **Session filters exist:** `chat_sessions` has filter columns, NEEDS `filter_folder_ids`
- **Backend pattern:** `chat-stream-v2` mergeFilters() can be extended

### Contacts Database
- **Attendee data source:** `fathom_calls.calendar_invitees` JSONB array
  - Shape: `[{email: string, name?: string, external?: boolean}]`
- **No contacts table:** Must be created
- **Pattern available:** Follow `folders` schema pattern with RLS

### Client Health Alerts
- **Email ready:** `automation-email` function uses Resend API
- **Automation engine:** Has action types including email, update_client_health
- **Scheduling:** Supabase pg_cron or scheduled functions available
- **No notification table:** Must be created for in-app alerts

### Real Analytics Data
- **Already wired:** `useCallAnalytics.ts` queries `fathom_calls` directly
- **Charts working:** AnalyticsTab.tsx uses DonutChartMetric, DonutChartCard
- **Data returned:** totalCalls, participationRate, avgDuration, etc.
- **May need:** Additional charts or metrics based on requirements

## Open Questions

1. **PROFITS storage location**
   - What we know: `fathom_calls.profits_framework` JSONB column exists
   - What's unclear: Store in column vs separate `profits_reports` table?
   - Recommendation: Use existing column for simplicity, single source of truth

2. **Contact import workflow**
   - What we know: calendar_invitees has attendee data
   - What's unclear: Bulk import vs progressive (per-call add)?
   - Recommendation: Support both - "Track all" toggle + per-call selection

3. **Health alert email template**
   - What we know: automation-email supports templates
   - What's unclear: Fixed template vs user-customizable?
   - Recommendation: Default template with prompt customization per CONTEXT.md

## Sources

### Primary (HIGH confidence)
- `supabase/functions/chat-stream-v2/index.ts` - Current chat backend patterns
- `src/hooks/useFolders.ts` - Folder management patterns
- `supabase/migrations/20251201000002_create_folders_tables.sql` - Folder schema
- `supabase/migrations/20251125000001_ai_chat_infrastructure.sql` - Chat session schema
- `src/components/chat/ChatFilterPopover.tsx` - Current filter UI
- `supabase/functions/automation-email/index.ts` - Email delivery patterns
- `src/hooks/useCallAnalytics.ts` - Analytics data patterns

### Secondary (MEDIUM confidence)
- `README.md` lines 17-28 - PROFITS definition
- `docs/reference/feature-roadmap.md` - PROFITS reimplementation notes
- `supabase/functions/automation-engine/actions.ts` - Action types

### Tertiary (LOW confidence)
- Legacy `ai-agent.ts` PROFITS code - Referenced but non-functional

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, patterns established
- Architecture: HIGH - Existing patterns clearly documented in codebase
- Pitfalls: MEDIUM - Based on code analysis, not production experience
- PROFITS implementation: MEDIUM - Definition exists but extraction is new
- Contacts schema: HIGH - Follows established folder pattern
- Health alerts: MEDIUM - Automation engine exists but new scheduling needed

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable patterns)
