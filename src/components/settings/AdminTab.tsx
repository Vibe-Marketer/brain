import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  RiArrowRightLine,
  RiLoader2Line,
  RiGroupLine,
  RiSearchLine,
  RiShieldStarLine,
  RiLockLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useUserRole } from "@/hooks/useUserRole";
import { UserTable } from "@/components/settings/UserTable";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string;
  role: "FREE" | "PRO" | "TEAM" | "ADMIN";
  last_login_at: string | null;
  setup_wizard_completed: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export default function AdminTab() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Define applyFilters BEFORE the useEffect that uses it to avoid TDZ errors
  const applyFilters = useCallback(() => {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.display_name?.toLowerCase().includes(query) ||
          user.user_id.toLowerCase().includes(query)
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  useEffect(() => {
    loadSystemData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, roleFilter, applyFilters]);

  const loadSystemData = async () => {
    try {
      // Fetch all user profiles with emails (ADMIN can see all via RLS policy)
      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get roles for each user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Create role map
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

      // Combine profiles with roles
      const profilesWithData = (profiles || []).map((profile) => ({
        ...profile,
        role: roleMap.get(profile.user_id) || "FREE",
        email: profile.email || "Unknown",
        last_login_at: null, // TODO: Track in separate table
        setup_wizard_completed: profile.onboarding_completed || false,
      }));

      setUsers(profilesWithData as UserProfile[]);
    } catch (error) {
      logger.error("Error loading system data", error);
      toast.error("Failed to load system data");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "FREE" | "PRO" | "TEAM" | "ADMIN") => {
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
      await loadSystemData();
    } catch (error) {
      logger.error("Error updating user role", error);
      toast.error("Failed to update user role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
        <RiLockLine className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">Admin access required</p>
        <p className="text-xs text-muted-foreground">
          This section is restricted to platform administrators.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Admin Center pointer (16-01) — System Overview + Tickets moved to /admin */}
      <div className="relative flex items-center gap-4 p-5 bg-card border border-border rounded-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-vibe-orange/10 border border-vibe-orange/20 shrink-0">
          <RiShieldStarLine className="h-5 w-5 text-vibe-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Admin Center moved
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            System overview and tickets now live in the Admin Center — dashboard,
            deploy status, and the full ticket queue in one place.
          </p>
        </div>
        <Button variant="hollow" onClick={() => navigate("/admin/dashboard")}>
          Open Admin Center
          <RiArrowRightLine className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Separator className="my-16" />

      {/* User Management Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">
            User Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            System-wide user administration and role management
          </p>
        </div>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative mt-2">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-40">
              <Label htmlFor="role-filter">Filter by Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="role-filter" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="FREE">FREE</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                  <SelectItem value="TEAM">TEAM</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* User Table */}
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border">
              <RiGroupLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "all" ? "No users match your filters" : "No users found"}
              </p>
            </div>
          ) : (
            <>
              <ErrorBoundary>
                <UserTable
                  users={filteredUsers}
                  isAdmin={true}
                  updatingUserId={updatingUserId}
                  onRoleChange={handleRoleChange}
                  onManageUser={() => {
                    toast.info("Advanced user management coming soon");
                  }}
                  showActions={true}
                />
              </ErrorBoundary>
            </>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {filteredUsers.length} of {users.length} users
            </p>
            <p className="text-xs">
              Results update in real-time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
