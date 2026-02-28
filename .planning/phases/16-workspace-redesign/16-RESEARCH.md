# Phase 16: Workspace Redesign - Research

**Researched:** 2026-02-27
**Domain:** React + Supabase multi-tenant rename, navigation redesign, invite flows
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Hierarchy navigation
- **Organization switcher:** Dedicated thin header bar above the sidebar showing current org name. One click to switch orgs via dropdown.
- **Workspace switching:** Sidebar section with workspaces listed as expandable items. Click to switch. Current workspace highlighted. Folders nest underneath each workspace. Matches v1 vault sidebar pattern.
- **Breadcrumbs:** Full breadcrumb trail (Org > Workspace > Folder > Call) always visible at the top of the main content area. Each level clickable for navigation.
- **Org switch behavior:** Switching organizations resets the view to that org's workspace list. No position memory across orgs — clean slate each time.

#### Onboarding & model clarity
- **4-level diagram:** Interactive explorer — user clicks through levels one at a time. Each click reveals the next layer (Account → Organization → Workspace → Folder → Call) with a brief explanation. More engaging than static, less passive than auto-animation.
- **Trigger:** Show on first login after signup. Also accessible later via a "How it works" link in the sidebar or help menu so users can revisit.
- **Personal org:** Distinct treatment with a special label/icon (e.g., house icon). Onboarding explains: "This is your personal space. Create an Organization to collaborate with others."
- **My Calls workspace:** Auto-created as the default import destination. User can rename it but cannot delete it (every org needs at least one workspace). Default destination for imports unless routing rules override.

#### Invite & membership flow
- **Invite mechanism:** Email invite AND shareable invite link (like Slack/Discord). Invite links can be revoked.
- **Role picker:** Claude's discretion — pick the approach that fits the dialog context best.
- **Invite acceptance:** Claude's discretion — must satisfy WKSP-10 (invitees know what they're accepting: who invited them, org name, workspace name, assigned role, what they'll have access to).
- **Member management:** Separate tabs for "Members" and "Pending Invites" in workspace settings. Pending invites tab shows resend/revoke options.

#### Folder management
- **Folder location:** Sidebar under parent workspace. Click a folder to filter the call list to that folder's contents.
- **Folder depth:** One level of nesting allowed (folders can contain subfolders, max 2 levels deep). Gives structure without over-organization.
- **Call assignment:** Drag-and-drop on desktop (drag call onto sidebar folder) AND action menu everywhere (right-click / "..." menu → "Move to folder" → pick folder). Both mechanisms available.
- **Archive behavior:** Archived folders move to an "Archived" section. Calls stay inside the archived folder. Folder is hidden from main sidebar view. Can be fully restored.
- **Archive = visibility toggle:** Archiving excludes calls/folders from searches AND MCP results. It is NOT deletion — all content is preserved and fully restorable.

### Claude's Discretion
- Role picker UX (dropdown vs cards — pick what fits the invite dialog)
- Invite acceptance flow design (must satisfy WKSP-10: invitees see who invited them, org name, workspace name, role, and access scope before accepting)
- Exact breadcrumb styling and truncation on narrow screens
- Folder creation UX (inline rename vs dialog)
- Sidebar expand/collapse animation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 16 is a rename-and-restructure phase, not a greenfield build. The app already has a working Bank/Vault/Hub architecture (tables, hooks, components, RLS policies) from Phase 9. The work here is: (1) rename everything to Organization/Workspace/Folder in UI labels, toasts, and error strings, (2) add additive DB migrations that alias the new concept names without renaming existing columns, (3) restructure the navigation UX per the locked decisions — a dedicated org-switcher header bar above the sidebar, workspaces as expandable sidebar items with folders nested under them, and full breadcrumbs in the main content area, (4) add email invite capability on top of the existing shareable invite link, (5) add archive state to folders, (6) build the interactive 4-level onboarding diagram, and (7) set up 301 URL redirects for old paths.

The existing codebase gives a strong foundation: `useBankContext` manages bank/vault state, `BankSwitcher` is the current org-switcher component (to be redesigned per the locked header-bar decision), `VaultListPane` is the current workspace list (to be restructured as expandable sidebar items with folder nesting), and `VaultMemberPanel` has the member management base (to gain a "Pending Invites" tab). The DnD kit (`@dnd-kit/core` 6.3.1) is already installed for drag-and-drop. Framer Motion (`framer-motion` 12.x) is available for the onboarding diagram animation.

