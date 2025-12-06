import { useState, useEffect, useCallback } from "react";
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
  RiLoader2Line,
  RiGroupLine,
  RiCheckboxCircleLine,
  RiSearchLine,
  RiShieldLine,
  RiPulseLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { UserTable } from "@/components/settings/UserTable";
import { supabase } from "@/integrations/supabase/client";

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

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  teamUsers: number;
  proUsers: number;
  freeUsers: number;
  completedSetup: number;
}

export default function AdminTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    teamUsers: 0,
    proUsers: 0,
    freeUsers: 0,
    completedSetup: 0,
  });
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

      // Calculate statistics
      const userStats = profilesWithData as UserProfile[];
      setStats({
        totalUsers: userStats.length,
        activeUsers: userStats.filter((u) => u.last_login_at !== null).length,
        adminUsers: userStats.filter((u) => u.role === "ADMIN").length,
        teamUsers: userStats.filter((u) => u.role === "TEAM").length,
        proUsers: userStats.filter((u) => u.role === "PRO").length,
        freeUsers: userStats.filter((u) => u.role === "FREE").length,
        completedSetup: userStats.filter((u) => u.setup_wizard_completed).length,
      });
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

      {/* System Statistics Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            System Overview
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Platform-wide statistics and metrics
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiGroupLine className="h-5 w-5 text-cb-ink-muted" />
                <p className="text-xs font-medium text-muted-foreground">Total Users</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.totalUsers}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiPulseLine className="h-5 w-5 text-cb-ink-muted" />
                <p className="text-xs font-medium text-muted-foreground">Active Users</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.activeUsers}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiCheckboxCircleLine className="h-5 w-5 text-cb-ink-muted" />
                <p className="text-xs font-medium text-muted-foreground">Setup Complete</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.completedSetup}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiShieldLine className="h-5 w-5 text-destructive" />
                <p className="text-xs font-medium text-muted-foreground">Admins</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.adminUsers}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiGroupLine className="h-5 w-5 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Team</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.teamUsers}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiGroupLine className="h-5 w-5 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Pro</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.proUsers}</p>
            </div>
            <div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-vibe-orange"
                style={{
                  clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
                }}
              />
              <div className="flex items-center gap-3 mb-2">
                <RiGroupLine className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Free</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{stats.freeUsers}</p>
            </div>
        </div>
      </div>

      <Separator className="my-16" />

      {/* User Management Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            User Management
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
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
            <div className="flex flex-col items-center justify-center py-12 border border-cb-border dark:border-cb-border-dark">
              <RiGroupLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "all" ? "No users match your filters" : "No users found"}
              </p>
            </div>
          ) : (
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
