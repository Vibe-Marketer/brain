# Phase 9: Bank/Vault Architecture - Research

**Researched:** 2026-01-31
**Domain:** Supabase PostgreSQL schema migration, multi-tenant architecture
**Confidence:** HIGH

## Summary

This research investigates implementing the Bank/Vault architecture from CallVault-Final-Spaces.md. The codebase currently has:

1. **Coach infrastructure to remove:** 3 database tables (`coach_relationships`, `coach_shares`, `coach_notes`), 1 Edge Function (`send-coach-invite`), 1 large hook file (~930 lines), UI components in billing, collaboration page, and settings tabs. No production data exists.

2. **Team infrastructure to rebuild:** 4 database tables (`teams`, `team_memberships`, `team_shares`, `manager_notes`) with RLS policies. Teams are minimally used - can be dropped and rebuilt cleanly using Bank/Vault model.

3. **Existing data patterns:** `fathom_calls` table with composite PK (`recording_id`, `user_id`), folders with folder_assignments, call_tags with tag_assignments. These provide the migration baseline.

**Primary recommendation:** Execute a clean replacement strategy - drop all coach/team tables, create Bank/Vault schema fresh, migrate fathom_calls to recordings + vault_entries in background.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase | 2.x | Database + Auth + RLS | Already the project database |
| PostgreSQL | 15+ | Relational database | Supabase's underlying DB |
| Deno | 1.x | Edge Functions runtime | Supabase standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | 2.x | Client SDK | All DB operations |
| Zustand | Latest | Client state | Team/Bank context switching |
| Tanstack Query | 5.x | Server state | Data fetching/caching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Background migration | Sync migration | Background allows zero-downtime; sync is simpler but blocks |
| Dual-write | Cut-over | Dual-write is safer but more complex |

## Architecture Patterns

### Database Schema Structure

Per CallVault-Final-Spaces.md spec:

```
Banks (top-level tenant)
├── BankMemberships (user → bank with role)
├── Vaults (collaboration containers)
│   ├── VaultMemberships (user → vault with role)
│   ├── VaultEntries (recording in vault with local context)
│   └── Folders (organization within vault)
├── Recordings (base call objects, owned by bank)
└── Subscriptions (billing per bank)
```

### Recommended Table Structure

```sql
-- Bank: Top-level tenant container
CREATE TABLE banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('personal', 'business')),
  cross_bank_default TEXT DEFAULT 'copy_only' CHECK (cross_bank_default IN ('copy_only', 'copy_and_remove')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BankMembership: User → Bank with role
CREATE TABLE bank_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('bank_owner', 'bank_admin', 'bank_member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_id, user_id)
);

-- Vault: Collaboration container within a bank
CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vault_type TEXT NOT NULL CHECK (vault_type IN ('personal', 'team', 'coach', 'community', 'client')),
  default_sharelink_ttl_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VaultMembership: User → Vault with role
CREATE TABLE vault_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('vault_owner', 'vault_admin', 'manager', 'member', 'guest')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vault_id, user_id)
);

-- Recording: Base call object (migrated from fathom_calls)
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_recording_id BIGINT, -- For migration tracking
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_url TEXT,
  full_transcript TEXT,
  summary TEXT,
  global_tags TEXT[] DEFAULT '{}',
  source_app TEXT, -- 'fathom', 'google_meet', 'zoom', 'youtube'
  source_metadata JSONB,
  duration INTEGER, -- seconds
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_id, legacy_recording_id) -- Prevent duplicate migrations
);

-- VaultEntry: Recording in Vault with local context
CREATE TABLE vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  local_tags TEXT[] DEFAULT '{}',
  scores JSONB, -- For AI scoring results
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vault_id, recording_id) -- Same recording can only appear once per vault
);
```

### Folder Visibility Pattern

```sql
-- Update existing folders table
ALTER TABLE folders ADD COLUMN IF NOT EXISTS vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'all_members' 
  CHECK (visibility IN ('all_members', 'managers_only', 'owner_only'));
```

### RLS Policy Pattern

The key RLS pattern for multi-tenant isolation:

