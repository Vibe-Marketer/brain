import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { RiLoader2Line, RiGroupLine } from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useUserRole } from "@/hooks/useUserRole";
import { UserTable } from "@/components/settings/UserTable";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { usePanelStore } from "@/stores/panelStore";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string;
  role: "FREE" | "PRO" | "TEAM" | "ADMIN";
  last_login_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export default function UsersTab() {
  const { isAdmin } = useUserRole();
  const { openPanel } = usePanelStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) return;

      // For TEAM users: Show only users in same organization (future: add org_id filtering)
      // For ADMIN users: Show all users in organization
      // Note: Full system-wide user management is in AdminTab

      // Query user_profiles with email and roles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select(`
          user_id,
          email,
          display_name,
          onboarding_completed,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for each user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Create role map
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

      // Combine profiles with roles
      const profilesWithData = (profiles || []).map((profile) => ({
        user_id: profile.user_id,
        email: profile.email || "Unknown",
        display_name: profile.display_name,
        role: roleMap.get(profile.user_id) || "FREE",
        last_login_at: null, // TODO: Track in separate table
        onboarding_completed: profile.onboarding_completed || false,
        created_at: profile.created_at,
      }));

      setUsers(profilesWithData as UserProfile[]);
    } catch (error) {
      logger.error("Error loading users", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "FREE" | "PRO" | "TEAM" | "ADMIN") => {
    if (!isAdmin) {
      toast.error("Only administrators can change user roles");
      return;
    }

    try {
      setUpdatingUserId(userId);

      // Delete old role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: newRole,
        });

      if (error) throw error;

      toast.success("User role updated successfully");
      await loadUsers(); // Refresh the list
    } catch (error) {
      logger.error("Error updating user role", error);
      toast.error("Failed to update user role");
    } finally {
      setUpdatingUserId(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Organization Users Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Organization Users
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            {isAdmin
              ? "Manage user roles and access within your organization"
              : "View users in your organization"}
          </p>
        </div>
        <div>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border dark:border-cb-border-dark">
              <RiGroupLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          ) : (
            <UserTable
              users={users}
              isAdmin={isAdmin}
              updatingUserId={updatingUserId}
              onRoleChange={handleRoleChange}
              onManageUser={(userId) => {
                openPanel('user-detail', { type: 'user-detail', userId, onUserUpdated: loadUsers });
              }}
              showActions={isAdmin}
            />
          )}
        </div>
      </div>

      {/* Information Section */}
      <div className="space-y-4 mt-12">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            User Management
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Information about user roles and permissions
          </p>
        </div>
        <div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              Role Descriptions
            </h3>
            <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="shrink-0">FREE</Badge>
                <p>Individual users with access to core features and personal meetings</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="default" className="shrink-0">PRO</Badge>
                <p>Premium individual users with access to advanced features and priority support</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="default" className="shrink-0">TEAM</Badge>
                <p>Hub members with shared organization access and collaboration features</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="destructive" className="shrink-0">ADMIN</Badge>
                <p>Full administrative access including user management and system settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
