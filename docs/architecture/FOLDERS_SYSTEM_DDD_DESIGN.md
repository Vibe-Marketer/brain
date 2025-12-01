# FOLDERS System - DDD Design Specification

**Created:** 2025-11-30
**Type:** Domain-Driven Design Specification
**Status:** APPROVED FOR IMPLEMENTATION

---

## Domain Model

### Bounded Context: Call Organization

```
+-------------------------------------------------------------------+
|                    CALL ORGANIZATION CONTEXT                       |
+-------------------------------------------------------------------+
|                                                                    |
|  +------------------+          +------------------+                |
|  |     FOLDERS      |          |      TAGS        |                |
|  |  (Organization)  |          | (Classification) |                |
|  +------------------+          +------------------+                |
|         |                              |                           |
|         | 1:1                          | 1:2 (primary + secondary) |
|         v                              v                           |
|  +--------------------------------------------------+              |
|  |                    CALL                          |              |
|  |            (fathom_calls)                        |              |
|  +--------------------------------------------------+              |
|                                                                    |
+-------------------------------------------------------------------+
```

### Aggregates

#### 1. Folder Aggregate (Root: `Folder`)

```typescript
// Domain Entity
interface Folder {
  id: UUID;
  userId: UUID;
  name: string;
  parentId: UUID | null;
  depth: number;  // 0=root, 1, 2 (max)
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: DateTime;
  updatedAt: DateTime;

  // Computed
  path: string;  // "Clients / Acme Corp / Q4 Projects"
  childCount: number;
  callCount: number;
}

// Value Objects
interface FolderPath {
  segments: string[];  // ["Clients", "Acme Corp", "Q4 Projects"]
  toString(): string;
}

// Domain Rules
const FOLDER_RULES = {
  MAX_DEPTH: 2,  // 0, 1, 2 = 3 levels
  MAX_NAME_LENGTH: 100,
  UNFILED_FOLDER_NAME: "Unfiled",
};
```

#### 2. FolderAssignment Aggregate (Root: `FolderAssignment`)

```typescript
interface FolderAssignment {
  id: UUID;
  callRecordingId: BigInt;
  folderId: UUID | null;  // null = Unfiled
  userId: UUID;
  autoAssigned: boolean;
  assignedAt: DateTime;
  assignedBy: "user" | "rule" | "default";
}

// Invariant: ONE call can only be in ONE folder
// Enforced by UNIQUE constraint on call_recording_id
```

#### 3. FolderRule Aggregate (Root: `FolderRule`)

```typescript
interface FolderRule {
  id: UUID;
  userId: UUID;
  name: string;
  description?: string;
  priority: number;  // Lower = higher priority
  isActive: boolean;
  ruleType: RuleType;
  conditions: RuleConditions;
  folderId: UUID;
  timesApplied: number;
  lastAppliedAt?: DateTime;
  createdAt: DateTime;
  updatedAt: DateTime;
}

type RuleType =
  | "title_exact"       // Exact title match
  | "title_contains"    // Title contains substring
  | "title_regex"       // Title matches regex
  | "participant"       // Participant email pattern
  | "day_time"          // Specific day/time
  | "transcript_keyword"; // Keyword in transcript

interface RuleConditions {
  // For title_exact
  title?: string;

  // For title_contains
  contains?: string;

  // For title_regex
  pattern?: string;

  // For participant
  email_contains?: string;

  // For day_time
  day_of_week?: number;  // 0-6 (Sunday-Saturday)
  hour?: number;         // 0-23

  // For transcript_keyword
  keywords?: string[];
  search_chars?: number;  // How many chars to search
}
```

---

## Database Schema

### Tables

