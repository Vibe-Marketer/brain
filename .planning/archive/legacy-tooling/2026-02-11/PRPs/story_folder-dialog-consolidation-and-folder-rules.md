---
name: story_folder-dialog-consolidation-and-folder-rules.md
description: "PRP for folder dialog UX consolidation and unified automation rules system"
created: 2025-12-09
status: READY_FOR_IMPLEMENTATION
confidence_score: 92/100
---

## Goal

**Feature Goal**: Streamline folder management UX and EXTEND the existing RulesTab to support both tag AND folder automation.

**Deliverable**:
1. **Dialog Consolidation**: Simplify FolderManagementDialog to avoid dialog-within-dialog patterns
2. **Unified Rules System**: Extend existing `tag_rules` table and `RulesTab.tsx` to support folder assignments alongside tag assignments

**Success Definition**:
1. FolderManagementDialog supports inline editing/creation without spawning additional dialogs
2. Existing RulesTab allows rules to assign BOTH a tag AND/OR a folder
3. Single rule can optionally do: assign tag, assign folder, or both
4. No code duplication - one component handles all automation

---

## User Persona

**Target User**: CallVault power users organizing large volumes of calls

**Use Cases**:
1. **Dialog UX**: User wants to quickly manage folders without navigating nested dialogs
2. **Folder Rules**: User wants new calls automatically filed into the correct folder based on title, participant, or other conditions

**User Journey (Unified Rules)**:
1. User navigates to Tags & Rules → Rules tab (existing)
2. User clicks "Create Rule" → defines conditions (e.g., "Title contains 'Sales'")
3. User selects target tag AND/OR target folder → saves rule
4. New calls matching the condition are automatically assigned to the tag and/or folder

**Pain Points Addressed**:
- Currently, folder management requires opening multiple nested dialogs
- No automation exists for folder assignment - 100% manual process
- Having separate "Tag Rules" and "Folder Rules" would be redundant and confusing

---

## Why

- **Workflow efficiency**: Automation reduces manual organization overhead
- **DRY principle**: Extending existing rules system avoids code duplication
- **User simplicity**: One place to manage all automation, not two separate tabs
- **Scalability**: As call volume grows, manual folder management becomes unsustainable
- **User expectation**: The FOLDERS_VS_TAGS_SPEC.md explicitly states "Both can be auto-assigned based on rules"
- **Synergy**: A single rule can assign BOTH a tag (for AI behavior) AND a folder (for organization)

---

## What

### Part A: Dialog Consolidation (Lower Priority)

Modify `FolderManagementDialog` to support inline editing without spawning `EditFolderDialog`.

**Current UX Flow**:
```
FolderManagementDialog → [Edit button] → EditFolderDialog (new modal opens)
```

**Proposed UX Flow**:
```
FolderManagementDialog → [Edit button] → Inline edit mode (same modal, expandable form)
```

### Part B: Extend Existing Rules System (Higher Priority)

Extend the existing `tag_rules` table and `RulesTab.tsx` to support folder assignments:

1. **Database**: Add `folder_id` column to existing `tag_rules` table (nullable)
2. **Backend**: Update `apply_tag_rules()` to also create folder_assignments when folder_id is set
3. **Frontend**: Update `RulesTab.tsx` to include optional folder selector
4. **Rename consideration**: Consider renaming to "automation_rules" or keep as "tag_rules" with folder support

---

## Success Criteria

### Part A: Dialog Consolidation
- [ ] FolderManagementDialog Edit button shows inline form instead of new dialog
- [ ] Create button shows inline form at top of list
- [ ] Inline forms have same fields as current EditFolderDialog/QuickCreateFolderDialog
- [ ] Delete confirmation remains as AlertDialog (acceptable)
- [ ] No new modals spawn from within the management dialog

### Part B: Unified Rules System
- [ ] `tag_rules` table has new nullable `folder_id` column
- [ ] `tag_id` becomes nullable (rule can assign tag only, folder only, or both)
- [ ] Constraint: at least one of tag_id or folder_id must be set
- [ ] `apply_tag_rules()` updated to also insert into folder_assignments when folder_id is set
- [ ] RulesTab.tsx has folder dropdown alongside tag dropdown
- [ ] UI clearly shows "Assign Tag" and "Assign to Folder" as optional selections
- [ ] Rules can be created with: tag only, folder only, or both
- [ ] "Apply Rules Now" button applies both tag and folder assignments
- [ ] Stats track applications correctly

