# Teams Feature Specification

**Created:** 2025-12-08
**Status:** Planning / Future Feature
**Priority:** Post-MVP (After Folders)
**Target:** B2B/Enterprise Tier

---

## Executive Summary

Teams enables organizations (sales teams, coaching businesses, companies) to:
1. Have multiple users under one account
2. Share access to team members' call recordings
3. Organize calls with shared folders
4. Run custom AI agents/frameworks against calls
5. Manage team-wide analytics and insights

---

## Key Capability: Same Call in Multiple User Profiles

### Current Architecture

```sql
-- Current: Call belongs to ONE user
fathom_calls
├── recording_id (PK)
├── user_id (FK) ──────► Single owner
├── ...call data...

-- Current: Folder belongs to ONE user
folders
├── id (PK)
├── user_id (FK) ──────► Single owner
├── ...folder data...
```

### Teams Architecture: Calls Accessible by Multiple Users

```sql
-- Enhanced: Call has owner BUT can be accessed by team members
fathom_calls
├── recording_id (PK)
├── user_id (FK) ──────► Original owner/recorder
├── team_id (FK, nullable) ──► Team association
├── visibility ('private' | 'team' | 'company')

-- New: Team membership defines who can see what
team_members
├── team_id (FK)
├── user_id (FK)
├── role ('owner' | 'admin' | 'member' | 'viewer')
├── can_see_all_calls BOOLEAN
├── can_run_ai_agents BOOLEAN
```

### How "Same Call in Multiple Profiles" Works

**Scenario:** Sarah (sales manager) wants to see all calls from her 5 reps

```
Team: "Acme Sales"
├── Sarah (Owner) - can see ALL team calls
├── John (Member) - his calls visible to Sarah
├── Jane (Member) - her calls visible to Sarah
├── Mike (Member) - his calls visible to Sarah
└── Lisa (Member) - her calls visible to Sarah
```

**Implementation:** NOT duplicating calls, but FILTERING by team membership

```sql
-- Sarah's view (team owner/admin)
SELECT * FROM fathom_calls
WHERE user_id = sarah.id  -- Her own calls
   OR (team_id = 'acme-sales' AND visibility IN ('team', 'company'))

-- John's view (member)
SELECT * FROM fathom_calls
WHERE user_id = john.id  -- Only his calls (unless team settings allow more)
```

---

## Schema Evolution Path

### Phase 1: Current (MVP) - Individual Users Only

```sql
-- No changes needed, current schema works
folders.user_id        -- Individual ownership
folder_assignments     -- Per-user assignments
```

### Phase 2: Teams Introduction

```sql
-- New Tables
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,           -- team URL identifier
  owner_user_id UUID REFERENCES auth.users(id),
  plan_type TEXT DEFAULT 'team_starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',  -- owner, admin, member, viewer
  permissions JSONB DEFAULT '{}',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
);

-- Modify existing tables (ADDITIVE - no breaking changes)
ALTER TABLE fathom_calls ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE fathom_calls ADD COLUMN visibility TEXT DEFAULT 'private';

ALTER TABLE folders ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE folders ADD COLUMN visibility TEXT DEFAULT 'private';
```

### Phase 3: Custom AI Frameworks

```sql
CREATE TABLE team_ai_frameworks (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  description TEXT,
  framework_type TEXT,  -- 'sales_methodology', 'coaching', 'custom'
  prompt_template TEXT,
  scoring_criteria JSONB,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE call_framework_results (
  id UUID PRIMARY KEY,
  call_recording_id BIGINT REFERENCES fathom_calls(recording_id),
  framework_id UUID REFERENCES team_ai_frameworks(id),
  results JSONB,
  score DECIMAL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by UUID REFERENCES auth.users(id)
);
```

---

## Team Roles & Permissions

| Role | See Own Calls | See Team Calls | Create Folders | Run AI | Manage Team |
|------|---------------|----------------|----------------|--------|-------------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Member | ✅ | ✅ (based on settings) | ✅ (team folders) | ✅ | ❌ |
| Viewer | ✅ | ✅ (view only) | ❌ | ❌ | ❌ |

---

## Folder Visibility Model

### Current (MVP)
```
User Folders (private)
├── Client A
├── Client B
└── Archive
```

### With Teams
```
My Folders (private to me)
├── Client A
└── Personal Notes

Team Folders (shared with team)
├── 📁 Q4 2024 Deals (team visibility)
├── 📁 Training Library (team visibility)
└── 📁 Coaching Sessions (team visibility)

Company Folders (visible to all)
├── 📁 Best Practices
└── 📁 Onboarding Materials
```

### Visibility Rules

```typescript
type FolderVisibility = 'private' | 'team' | 'company';

// Private: Only creator can see
// Team: All team members can see
// Company: All users in the organization can see

interface Folder {
  id: string;
  user_id: string;      // Creator
  team_id?: string;     // null = personal folder
  visibility: FolderVisibility;
  // ... other fields
}
```

---

## RLS Policy Evolution

### Current (Individual)
```sql
-- Users see only their folders
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);
```

