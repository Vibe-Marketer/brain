import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RiUserLine,
  RiCalendarLine,
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiLoader2Line,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { usePanelStore } from "@/stores/panelStore";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useUserRole } from "@/hooks/useUserRole";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string;
  role: "FREE" | "PRO" | "TEAM" | "ADMIN";
  last_login_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

interface UserDetailPanelProps {
  userId: string;
  onUserUpdated?: () => void;
}

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "ADMIN":
      return "destructive";
    case "TEAM":
      return "default";
    case "PRO":
      return "default";
    default:
      return "outline";
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

export function UserDetailPanel({
  userId,
  onUserUpdated,
}: UserDetailPanelProps) {
  const { closePanel, togglePin, isPinned } = usePanelStore();
  const { isAdmin } = useUserRole();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);

  const loadUserDetails = useCallback(async () => {
    try {
      setLoading(true);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select(`
          user_id,
          email,
          display_name,
          onboarding_completed,
          created_at
        `)
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const userProfile: UserProfile = {
        user_id: profile.user_id,
        email: profile.email || "Unknown",
        display_name: profile.display_name,
        role: roleData?.role || "FREE",
        last_login_at: null, // TODO: Track in separate table
        onboarding_completed: profile.onboarding_completed || false,
        created_at: profile.created_at,
      };

      setUser(userProfile);
    } catch (error) {
      logger.error("Error loading user details", error);
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserDetails();
  }, [loadUserDetails]);

  const handleRoleChange = async (newRole: "FREE" | "PRO" | "TEAM" | "ADMIN") => {
    if (!user || !isAdmin) {
      toast.error("Only administrators can change user roles");
      return;
    }

    try {
      setUpdatingRole(true);

      // Delete old role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.user_id);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.user_id,
          role: newRole,
        });

      if (error) throw error;

      toast.success("User role updated successfully");

      // Update local state
      setUser({ ...user, role: newRole });

      // Notify parent to refresh
      onUserUpdated?.();
    } catch (error) {
      logger.error("Error updating user role", error);
      toast.error("Failed to update user role");
    } finally {
      setUpdatingRole(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // User not found
  if (!user) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">User Not Found</h3>
          <Button variant="ghost" size="sm" onClick={closePanel}>
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-ink-muted">
          The selected user could not be found. They may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      role="region"
      aria-label={`User details: ${user.display_name || user.email}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <RiUserLine className="h-5 w-5 text-vibe-orange" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-ink truncate" id="user-panel-title">
              {user.display_name || "No Name"}
            </h3>
            <p className="text-xs text-ink-muted truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" role="toolbar" aria-label="Panel actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            aria-label={isPinned ? "Unpin panel" : "Pin panel"}
            aria-pressed={isPinned}
          >
            {isPinned ? (
              <RiPushpinFill className="h-4 w-4 text-ink" aria-hidden="true" />
            ) : (
              <RiPushpinLine className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status and Joined Stats */}
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="User statistics">
          <div className="bg-cb-card rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-ink-muted mb-1">
              {user.onboarding_completed ? (
                <RiCheckboxCircleLine className="h-4 w-4 text-success" />
              ) : (
                <RiCloseCircleLine className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs">Status</span>
            </div>
            <Badge
              variant={user.onboarding_completed ? "default" : "outline"}
              className="text-sm"
            >
              {user.onboarding_completed ? "Active" : "Pending"}
            </Badge>
          </div>
          <div className="bg-cb-card rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-ink-muted mb-1">
              <RiCalendarLine className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">Joined</span>
            </div>
            <div className="text-xs font-medium text-ink">
              {new Date(user.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* User Information */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
            User Information
          </h4>

          {/* Display Name */}
          <div className="space-y-1">
            <span className="text-xs text-ink-muted">Display Name</span>
            <div className="text-sm text-ink">
              {user.display_name || <span className="text-ink-muted italic">Not set</span>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <span className="text-xs text-ink-muted">Email</span>
            <div className="text-sm text-ink">{user.email}</div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <span className="text-xs text-ink-muted">Role</span>
            {isAdmin && !updatingRole ? (
              <Select
                value={user.role}
                onValueChange={(value) =>
                  handleRoleChange(value as "FREE" | "PRO" | "TEAM" | "ADMIN")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">FREE</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                  <SelectItem value="TEAM">TEAM</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {updatingRole && (
                  <RiLoader2Line className="mr-1 h-3 w-3 animate-spin" />
                )}
                {user.role}
              </Badge>
            )}
          </div>

          {/* Onboarding Status */}
          <div className="space-y-1">
            <span className="text-xs text-ink-muted">Onboarding Status</span>
            <div className="text-sm text-ink">
              {user.onboarding_completed ? "Completed" : "Not completed"}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
            Account Details
          </h4>
          <div className="text-sm text-ink-muted space-y-1">
            <p>Created: {formatDate(user.created_at)}</p>
            <p>Last Login: {formatDate(user.last_login_at)}</p>
          </div>
        </div>

        {/* Role Descriptions */}
        <div className="space-y-2 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
            Role Information
          </h4>
          <div className="space-y-3 text-xs text-ink-muted">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0 text-xs">FREE</Badge>
              <p>Individual users with access to core features</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="default" className="shrink-0 text-xs">PRO</Badge>
              <p>Premium users with advanced features</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="default" className="shrink-0 text-xs">TEAM</Badge>
              <p>Team members with shared organization access</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="destructive" className="shrink-0 text-xs">ADMIN</Badge>
              <p>Full administrative access to all features</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDetailPanel;