```sql
-- ============================================================================
-- FOLDERS SYSTEM TABLES
-- ============================================================================

-- 1. Folders (hierarchical structure)
CREATE TABLE call_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES call_folders(id) ON DELETE CASCADE,
  depth INT NOT NULL DEFAULT 0,
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT max_depth CHECK (depth <= 2),
  CONSTRAINT valid_name CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 100),
  UNIQUE (user_id, parent_id, name)
);

-- 2. Folder Assignments (1 call = 1 folder)
CREATE TABLE call_folder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT REFERENCES fathom_calls(recording_id)
    ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES call_folders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  auto_assigned BOOLEAN DEFAULT false,
  assigned_by TEXT DEFAULT 'user' CHECK (assigned_by IN ('user', 'rule', 'default')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: ONE folder per call
  UNIQUE (call_recording_id)
);

-- 3. Folder Rules (auto-assignment)
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

-- Indexes
CREATE INDEX idx_folders_user_id ON call_folders(user_id);
CREATE INDEX idx_folders_parent ON call_folders(parent_id);
CREATE INDEX idx_folders_user_parent ON call_folders(user_id, parent_id);
CREATE INDEX idx_folder_assignments_user ON call_folder_assignments(user_id);
CREATE INDEX idx_folder_assignments_folder ON call_folder_assignments(folder_id);
CREATE INDEX idx_folder_rules_active ON folder_rules(user_id, is_active, priority);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE call_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_folder_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_rules ENABLE ROW LEVEL SECURITY;

-- Folder policies
CREATE POLICY "Users can read own folders"
  ON call_folders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own folders"
  ON call_folders FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Folder assignment policies
CREATE POLICY "Users can read own folder assignments"
  ON call_folder_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own folder assignments"
  ON call_folder_assignments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role access
CREATE POLICY "Service role can manage folders"
  ON call_folders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage folder assignments"
  ON call_folder_assignments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage folder rules"
  ON folder_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Folder rules policies
CREATE POLICY "Users can manage own folder rules"
  ON folder_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Database Functions

```sql
-- Get folder path as array
CREATE OR REPLACE FUNCTION get_folder_path(p_folder_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE folder_path AS (
    SELECT id, name, parent_id, ARRAY[name] as path
    FROM call_folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT cf.id, cf.name, cf.parent_id, cf.name || fp.path
    FROM call_folders cf
    JOIN folder_path fp ON cf.id = fp.parent_id
  )
  SELECT path FROM folder_path WHERE parent_id IS NULL
$$;

-- Get folder with computed fields
CREATE OR REPLACE FUNCTION get_folder_with_stats(p_folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_id UUID,
  depth INT,
  path TEXT[],
  child_count BIGINT,
  call_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id,
    f.name,
    f.parent_id,
    f.depth,
    get_folder_path(f.id) as path,
    (SELECT COUNT(*) FROM call_folders WHERE parent_id = f.id) as child_count,
    (SELECT COUNT(*) FROM call_folder_assignments WHERE folder_id = f.id) as call_count
  FROM call_folders f
  WHERE f.id = p_folder_id
$$;

-- Apply folder rules to a call
CREATE OR REPLACE FUNCTION apply_folder_rules(
  p_recording_id BIGINT,
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  matched_rule_id UUID,
  matched_rule_name TEXT,
  folder_name TEXT,
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
  -- Get call details
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
  FOR v_rule IN
    SELECT r.*, cf.name as folder_name
    FROM folder_rules r
    JOIN call_folders cf ON r.folder_id = cf.id
    WHERE r.user_id = p_user_id AND r.is_active = true
    ORDER BY r.priority ASC
  LOOP
    v_matched := false;
    v_match_reason := NULL;

    CASE v_rule.rule_type
      WHEN 'title_exact' THEN
        IF LOWER(v_call.title) = LOWER(v_rule.conditions->>'title') THEN
          v_matched := true;
          v_match_reason := 'Title exactly matches: ' || (v_rule.conditions->>'title');
        END IF;

      WHEN 'title_contains' THEN
        IF LOWER(v_call.title) LIKE '%' || LOWER(v_rule.conditions->>'contains') || '%' THEN
          v_matched := true;
          v_match_reason := 'Title contains: ' || (v_rule.conditions->>'contains');
        END IF;

      WHEN 'title_regex' THEN
        IF v_call.title ~ (v_rule.conditions->>'pattern') THEN
          v_matched := true;
          v_match_reason := 'Title matches pattern: ' || (v_rule.conditions->>'pattern');
        END IF;

      WHEN 'day_time' THEN
        IF v_call.day_of_week = (v_rule.conditions->>'day_of_week')::int
           AND v_call.hour = (v_rule.conditions->>'hour')::int THEN
          v_matched := true;
          v_match_reason := 'Day/time matches';
        END IF;

      WHEN 'transcript_keyword' THEN
        DECLARE
          v_keywords TEXT[];
          v_keyword TEXT;
        BEGIN
          v_keywords := ARRAY(SELECT jsonb_array_elements_text(v_rule.conditions->'keywords'));
          FOREACH v_keyword IN ARRAY v_keywords
          LOOP
            IF LOWER(v_call.transcript_preview) LIKE '%' || LOWER(v_keyword) || '%' THEN
              v_matched := true;
              v_match_reason := 'Transcript contains: ' || v_keyword;
              EXIT;
            END IF;
          END LOOP;
        END;
    END CASE;

    IF v_matched THEN
      matched_rule_id := v_rule.id;
      matched_rule_name := v_rule.name;
      folder_name := v_rule.folder_name;
      match_reason := v_match_reason;
      RETURN NEXT;

      IF NOT p_dry_run THEN
        -- Assign to folder (upsert - replace existing assignment)
        INSERT INTO call_folder_assignments (call_recording_id, folder_id, user_id, auto_assigned, assigned_by)
        VALUES (p_recording_id, v_rule.folder_id, p_user_id, true, 'rule')
        ON CONFLICT (call_recording_id)
        DO UPDATE SET folder_id = EXCLUDED.folder_id,
                      auto_assigned = true,
                      assigned_by = 'rule',
                      assigned_at = NOW();

        UPDATE folder_rules
        SET times_applied = times_applied + 1, last_applied_at = NOW()
        WHERE id = v_rule.id;
      END IF;

      RETURN;  -- Only apply first matching rule
    END IF;
  END LOOP;
END;
$$;

-- Trigger to validate folder depth on insert/update
CREATE OR REPLACE FUNCTION validate_folder_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT depth INTO parent_depth
    FROM call_folders WHERE id = NEW.parent_id;

    NEW.depth := COALESCE(parent_depth, -1) + 1;

    IF NEW.depth > 2 THEN
      RAISE EXCEPTION 'Maximum folder depth exceeded (3 levels max)';
    END IF;
  ELSE
    NEW.depth := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_folder_depth
  BEFORE INSERT OR UPDATE ON call_folders
  FOR EACH ROW EXECUTE FUNCTION validate_folder_depth();
```

---

## API Design

### REST Endpoints (Edge Functions)

#### Folders CRUD

```typescript
// GET /functions/v1/folders
// List all folders for user (hierarchical tree)
interface ListFoldersResponse {
  folders: FolderTreeNode[];
  unfiled_count: number;
}

interface FolderTreeNode {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  depth: number;
  call_count: number;
  children: FolderTreeNode[];
}

// POST /functions/v1/folders
// Create new folder
interface CreateFolderRequest {
  name: string;
  parent_id?: string;
  icon?: string;
  color?: string;
}

// PATCH /functions/v1/folders/:id
// Update folder
interface UpdateFolderRequest {
  name?: string;
  parent_id?: string;  // Move folder
  icon?: string;
  color?: string;
  sort_order?: number;
}

// DELETE /functions/v1/folders/:id
// Delete folder (calls move to Unfiled, not deleted)
```

#### Folder Assignments

```typescript
// POST /functions/v1/folder-assignments
// Assign call(s) to folder
interface AssignToFolderRequest {
  recording_ids: number[];
  folder_id: string | null;  // null = Unfiled
}

// POST /functions/v1/folder-assignments/apply-rules
// Apply folder rules to uncategorized calls
interface ApplyFolderRulesRequest {
  dry_run?: boolean;
  limit?: number;
}
```

#### Folder Rules

```typescript
// GET /functions/v1/folder-rules
// POST /functions/v1/folder-rules
// PATCH /functions/v1/folder-rules/:id
// DELETE /functions/v1/folder-rules/:id
// Same pattern as existing tag rules
```

---

## UI Components

### Component Tree

```
src/components/folders/
├── FolderTree.tsx           # Hierarchical folder navigation
├── FolderTreeItem.tsx       # Single folder in tree
├── FolderPicker.tsx         # Dropdown to select folder
├── FolderBadge.tsx          # Folder display badge
├── CreateFolderDialog.tsx   # Create new folder modal
├── EditFolderDialog.tsx     # Edit folder modal
├── FolderRulesTab.tsx       # Rules management tab
├── FolderRuleRow.tsx        # Single rule display
└── CreateFolderRuleDialog.tsx # Create rule modal
```

### FolderTree Component

```tsx
interface FolderTreeProps {
  onSelect: (folderId: string | null) => void;
  selectedId: string | null;
  showCounts?: boolean;
  allowCreate?: boolean;
}

// Usage in sidebar
<FolderTree
  onSelect={setSelectedFolder}
  selectedId={selectedFolder}
  showCounts={true}
  allowCreate={true}
/>
```

### FolderPicker Component

```tsx
interface FolderPickerProps {
  value: string | null;
  onChange: (folderId: string | null) => void;
  excludeId?: string;  // Can't move folder into itself
  allowCreate?: boolean;
}

// Usage in call detail
<FolderPicker
  value={call.folder_id}
  onChange={handleFolderChange}
  allowCreate={true}
/>
```

---

## Integration Points

### 1. Transcript Library Table

Add folder column and filter:

```tsx
// Column
<TableHead>Folder</TableHead>
<TableCell>
  <FolderBadge folder={call.folder} />
</TableCell>

// Filter
<FolderFilterPopover
  selectedFolder={filter.folderId}
  onChange={(id) => setFilter({ ...filter, folderId: id })}
/>
```

### 2. Call Detail View

Add folder picker:

```tsx
// In CallOverviewTab
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Folder:</span>
  <FolderPicker
    value={call.folder_id}
    onChange={handleFolderChange}
  />
</div>
```

### 3. Sync Process

After syncing new calls, apply folder rules:

```typescript
// In sync-meetings function
// After inserting call...
await supabase.rpc('apply_folder_rules', {
  p_recording_id: recordingId,
  p_user_id: userId,
  p_dry_run: false
});
```

### 4. Bulk Actions

Add "Move to Folder" bulk action:

```tsx
// In BulkActionToolbar
<Button onClick={() => setShowFolderPicker(true)}>
  Move to Folder
</Button>

<BulkFolderAssignDialog
  open={showFolderPicker}
  recordingIds={selectedIds}
  onComplete={handleComplete}
/>
```

---

## Views & Queries

### Folder Tree View

```sql
CREATE OR REPLACE VIEW folder_tree AS
SELECT
  f.id,
  f.user_id,
  f.name,
  f.parent_id,
  f.depth,
  f.icon,
  f.color,
  f.sort_order,
  f.created_at,
  get_folder_path(f.id) as path,
  (SELECT COUNT(*) FROM call_folders WHERE parent_id = f.id) as child_count,
  (SELECT COUNT(*) FROM call_folder_assignments WHERE folder_id = f.id) as call_count
FROM call_folders f;
```

### Calls with Folders View

```sql
CREATE OR REPLACE VIEW calls_with_folders AS
SELECT
  fc.*,
  cfa.folder_id,
  cf.name as folder_name,
  get_folder_path(cf.id) as folder_path
FROM fathom_calls fc
LEFT JOIN call_folder_assignments cfa ON fc.recording_id = cfa.call_recording_id
LEFT JOIN call_folders cf ON cfa.folder_id = cf.id;
```

---

## Migration Strategy

### Phase 2 Migration Steps

1. Create `call_folders` table
2. Create `call_folder_assignments` table
3. Create `folder_rules` table
4. Add RLS policies
5. Create views and functions
6. Update `sync-meetings` to apply folder rules

### Default "Unfiled" Handling

Calls without folder assignment are considered "Unfiled":
- No need for a special "Unfiled" folder record
- Query: `WHERE folder_id IS NULL`
- UI shows "Unfiled" as a virtual folder at top of tree

---

## Testing Plan

1. **Unit Tests**
   - Folder CRUD operations
   - Depth validation (max 3 levels)
   - Rule matching logic

2. **Integration Tests**
   - Folder assignment on call sync
   - Rule application priority
   - Moving calls between folders

3. **E2E Tests**
   - Create folder hierarchy
   - Assign calls via drag-drop
   - Filter by folder
   - Bulk folder operations

---

*End of DDD Design Specification*