The critical planning sequencing constraint from the requirements: URL redirect rules (WKSP-04) MUST ship before the UI rename (WKSP-01/02/03). This prevents "Workspace not found" errors during the rename window. DB migrations are additive only — no column renames.

**Primary recommendation:** Plan tasks in this order — (1) URL redirects first, (2) additive DB migrations + type aliases, (3) UI terminology sweep, (4) navigation redesign (org-switcher bar, sidebar restructure, breadcrumbs), (5) folder archive support, (6) email invite + pending invites tab, (7) onboarding diagram.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop (call → folder) | Already installed, used in existing DnD |
| `framer-motion` | 12.x | Onboarding step animation | Already installed in project |
| `@tanstack/react-query` | 5.90.x | Server state for org/workspace/folder | Already used throughout |
| `zustand` | 5.0.x | Active org/workspace state | `bankContextStore.ts` already exists |
| `react-router-dom` | 6.30.x | Routes + 301 redirects | Already used for all routing |
| `sonner` | 1.7.x | Toast notifications | Already used everywhere |
| `@remixicon/react` | 4.7.x | Icons (house icon for personal org) | Mandatory per CLAUDE.md |
| `@supabase/supabase-js` | 2.84.x | DB, RLS, Auth, RPC calls | Already used |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 3.6.x | Invite expiry date formatting | Invite dialogs |
| `zod` | 3.25.x | Input validation in edge functions | Email invite Edge Function |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `framer-motion` (already installed) | CSS transitions only | CSS is sufficient for simple step reveals; framer-motion gives smoother spring animations for the interactive explorer |
| `@dnd-kit/core` (already installed) | `react-beautiful-dnd` | DnD kit is already in use; no reason to add another |

**Installation:** No new packages required. All libraries are already in `package.json`.

---

## Architecture Patterns

### Existing File Map (What Already Exists)

```
src/
├── components/
│   ├── header/
│   │   └── BankSwitcher.tsx          # TO REPLACE: becomes OrgSwitcherBar (header bar)
│   ├── panes/
│   │   ├── VaultListPane.tsx         # TO REPLACE: becomes WorkspaceSidebarPane (expandable + folders)
│   │   └── VaultDetailPane.tsx       # TO RENAME/UPDATE: WorkspaceDetailPane
│   ├── panels/
│   │   └── VaultMemberPanel.tsx      # TO UPDATE: add Pending Invites tab
│   ├── dialogs/
│   │   ├── VaultInviteDialog.tsx     # TO UPDATE: add email invite + role picker
│   │   ├── CreateVaultDialog.tsx     # TO RENAME: CreateWorkspaceDialog
│   │   └── CreateBusinessBankDialog.tsx  # TO RENAME: CreateOrganizationDialog
│   ├── settings/
│   │   ├── BanksTab.tsx              # TO UPDATE: terminology sweep
│   │   └── VaultManagement.tsx       # TO UPDATE: terminology sweep
│   └── ui/
│       └── sidebar-nav.tsx           # TO UPDATE: add org-switcher bar slot, folder nesting
├── hooks/
│   ├── useBankContext.ts             # TO RENAME/UPDATE: useOrgContext.ts
│   ├── useBankMutations.ts           # TO RENAME: useOrgMutations.ts
│   ├── useVaults.ts                  # TO RENAME: useWorkspaces.ts
│   ├── useVaultMemberMutations.ts    # TO RENAME: useWorkspaceMemberMutations.ts
│   ├── useVaultAssignment.ts         # TO RENAME: useWorkspaceAssignment.ts
│   └── useFolders.ts                 # TO UPDATE: add archive support
├── stores/
│   └── bankContextStore.ts           # TO RENAME/UPDATE: orgContextStore.ts
├── types/
│   └── bank.ts                       # TO UPDATE: add Organization/Workspace/Folder type aliases
└── pages/
    ├── VaultsPage.tsx                # TO RENAME: WorkspacesPage.tsx
    └── VaultJoin.tsx                 # TO RENAME: WorkspaceJoin.tsx (+ update invite info)
```

### New Files to Create

