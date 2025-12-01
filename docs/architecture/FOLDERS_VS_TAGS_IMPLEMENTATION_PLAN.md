# FOLDERS vs TAGS Implementation Plan

**Created:** 2025-11-29
**Status:** PLANNING

---

## Executive Summary

The current system conflates two distinct concepts under "categories":
1. **Organizational grouping** (where you find calls)
2. **Call type classification** (what kind of call it is, controls AI behavior)

This plan separates them into **FOLDERS** and **TAGS** as two independent systems.

---

## Current State Analysis

### What Exists Today

#### Database Tables

| Table | Purpose | Current Usage |
|-------|---------|---------------|
| `call_categories` | Stores 16 "system categories" | These are actually **TAGS** (call types that should control AI) |
| `call_category_assignments` | Links calls to categories | Currently used for tag assignments |
| `categorization_rules` | Rules to auto-assign categories | Should become **tag_rules** |
| `fathom_calls.auto_tags` | TEXT[] column for auto-tags | Unused - was from earlier concept |

#### Current call_categories (16 types)

```
TEAM, COACH_GROUP, COACH_1ON1, WEBINAR, SALES, EXTERNAL, DISCOVERY,
ONBOARDING, REFUND, FREE, EDUCATION, PRODUCT, SUPPORT, REVIEW, STRATEGY, SKIP
```

**These ARE the TAGS** - they're call type classifications that control AI behavior.

#### Current Code References

1. **`generate-ai-titles/index.ts`** - Uses `category_hint` in the AI prompt
   - Currently assigns to `call_category_assignments` when generating titles
   - This is correct behavior but wrong naming

2. **`Categorization.tsx`** page with 3 tabs:
   - RecurringTitlesTab - Shows recurring titles for rule creation
   - RulesTab - CRUD for categorization rules
   - CategoriesTab - Displays the 16 system categories

3. **Multiple UI components** reference categories for:
   - Filtering calls
   - Displaying category badges
   - Manual categorization
   - Bulk actions

---

## Desired State

### Two Independent Systems

```
+------------------+        +------------------+
|     FOLDERS      |        |      TAGS        |
+------------------+        +------------------+
| Purpose:         |        | Purpose:         |
| Organization     |        | Classification   |
| (for humans)     |        | (for AI/system)  |
+------------------+        +------------------+
| Per call: 1      |        | Per call: 1-2    |
| (primary + sec)  |        |                  |
+------------------+        +------------------+
| User-created     |        | System-defined   |
| Hierarchical     |        | Flat list (16)   |
| (3 levels max)   |        |                  |
+------------------+        +------------------+
| Controls:        |        | Controls:        |
| - Where call     |        | - Which prompts  |
|   appears in UI  |        | - What analysis  |
| - Nothing else   |        | - Report grouping|
+------------------+        +------------------+
```

### Database Schema - Desired

```sql
-- FOLDERS (NEW) - Hierarchical organization
CREATE TABLE call_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES call_folders(id) ON DELETE CASCADE,
  depth INT NOT NULL DEFAULT 0,  -- 0 = root, 1, 2 (max 2 = 3 levels)
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT max_depth CHECK (depth <= 2),
  UNIQUE (user_id, parent_id, name)
);

-- Call folder assignments (1 call = 1 folder only)
CREATE TABLE call_folder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT REFERENCES fathom_calls(recording_id) ON DELETE CASCADE NOT NULL UNIQUE,
  folder_id UUID REFERENCES call_folders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  auto_assigned BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folder rules (auto-assign calls to folders)
CREATE TABLE folder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'title_exact', 'title_contains', 'title_regex',
    'participant', 'day_time', 'transcript_keyword'
  )),
  conditions JSONB NOT NULL,
  folder_id UUID REFERENCES call_folders(id) ON DELETE CASCADE NOT NULL,
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- TAGS - Rename existing call_categories
-- (Keep structure, rename for clarity)
ALTER TABLE call_categories RENAME TO call_tags;
ALTER TABLE call_category_assignments RENAME TO call_tag_assignments;
ALTER TABLE categorization_rules RENAME TO tag_rules;

-- Add primary/secondary distinction to tag assignments
ALTER TABLE call_tag_assignments ADD COLUMN is_primary BOOLEAN DEFAULT true;
-- Constraint: max 1 primary + 1 secondary per call
```