```sql
-- Bank isolation: Users only see banks they're members of
CREATE POLICY "Users can view their banks"
  ON banks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_memberships.bank_id = banks.id
        AND bank_memberships.user_id = auth.uid()
    )
  );

-- Vault isolation: Users only see vaults they're members of
CREATE POLICY "Users can view their vaults"
  ON vaults FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vaults.id
        AND vault_memberships.user_id = auth.uid()
    )
  );

-- Recording isolation: Within bank only
CREATE POLICY "Users can view recordings in their banks"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_memberships
      WHERE bank_memberships.bank_id = recordings.bank_id
        AND bank_memberships.user_id = auth.uid()
    )
  );

-- VaultEntry: Via vault membership
CREATE POLICY "Users can view vault entries in their vaults"
  ON vault_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vault_entries.vault_id
        AND vault_memberships.user_id = auth.uid()
    )
  );
```

### Anti-Patterns to Avoid

- **Cross-Bank Recording References:** NEVER allow a VaultEntry to reference a Recording in a different Bank. Enforce via FK constraint and application logic.
- **Direct Recording.bank_id Changes:** Bank_id should be immutable on recordings. Cross-bank = always COPY.
- **Missing bank_id in Queries:** Every query touching multi-tenant data MUST include bank_id filter.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-tenant isolation | Custom middleware | Supabase RLS | RLS is database-level security, can't be bypassed by app bugs |
| Background jobs | Custom queue | pg_cron + Edge Functions | Already in Supabase, production-tested |
| UUID generation | Custom function | gen_random_uuid() | PostgreSQL native, fast, correct |
| Cascade deletes | Application logic | ON DELETE CASCADE | Database-level guarantees |

**Key insight:** Supabase RLS provides row-level multi-tenant isolation that's impossible to bypass from application code. Use it for Bank/Vault boundaries.

## Common Pitfalls

### Pitfall 1: RLS Recursion with Self-Joins
**What goes wrong:** RLS policies that reference the same table cause infinite recursion
**Why it happens:** Policy checks itself when evaluating membership queries
**How to avoid:** Use SECURITY DEFINER helper functions that bypass RLS for membership checks
**Warning signs:** "infinite recursion detected" errors, query timeouts

```sql
-- GOOD: Security definer function for membership checks
CREATE OR REPLACE FUNCTION is_bank_member(p_bank_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bank_memberships
    WHERE bank_id = p_bank_id AND user_id = p_user_id
  )
$$;
```

### Pitfall 2: Migration Data Loss During Dual-Write
**What goes wrong:** Records created during migration window get lost
**Why it happens:** Writes go to old table but reads from new table
**How to avoid:** 
1. Migration inserts into BOTH old and new tables
2. Cut over reads only after migration complete
3. Keep dual-write active until validation passes
**Warning signs:** Missing recent records after migration

### Pitfall 3: Orphaned VaultEntries After Recording Delete
**What goes wrong:** Deleting a recording leaves ghost VaultEntries
**Why it happens:** FK cascade not set up, or cascade order wrong
**How to avoid:** ON DELETE CASCADE on vault_entries.recording_id FK
**Warning signs:** Foreign key violations, null references in UI

### Pitfall 4: Missing Default Personal Bank
**What goes wrong:** New user has no bank, can't store recordings
**Why it happens:** Signup trigger doesn't create personal bank
**How to avoid:** Add to handle_new_user() trigger: create personal bank + vault
**Warning signs:** Empty state forever, "no bank found" errors

## Code Examples

### Auto-Create Personal Bank on User Signup

```sql
-- Extend existing handle_new_user() trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
BEGIN
  -- Insert profile for new user (existing)
  INSERT INTO public.user_profiles (user_id, email, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );
  
  -- Assign default FREE role (existing)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- NEW: Create personal bank
  INSERT INTO banks (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_bank_id;
  
  -- NEW: Create bank membership as owner
  INSERT INTO bank_memberships (bank_id, user_id, role)
  VALUES (v_bank_id, NEW.id, 'bank_owner');
  
  -- NEW: Create default personal vault
  INSERT INTO vaults (bank_id, name, vault_type)
  VALUES (v_bank_id, 'My Calls', 'personal')
  RETURNING id INTO v_vault_id;
  
  -- NEW: Create vault membership as owner
  INSERT INTO vault_memberships (vault_id, user_id, role)
  VALUES (v_vault_id, NEW.id, 'vault_owner');
  
  RETURN NEW;
END;
$$;
```

