# Admin Access Setup

## Overview

The CallVault admin system uses role-based access control (RBAC) to restrict access to sensitive features like the Debug Tool.

## User Roles

The system supports four role types (defined in `app_role` enum):
- `FREE` - Default role for all new users
- `PRO` - Premium features access
- `TEAM` - Multi-user access
- `ADMIN` - Full system access (including Debug Tool)

## Granting Admin Access

To grant admin access to a user for testing or administrative purposes:

### Option 1: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following query (replace `USER_EMAIL` with the actual email):

```sql
-- Get the user ID from their email
WITH target_user AS (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL@example.com'
)
-- Insert ADMIN role for the user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ADMIN' FROM target_user
ON CONFLICT (user_id, role) DO NOTHING;
```

### Option 2: Using Supabase CLI

```bash
# Run migration to grant admin access
supabase sql --db-url "YOUR_DATABASE_URL" <<SQL
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'ADMIN')
ON CONFLICT (user_id, role) DO NOTHING;
SQL
```

### Option 3: Programmatically (Admin Only)

If you already have an admin account, you can use the Supabase client:

```typescript
import { supabase } from '@/integrations/supabase/client';

// This will only work if the current user is an ADMIN
await supabase
  .from('user_roles')
  .insert({ user_id: 'TARGET_USER_UUID', role: 'ADMIN' });
```

## Verifying Admin Access

After granting admin role:

1. Log in with the admin user account
2. Navigate to **Sorting & Tagging** page (`/sorting-tagging`)
3. The **Debug Tool** category should now be visible in the category list
4. Click on **Debug Tool** to access admin diagnostic features

The Debug Tool provides:
- Real-time statistics for tags, rules, folders, and calls
- Dry-run testing of rule execution
- Query cache clearing
- System health monitoring

## Debug Tool Features

The debug tool (located at `/sorting-tagging/debug`) includes:

- **Statistics Dashboard**: View counts for tags, rules, folders, and calls
- **Test Rules**: Execute rules in dry-run mode (no changes made)
- **Clear Cache**: Force fresh data fetch by invalidating query cache
- **Refresh Stats**: Update statistics in real-time

## Security Notes

- The `user_roles` table is protected by Row Level Security (RLS)
- Only admins can insert, update, or delete roles
- Users can only view their own roles
- The `get_user_role()` function is SECURITY DEFINER to prevent privilege escalation
- Role checks use the secure `has_role()` function

## Implementation Details

### Frontend Components

- `src/components/tags/DebugTool.tsx` - Debug tool UI component
- `src/hooks/useUserRole.ts` - Role checking hook
- `src/components/panes/SortingCategoryPane.tsx` - Conditionally shows debug category for admins
- `src/components/panes/SortingDetailPane.tsx` - Renders debug tool when category is "debug"

### Database Functions

- `public.get_user_role(user_id UUID)` - Returns highest role for a user
- `public.has_role(user_id UUID, role app_role)` - Checks if user has specific role

### Database Schema

- `public.user_roles` table stores user-role associations
- `app_role` enum defines valid role types
- Indexes on `user_id` and `role` for performance