---

## Implementation Phases

### Phase 1: Rename "Categories" to "Tags" (No Functional Change)

**Goal:** Align terminology without breaking anything

1. **Database Migration**
   - Rename `call_categories` → `call_tags`
   - Rename `call_category_assignments` → `call_tag_assignments`
   - Rename `categorization_rules` → `tag_rules`
   - Update RLS policies
   - Update function references

2. **Backend Code**
   - Update `generate-ai-titles/index.ts`: `category_hint` → `tag_hint`
   - Update all Edge Functions that reference categories

3. **Frontend Code**
   - Global search/replace in components
   - Update query keys from `call-categories` to `call-tags`
   - Update UI labels: "Category" → "Tag"

4. **UI/Navigation**
   - Rename `/categorization` page to `/tags` or keep as-is but update labels
   - Update dock icon label if needed

**Files to Update:**
- `supabase/migrations/` - New migration
- `supabase/functions/generate-ai-titles/index.ts`
- `src/pages/Categorization.tsx`
- `src/components/categorization/*` - Rename folder to `tags/`
- `src/components/transcript-library/CategoryFilterPopover.tsx` → TagFilterPopover
- `src/components/transcript-library/CategoryManagementDialog.tsx`
- `src/components/transcript-library/CategoryNavigationDropdown.tsx`
- `src/components/transcript-library/CategorizeDropdown.tsx`
- `src/components/ManualCategorizeDialog.tsx`
- `src/components/QuickCreateCategoryDialog.tsx`
- Multiple other files (26 found in grep)

### Phase 2: Add Folders System (New Feature)

**Goal:** Add hierarchical folder organization separate from tags

1. **Database Migration**
   - Create `call_folders` table
   - Create `call_folder_assignments` table
   - Create `folder_rules` table
   - Add RLS policies
   - Add indexes

2. **Backend**
   - Create Edge Function: `manage-folders`
   - Create Edge Function: `apply-folder-rules`
   - Update `sync-meetings` to apply folder rules on sync

3. **Frontend - Folder Management**
   - Create `/folders` page (or add tab to existing page)
   - Folder tree view component
   - Create/edit/delete folder dialogs
   - Drag-drop reordering

4. **Frontend - Call Assignment**
   - Add folder picker to call detail view
   - Add folder column to transcript table
   - Add folder filter to FilterBar
   - Update bulk actions for folder assignment

5. **Folder Rules UI**
   - Rules tab for folder auto-assignment
   - Similar to existing tag rules UI

### Phase 3: Enhance Tag System

**Goal:** Add primary/secondary tag support

1. **Database Migration**
   - Add `is_primary` column to `call_tag_assignments`
   - Update trigger to enforce: max 1 primary + 1 secondary

2. **Frontend**
   - Update tag assignment UI to show primary/secondary
   - Allow swapping primary/secondary

### Phase 4: AI Integration with Tags

**Goal:** Tags control which AI prompts run

1. **Create tag-specific prompt templates**
   - Store in database or config
   - Each tag type gets its own analysis prompt

2. **Update AI analysis functions**
   - Route to correct prompt based on tag
   - Different extraction schemas per tag type

---

## Migration Strategy

### Why Rename First

1. **Clarity:** Everyone understands "tag" = classification, "folder" = organization
2. **No Functional Change:** Reduces risk - just naming
3. **Sets Foundation:** Clean naming before adding folders

### Data Migration