```
src/
├── components/
│   ├── layout/
│   │   └── OrgSwitcherBar.tsx        # NEW: thin header bar above sidebar (locked decision)
│   ├── panes/
│   │   └── WorkspaceSidebarPane.tsx  # NEW: expandable workspaces + nested folders
│   ├── panels/
│   │   └── WorkspaceMemberPanel.tsx  # NEW: Members + Pending Invites tabs
│   └── onboarding/
│       └── ModelExplorer.tsx         # NEW: interactive 4-level click-through diagram
supabase/
├── migrations/
│   └── 20260227XXXXXX_org_workspace_folder_aliases.sql  # NEW: additive migration
└── functions/
    └── send-workspace-invite/        # NEW: email invite Edge Function
        └── index.ts
```

### Pattern 1: Additive DB Migration (WKSP-01/02/03)

**What:** Add VIEW aliases and display_name columns — never rename existing columns.
**When to use:** All DB schema changes in this phase.

```sql
-- Source: Phase 16 requirements — "additive DB migrations only"
-- Never rename banks → organizations, vaults → workspaces inline.
-- Instead: add a computed column or view that presents the new name.

-- Option A: Views (read-only aliases for new consumer code)
CREATE OR REPLACE VIEW organizations AS
  SELECT
    id,
    name,
    type,
    cross_bank_default,
    logo_url,
    created_at,
    updated_at
  FROM banks;

CREATE OR REPLACE VIEW workspaces AS
  SELECT
    id,
    bank_id AS organization_id,
    name,
    vault_type AS workspace_type,
    default_sharelink_ttl_days,
    invite_token,
    invite_expires_at,
    created_at,
    updated_at
  FROM vaults;

-- Option B: Add display_name columns to existing tables (for phase-specific label override)
ALTER TABLE banks ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Workspace invite tracking: need pending_invites table for email invites
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vault_owner', 'vault_admin', 'manager', 'member', 'guest')),
  token VARCHAR(64) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(workspace_id, email, status)
);

-- Archive support for folders
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
```

**CRITICAL NOTE:** Views in Supabase with RLS may not inherit parent table RLS policies. For Supabase RLS with views, use `SECURITY INVOKER` (default in Postgres 15+). Verify that view queries go through RLS correctly, or use the existing table names + TypeScript type aliases instead of DB views.

**Recommendation:** Use TypeScript type aliases over DB views. Keep all queries using `banks` and `vaults` table names. Only rename display strings in the UI layer. This avoids RLS complexity entirely.

### Pattern 2: URL 301 Redirects (WKSP-04)

**What:** React Router v6 `<Navigate>` for client-side redirects. The existing app already uses this pattern for legacy routes.
**When to use:** Before any rename ships.

```typescript
// Source: existing App.tsx pattern (line 94: /team → /vaults)
// Add these routes in App.tsx BEFORE the new workspace routes:

// 301-equivalent client redirects (old → new paths)
<Route path="/bank/*" element={<Navigate to="/organization" replace />} />
<Route path="/vault/*" element={<Navigate to="/workspace" replace />} />
<Route path="/vaults" element={<Navigate to="/workspaces" replace />} />
<Route path="/vaults/:vaultId" element={<Navigate to={`/workspaces/${vaultId}`} replace />} />
<Route path="/join/vault/:token" element={<Navigate to={`/join/workspace/${token}`} replace />} />
<Route path="/settings/banks" element={<Navigate to="/settings/organizations" replace />} />
```

**Note on "301 lifespan":** Client-side React redirects are permanent for the user's session. For true HTTP 301s (for SEO, external bookmarks), a Vercel/hosting-level redirect config (vercel.json) is needed. Since this is an SPA behind authentication, most "bookmarks" are internal links — React Router redirects are sufficient for the 90-day window.

```json
// vercel.json (if deploying on Vercel) — for hard server-level redirects
{
  "redirects": [
    { "source": "/vaults", "destination": "/workspaces", "permanent": true },
    { "source": "/vaults/:vaultId", "destination": "/workspaces/:vaultId", "permanent": true },
    { "source": "/join/vault/:token", "destination": "/join/workspace/:token", "permanent": true },
    { "source": "/settings/banks", "destination": "/settings/organizations", "permanent": true }
  ]
}
```

### Pattern 3: Organization Switcher Bar (Locked Decision)

**What:** A thin header bar rendered above the sidebar, showing current org name + dropdown.
**Where:** In `AppShell.tsx`, above Pane 1 (NavRail), visible on desktop/tablet.

