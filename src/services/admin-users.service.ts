/**
 * Admin Users service (16-02) — ported from worktree-admin-center, rebound
 * to live schema:
 *   - user_profiles has no avatar_url column on main (branch field dropped).
 *   - All privileged mutations route through the admin-manage-user edge
 *     function, which verifies the caller's JWT, checks
 *     has_role(caller, 'ADMIN') server-side, and writes the audit row to
 *     admin_audit_log with the real actor. No direct table writes and no
 *     client-side audit inserts.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AdminUserProfile {
  /** The auth user id (user_profiles.user_id) — the id every role/audit/edge-function call keys on. */
  id: string;
  /** The user_profiles row id, kept for row-level operations on the profile itself. */
  profile_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  role: string;
  subscription_status: string | null;
  product_id: string | null;
  polar_customer_id: string | null;
}

export async function fetchAllUsers(): Promise<AdminUserProfile[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (profilesError) throw profilesError;

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role");

  if (rolesError) throw rolesError;

  // Role rows key on the auth user id (user_id), not the profile row id.
  const roleMap = new Map<string, string>();
  for (const r of roles ?? []) {
    roleMap.set(r.user_id, r.role);
  }

  return (profiles ?? []).map((p) => ({
    id: p.user_id,
    profile_id: p.id,
    email: p.email,
    display_name: p.display_name,
    created_at: p.created_at ?? "",
    updated_at: p.updated_at ?? "",
    last_login_at: p.last_login_at,
    role: roleMap.get(p.user_id) ?? "FREE",
    subscription_status: p.subscription_status,
    product_id: p.product_id,
    polar_customer_id: p.polar_customer_id,
  }));
}

/**
 * Role changes route through the admin-manage-user edge function — the
 * function verifies the caller is an admin, performs the role write with the
 * service role, and records the audit row with the real actor.
 */
export async function updateUserRoleAsAdmin(userId: string, newRole: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: {
      action: "change_role",
      target_user_id: userId,
      new_role: newRole,
    },
  });

  if (error) throw error;
}

export async function resetUserPasswordAsAdmin(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: {
      action: "reset_password",
      target_user_id: userId,
      new_password: newPassword,
    },
  });

  if (error) throw error;
}

export async function revokeAccessAsAdmin(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: {
      action: "revoke_access",
      target_user_id: userId,
    },
  });

  if (error) throw error;
}

export async function restoreAccessAsAdmin(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: {
      action: "restore_access",
      target_user_id: userId,
    },
  });

  if (error) throw error;
}

/**
 * Hard-deletes a user. Irreversible. The edge function re-verifies the
 * confirmation email server-side, then runs the sanctioned trigger-bypass
 * cascade cleanup (owned workspaces + org memberships cleared first) before
 * deleting the auth user. `confirmEmail` must match the target's email
 * exactly — it is the typed-confirmation gate, checked on both ends.
 */
export async function deleteUserAsAdmin(userId: string, confirmEmail: string): Promise<void> {
  const { error } = await supabase.functions.invoke("admin-manage-user", {
    body: {
      action: "delete_user",
      target_user_id: userId,
      confirm_email: confirmEmail,
    },
  });

  if (error) throw error;
}