No data loss - just table renames:
```sql
-- Phase 1: Rename tables (data preserved)
ALTER TABLE call_categories RENAME TO call_tags;
ALTER TABLE call_category_assignments RENAME TO call_tag_assignments;
ALTER TABLE categorization_rules RENAME TO tag_rules;

-- Update column names in rules table
ALTER TABLE tag_rules RENAME COLUMN category_id TO tag_id;

-- Update foreign key constraints (if needed)
ALTER TABLE call_tag_assignments RENAME COLUMN category_id TO tag_id;
```

### Rollback Plan

Each phase is independently rollable:
- Phase 1: Rename tables back
- Phase 2: Drop new folder tables
- Phase 3: Remove is_primary column

---

## UI/UX Considerations

### Navigation

**Current:**
- Dock has "Categories" icon → /categorization page

**Proposed:**
```
Option A: Separate Pages
- /tags → Tag management (existing, renamed)
- /folders → Folder management (new)

Option B: Combined Page with Tabs
- /organization → with FOLDERS | TAGS tabs
  - FOLDERS tab: Tree view, folder rules
  - TAGS tab: 16 system tags, tag rules
```

**Recommendation:** Option B - keeps related concepts together

### Transcript Library Changes

**Current columns:** Title, Date, Duration, Category, ...

**Proposed columns:**
- Keep tag display (was category)
- Add folder path column (e.g., "Clients / Acme Corp")
- Add folder filter in FilterBar

### Call Detail View

**Add:**
- Folder picker dropdown
- Clear distinction between "Tag (what type)" and "Folder (where filed)"

---

## File Changes Summary

### Phase 1 (Rename to Tags)

| File | Change |
|------|--------|
| New migration file | Rename tables |
| `generate-ai-titles/index.ts` | category_hint → tag_hint |
| `src/pages/Categorization.tsx` | Labels + content updates |
| `src/components/categorization/` → `src/components/tags/` | Rename folder |
| 26+ component files | Update references |

### Phase 2 (Add Folders)

| File | Change |
|------|--------|
| New migration file | Create folder tables |
| New Edge Function | `manage-folders` |
| New Edge Function | `apply-folder-rules` |
| `src/pages/Folders.tsx` | New page OR combined |
| `src/components/folders/` | New component folder |
| `src/components/transcript-library/*` | Add folder column/filter |
| `src/components/call-detail/*` | Add folder picker |

---

## Constraints & Rules

### Tags

1. **16 system tags** - not user-editable (can't add/remove)
2. **1 primary tag required** per call (auto-assigned by AI or rules)
3. **1 secondary tag optional** per call (user-assigned)
4. **Tags control AI behavior** - determines which prompts run

### Folders

1. **User-created** - can add/edit/delete
2. **Hierarchical** - max 3 levels deep
3. **1 folder per call** (or "Unfiled" default)
4. **No AI impact** - purely organizational
5. **Deleting folder moves calls to "Unfiled"** - never deletes calls

---

## Open Questions

1. **Should there be a "Unfiled" system folder?**
   - Probably yes - calls without folder assignment go here

2. **Can users create custom tags?**
   - Spec says no - tags are system-defined 16 types
   - But should there be a way to request new tags?

3. **Should existing "SKIP" tag become special?**
   - Currently auto-assigned for short/empty transcripts
   - Keep as a tag or move to a separate "status" concept?

4. **How to handle existing category assignments?**
   - They become tag assignments - data preserved
   - No migration of assignments needed

---

## Timeline Estimate

| Phase | Scope | Complexity |
|-------|-------|------------|
| Phase 1: Rename to Tags | Database + all code references | Medium |
| Phase 2: Add Folders | New tables, new UI, new logic | High |
| Phase 3: Primary/Secondary Tags | Small schema change, UI update | Low |
| Phase 4: AI Integration | Prompt templates, routing | Medium |

**Recommended Order:** 1 → 2 → 3 → 4

---

## Next Steps

1. Review this plan with user
2. Create detailed migration file for Phase 1
3. List all files requiring changes for Phase 1
4. Execute Phase 1 (rename categories → tags)
5. Then proceed to Phase 2 (add folders)

---

*End of implementation plan*