---

## All Needed Context

### Context Completeness Check

_This PRP contains complete context for extending the rules system. The dialog consolidation is optional enhancement._

### Documentation & References

```yaml
# MUST READ - Component to extend
- file: src/components/tags/RulesTab.tsx
  why: THE component to modify - add folder support here
  pattern: CRUD operations, toggle active, Apply Rules Now button
  critical: Add folder_id to form and table, keep same patterns

# MUST READ - Database to extend
- file: supabase/migrations/20251130000001_rename_categories_to_tags.sql
  why: Current tag_rules schema and apply_tag_rules functions
  pattern: Add folder_id column, update stored procedures
  critical: Make tag_id nullable, add CHECK constraint

- file: supabase/migrations/20251201000002_create_folders_tables.sql
  why: Folders table schema for foreign key reference
  pattern: folders.id will be referenced by new tag_rules.folder_id

# Reference - Folder system specs
- file: docs/FOLDERS_VS_TAGS_SPEC.md
  why: Defines folders as organizational (no AI impact) vs tags (AI control)
  critical: Rules can now assign both - tag for AI, folder for organization

# Dialog consolidation references (Part A)
- file: src/components/transcript-library/FolderManagementDialog.tsx
  why: Current implementation with dialog-in-dialog pattern
  pattern: Needs inline editing capability

- file: src/components/EditFolderDialog.tsx
  why: Form fields to inline into FolderManagementDialog
  pattern: Name, description, parent, color, icon fields

- file: src/components/QuickCreateFolderDialog.tsx
  why: Create form fields to inline into FolderManagementDialog
```

### Current Codebase Tree (affected areas)

```
src/
├── components/
│   ├── tags/
│   │   └── RulesTab.tsx                    # MODIFY - Add folder support
│   ├── transcript-library/
│   │   └── FolderManagementDialog.tsx      # MODIFY (Part A)
│   ├── EditFolderDialog.tsx                # REFERENCE (Part A)
│   └── QuickCreateFolderDialog.tsx         # REFERENCE (Part A)
└── types/
    └── folders.ts                          # NO CHANGE needed

supabase/
└── migrations/
    ├── 20251130000001_rename_categories_to_tags.sql   # REFERENCE - Current schema
    └── 20251201000002_create_folders_tables.sql       # REFERENCE - folders.id FK
```

### Desired Codebase Tree

```
src/
├── components/
│   ├── tags/
│   │   └── RulesTab.tsx                    # MODIFIED - Now supports tag AND/OR folder
│   └── transcript-library/
│       └── FolderManagementDialog.tsx      # MODIFIED - Inline editing (Part A)

supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_extend_tag_rules_with_folders.sql  # CREATE - Add folder_id column
```

### Known Gotchas

```typescript
// CRITICAL: Same table (tag_rules), now with folder_id
// Rules can assign tag, folder, or BOTH
// tag_rules.tag_id → call_tag_assignments (if tag_id set)
// tag_rules.folder_id → folder_assignments (if folder_id set)

// GOTCHA: Make tag_id nullable BEFORE adding CHECK constraint
// Otherwise existing rules will fail the constraint check

// GOTCHA: Must update BOTH apply_tag_rules() and apply_tag_rules_to_untagged()
// Both functions need to insert into folder_assignments when folder_id is set

// GOTCHA: Form validation must allow: tag-only, folder-only, or both
// But NOT neither - use client-side validation + DB CHECK constraint

// GOTCHA: RulesTab table now needs Folder column
// Show "—" for rules without folder_id

// GOTCHA: Need to fetch folders in RulesTab (new query)
// queryKey: ["folders"] alongside existing ["call-tags"]
```

---

## Implementation Blueprint

### Part B: Unified Rules System (Primary Implementation)

#### Database Schema: Extend tag_rules table