```typescript
// Source: AppShell.tsx structure analysis
// Currently sidebar is Pane 1; org bar goes ABOVE all panes
// AppShell renders: [nav] [secondary] [main] [detail]
// New layout: [org-bar (full width)] + [nav] [secondary] [main] [detail]

// OrgSwitcherBar.tsx
export function OrgSwitcherBar() {
  const { activeBank, banks, switchBank, isPersonalBank } = useOrgContext(); // renamed from useBankContext

  return (
    <div className="h-9 flex-shrink-0 flex items-center px-3 border-b border-border/40 bg-card/50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            {isPersonalBank ? (
              <RiHome4Line className="h-3.5 w-3.5" />  // house icon for personal org
            ) : (
              <RiBuildingLine className="h-3.5 w-3.5" />
            )}
            <span className="truncate max-w-[120px]">{activeBank?.name}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        {/* Org list dropdown — switching resets to org's workspace list */}
        <DropdownMenuContent>
          {banks.map(org => (
            <DropdownMenuItem key={org.id} onClick={() => switchBank(org.id)}>
              {/* ... */}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openCreateOrgDialog()}>
            + Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

### Pattern 4: Workspace Sidebar with Nested Folders (Locked Decision)

**What:** Workspaces listed as expandable items in the secondary pane. Folders nested under each workspace.
**Matches:** The existing VaultListPane pattern (same library, same visual style).

```typescript
// WorkspaceSidebarPane.tsx
// Structure: replaces VaultListPane.tsx
// Key changes:
// 1. Workspaces are expandable accordion items (use @radix-ui/react-collapsible)
// 2. Folders appear as indented children under active workspace
// 3. Folder click filters call list to folder contents
// 4. Archived folders shown in collapsed "Archived" section

// Use @radix-ui/react-collapsible (already installed):
import * as Collapsible from '@radix-ui/react-collapsible';

function WorkspaceItem({ workspace, isActive, folders }) {
  const [isOpen, setIsOpen] = useState(isActive);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <button className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg', ...)}>
          <WorkspaceIcon />
          <span>{workspace.name}</span>
          <RiArrowDownSLine className={cn('ml-auto', isOpen && 'rotate-180')} />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {folders.map(folder => (
          <FolderItem key={folder.id} folder={folder} />
        ))}
        <CreateFolderButton workspaceId={workspace.id} />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
```

**Note:** `@radix-ui/react-collapsible` is already installed (v1.1.12 in package.json).

### Pattern 5: Breadcrumbs in Main Content Area (Locked Decision)

**What:** `Org > Workspace > Folder > Call` always visible at top of main content pane. Each level clickable.

```typescript
// WorkspaceBreadcrumb.tsx (new component)
// Render at top of WorkspaceDetailPane (replaces VaultDetailPane header)

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

function WorkspaceBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true" className="text-muted-foreground/50">/</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-foreground transition-colors truncate max-w-[120px]"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[120px]">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

**Truncation on narrow screens:** Use `truncate` + `max-w` per item. Show only last 2 levels on mobile (hide org level). This is Claude's discretion per CONTEXT.md.

### Pattern 6: Email Invite (new requirement vs. link-only)

**What:** New Edge Function `send-workspace-invite` + `workspace_invitations` DB table.
**When:** Invite dialog now has two modes: "Share Link" and "Email Invite".

```typescript
// send-workspace-invite/index.ts (Edge Function)
// Uses Supabase Auth to send invite email via auth.admin.inviteUserByEmail
// OR sends via Resend/SMTP if user is already registered

// Pattern: generate a unique invite token, store in workspace_invitations table,
// send email with the /join/workspace/:token?invite=:inviteToken URL

const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${Deno.env.get('SITE_URL')}/join/workspace/${workspaceId}?invite=${token}`
});
```

**SITE_URL timing note (from requirements):** Do NOT update SITE_URL until hard cutover date. During dual-operation, use allowlist. The invite URL must use the correct SITE_URL at send time.

### Pattern 7: Interactive 4-Level Onboarding Diagram (WKSP-09)

**What:** Step-through explorer. Each click reveals the next level. 5 steps total: Account → Organization → Workspace → Folder → Call.
**Implementation:** framer-motion `AnimatePresence` + local state for current step.

```typescript
// ModelExplorer.tsx
// Shows on first login (persisted via user_preferences or Supabase metadata)
// Also accessible via "How it works" link in sidebar

