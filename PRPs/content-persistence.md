# PRP: Content Persistence

**Created**: 2026-01-11
**Status**: Ready for Implementation
**Confidence Score**: 9/10

---

## Goal

**Feature Goal**: Persist generated hooks and content items (posts/emails) to the database when the Content Hub wizard completes, enabling users to access their generated content in the Content Libraries.

**Deliverable**:
- Save logic in wizard completion flow that persists hooks to `hooks` table
- Save logic that persists generated posts and emails to `content_items` table
- Proper error handling with user feedback via toast notifications

**Success Definition**:
- After completing the wizard, generated content appears in Content Libraries (Hooks, Posts, Emails tabs)
- Counter metrics on Content Hub main page show accurate counts
- Content persists across page refreshes and sessions

---

## User Persona

**Target User**: Business professional using CallVault to generate marketing content from call transcripts

**Use Case**: User runs the Call Content Generator wizard, selects calls, generates hooks, and creates posts/emails. Upon clicking "Done", all generated content should be saved permanently.

**User Journey**:
1. User navigates to Content Hub → Content Generators → Call Content Generator
2. Selects calls and business profile (Step 1)
3. Watches AI analyze calls and extract insights (Step 2)
4. Generates hooks, selects favorites (Step 3)
5. Views generated posts and emails (Step 4)
6. Clicks "Done" → **Content is saved to database** ← THIS IS THE GAP
7. User can access saved content in Content Libraries

**Pain Points Addressed**:
- Currently generated content disappears after wizard closes
- No way to access previously generated content
- Content counters always show 0

---

## Why

- **Business value**: Users invest time generating content; losing it destroys value and trust
- **Integration**: Connects wizard output to Content Libraries feature
- **Problems solved**: Content loss, inability to build a content library over time

---

## What

When user clicks "Done" on Step 4 (Create Content):
1. All generated hooks (selected ones) are saved to `hooks` table
2. For each hook, the associated post and email are saved to `content_items` table
3. Success toast notification confirms save
4. User is redirected to Content Hub with updated counters

### Success Criteria

- [ ] Hooks table contains generated hooks with all metadata (emotion_category, virality_score, topic_hint)
- [ ] content_items table contains posts with `content_type='post'`
- [ ] content_items table contains emails with `content_type='email'` and `email_subject` set
- [ ] Foreign key relationships maintained (`content_items.hook_id` → `hooks.id`)
- [ ] RLS policies respected (user_id matches authenticated user)
- [ ] Content Libraries display saved content correctly
- [ ] Error handling shows toast on failure without crashing wizard

---

## All Needed Context

### Context Completeness Check

_Validated: This PRP contains complete database schemas, exact integration points, code patterns from the codebase, and step-by-step implementation tasks._

### Documentation & References

```yaml
# MUST READ - Include these in your context window

- file: src/stores/contentWizardStore.ts
  why: Contains all data structures and state selectors for generated content
  pattern: |
    - generated_content: Record<string, StreamingContent>
    - generated_hooks: Hook[]
    - selected_hook_ids: string[]
    - markContentSaved(hookId: string) action
  gotcha: Data is in-memory only; lost on page refresh if not persisted

- file: src/components/content-hub/CallContentWizard.tsx
  why: Contains the onComplete callback trigger point (lines 64-68)
  pattern: |
    const handleNext = useCallback(() => {
      if (isLastStep && onComplete) {
        onComplete();  // <-- ADD SAVE LOGIC HERE
      } else {
        nextStep();
      }
    }, [isLastStep, onComplete, nextStep]);
  gotcha: onComplete is called AFTER content generation is complete

- file: supabase/migrations/20260111000003_create_hooks_table.sql
  why: Defines hooks table schema and constraints
  pattern: Required fields are user_id and hook_text; optional fields include recording_id, insight_ids[], emotion_category, virality_score, topic_hint, is_starred, status
  gotcha: Composite FK (recording_id, user_id) → fathom_calls; use DEFERRABLE for flexibility

- file: supabase/migrations/20260111000004_create_content_items_table.sql
  why: Defines content_items table schema and constraints
  pattern: Required fields are user_id, content_type ('post'|'email'), content_text; email_subject only for emails
  gotcha: Constraint prevents email_subject on posts; trigger auto-sets used_at when status='used'

- file: src/hooks/useChatSession.ts
  why: Shows insert pattern with .insert().select().single() and error handling
  pattern: Lines 130-142 for single insert, lines 166-187 for duplicate checking
  gotcha: Always check error immediately after operation

- file: supabase/functions/teams/index.ts
  why: Shows rollback pattern for parent-child inserts (lines 149-172)
  pattern: Create parent, get ID, create children; rollback parent if children fail
  gotcha: Manual transaction-like behavior since Supabase client doesn't support transactions

- url: https://supabase.com/docs/reference/javascript/insert
  why: Official batch insert documentation
  critical: Pass array for multi-row insert; chain .select() to return inserted data
```