```sql
-- Migration: YYYYMMDDHHMMSS_extend_tag_rules_with_folders.sql

-- 1. Add folder_id column to existing tag_rules table
ALTER TABLE tag_rules
ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 2. Make tag_id nullable (rules can now assign folder only)
ALTER TABLE tag_rules
ALTER COLUMN tag_id DROP NOT NULL;

-- 3. Add constraint: at least one target must be set
ALTER TABLE tag_rules
ADD CONSTRAINT tag_rules_at_least_one_target
CHECK (tag_id IS NOT NULL OR folder_id IS NOT NULL);

-- 4. Add index for folder_id lookups
CREATE INDEX IF NOT EXISTS idx_tag_rules_folder_id
  ON tag_rules(folder_id) WHERE folder_id IS NOT NULL;

-- 5. Update comment
COMMENT ON TABLE tag_rules IS 'User-defined automation rules for assigning tags and/or folders to calls';
COMMENT ON COLUMN tag_rules.folder_id IS 'Optional folder to assign when rule matches (can be set alongside or instead of tag_id)';
```

#### Update apply_tag_rules() function

```sql
-- In the same migration, update the apply_tag_rules function

CREATE OR REPLACE FUNCTION apply_tag_rules(
  p_recording_id BIGINT,
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  matched_rule_id UUID,
  matched_rule_name TEXT,
  tag_name TEXT,
  folder_name TEXT,  -- NEW: Added folder name
  match_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call RECORD;
  v_rule RECORD;
  v_matched BOOLEAN;
  v_match_reason TEXT;
BEGIN
  -- Get call details (same as before)
  SELECT
    fc.recording_id,
    fc.title,
    fc.created_at,
    EXTRACT(DOW FROM fc.created_at) as day_of_week,
    EXTRACT(HOUR FROM fc.created_at) as hour,
    LEFT(fc.full_transcript, 1000) as transcript_preview
  INTO v_call
  FROM fathom_calls fc
  WHERE fc.recording_id = p_recording_id AND fc.user_id = p_user_id;

  IF v_call IS NULL THEN
    RETURN;
  END IF;

  -- Check each active rule in priority order
  -- JOIN both tags AND folders
  FOR v_rule IN
    SELECT r.*,
           ct.name as tag_name,
           f.name as folder_name
    FROM tag_rules r
    LEFT JOIN call_tags ct ON r.tag_id = ct.id
    LEFT JOIN folders f ON r.folder_id = f.id
    WHERE r.user_id = p_user_id AND r.is_active = true
    ORDER BY r.priority ASC
  LOOP
    v_matched := false;
    v_match_reason := NULL;

    -- Same matching logic as before...
    CASE v_rule.rule_type
      WHEN 'title_exact' THEN
        IF LOWER(v_call.title) = LOWER(v_rule.conditions->>'title') THEN
          v_matched := true;
          v_match_reason := 'Title exactly matches: ' || (v_rule.conditions->>'title');
        END IF;
      -- ... other cases remain the same ...
    END CASE;

    IF v_matched THEN
      matched_rule_id := v_rule.id;
      matched_rule_name := v_rule.name;
      tag_name := v_rule.tag_name;
      folder_name := v_rule.folder_name;  -- NEW
      match_reason := v_match_reason;
      RETURN NEXT;

      IF NOT p_dry_run THEN
        -- Apply tag if tag_id is set
        IF v_rule.tag_id IS NOT NULL THEN
          INSERT INTO call_tag_assignments (call_recording_id, tag_id, user_id)
          VALUES (p_recording_id, v_rule.tag_id, p_user_id)
          ON CONFLICT DO NOTHING;
        END IF;

        -- NEW: Apply folder if folder_id is set
        IF v_rule.folder_id IS NOT NULL THEN
          INSERT INTO folder_assignments (folder_id, call_recording_id, user_id)
          VALUES (v_rule.folder_id, p_recording_id, p_user_id)
          ON CONFLICT DO NOTHING;
        END IF;

        UPDATE tag_rules
        SET times_applied = times_applied + 1, last_applied_at = NOW()
        WHERE id = v_rule.id;
      END IF;

      RETURN;
    END IF;
  END LOOP;
END;
$$;
```

