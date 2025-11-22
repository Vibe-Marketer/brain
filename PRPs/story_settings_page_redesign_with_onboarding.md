---
name: Settings Page Redesign with Role-Based Onboarding
description: Complete redesign of Settings page with Tremor-style layout, role-based tabs, mandatory Fathom integration wizard, and admin user management
created: 2025-11-20
complexity: HIGH
affected_systems: Settings UI, Database Schema, Auth/Roles, Onboarding Flow, Integration Management
---

## Goal

**Feature Goal**: Transform Settings page into a clean, role-based interface with Tremor-style two-column layout, mandatory step-by-step Fathom integration wizard, and admin user management capabilities.

**Deliverable**:
- Redesigned Settings page with 5 role-based tabs (Account, Users, Billing, Integrations, Admin)
- Mandatory 5-step Fathom integration wizard modal
- Role-based access control (FREE, TEAM, ADMIN)
- Admin user management interface

**Success Definition**:
- New users complete Fathom integration before accessing app (blocking onboarding)
- Settings page uses clean two-column layout per brand guidelines (90% no-card rule)
- TEAM users can manage their team members
- ADMIN user (andrew@aisimple.co) can view all system users
- Zero card containers on settings page (except What's New and Delete Account)

## User Persona

**Primary Users**:
1. **New Users (FREE role)**: Need seamless, guided Fathom setup on first login
2. **Team Leads (TEAM role)**: Need to add/manage team members
3. **Admin (ADMIN role)**: Need full system user visibility and management

**Use Cases**:
- **First-time User**: Logs in → forced through 5-step Fathom wizard → gains app access
- **Team Lead**: Manages team members via Users tab
- **Admin**: Views all users, connection status, usage metrics

**Pain Points Addressed**:
- Current settings page is cluttered with card containers (violates 90% rule)
- No guided onboarding - users confused about Fathom setup
- No distinction between OAuth (required) and API key (bulk import)
- No role-based features (teams, admin management)

## Why

- **Brand Compliance**: Current page violates brand guidelines with excessive card usage
- **User Experience**: Tremor-style two-column layout is cleaner, more professional, easier to scan
- **Onboarding**: Mandatory wizard ensures users properly connect Fathom before using app
- **Scalability**: Role-based architecture supports future team/enterprise features
- **Admin Visibility**: Need to see all users, their status, and usage metrics

## What

### Success Criteria

- [ ] Settings page uses Tremor two-column grid layout (no card containers for main content)
- [ ] 5 tabs with role-based visibility:
  - Account (all users)
  - Users (only TEAM + ADMIN roles)
  - Billing (all users, shows FREE plan)
  - Integrations (all users)
  - Admin (only ADMIN role)
- [ ] Fathom integration wizard (5 steps) blocks app access until completed
- [ ] Database schema includes user roles (FREE, TEAM, ADMIN)
- [ ] Webhook diagnostics hidden behind confirmation dialog
- [ ] Admin tab shows all system users with status/metrics
- [ ] Coming soon placeholders for: Zoom, GHL integrations, PRO billing

### User-Visible Behavior

1. **First Login Experience**:
   - User signs up/logs in
   - Immediately redirected to Settings page
   - Fathom setup wizard modal opens automatically (cannot be dismissed)
   - Must complete all 5 steps before app access
   - On subsequent logins, wizard only shows if setup incomplete

2. **Settings Page Layout** (Tremor-style):
   - Page title + description at top
   - Tabs below title (left-justified, line variant)
   - Each section uses two-column grid:
     - Left column (1/3 width): Section title + description + optional action button
     - Right column (2/3 width): Form inputs, settings, controls
   - Sections separated by `<Separator />` components (not cards)

3. **Role-Based Tab Visibility**:
   - FREE users see: Account, Billing, Integrations
   - TEAM users see: Account, Users, Billing, Integrations
   - ADMIN user sees: Account, Users, Billing, Integrations, Admin

4. **Fathom Integration Wizard** (5 steps):
   - Step 1: Welcome + explanation of why both OAuth AND API key needed
   - Step 2: Get Fathom API key + secret (with instructions/screenshots)
   - Step 3: Add webhook URL to Fathom + get webhook secret
   - Step 4: Configure webhook in Fathom (check all boxes)
   - Step 5: Connect via OAuth (final step)

## All Needed Context

### Documentation & References

```yaml
- file: docs/design/brand-guidelines-v3.3.md
  why: Tremor-style layout patterns, 90% no-card rule, typography standards
  critical: Two-column grid pattern (lg:grid-cols-3), use Separator not Card, typography rules

- file: src/pages/Settings.tsx
  why: Current 1597-line implementation to be redesigned
  pattern: Extract existing OAuth/webhook logic, refactor into cleaner structure
  gotcha: Currently has 17+ rounded-lg violations, needs complete restructuring

- file: src/components/OnboardingModal.tsx
  why: Replace with new 5-step wizard modal
  pattern: Dialog structure, step management, progress indication
  gotcha: Current modal has 2 steps, new wizard needs 5 steps with validation

- file: supabase/migrations/20251031065616_03841945-7a0b-4341-a161-60396ed47418.sql
  why: Current user_profiles and user_settings schema
  pattern: user_profiles: {id, user_id, display_name, created_at, updated_at}
           user_settings: {id, user_id, fathom_api_key, webhook_secret, host_email, oauth_access_token, oauth_refresh_token, oauth_token_expires}
  gotcha: Need to ADD role column to user_profiles, additional columns to user_settings
```

### Current Codebase Tree (Settings-related)

```
src/
├── pages/
│   └── Settings.tsx (1597 lines - TO BE REDESIGNED)
├── components/
│   ├── OnboardingModal.tsx (TO BE REPLACED)
│   ├── DeleteAccountDialog.tsx (keep as-is)
│   ├── WebhookDiagnosticsDialog.tsx (keep, add confirmation)
│   └── ui/
│       ├── tabs.tsx (left-justified flex layout)
│       ├── separator.tsx (for section dividers)
│       └── dialog.tsx (for modals)
supabase/
└── migrations/
    └── 20251031065616_*.sql (user_profiles, user_settings tables)
```

### Desired Codebase Tree

```
src/
├── pages/
│   └── Settings.tsx (300 lines - main shell with routing)
├── components/
│   ├── settings/
│   │   ├── FathomSetupWizard.tsx (NEW - 5-step modal, ~400 lines)
│   │   ├── AccountTab.tsx (NEW - ~200 lines)
│   │   ├── UsersTab.tsx (NEW - ~250 lines)
│   │   ├── BillingTab.tsx (NEW - ~100 lines)
│   │   ├── IntegrationsTab.tsx (NEW - ~300 lines)
│   │   ├── AdminTab.tsx (NEW - ~350 lines)
│   │   ├── IntegrationStatusCard.tsx (NEW - ~80 lines)
│   │   └── ConfirmWebhookDialog.tsx (NEW - ~60 lines)
│   ├── DeleteAccountDialog.tsx (keep)
│   └── WebhookDiagnosticsDialog.tsx (keep)
supabase/
└── migrations/
    └── 20251120_add_user_roles_and_setup_tracking.sql (NEW)
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Supabase RLS requires service_role for admin queries
// When querying ALL users in Admin tab, must use service role policy

// CRITICAL: Role-based tab visibility requires checking user_profiles.role
// Must load user profile on Settings page mount to determine visible tabs

// GOTCHA: Tremor layout uses lg:grid-cols-3 where left is 1 col, right is 2 cols (lg:col-span-2)
// Example: <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
//            <div>Left: Title + Desc</div>
//            <div className="lg:col-span-2">Right: Content</div>
//          </div>

// GOTCHA: OAuth tokens stored in user_settings, need to persist after wizard completion
// wizard_completed flag prevents re-showing wizard on subsequent logins

// CRITICAL: First-time login redirect must check wizard_completed before allowing navigation
// If false, force redirect to /settings and auto-open wizard (modal cannot be dismissed)
```

## Implementation Blueprint

### Database Schema Changes

```sql
-- Migration: Add user roles and setup tracking

-- Add role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN role TEXT DEFAULT 'FREE' CHECK (role IN ('FREE', 'TEAM', 'ADMIN')),
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN setup_wizard_completed BOOLEAN DEFAULT false,
ADD COLUMN last_login_at TIMESTAMPTZ;

-- Add Fathom API credentials to user_settings
ALTER TABLE user_settings
ADD COLUMN fathom_api_secret TEXT,
ADD COLUMN bulk_import_enabled BOOLEAN DEFAULT false,
ADD COLUMN setup_completed_at TIMESTAMPTZ;

-- Set andrew@aisimple.co as ADMIN
UPDATE user_profiles
SET role = 'ADMIN'
WHERE user_id = 'eaa275cd-c72b-4a08-adb5-2a002fb8f6a3';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role) WHERE role IN ('TEAM', 'ADMIN');

-- Create RLS policy for admin user queries
CREATE POLICY "Admins can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'ADMIN'
  )
);
```

### Implementation Tasks (ordered by dependencies)

```yaml
## PHASE 1: Database & Auth Foundation

Task 1: CREATE supabase/migrations/20251120_add_user_roles_and_setup_tracking.sql
  - IMPLEMENT: Schema changes above (role column, wizard tracking, indexes, RLS policies)
  - FOLLOW pattern: supabase/migrations/20251031065616_*.sql (table alteration, RLS policy syntax)
  - CRITICAL: Set andrew@aisimple.co as ADMIN, all others default to FREE
  - NAMING: Migration file with timestamp prefix
  - VALIDATE: Run migration locally, verify andrew has ADMIN role

Task 2: CREATE src/hooks/useUserRole.ts
  - IMPLEMENT: Custom hook to fetch user profile and role from user_profiles table
  - FOLLOW pattern: Other hooks in src/hooks/ (Supabase client usage, loading states)
  - RETURN: { role, loading, isAdmin, isTeam, isFree }
  - ERROR: Toast on fetch failure, return 'FREE' as fallback
  - PLACEMENT: src/hooks/useUserRole.ts

Task 3: CREATE src/hooks/useSetupWizard.ts
  - IMPLEMENT: Custom hook to check/update setup_wizard_completed status
  - METHODS: checkWizardStatus(), markWizardComplete()
  - FOLLOW pattern: src/hooks/ (async operations, error handling)
  - RETURN: { wizardCompleted, checkWizardStatus, markWizardComplete, loading }
  - PLACEMENT: src/hooks/useSetupWizard.ts

## PHASE 2: Fathom Setup Wizard Modal

Task 4: CREATE src/components/settings/FathomSetupWizard.tsx
  - IMPLEMENT: 5-step modal wizard (Welcome, API Keys, Webhook URL, Webhook Config, OAuth)
  - STRUCTURE:
    - Step navigation (Back/Next buttons, progress indicator)
    - Step 1: Welcome screen explaining OAuth + API key requirement
    - Step 2: Instructions for getting Fathom API key/secret + input fields
    - Step 3: Display webhook URL, instructions to add to Fathom + webhook secret input
    - Step 4: Checklist of webhook settings to enable in Fathom
    - Step 5: OAuth connection button (trigger existing OAuth flow)
  - FOLLOW pattern: src/components/OnboardingModal.tsx (Dialog usage, step management)
  - VALIDATION: Each step validates inputs before allowing Next
  - BLOCKING: Modal cannot be dismissed (no X button, no escape key, required backdrop-static)
  - STATE: Save progress to user_settings after each step
  - COMPLETION: Mark setup_wizard_completed = true on final step
  - NAMING: FathomSetupWizard, clear step component names
  - PLACEMENT: src/components/settings/FathomSetupWizard.tsx

Task 5: CREATE src/components/settings/ConfirmWebhookDialog.tsx
  - IMPLEMENT: Confirmation dialog before opening WebhookDiagnosticsDialog
  - MESSAGE: "Webhook diagnostics are only needed if you're experiencing sync issues and support has asked you to enable this. Did support ask you to enable diagnostics?"
  - BUTTONS: "Yes, Continue" (opens diagnostics), "No, Cancel" (closes)
  - FOLLOW pattern: src/components/ui/alert-dialog.tsx (AlertDialog structure)
  - PLACEMENT: src/components/settings/ConfirmWebhookDialog.tsx

## PHASE 3: Settings Page Tab Components

Task 6: CREATE src/components/settings/AccountTab.tsx
  - IMPLEMENT: Tremor two-column layout with 3 sections:
    1. Profile (left: title+desc, right: name/email fields with edit buttons)
    2. Preferences (left: title+desc, right: timezone/fathom email selectors)
    3. Password (left: title+desc, right: change password form)
  - LAYOUT: <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
  - SECTIONS: Separated by <Separator /> component (no Card wrappers)
  - FOLLOW pattern: docs/design/brand-guidelines-v3.3.md (two-column grid, section structure)
  - EXTRACT: Profile/password logic from current Settings.tsx
  - NAMING: Clear section headings using font-display typography
  - PLACEMENT: src/components/settings/AccountTab.tsx

Task 7: CREATE src/components/settings/BillingTab.tsx
  - IMPLEMENT: Simple two-column layout showing:
    - Left: "Current Plan" title + description
    - Right: Badge showing "FREE", text "You're on the Free plan"
    - Placeholder: "PRO plan coming soon" message
  - LAYOUT: Tremor two-column grid
  - MINIMAL: ~100 lines, placeholder for future billing features
  - PLACEMENT: src/components/settings/BillingTab.tsx

Task 8: CREATE src/components/settings/IntegrationStatusCard.tsx
  - IMPLEMENT: Reusable card component for integration status display
  - PROPS: {name: string, status: 'connected'|'disconnected'|'coming-soon', onConnect?: () => void}
  - RENDER: Icon, name, status badge, connect/reconnect button
  - USE: For Fathom, Zoom (coming soon), GHL (coming soon)
  - FOLLOW pattern: Keep minimal, use badge for status
  - PLACEMENT: src/components/settings/IntegrationStatusCard.tsx

Task 9: CREATE src/components/settings/IntegrationsTab.tsx
  - IMPLEMENT: Tremor two-column layout with sections:
    1. Fathom Integration (status card, "Connect" button opens wizard if not connected, "Reconnect" if connected)
    2. Webhook Diagnostics (hidden button that opens ConfirmWebhookDialog)
    3. Zoom Integration (coming soon placeholder using IntegrationStatusCard)
    4. GHL Integration (coming soon placeholder using IntegrationStatusCard)
  - LOGIC:
    - Check user_settings for fathom_api_key + oauth_access_token to determine connection status
    - "Connect" button opens FathomSetupWizard modal
    - "Webhook Diagnostics" button opens ConfirmWebhookDialog → WebhookDiagnosticsDialog
  - LAYOUT: Two-column grid, sections separated by Separator
  - PLACEMENT: src/components/settings/IntegrationsTab.tsx

Task 10: CREATE src/components/settings/UsersTab.tsx
  - IMPLEMENT: Conditional rendering based on role:
    - TEAM role: Shows "Manage Team" section (placeholder: "Team management coming soon")
    - ADMIN role: Shows same content as AdminTab (full user list)
  - LAYOUT: Tremor two-column grid
  - CONDITIONAL: useUserRole() to check role and render appropriate content
  - PLACEHOLDER: Team management is future feature, show "Coming soon" message for TEAM users
  - PLACEMENT: src/components/settings/UsersTab.tsx

Task 11: CREATE src/components/settings/AdminTab.tsx
  - IMPLEMENT: Admin-only user management table showing ALL system users
  - FETCH: Query user_profiles + user_settings with service_role policy to get all users
  - COLUMNS:
    - Display Name
    - Email (from auth.users)
    - Role (FREE/TEAM/ADMIN)
    - OAuth Connected (yes/no badge)
    - Webhook Configured (yes/no badge)
    - Calls Synced (count from fathom_calls)
    - Last Login (last_login_at timestamp)
  - LAYOUT: Use table component similar to TranscriptsTab
  - FUTURE: Add filters, sort, action buttons (for now, read-only display)
  - NOTE: Add comment "// Future: Add reset password, change role, manage billing actions here"
  - PLACEMENT: src/components/settings/AdminTab.tsx

## PHASE 4: Main Settings Page Integration

Task 12: REFACTOR src/pages/Settings.tsx
  - IMPLEMENT: Main shell page with role-based tab rendering
  - STRUCTURE:
    - Page title + description (h1 + p)
    - Tabs component with role-based TabsTrigger visibility
    - TabsContent for each tab component
  - TABS:
    - "Account" - always visible
    - "Users" - only if isTeam || isAdmin
    - "Billing" - always visible
    - "Integrations" - always visible
    - "Admin" - only if isAdmin
  - HOOKS:
    - useUserRole() to determine visible tabs
    - useSetupWizard() to check if wizard needed
    - useEffect to auto-open FathomSetupWizard if !wizardCompleted
  - CLEANUP: Remove all Card wrappers, extract logic to tab components
  - REDUCE: From 1597 lines to ~300 lines (main shell only)
  - FOLLOW pattern: Tremor examples (clean structure, tab routing)
  - PLACEMENT: src/pages/Settings.tsx (complete rewrite)

Task 13: ADD forced onboarding redirect logic
  - LOCATION: src/App.tsx or main routing component
  - IMPLEMENT: Check setup_wizard_completed on authenticated route navigation
  - LOGIC:
    - If user authenticated + !setup_wizard_completed + navigating away from /settings
    - Redirect to /settings
    - Settings page auto-opens FathomSetupWizard
  - FOLLOW pattern: Existing auth checks in routing
  - UPDATE: last_login_at timestamp on each login
  - CRITICAL: Prevents app access until wizard completed

## PHASE 5: Cleanup & Refinement

Task 14: UPDATE src/components/OnboardingModal.tsx
  - ACTION: DELETE this file (replaced by FathomSetupWizard.tsx)
  - VERIFY: No remaining imports of OnboardingModal in codebase
  - COMMAND: grep -r "OnboardingModal" src/ to verify

Task 15: REMOVE all Card usage violations from Settings components
  - SEARCH: grep -r "Card\|rounded-lg" src/components/settings/
  - REPLACE: All Card wrappers with two-column grid divs + Separator
  - KEEP: Only DeleteAccountDialog can use Card (danger zone exception)
  - VERIFY: Zero Card imports in settings/ directory

Task 16: UPDATE brand compliance documentation
  - FILE: docs/design/brand-guidelines-v3.3.md
  - ADD: Example of Settings page Tremor layout pattern
  - REFERENCE: Document that Settings page is canonical example of 90% rule
  - INCREMENT: Version to v3.3.1 (patch version)
```

### Integration Points

```yaml
DATABASE:
  - migration: supabase/migrations/20251120_add_user_roles_and_setup_tracking.sql
  - tables: user_profiles (add role, wizard tracking), user_settings (add api_secret, bulk_import_enabled)
  - indexes: idx_user_profiles_role for efficient role queries
  - RLS: Admin policy for viewing all user profiles

ROUTING:
  - update: src/App.tsx or main router
  - add: Redirect logic forcing /settings on first login
  - check: setup_wizard_completed before allowing navigation

AUTH:
  - check: user_profiles.role for tab visibility
  - verify: Existing OAuth flow works with wizard Step 5
  - update: last_login_at on each authentication

API:
  - existing: getFathomOAuthUrl(), createFathomWebhook() in src/lib/api-client.ts
  - reuse: OAuth and webhook functions in wizard
  - add: API for saving wizard progress (fathom_api_key, fathom_api_secret, webhook_secret)
```

### Implementation Patterns & Key Details

```typescript
// Pattern: Two-column Tremor layout
<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
  {/* Left column: 1/3 width */}
  <div>
    <h2 className="font-semibold text-gray-900 dark:text-gray-50">
      Section Title
    </h2>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
      Description text explaining this section
    </p>
  </div>

  {/* Right column: 2/3 width */}
  <div className="lg:col-span-2">
    {/* Form inputs, settings controls, etc. */}
  </div>
</div>

// Pattern: Role-based tab visibility
const { role, isAdmin, isTeam } = useUserRole();

<TabsList>
  <TabsTrigger value="account">ACCOUNT</TabsTrigger>
  {(isTeam || isAdmin) && <TabsTrigger value="users">USERS</TabsTrigger>}
  <TabsTrigger value="billing">BILLING</TabsTrigger>
  <TabsTrigger value="integrations">INTEGRATIONS</TabsTrigger>
  {isAdmin && <TabsTrigger value="admin">ADMIN</TabsTrigger>}
</TabsList>

// Pattern: Wizard step validation
const validateStep = (stepNumber: number): boolean => {
  switch(stepNumber) {
    case 2: // API Keys step
      return apiKey.length > 0 && apiSecret.length > 0;
    case 3: // Webhook step
      return webhookSecret.length > 0;
    default:
      return true;
  }
};

// Pattern: Blocking wizard modal
<Dialog open={!wizardCompleted} onOpenChange={() => {}} modal>
  {/* No close button, no escape key handler */}
  <DialogContent className="max-w-3xl" hideClose>
    {/* Wizard content */}
  </DialogContent>
</Dialog>

// Pattern: Admin user query with RLS
const { data: allUsers } = await supabase
  .from('user_profiles')
  .select(`
    *,
    user_settings(*),
    fathom_calls(count)
  `)
  .order('created_at', { ascending: false });
// RLS policy allows this query only if current user has role='ADMIN'
```

### Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Wrap content sections in Card components
<Card>
  <CardHeader>
    <CardTitle>Profile Settings</CardTitle>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>

// ✅ DO: Use two-column grid with Separator
<div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
  <div><h2>Profile Settings</h2></div>
  <div className="lg:col-span-2">{/* content */}</div>
</div>
<Separator />

// ❌ DON'T: Use grid layout for tabs
<TabsList className="grid w-full grid-cols-4">

// ✅ DO: Use flex (left-justified) layout for tabs
<TabsList> {/* Default flex layout */}

// ❌ DON'T: Allow wizard dismissal
<Dialog open={showWizard} onOpenChange={setShowWizard}>

// ✅ DO: Block wizard until completion
<Dialog open={!wizardCompleted} onOpenChange={() => {}}>

// ❌ DON'T: Check role inline everywhere
{user?.email === 'andrew@aisimple.co' && <AdminTab />}

// ✅ DO: Use role from database
{isAdmin && <AdminTab />}
```

## Validation Loop

### Level 1: Syntax & Build (Immediate Feedback)

```bash
# After creating each component file
npm run type-check  # TypeScript validation
npm run lint        # ESLint validation
npm run build       # Vite build check

# Expected: Zero errors. Fix any TypeScript/ESLint issues before proceeding.
```

### Level 2: Database Migration (Schema Validation)

```bash
# After creating migration file
# Local Supabase setup (if available)
supabase db reset  # Reset local DB
supabase migration up  # Apply new migration

# Verify:
psql -d postgres -c "SELECT role, setup_wizard_completed FROM user_profiles WHERE user_id = 'eaa275cd-c72b-4a08-adb5-2a002fb8f6a3';"
# Expected: role='ADMIN', setup_wizard_completed=false

# If no local Supabase, apply migration to staging/dev environment
```

### Level 3: Component Integration (UI Validation)

```bash
# After implementing tab components
npm run dev  # Start dev server

# Manual Testing Checklist:
# 1. Navigate to http://localhost:8080/settings
# 2. Verify FathomSetupWizard opens automatically (if not completed)
# 3. Verify wizard cannot be dismissed (no X button, ESC doesn't close)
# 4. Complete wizard step-by-step, verify each step validation
# 5. After wizard completion, verify Settings page loads with correct tabs
# 6. Verify tab visibility based on role:
#    - As andrew@aisimple.co: See Account, Users, Billing, Integrations, Admin
#    - As test FREE user: See Account, Billing, Integrations only
# 7. Verify two-column layout on each tab (no Card wrappers)
# 8. Verify Separator between sections (not rounded-lg borders)
# 9. Test IntegrationsTab: Click "Webhook Diagnostics" → see confirmation → can open diagnostics
# 10. Test AdminTab: Verify table shows all users with correct data
```

### Level 4: Brand Compliance (Design Validation)

```bash
# Visual regression check
# 1. Take screenshot of Settings page (each tab)
# 2. Verify against docs/design/brand-guidelines-v3.3.md:
#    - No Card containers for main content sections
#    - Two-column grid layout (lg:grid-cols-3)
#    - Sections separated by thin Separator lines
#    - Typography: Montserrat Extra Bold ALL CAPS for headings
#    - Tabs: Left-justified, uppercase, vibe green underline on active
# 3. Search for violations:
grep -r "Card\|rounded-lg" src/pages/Settings.tsx src/components/settings/
# Expected: Only DeleteAccountDialog contains Card references

# 4. Verify no grid layout on tabs:
grep -r "grid.*grid-cols" src/pages/Settings.tsx | grep TabsList
# Expected: No results (TabsList should not use grid layout)
```

### Level 5: End-to-End (User Flow Validation)

```bash
# New user flow test:
# 1. Create new test user account
# 2. Sign up/log in
# 3. Verify immediate redirect to /settings
# 4. Verify FathomSetupWizard opens and blocks interaction
# 5. Complete wizard (all 5 steps)
# 6. Verify redirect to /settings with full app access
# 7. Navigate away to /transcripts
# 8. Navigate back to /settings
# 9. Verify wizard does NOT open again (wizard_completed=true)

# Role-based access test:
# 1. Test as FREE user: Verify only 3 tabs visible (Account, Billing, Integrations)
# 2. Update user to TEAM role in database
# 3. Refresh page, verify Users tab now visible
# 4. Test as ADMIN (andrew@aisimple.co): Verify all 5 tabs visible
# 5. AdminTab: Verify can see all system users
```

### Level 6: Performance & Security (Final Checks)

```bash
# Performance check
npm run build
npm run preview
# Lighthouse audit: Verify no performance regressions

# Security check
# 1. Verify RLS policies work:
#    - As non-admin user, try to query all user_profiles
#    - Expected: Only see own profile
# 2. Verify admin policy works:
#    - As andrew@aisimple.co, query all user_profiles
#    - Expected: See all users
# 3. Verify API keys/secrets stored securely in user_settings
# 4. Verify webhook secret not exposed in client-side code
```

## Final Validation Checklist

```yaml
Database:
  - [ ] Migration applied successfully
  - [ ] user_profiles.role column exists with CHECK constraint
  - [ ] user_settings has fathom_api_secret, bulk_import_enabled columns
  - [ ] andrew@aisimple.co has role='ADMIN'
  - [ ] RLS policies allow admin to query all users

Components:
  - [ ] FathomSetupWizard.tsx created (~400 lines)
  - [ ] 5 tab components created (Account, Users, Billing, Integrations, Admin)
  - [ ] ConfirmWebhookDialog.tsx created
  - [ ] IntegrationStatusCard.tsx created
  - [ ] OnboardingModal.tsx deleted

Settings Page:
  - [ ] Settings.tsx refactored to ~300 lines (main shell only)
  - [ ] Tremor two-column layout used throughout
  - [ ] Zero Card wrappers (except DeleteAccountDialog)
  - [ ] Sections separated by Separator component
  - [ ] Tabs left-justified, uppercase, line variant

Functionality:
  - [ ] First-time login forces FathomSetupWizard (blocking)
  - [ ] Wizard cannot be dismissed until completed
  - [ ] Wizard saves progress to user_settings after each step
  - [ ] setup_wizard_completed flag prevents re-showing wizard
  - [ ] Tab visibility based on user role (FREE/TEAM/ADMIN)
  - [ ] Webhook diagnostics behind confirmation dialog
  - [ ] AdminTab shows all system users (admin only)

Brand Compliance:
  - [ ] Zero rounded-lg violations in Settings components
  - [ ] Typography: Montserrat Extra Bold ALL CAPS for headings
  - [ ] Tabs: Left-justified with gap-6 spacing
  - [ ] Active tab: 6px vibe green angular underline
  - [ ] Body text: Inter Light/Regular (not Medium)
  - [ ] No card containers for main content sections
```

## Estimated Effort

- **Phase 1** (Database & Auth): 2-3 hours
- **Phase 2** (Fathom Wizard): 4-5 hours
- **Phase 3** (Tab Components): 5-6 hours
- **Phase 4** (Main Integration): 2-3 hours
- **Phase 5** (Cleanup & Testing): 2-3 hours

**Total**: 15-20 hours (2-3 days for single developer)

## Success Metrics

- Zero card containers on Settings page (except approved exceptions)
- 100% of new users complete Fathom setup before app access
- Clean two-column layout matches Tremor reference examples
- Role-based tabs work correctly for all user types
- Admin can view all system users and their status
- Brand guidelines compliance: 0 violations

---

**END OF PRP**