### Current Codebase tree (relevant sections)

```bash
src/
├── components/content-hub/
│   ├── CallContentWizard.tsx          # Contains onComplete trigger
│   └── wizard/
│       └── CreateContentStep.tsx      # Step 4 - where content generation completes
├── stores/
│   └── contentWizardStore.ts          # All wizard state including generated content
├── hooks/
│   └── useChatSession.ts              # Reference insert patterns
└── integrations/supabase/
    └── client.ts                      # Supabase client instance

supabase/
├── migrations/
│   ├── 20260111000002_create_insights_table.sql
│   ├── 20260111000003_create_hooks_table.sql      # hooks schema
│   └── 20260111000004_create_content_items_table.sql  # content_items schema
```

### Desired Codebase tree with files to be added

```bash
src/
├── components/content-hub/
│   └── CallContentWizard.tsx          # MODIFY: Add save logic in onComplete
├── lib/
│   └── content-persistence.ts         # CREATE: Save functions for hooks & content_items
└── stores/
    └── contentWizardStore.ts          # MODIFY: Add saveAllContent action
```

### Known Gotchas of our codebase & Library Quirks

```typescript
// CRITICAL: User ID handling in frontend
// Use supabase.auth.getUser() to get current user, NOT auth.uid()
// Pattern from src/hooks/useChatSession.ts

// CRITICAL: Hooks table has composite FK (recording_id, user_id)
// If recording_id is provided, it must match a valid fathom_calls record for that user
// Most wizard hooks won't have recording_id (null is fine)

// CRITICAL: Email content constraint
// content_items with content_type='post' MUST have email_subject=null
// content_items with content_type='email' CAN have email_subject set

// GOTCHA: Batch insert size
// For large batches, use chunks of 500 to avoid statement timeouts
// Not critical here (typically 5-10 hooks per wizard run)
```

---

## Implementation Blueprint

### Data models and structure

```typescript
// From contentWizardStore.ts - existing types (DO NOT RECREATE)
interface StreamingContent {
  hook_id: string;
  social_post_text: string;
  email_subject: string;
  email_body_opening: string;
  is_streaming: boolean;
  is_saved: boolean;
}

interface Hook {
  id: string;
  hook_text: string;
  topic_hint: string | null;
  emotion_category: EmotionCategory;
  virality_score: number;
  user_id: string;
  recording_id: number | null;
}

// NEW: Insert types for database operations
interface HookInsert {
  user_id: string;
  hook_text: string;
  recording_id?: number | null;
  insight_ids?: string[];
  emotion_category?: 'anger_outrage' | 'awe_surprise' | 'social_currency' |
                     'relatable' | 'practical_value' | 'humor_sharp' | 'neutral' | null;
  virality_score?: number | null;
  topic_hint?: string | null;
  is_starred?: boolean;
  status?: 'generated' | 'selected' | 'archived';
}

interface ContentItemInsert {
  user_id: string;
  hook_id: string;
  content_type: 'post' | 'email';
  content_text: string;
  email_subject?: string | null;  // Only for emails
  status?: 'draft' | 'used';
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/lib/content-persistence.ts
  - IMPLEMENT: saveHooksToDatabase(hooks: Hook[], userId: string) function
  - IMPLEMENT: saveContentItemsToDatabase(items: ContentItemInsert[]) function
  - IMPLEMENT: saveWizardContent(wizardState, userId) orchestration function
  - FOLLOW pattern: src/hooks/useChatSession.ts (insert with error handling)
  - NAMING: snake_case for database fields, camelCase for function names
  - PLACEMENT: lib/ directory for utility functions
  - ERROR HANDLING: Return { success: boolean, savedHookIds: string[], errors: string[] }

Task 2: MODIFY src/stores/contentWizardStore.ts
  - ADD action: saveAllContent(): Promise<SaveResult>
  - IMPLEMENT: Call saveWizardContent from Task 1
  - IMPLEMENT: Update is_saved flags for each hook after successful save
  - FOLLOW pattern: Existing async actions in store (fetchProfiles pattern)
  - DEPENDENCIES: Import saveWizardContent from Task 1

Task 3: MODIFY src/components/content-hub/CallContentWizard.tsx
  - MODIFY: handleNext to call saveAllContent before onComplete
  - ADD: Loading state during save operation
  - ADD: Toast notification for success/failure
  - FOLLOW pattern: Existing toast usage in codebase
  - DEPENDENCIES: Uses store action from Task 2

Task 4: VERIFY database tables exist
  - RUN: supabase db push (if not already applied)
  - VERIFY: hooks table has correct schema
  - VERIFY: content_items table has correct schema
  - CHECK: RLS policies allow authenticated user inserts
```