#### Implementation Tasks (ordered)

```yaml
Task 1: CREATE migration to extend tag_rules
  - FILE: supabase/migrations/{timestamp}_extend_tag_rules_with_folders.sql
  - ADD: folder_id nullable column with FK to folders
  - MODIFY: tag_id to be nullable
  - ADD: CHECK constraint (tag_id OR folder_id must be set)
  - UPDATE: apply_tag_rules() to also insert folder_assignments
  - UPDATE: apply_tag_rules_to_untagged() to handle folder assignments
  - VALIDATION: Run `npx supabase db push` successfully

Task 2: UPDATE TypeScript types
  - FILE: src/components/tags/RulesTab.tsx (Rule interface)
  - ADD: folder_id?: string to Rule interface
  - ADD: folder_id: string to formData state
  - VALIDATION: TypeScript compiles without errors

Task 3: ADD folders query to RulesTab
  - FILE: src/components/tags/RulesTab.tsx
  - ADD: useQuery for folders (similar to existing tags query)
  - PATTERN:
    const { data: folders } = useQuery({
      queryKey: ["folders"],
      queryFn: async () => { ... }
    });
  - VALIDATION: Folders load correctly

Task 4: UPDATE RulesTab form to include folder selector
  - FILE: src/components/tags/RulesTab.tsx
  - MODIFY: Form to have TWO optional selectors:
    - "Assign Tag" (existing, now optional)
    - "Assign to Folder" (new, optional)
  - ADD: Folder dropdown with folder icons/colors
  - ADD: Validation: at least one must be selected
  - PATTERN: Side-by-side or stacked dropdowns with "Optional" labels
  - VALIDATION: Form allows tag-only, folder-only, or both

Task 5: UPDATE RulesTab table to show folder column
  - FILE: src/components/tags/RulesTab.tsx
  - ADD: "Folder" column in table header
  - ADD: Folder name/icon display in table rows
  - HANDLE: Rules with no folder (show "-" or empty)
  - VALIDATION: Table correctly displays folder assignments

Task 6: UPDATE save mutation to include folder_id
  - FILE: src/components/tags/RulesTab.tsx
  - MODIFY: saveMutation to include folder_id in insert/update
  - VALIDATION: Rules save with folder_id correctly

Task 7: UPDATE "Apply Rules Now" result display
  - FILE: src/components/tags/RulesTab.tsx
  - MODIFY: Toast/result to show folder assignments alongside tag assignments
  - VALIDATION: User sees feedback about both tag and folder applications
```

### Part A: Dialog Consolidation (Optional Enhancement)

```yaml
Task A1: ADD inline editing state to FolderManagementDialog
  - FILE: src/components/transcript-library/FolderManagementDialog.tsx
  - ADD: editingFolderId state (string | null)
  - ADD: creatingNew state (boolean)
  - MODIFY: renderFolder() to show form when editingFolderId matches
  - FOLLOW pattern: Inline editing patterns in similar components

Task A2: INLINE the edit form fields
  - ADD: Form fields from EditFolderDialog (name, description, color, icon)
  - REMOVE: onEditFolder callback that opens separate dialog
  - ADD: Save/Cancel buttons inline
  - VALIDATION: Edit button shows inline form, Save updates folder

Task A3: INLINE the create form
  - ADD: "Create New Folder" section at top that expands to inline form
  - REMOVE: onCreateFolder callback that opens separate dialog
  - VALIDATION: Create flow works without spawning QuickCreateFolderDialog
```

---

## Implementation Patterns & Key Details

### Updated Rule Interface (Task 2)

```typescript
// src/components/tags/RulesTab.tsx - Updated Rule interface

interface Rule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  conditions: RuleConditions;
  tag_id: string | null;      // NOW NULLABLE
  folder_id: string | null;   // NEW FIELD
  priority: number;
  is_active: boolean | null;
  times_applied: number | null;
  last_applied_at: string | null;
  created_at: string | null;
}

// Updated form state
const [formData, setFormData] = useState({
  name: "",
  description: "",
  rule_type: "title_exact",
  tag_id: "",           // Can be empty
  folder_id: "",        // NEW: Can be empty
  priority: 100,
  conditions: {} as RuleConditions,
});
```