### Migration Function: fathom_calls → recordings + vault_entries

```sql
CREATE OR REPLACE FUNCTION migrate_fathom_call_to_recording(
  p_recording_id BIGINT,
  p_user_id UUID
)
RETURNS UUID -- Returns new recording UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  -- Get user's personal bank
  SELECT b.id INTO v_bank_id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;
  
  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'No personal bank found for user %', p_user_id;
  END IF;
  
  -- Get user's personal vault
  SELECT v.id INTO v_vault_id
  FROM vaults v
  JOIN vault_memberships vm ON vm.vault_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.bank_id = v_bank_id
    AND v.vault_type = 'personal'
  LIMIT 1;
  
  IF v_vault_id IS NULL THEN
    RAISE EXCEPTION 'No personal vault found for user %', p_user_id;
  END IF;
  
  -- Get the fathom_call data
  SELECT * INTO v_call
  FROM fathom_calls
  WHERE recording_id = p_recording_id AND user_id = p_user_id;
  
  IF v_call IS NULL THEN
    RAISE EXCEPTION 'Call not found: % / %', p_recording_id, p_user_id;
  END IF;
  
  -- Check if already migrated
  SELECT id INTO v_new_recording_id
  FROM recordings
  WHERE legacy_recording_id = p_recording_id AND bank_id = v_bank_id;
  
  IF v_new_recording_id IS NOT NULL THEN
    -- Already migrated, return existing
    RETURN v_new_recording_id;
  END IF;
  
  -- Create recording
  INSERT INTO recordings (
    legacy_recording_id,
    bank_id,
    owner_user_id,
    title,
    full_transcript,
    summary,
    global_tags,
    source_app,
    recording_start_time,
    recording_end_time,
    created_at,
    synced_at
  ) VALUES (
    v_call.recording_id,
    v_bank_id,
    p_user_id,
    v_call.title,
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    'fathom',
    v_call.recording_start_time,
    v_call.recording_end_time,
    v_call.created_at,
    v_call.synced_at
  )
  RETURNING id INTO v_new_recording_id;
  
  -- Create vault entry in personal vault
  INSERT INTO vault_entries (
    vault_id,
    recording_id,
    created_at
  ) VALUES (
    v_vault_id,
    v_new_recording_id,
    v_call.created_at
  );
  
  RETURN v_new_recording_id;
END;
$$;
```

### Bank Context Store Pattern

```typescript
// stores/bankContextStore.ts
import { create } from 'zustand';

export const BANK_CONTEXT_UPDATED_KEY = 'bank-context-updated';

interface BankContextState {
  activeBankId: string | null; // null during loading
  activeVaultId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  setActiveBank: (bankId: string) => void;
  setActiveVault: (vaultId: string | null) => void;
  initialize: (bankId: string, vaultId: string | null) => void;
  setError: (error: string | null) => void;
}

export const useBankContextStore = create<BankContextState>((set) => ({
  activeBankId: null,
  activeVaultId: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  setActiveBank: (bankId) => {
    set({ activeBankId: bankId, activeVaultId: null, error: null });
    if (typeof window !== 'undefined') {
      localStorage.setItem(BANK_CONTEXT_UPDATED_KEY, Date.now().toString());
    }
  },

  setActiveVault: (vaultId) => {
    set({ activeVaultId: vaultId, error: null });
  },

  initialize: (bankId, vaultId) => {
    set({ 
      activeBankId: bankId,
      activeVaultId: vaultId,
      isLoading: false, 
      isInitialized: true,
      error: null 
    });
  },

  setError: (error) => {
    set({ error, isLoading: false });
  },
}));
```

## Coach Code Removal Inventory

### Database Tables to DROP
1. `coach_relationships` - 381 lines migration
2. `coach_shares` - included in same migration
3. `coach_notes` - included in same migration

### Edge Functions to DELETE
1. `supabase/functions/send-coach-invite/` - 282 lines