### Implementation Patterns & Key Details

```typescript
// Task 1: content-persistence.ts

import { supabase } from '@/integrations/supabase/client';

interface SaveResult {
  success: boolean;
  savedHookIds: string[];
  savedContentIds: string[];
  errors: string[];
}

export async function saveWizardContent(
  selectedHookIds: string[],
  generatedHooks: Hook[],
  generatedContent: Record<string, StreamingContent>
): Promise<SaveResult> {
  const result: SaveResult = {
    success: true,
    savedHookIds: [],
    savedContentIds: [],
    errors: [],
  };

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ...result, success: false, errors: ['Not authenticated'] };
  }

  // Filter to only selected hooks
  const hooksToSave = generatedHooks.filter(h => selectedHookIds.includes(h.id));

  // Save hooks first (parent records)
  for (const hook of hooksToSave) {
    const { data: savedHook, error: hookError } = await supabase
      .from('hooks')
      .insert({
        user_id: user.id,
        hook_text: hook.hook_text,
        recording_id: hook.recording_id || null,
        emotion_category: hook.emotion_category || null,
        virality_score: hook.virality_score || null,
        topic_hint: hook.topic_hint || null,
        status: 'selected',  // Mark as selected since user chose this hook
      })
      .select('id')
      .single();

    if (hookError) {
      result.errors.push(`Hook save failed: ${hookError.message}`);
      result.success = false;
      continue;
    }

    result.savedHookIds.push(savedHook.id);

    // Get content for this hook
    const content = generatedContent[hook.id];
    if (!content) continue;

    // Save social post
    if (content.social_post_text) {
      const { data: savedPost, error: postError } = await supabase
        .from('content_items')
        .insert({
          user_id: user.id,
          hook_id: savedHook.id,  // Use NEW database ID, not client-side ID
          content_type: 'post',
          content_text: content.social_post_text,
          email_subject: null,  // MUST be null for posts (constraint)
          status: 'draft',
        })
        .select('id')
        .single();

      if (postError) {
        result.errors.push(`Post save failed: ${postError.message}`);
      } else {
        result.savedContentIds.push(savedPost.id);
      }
    }

    // Save email
    if (content.email_body_opening) {
      const { data: savedEmail, error: emailError } = await supabase
        .from('content_items')
        .insert({
          user_id: user.id,
          hook_id: savedHook.id,
          content_type: 'email',
          content_text: content.email_body_opening,
          email_subject: content.email_subject || 'Untitled Email',
          status: 'draft',
        })
        .select('id')
        .single();

      if (emailError) {
        result.errors.push(`Email save failed: ${emailError.message}`);
      } else {
        result.savedContentIds.push(savedEmail.id);
      }
    }
  }

  return result;
}

// Task 3: CallContentWizard.tsx modification pattern

const handleNext = useCallback(async () => {
  if (isLastStep) {
    // Save content before completing
    const saveResult = await saveAllContent();

    if (saveResult.success) {
      toast({
        title: 'Content Saved!',
        description: `Saved ${saveResult.savedHookIds.length} hooks and ${saveResult.savedContentIds.length} content items to your library.`,
      });
    } else {
      toast({
        title: 'Save Error',
        description: saveResult.errors.join(', '),
        variant: 'destructive',
      });
    }

    onComplete?.();
  } else {
    nextStep();
  }
}, [isLastStep, onComplete, nextStep, saveAllContent, toast]);
```