### Folders Query Pattern (Task 3)

```typescript
// Add alongside existing tags query in RulesTab.tsx

interface Folder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

// Fetch folders
const { data: folders } = useQuery({
  queryKey: ["folders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("id, name, color, icon")
      .order("name");

    if (error) throw error;
    return data as Folder[];
  },
});
```

### Form UI Pattern (Task 4)

```tsx
// Updated form section - TWO optional selectors

{/* Actions Section - replaces single Tag selector */}
<div className="space-y-4 border-t pt-4">
  <Label className="text-sm font-medium">Actions (select at least one)</Label>

  {/* Tag Assignment (optional) */}
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">Assign Tag</Label>
    <Select
      value={formData.tag_id || "none"}
      onValueChange={(v) => setFormData({ ...formData, tag_id: v === "none" ? "" : v })}
    >
      <SelectTrigger>
        <SelectValue placeholder="No tag (optional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No tag</SelectItem>
        {tags?.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: tag.color || "#666" }} />
              {tag.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Folder Assignment (optional) */}
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">Assign to Folder</Label>
    <Select
      value={formData.folder_id || "none"}
      onValueChange={(v) => setFormData({ ...formData, folder_id: v === "none" ? "" : v })}
    >
      <SelectTrigger>
        <SelectValue placeholder="No folder (optional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No folder</SelectItem>
        {folders?.map((folder) => (
          <SelectItem key={folder.id} value={folder.id}>
            <div className="flex items-center gap-2">
              <RiFolderLine className="h-4 w-4" style={{ color: folder.color || "#666" }} />
              {folder.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>

{/* Validation in handleSubmit */}
const handleSubmit = () => {
  if (!formData.name) {
    toast.error("Please enter a rule name");
    return;
  }
  if (!formData.tag_id && !formData.folder_id) {
    toast.error("Please select at least a tag or folder to assign");
    return;
  }
  saveMutation.mutate(formData);
};
```

### Table Display Pattern (Task 5)

```tsx
// Updated table with Folder column

<TableHeader>
  <TableRow>
    <TableHead>Active</TableHead>
    <TableHead>Name</TableHead>
    <TableHead>Type</TableHead>
    <TableHead>Tag</TableHead>
    <TableHead>Folder</TableHead>  {/* NEW COLUMN */}
    <TableHead>Applied</TableHead>
    <TableHead>Actions</TableHead>
  </TableRow>
</TableHeader>

// Helper functions
const getFolderName = (folderId: string | null) => {
  if (!folderId) return null;
  return folders?.find((f) => f.id === folderId)?.name || "Unknown";
};

const getFolderColor = (folderId: string | null) => {
  if (!folderId) return "#666";
  return folders?.find((f) => f.id === folderId)?.color || "#666";
};

// In table body:
<TableCell>
  {rule.tag_id ? (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getTagColor(rule.tag_id) }} />
      {getTagName(rule.tag_id)}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</TableCell>
<TableCell>
  {rule.folder_id ? (
    <div className="flex items-center gap-2">
      <RiFolderLine className="h-4 w-4" style={{ color: getFolderColor(rule.folder_id) }} />
      {getFolderName(rule.folder_id)}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</TableCell>
```

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# After each file modification
npm run type-check          # TypeScript validation
npm run lint               # ESLint checks
npm run lint:fix           # Auto-fix if needed

# Expected: Zero errors
```

### Level 2: Database Migration

```bash
# Apply migration to local Supabase
npx supabase db push

# Verify folder_id column added to tag_rules
npx supabase db sql "SELECT column_name FROM information_schema.columns WHERE table_name = 'tag_rules' AND column_name = 'folder_id';"

# Verify constraint exists
npx supabase db sql "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'tag_rules' AND constraint_name = 'tag_rules_at_least_one_target';"

# Expected: Migration applies cleanly, column and constraint exist
```

### Level 3: Component Testing

```bash
# Start dev server
npm run dev