const STEPS = [
  { id: 'account', label: 'Your Account', description: 'You sign in once. Everything starts here.', icon: RiUserLine },
  { id: 'organization', label: 'Organization', description: 'Your personal space or a team org you belong to.', icon: RiHome4Line },
  { id: 'workspace', label: 'Workspace', description: 'A workspace holds your calls. My Calls is your default.', icon: RiBriefcaseLine },
  { id: 'folder', label: 'Folder', description: 'Organize calls into folders. Archived folders hide from searches.', icon: RiFolderLine },
  { id: 'call', label: 'Call', description: 'Your actual recording — transcript, AI summary, and more.', icon: RiMicLine },
];

export function ModelExplorer({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Progress dots */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className={cn('w-2 h-2 rounded-full', i <= step ? 'bg-vibe-orange' : 'bg-muted')} />
        ))}
      </div>

      {/* Current step content — framer-motion AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          {/* Step icon, label, description */}
        </motion.div>
      </AnimatePresence>

      <Button onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : onComplete()}>
        {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
      </Button>
    </div>
  );
}
```

### Pattern 8: Folder Archive Support (WKSP-12)

**What:** Archive toggle on folders. Archived folders excluded from search + MCP results.

```typescript
// Update useFolders hook: add archiveFolder / restoreFolder mutations
// Update folders query: separate archived vs active folders

const { data: activeFolders } = useQuery({
  queryKey: [...queryKeys.folders.list(), 'active', activeBankId, activeVaultId],
  queryFn: async () => {
    const { data } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .eq('bank_id', activeBankId)
      .eq('vault_id', activeVaultId)  // NEW: scope to workspace
      .eq('is_archived', false)       // NEW: active only
      .order('position');
    return data as Folder[];
  }
});