### Integration Points

```yaml
DATABASE:
  - tables: hooks, content_items (already created via migrations)
  - verify: supabase db push has been run

STORE:
  - add to: src/stores/contentWizardStore.ts
  - pattern: Add saveAllContent async action using saveWizardContent

COMPONENT:
  - modify: src/components/content-hub/CallContentWizard.tsx
  - pattern: Call saveAllContent in handleNext when isLastStep

TOAST:
  - use: existing useToast hook from @/hooks/use-toast
  - pattern: Success toast green, error toast red (destructive variant)
```

---

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# After creating/modifying files
npm run lint -- --fix
npm run typecheck

# Expected: Zero errors
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test the save function works with mock data
# Create test file if needed: src/lib/__tests__/content-persistence.test.ts

npm run test -- content-persistence
```

### Level 3: Integration Testing (System Validation)

```bash
# Start dev server
npm run dev

# Manual test flow:
# 1. Navigate to http://localhost:8080/content/generators/call-content
# 2. Select 1 call, continue through wizard
# 3. Generate hooks, select at least 1
# 4. Let content generate, click Done
# 5. Check Content Libraries for saved content

# Verify in Supabase:
# SELECT * FROM hooks ORDER BY created_at DESC LIMIT 5;
# SELECT * FROM content_items ORDER BY created_at DESC LIMIT 10;
```

### Level 4: Browser Testing with Chrome DevTools MCP

```bash
# Use Chrome DevTools MCP to:
# 1. Navigate to wizard
# 2. Complete flow
# 3. Check network requests for POST to /rest/v1/hooks and /rest/v1/content_items
# 4. Verify 201 Created responses
# 5. Navigate to Content Libraries
# 6. Verify content appears
```

---

## Final Validation Checklist

### Technical Validation

- [ ] All TypeScript compiles without errors
- [ ] Lint passes with no warnings
- [ ] Network requests show 201 Created for inserts
- [ ] No console errors during save operation

### Feature Validation

- [ ] Hooks appear in Hooks Library after wizard completion
- [ ] Posts appear in Posts Library after wizard completion
- [ ] Emails appear in Emails Library after wizard completion
- [ ] Content Hub counters update correctly
- [ ] Toast notification shows success message
- [ ] Error handling works (test with network offline)

### Code Quality Validation

- [ ] Follows existing insert patterns from useChatSession.ts
- [ ] User ID obtained from supabase.auth.getUser()
- [ ] Error messages are user-friendly
- [ ] No console.log statements left in production code

### Edge Cases

- [ ] Works with 1 hook selected
- [ ] Works with 5+ hooks selected
- [ ] Handles missing email_subject gracefully
- [ ] Handles empty social_post_text gracefully
- [ ] Partial save failure shows informative error

---

## Anti-Patterns to Avoid

- **Don't use auth.uid()** - Use supabase.auth.getUser() instead
- **Don't skip error checking** - Check every insert response
- **Don't use client-side hook IDs as FK** - Use returned database IDs after insert
- **Don't set email_subject for posts** - Constraint will fail
- **Don't assume all hooks have content** - Check before saving
- **Don't batch insert without parent-child ordering** - Hooks must be saved before content_items

---

## Future Enhancements (Out of Scope)

- Hook Regeneration Enhancement: Append new hooks instead of replacing
- Content Library CRUD: Edit, delete, and manage saved content
- Duplicate Detection: Prevent saving identical hooks
- Bulk Export: Export saved content to CSV/JSON