### With Teams
```sql
-- Users see: their folders + team folders they belong to
CREATE POLICY "Users can view accessible folders"
  ON folders FOR SELECT
  USING (
    auth.uid() = user_id  -- Own folders
    OR (
      team_id IS NOT NULL
      AND team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid()
      )
      AND visibility IN ('team', 'company')
    )
  );
```

---

## Custom AI Agents/Frameworks

### Use Cases

1. **Sales Methodologies**
   - MEDDIC scoring
   - BANT qualification
   - Challenger Sale analysis
   - Custom company methodology

2. **Coaching & Training**
   - Talk/listen ratio
   - Question quality scoring
   - Objection handling analysis
   - Discovery depth scoring

3. **Custom Frameworks**
   - Team-specific rubrics
   - Industry-specific analysis
   - Compliance checking
   - Quality assurance scoring

### Framework Configuration

```typescript
interface AIFramework {
  id: string;
  team_id: string;
  name: string;
  description: string;

  // Analysis Configuration
  prompt_template: string;  // The actual AI prompt
  model_preference: string; // 'gpt-4o', 'claude-sonnet', etc.

  // Scoring
  scoring_criteria: {
    dimensions: Array<{
      name: string;        // "Discovery Quality"
      description: string;
      weight: number;      // 0-1
      rubric: string;      // Scoring guidelines
    }>;
    total_points: number;
  };

  // Output Format
  output_format: 'score' | 'report' | 'both';
  include_recommendations: boolean;
}
```

### Example: MEDDIC Framework

```typescript
const meddic_framework: AIFramework = {
  id: 'meddic-standard',
  team_id: 'acme-sales',
  name: 'MEDDIC Analysis',
  description: 'Analyze sales calls using MEDDIC methodology',

  prompt_template: `
    Analyze this sales call transcript using the MEDDIC framework.

    Score each dimension 1-5:
    - Metrics: Did rep establish quantifiable business value?
    - Economic Buyer: Was decision-maker identified?
    - Decision Criteria: Are requirements clear?
    - Decision Process: Is the buying process understood?
    - Identify Pain: Were pain points uncovered?
    - Champion: Is there an internal advocate?

    Provide specific evidence from the call for each score.
  `,

  scoring_criteria: {
    dimensions: [
      { name: 'Metrics', weight: 0.2 },
      { name: 'Economic Buyer', weight: 0.15 },
      { name: 'Decision Criteria', weight: 0.15 },
      { name: 'Decision Process', weight: 0.15 },
      { name: 'Identify Pain', weight: 0.2 },
      { name: 'Champion', weight: 0.15 }
    ],
    total_points: 30
  }
};
```

---

## Pricing Tiers (Suggested)

| Tier | Users | Calls/mo | AI Credits | Custom Frameworks | Price |
|------|-------|----------|------------|-------------------|-------|
| **Solo** | 1 | Unlimited | 100 | 0 | $29/mo |
| **Team** | Up to 5 | Unlimited | 500 | 3 | $99/mo |
| **Business** | Up to 20 | Unlimited | 2000 | 10 | $299/mo |
| **Enterprise** | Unlimited | Unlimited | Unlimited | Unlimited | Custom |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `teams` table
- [ ] Create `team_members` table
- [ ] Add `team_id` to `folders` (nullable)
- [ ] Basic team CRUD operations
- [ ] Team creation UI

### Phase 2: Invitations (Week 2-3)
- [ ] Create `team_invitations` table
- [ ] Email invitation flow
- [ ] Accept/decline invitation UI
- [ ] Role assignment

### Phase 3: Shared Folders (Week 3-4)
- [ ] Add visibility field to folders
- [ ] Update RLS policies
- [ ] Team folder UI
- [ ] Folder sharing controls

### Phase 4: Call Visibility (Week 4-5)
- [ ] Add team_id/visibility to calls
- [ ] Update call listing queries
- [ ] Team call view
- [ ] Privacy controls

### Phase 5: AI Frameworks (Week 5-7)
- [ ] Create framework tables
- [ ] Framework builder UI
- [ ] Run framework on call
- [ ] Results display
- [ ] Team-wide analytics

---

## Migration Strategy from Folders MVP

The Folders feature is being designed to be **Teams-ready**:

1. **Current `user_id`** - Stays as individual owner
2. **Future `team_id`** - Added as nullable column
3. **Future `visibility`** - Added with default 'private'

**No breaking changes required.** All existing folders continue to work as private individual folders. Teams is purely additive.

---

## Questions to Resolve Before Building Teams

1. **Billing Model:** Per-seat or per-team flat rate?
2. **Call Ownership:** Can calls be "transferred" to team ownership?
3. **Departure Handling:** What happens to calls when member leaves team?
4. **Multi-Team:** Can a user belong to multiple teams?
5. **SSO/SAML:** Required for enterprise tier?
6. **API Access:** Team-level API keys?

---

## Appendix: Fathom Integration Consideration

Fathom recordings are tied to individual accounts. Teams feature needs to handle:

1. **Each rep has own Fathom account** - Sync pulls to their user_id
2. **Team association** - Calls tagged with team_id after sync
3. **Visibility rules** - RLS determines who can query which calls

The Fathom sync doesn't change - only the visibility/querying layer.