// NOTE: folders currently have bank_id but NOT vault_id.
// The migration must add vault_id to folders table to scope them to workspaces.
```

**IMPORTANT DISCOVERY:** The existing `folders` table has `bank_id` but NO `vault_id` column. Folders are currently org-scoped, not workspace-scoped. Phase 16 MUST add `vault_id` to folders (additive migration) to support the "Folders nest under workspaces" locked decision. This is a critical schema gap.

### Anti-Patterns to Avoid

- **Renaming DB columns in-place:** Never `ALTER TABLE banks RENAME TO organizations`. Add views or aliases only.
- **Deploying UI rename before URL redirects:** The 301 rules (WKSP-04) must ship first.
- **Using DB views with RLS:** Views don't automatically inherit RLS from base tables in all Postgres versions. Keep queries using the original table names.
- **Blocking "My Calls" workspace deletion without enforcement:** The undeletable constraint must be enforced server-side (RPC check), not just UI-disabled.
- **Storing onboarding-seen state in localStorage only:** Loses cross-device sync. Store in `user_preferences` table (already exists) or Supabase user metadata.
- **Using `supabase as any`:** The existing codebase uses this pattern widely for tables not in generated types. The workspace_invitations table will also need this until types are regenerated. Document this debt explicitly in new code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop call → folder | Custom mouse event handlers | `@dnd-kit/core` (already installed) | Accessibility, touch support, complex edge cases |
| Accordion expand/collapse for workspaces | Custom show/hide state + CSS | `@radix-ui/react-collapsible` (already installed) | Keyboard accessibility, animation, focus management |
| Email sending | DIY SMTP or Supabase trigger | Supabase Auth `inviteUserByEmail` or Resend API | Auth token management, deliverability |
| Invite token generation | `Math.random()` | `gen_random_bytes(24)` in Postgres (existing pattern) | Cryptographically secure, matches existing generate_vault_invite RPC |
| Step animation in onboarding | Manual CSS transitions | `framer-motion AnimatePresence` (already installed) | Cross-browser, spring physics, proper enter/exit handling |
| Role change confirmation | Custom confirm() | `ChangeRoleDialog` (already exists) | Matches existing pattern, avoids browser confirm() |

**Key insight:** This phase is almost entirely about renaming and restructuring existing pieces. The hardest new builds are: (1) `workspace_invitations` table + email flow, (2) `OrgSwitcherBar` layout integration, (3) folder archive support, (4) `ModelExplorer` onboarding component. Everything else is text replacement + component restructuring.

---

## Common Pitfalls

### Pitfall 1: Rename Ships Before URL Redirects
**What goes wrong:** Users with bookmarked `/vaults/abc123` get 404 or "Workspace not found" after rename.
**Why it happens:** Developers rename routes without setting up redirects first.
**How to avoid:** URL redirect task MUST be the first merged PR in this phase. Gate all rename tasks on redirect completion.
**Warning signs:** Any PR that changes `/vaults` routes without a corresponding redirect rule.

### Pitfall 2: Folders Missing vault_id Column
**What goes wrong:** Sidebar shows all org's folders under every workspace, not just folders for the current workspace.
**Why it happens:** The existing `folders` table has `bank_id` (org scope) but no `vault_id` (workspace scope). The locked decision says folders nest under workspaces, which requires workspace-scoped folder queries.
**How to avoid:** Add `vault_id` to `folders` table as part of the additive DB migration. Make it nullable for backward compat, default to the user's personal vault. Update `useFolders` to filter by `vault_id`.
**Warning signs:** If folder queries don't include `.eq('vault_id', activeVaultId)`, folders will leak across workspaces.

### Pitfall 3: TypeScript `supabase as any` Debt for New Tables
**What goes wrong:** `workspace_invitations` table queries fail TypeScript type checks, causing developer confusion and potential runtime errors.
**Why it happens:** Generated Supabase types only cover tables present when `supabase gen types` was last run. New tables require `as any` cast or type regen.
**How to avoid:** Explicitly define local TypeScript interfaces for new tables (same pattern as `VaultQueryResult` in `VaultManagement.tsx`). Run `supabase gen types typescript` after all migrations are applied.
**Warning signs:** Direct use of `supabase.from('workspace_invitations')` without a local type interface.

### Pitfall 4: "My Calls" Workspace Deletion Not Server-Enforced
**What goes wrong:** User finds a way to delete their only workspace (e.g., via API call), leaving the org in a broken state.
**Why it happens:** UI-only protection is easy to bypass.
**How to avoid:** Add a `is_default` boolean to `vaults` table. Create an RPC that rejects deletion when `is_default = true`. The existing `DELETE` RLS policy on vaults should add this check.
**Warning signs:** Only checking `is_default` in the React component, not in the DB trigger or RPC.

### Pitfall 5: Org Switch Not Resetting Active Workspace
**What goes wrong:** User switches org but still sees workspaces/folders from the previous org.
**Why it happens:** `bankContextStore.ts` stores `activeVaultId` — switching bank resets bank but may not clear vault.
**How to avoid:** In `switchBank` action in `bankContextStore.ts`, always set `activeVaultId = null` when switching banks. Then auto-select the personal workspace of the new org.
**Warning signs:** After switching org, the URL still shows the old vault ID.

### Pitfall 6: Onboarding Shown Every Login
**What goes wrong:** Users see the 4-level diagram on every login, not just first login.
**Why it happens:** Storing `onboarding_seen` in localStorage (cleared on browser reset) or not storing it at all.
**How to avoid:** Store `onboarding_seen_v1: true` in `user_preferences` table (already exists) after user completes the diagram. The `useUserPreferences` hook (already exists) provides the pattern.
**Warning signs:** The onboarding trigger reads from localStorage instead of a persisted preference.

### Pitfall 7: Email Invites vs SITE_URL Timing
**What goes wrong:** Invite emails contain the old SITE_URL or wrong domain during dual-operation period.
**Why it happens:** `SITE_URL` env var controls Supabase Auth redirect URLs. Requirements explicitly say: do NOT update SITE_URL until hard cutover.
**How to avoid:** The `send-workspace-invite` Edge Function must construct the invite URL using a separate `WORKSPACE_INVITE_URL_BASE` env var (or derive it from `req.headers.get('origin')`), not from `SITE_URL`.
**Warning signs:** Invite emails link to the wrong domain.

### Pitfall 8: WKSP-10 Invite Acceptance Context Missing
**What goes wrong:** Invitee sees "Join this workspace" with no context about who invited them, which org, which role.
**Why it happens:** The current `VaultJoin.tsx` only shows vault name and member count — no inviter name, no org name, no role.
**How to avoid:** The `WorkspaceJoin.tsx` page must fetch and display: inviter display name, org name, workspace name, assigned role, and what access that role grants. The `workspace_invitations` table stores all this. The join page query must use a SECURITY DEFINER RPC (like `get_workspace_invite_details`) to bypass RLS on the invitations table for unauthenticated or pre-join users.
**Warning signs:** Join page only shows workspace name; no inviter context visible.

---

## Code Examples

### Existing Patterns to Follow

#### RPC pattern (from generate_vault_invite)
```sql
-- Source: 20260210235500_shared_links_and_vault_invite_rpc.sql
-- Pattern for new get_workspace_invite_details RPC:
CREATE OR REPLACE FUNCTION public.get_workspace_invite_details(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  workspace_name TEXT,
  organization_name TEXT,
  inviter_display_name TEXT,
  role TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    v.name AS workspace_name,
    b.name AS organization_name,
    u.raw_user_meta_data->>'full_name' AS inviter_display_name,
    wi.role,
    wi.expires_at
  FROM workspace_invitations wi
  JOIN vaults v ON v.id = wi.workspace_id
  JOIN banks b ON b.id = v.bank_id
  JOIN auth.users u ON u.id = wi.invited_by
  WHERE wi.token = p_token
    AND wi.status = 'pending'
    AND wi.expires_at > NOW();
END;
$$;
```

#### BankContextStore pattern (for activeVaultId reset on org switch)
```typescript
// Source: src/stores/bankContextStore.ts (existing pattern)
// When renaming to orgContextStore.ts, update switchBank:
setActiveBank: (bankId: string) => {
  set({
    activeBankId: bankId,
    activeVaultId: null,  // CRITICAL: always reset vault on org switch
    isInitialized: true,
  });
  localStorage.setItem(BANK_CONTEXT_UPDATED_KEY, Date.now().toString());
},
```

#### Collapsible workspace item (using already-installed Radix)
```typescript
// Source: @radix-ui/react-collapsible (already installed, v1.1.12)
import * as Collapsible from '@radix-ui/react-collapsible';

<Collapsible.Root open={isExpanded} onOpenChange={setIsExpanded}>
  <div className="flex items-center">
    <button onClick={onSelect}>{workspace.name}</button>
    <Collapsible.Trigger asChild>
      <button aria-label="Toggle folders">
        <RiArrowDownSLine className={cn('h-4 w-4 transition-transform duration-500', isExpanded && 'rotate-180')} />
      </button>
    </Collapsible.Trigger>
  </div>
  <Collapsible.Content className="ml-4">
    {folders.map(f => <FolderRow key={f.id} folder={f} />)}
  </Collapsible.Content>
</Collapsible.Root>
```

#### DnD folder drop zone (using already-installed @dnd-kit)
```typescript
// Source: useDragAndDrop.ts (existing) + @dnd-kit/core patterns
// Pattern for sidebar folder drop target:
import { useDroppable } from '@dnd-kit/core';

function FolderDropZone({ folder, children }: { folder: Folder; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `folder-${folder.id}` });

  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-lg transition-colors', isOver && 'bg-vibe-orange/10 ring-1 ring-vibe-orange')}
    >
      {children}
    </div>
  );
}
```

#### AppShell layout modification (adding org bar)
```typescript
// Source: src/components/layout/AppShell.tsx (existing structure)
// Wrap the current flex container in a flex-col to stack org bar above panes:
return (
  <div className="flex flex-col h-full">
    {/* Org switcher bar — always visible, desktop/tablet only */}
    {!isMobile && <OrgSwitcherBar />}

    {/* Existing pane container (unchanged structure) */}
    <div ref={containerRef} className="flex-1 flex gap-3 overflow-hidden p-1">
      {/* ... existing panes ... */}
    </div>
  </div>
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Teams concept | Bank/Vault/Hub architecture | Phase 9 (Feb 2026) | Phase 16 renames to Org/Workspace/Folder |
| TeamSwitcher (deprecated) | BankSwitcher (in VaultListPane header) | Phase 9 | Being replaced by OrgSwitcherBar (dedicated header bar) |
| Folders scoped to bank only | Folders need vault_id scope | Phase 16 | Schema gap — additive migration required |
| Link-only vault invites | Link + email invites | Phase 16 | New workspace_invitations table needed |
| No archive state on folders | is_archived column | Phase 16 | Additive migration + filter updates |
| No onboarding diagram | ModelExplorer component | Phase 16 | New component using framer-motion |

**Deprecated/outdated:**
- `BankSwitcher` in `VaultListPane` header: replaced by `OrgSwitcherBar` (dedicated thin header bar per locked decision)
- `TeamSwitcher.tsx`: Already deprecated before Phase 16; fully remove
- `VaultManagement.tsx` deprecation banner: Remove after Phase 16 completes the Hubs → Workspace/Folder migration

---

## Open Questions

1. **Where does email invite sending live?**
   - What we know: Project has no existing email-sending infrastructure (no Resend, no Mailgun in `package.json` or functions list). Supabase Auth `inviteUserByEmail` handles new users. Existing registered users don't receive Supabase Auth invite emails.
   - What's unclear: For users already registered, how do we send the workspace invite email? Options: (a) Resend API (needs secret, new dependency), (b) Supabase Auth magic link repurposed, (c) in-app notification only (no email for existing users).
   - Recommendation: Use Supabase `auth.admin.inviteUserByEmail` for new users (free tier compatible). For existing users, send a Supabase Database webhook-triggered email OR just show the invite link. Plan task should flag this for decision — but the workspace_invitations table and pending invites tab should be built regardless of email delivery mechanism.

2. **Should folder `vault_id` be nullable or required?**
   - What we know: Existing folders have `bank_id` but no `vault_id`. Making it required with no default would break existing folders.
   - What's unclear: Do existing folders in the personal bank belong to the personal vault? Yes, logically — the personal bank has exactly one personal vault.
   - Recommendation: Add `vault_id` as nullable. Write a backfill migration that sets `vault_id` to the personal vault for all existing folders in personal banks. For business bank folders, set `vault_id` to the first vault in that bank. This is a one-time backfill, not an ongoing concern.

3. **Breadcrumb in main content vs. inside secondary pane?**
   - What we know: Locked decision says "always visible at the top of the main content area."
   - What's unclear: When no workspace is selected (org view), what does the breadcrumb show? Just "Org Name"?
   - Recommendation: Show breadcrumb at all times. When at org level: "Org Name". When at workspace level: "Org Name / Workspace Name". When filtering by folder: "Org Name / Workspace Name / Folder Name". This is a display logic decision for the planner.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `src/types/bank.ts`, `src/hooks/useBankContext.ts`, `src/stores/bankContextStore.ts` — current Bank/Vault/Hub type system
- Codebase direct read: `supabase/migrations/20260131000005_create_banks_tables.sql`, `20260131000006_create_vaults_tables.sql` — current schema
- Codebase direct read: `supabase/migrations/20260210235500_shared_links_and_vault_invite_rpc.sql` — existing invite token pattern
- Codebase direct read: `src/components/panes/VaultListPane.tsx`, `VaultDetailPane.tsx`, `panels/VaultMemberPanel.tsx` — components to modify
- Codebase direct read: `src/components/layout/AppShell.tsx` — layout to extend
- Codebase direct read: `src/components/dialogs/VaultInviteDialog.tsx`, `src/pages/VaultJoin.tsx` — invite patterns to extend
- Codebase direct read: `src/hooks/useFolders.ts`, `src/types/folders.ts` — folder system (missing vault_id)
- Codebase direct read: `package.json` — confirmed installed: `@dnd-kit/core` 6.3.1, `framer-motion` 12.x, `@radix-ui/react-collapsible` 1.1.12

### Secondary (MEDIUM confidence)
- `supabase/CLAUDE.md` — confirmed Edge Function patterns, SECURITY DEFINER RPC approach, RLS requirements
- `src/CLAUDE.md` — confirmed AppShell usage, 500ms transition requirement, icon system, button variants

### Tertiary (LOW confidence)
- Supabase views + RLS interaction: general Postgres knowledge, recommend testing in dev before shipping

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json, codebase directly read
- Architecture: HIGH — existing patterns directly observed in codebase
- Critical schema gap (folder vault_id): HIGH — confirmed by reading folders.ts and useFolders.ts
- Email invite mechanism: MEDIUM — infrastructure unknown, flagged as open question
- Pitfalls: HIGH — derived directly from codebase analysis, not speculation

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable codebase; only invalidated by concurrent schema changes)