# Manual verification:
# 1. Navigate to Tags & Rules page
# 2. Click "Create Rule" - form should show BOTH tag and folder selectors
# 3. Create a rule with tag only - should work
# 4. Create a rule with folder only - should work
# 5. Create a rule with both tag and folder - should work
# 6. Try to create rule with neither - should show error
# 7. Verify table shows Tag AND Folder columns
# 8. Click "Apply Rules Now" - should apply both tag and folder assignments
```

### Level 4: Visual Verification

```bash
# Use Playwright to capture screenshots
# 1. RulesTab with updated Create Rule dialog showing both selectors
# 2. RulesTab table with Tag AND Folder columns populated
# 3. Rule with both tag and folder assigned

# Verify brand compliance:
# - Buttons use correct variants
# - Icons are Remix Icons (RiFolderLine for folders)
# - Colors follow brand system
```

---

## Final Validation Checklist

### Technical Validation
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with no errors
- [ ] Migration applies cleanly to Supabase
- [ ] CHECK constraint prevents rules with no tag or folder
- [ ] React Query cache invalidation works for both tags and folders

### Feature Validation (Part B - Unified Rules)
- [ ] tag_rules.folder_id column exists
- [ ] tag_rules.tag_id is now nullable
- [ ] RulesTab form shows BOTH tag and folder selectors
- [ ] Can create rule with tag only
- [ ] Can create rule with folder only
- [ ] Can create rule with BOTH tag and folder
- [ ] Cannot create rule with neither (validation error)
- [ ] Table shows Tag AND Folder columns
- [ ] Edit rule preserves both tag and folder selections
- [ ] Delete rule works with confirmation
- [ ] Toggle active/inactive works
- [ ] "Apply Rules Now" applies both tag AND folder assignments
- [ ] Stats (times_applied) increment correctly

### Feature Validation (Part A - Dialog Consolidation)
- [ ] Edit button shows inline form (no new dialog)
- [ ] Create button shows inline form (no new dialog)
- [ ] Save inline updates folder correctly
- [ ] Cancel inline resets form state
- [ ] Delete still shows confirmation AlertDialog

### Code Quality Validation
- [ ] No code duplication (single RulesTab handles both)
- [ ] Folders query added alongside tags query
- [ ] Helper functions for folder name/color lookups
- [ ] Query keys follow existing conventions

---

## Anti-Patterns to Avoid

- ❌ Don't create a separate FolderRulesTab - extend existing RulesTab
- ❌ Don't create a separate folder_rules table - extend tag_rules
- ❌ Don't forget to make tag_id nullable
- ❌ Don't forget CHECK constraint (at least one target required)
- ❌ Don't skip folder_assignments insert in apply_tag_rules
- ❌ Don't forget to update apply_tag_rules_to_untagged function too
- ❌ Don't create new icon patterns - use existing RiFolderLine

---

## Confidence Score: 92/100

**Rationale**:
- +35: Extending existing code is simpler than creating new
- +25: No new tables needed - just add column
- +20: Single component to maintain
- +10: Well-defined success criteria
- +5: DRY principle - no code duplication
- -3: Need to update stored procedure carefully
- -5: Part A (dialog consolidation) needs more design work

**One-pass implementation likelihood**: HIGH for Part B, MEDIUM for Part A

---

## Implementation Order Recommendation

1. **First**: Task 1 (Database migration) - Add folder_id column, update functions
2. **Second**: Tasks 2-3 (Types + Folders query) - TypeScript updates
3. **Third**: Task 4 (Form UI) - Add folder selector to form
4. **Fourth**: Task 5 (Table UI) - Add Folder column to table
5. **Fifth**: Tasks 6-7 (Save + Apply) - Wire up the functionality
6. **Optional**: Part A tasks - Dialog consolidation enhancements

Part B should be completed before Part A, as unified rules provide more user value than dialog UX improvements.

---

## Key Benefits of This Approach

1. **No code duplication** - Single RulesTab component
2. **No new tables** - Just extend existing tag_rules
3. **Unified UX** - Users manage all automation in one place
4. **Synergy** - One rule can assign both tag AND folder
5. **Easier maintenance** - One codebase to update
6. **Consistent patterns** - Same UI, just more options