### Frontend Files to DELETE/MODIFY
| File | Action | Lines |
|------|--------|-------|
| `src/hooks/useCoachRelationships.ts` | DELETE | 928 |
| `src/components/settings/CoachesTab.tsx` | DELETE | ~400 |
| `src/components/sharing/CoachInviteDialog.tsx` | DELETE | ~350 |
| `src/components/sharing/CoacheeInviteDialog.tsx` | DELETE | ~350 |
| `src/components/sharing/RelationshipCard.tsx` | DELETE | ~200 |
| `src/components/sharing/RelationshipList.tsx` | DELETE | ~150 |
| `src/types/sharing.ts` | MODIFY | Remove coach types |
| `src/lib/query-config.ts` | MODIFY | Remove coaches keys |
| `src/pages/CollaborationPage.tsx` | MODIFY | Remove coaches route |
| `src/components/billing/PlanCards.tsx` | MODIFY | Remove coach feature mentions |
| `src/components/settings/BillingTab.tsx` | MODIFY | Remove coach feature mentions |
| `src/App.tsx` | MODIFY | Remove /coach routes |

### Type Definitions to Remove
From `src/types/sharing.ts`:
- `InvitedBy` (coach | coachee)
- `CoachRelationship`
- `CoachRelationshipWithUsers`
- `CoachShare`
- `CoachShareWithDetails`
- `CoachNote`
- `ConfigureCoachSharingInput`

## Team Code to Replace

### Tables to DROP and REBUILD
1. `teams` - Will become Banks + Vaults
2. `team_memberships` - Will become BankMemberships + VaultMemberships
3. `team_shares` - Absorbed into VaultEntry + Folder visibility
4. `manager_notes` - Can be preserved as VaultEntry.notes or separate table

### Store to Replace
- `src/stores/teamContextStore.ts` → `bankContextStore.ts`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Coach relationships | Vault types | Phase 9 | Unifies sharing model |
| Team memberships | Bank + Vault memberships | Phase 9 | 2-level hierarchy |
| fathom_calls with user_id | recordings + vault_entries | Phase 9 | Multi-vault sharing |
| activeTeamId context | activeBankId + activeVaultId | Phase 9 | Bank/Vault hierarchy |

**Deprecated/outdated:**
- `coach_relationships`: Replaced by `coach` vault_type
- `team_memberships`: Replaced by bank_memberships + vault_memberships
- `fathom_calls` composite PK: Replaced by UUID-based recordings

## Open Questions

1. **Folder Migration Strategy**
   - What we know: Folders currently belong to user, not vault
   - What's unclear: Should existing folders migrate to personal vault, or stay user-scoped?
   - Recommendation: Migrate to personal vault, add vault_id column

2. **Tag Migration Strategy**
   - What we know: Tags are currently user-scoped via call_tags
   - What's unclear: Should tags become vault-scoped local_tags or recording global_tags?
   - Recommendation: Keep as global_tags on Recording, use local_tags for vault-specific context

3. **Historical Call Access After Migration**
   - What we know: All existing calls will be in personal vault
   - What's unclear: How to handle shared links to old recording_ids?
   - Recommendation: Keep fathom_calls table read-only for legacy URL redirects

## Sources

### Primary (HIGH confidence)
- `/docs/planning/CallVault-Final-Spaces.md` - Authoritative architecture spec
- `/supabase/migrations/00000000000000_consolidated_schema.sql` - Current schema
- `/supabase/migrations/20260108000002_create_coach_access_tables.sql` - Coach tables to remove
- `/supabase/migrations/20260108000003_create_team_access_tables.sql` - Team tables to replace

### Secondary (MEDIUM confidence)
- `/src/hooks/useCoachRelationships.ts` - Coach code patterns to remove
- `/src/stores/teamContextStore.ts` - Team context pattern to adapt
- `/supabase/CLAUDE.md` - Database patterns and conventions

### Tertiary (LOW confidence)
- N/A - All findings verified against codebase

## Metadata

**Confidence breakdown:**
- Schema design: HIGH - Directly from CallVault-Final-Spaces.md spec
- Coach removal: HIGH - Full codebase inventory completed
- Migration strategy: HIGH - Standard Supabase patterns
- RLS patterns: HIGH - Based on existing working patterns in codebase

**Research date:** 2026-01-31
**Valid until:** 60 days (stable architecture, no external dependencies)
