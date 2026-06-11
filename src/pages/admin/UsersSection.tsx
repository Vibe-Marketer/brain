/**
 * Admin Center Users section (16-02) — ported from worktree-admin-center.
 * Row click opens the pane-native UserProfileDetails via adminDetailStore.
 */
import { useMemo, useState } from "react";
import { RiTeamLine } from "@remixicon/react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = ["FREE", "PRO", "TEAM", "ADMIN"] as const;

export default function UsersSection() {
  const { data: users, isLoading, error } = useAdminUsers();
  const openUser = useAdminDetailStore((s) => s.openUser);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Distinct plans come from the data itself, plus an explicit no-plan bucket.
  const plans = useMemo(() => {
    const set = new Set<string>();
    for (const u of users ?? []) {
      if (u.product_id) set.add(u.product_id);
    }
    return [...set].sort();
  }, [users]);

  const filtered = (users ?? []).filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesPlan =
      planFilter === "all" ||
      (planFilter === "none" ? !u.product_id : u.product_id === planFilter);
    return matchesSearch && matchesRole && matchesPlan;
  });

  const totalUsers = users?.length ?? 0;
  const adminCount = (users ?? []).filter((u) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Users
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums mt-1">
            {totalUsers} users · {adminCount} admins
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-36">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger aria-label="Filter by plan">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="none">No plan</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Input
              placeholder="Search email, name, id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-destructive">Failed to load users.</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
            <RiTeamLine className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No users found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => openUser(user.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="font-medium text-foreground truncate">
                      {user.email ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.display_name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{user.product_id ?? "—"}</div>
                    {user.subscription_status && (
                      <div className="text-xs text-muted-foreground capitalize">
                        {user.subscription_status}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
