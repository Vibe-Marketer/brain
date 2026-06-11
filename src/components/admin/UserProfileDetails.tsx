/**
 * Pane-native user detail for the Admin Center (16-02) — ported from
 * worktree-admin-center. Every action routes through the admin-manage-user
 * edge function (server-side admin check + audit log); billing is read-only.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RiCloseLine,
  RiShieldLine,
  RiAlarmWarningLine,
  RiDeleteBinLine,
  RiInformationLine,
} from "@remixicon/react";
import {
  useAdminUsers,
  useUpdateUserRole,
  useResetUserPassword,
  useRevokeAccess,
  useRestoreAccess,
  useDeleteUser,
} from "@/hooks/useAdminUsers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserProfileDetailsProps {
  id: string;
  onClose?: () => void;
}

const ROLES = ["FREE", "PRO", "TEAM", "ADMIN"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{label}</div>
      <div className="text-xs text-foreground break-words">{children}</div>
    </div>
  );
}

export function UserProfileDetails({ id, onClose }: UserProfileDetailsProps) {
  const { data: users, isLoading } = useAdminUsers();
  const { mutate: updateRole, isPending: rolePending } = useUpdateUserRole();
  const { mutate: resetPassword, isPending: resetPending } = useResetUserPassword();
  const { mutate: revokeAccess, isPending: revokePending } = useRevokeAccess();
  const { mutate: restoreAccess, isPending: restorePending } = useRestoreAccess();
  const { mutate: deleteUser, isPending: deletePending } = useDeleteUser();

  const user = users?.find((u) => u.id === id);

  const [selectedRole, setSelectedRole] = useState<string>(user?.role ?? "FREE");
  const [newPassword, setNewPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Re-sync local controls when a different user opens in the pane.
  useEffect(() => {
    setSelectedRole(user?.role ?? "FREE");
    setNewPassword("");
    setDeleteOpen(false);
    setDeleteConfirm("");
  }, [id, user?.role]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">User not found.</p>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close">
              <RiCloseLine className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const handleConfirmRole = () => {
    if (selectedRole === user.role) return;
    updateRole({ userId: user.id, role: selectedRole });
  };

  const handleResetPassword = () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    resetPassword(
      { userId: user.id, newPassword },
      { onSuccess: () => setNewPassword("") }
    );
  };

  const deleteEmail = user.email ?? "";
  const confirmMatches =
    deleteConfirm.trim().toLowerCase() === deleteEmail.toLowerCase() && deleteEmail.length > 0;

  const handleDelete = () => {
    if (!confirmMatches) return;
    deleteUser(
      { userId: user.id, confirmEmail: deleteEmail },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          setDeleteConfirm("");
          onClose?.();
        },
      }
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground font-semibold">
            {user.display_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground truncate">
              {user.display_name ?? user.email ?? "User"}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={onClose}
            aria-label="Close user detail"
          >
            <RiCloseLine className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Read-only profile */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Email">{user.email ?? "—"}</Field>
        <Field label="Name">{user.display_name ?? "—"}</Field>
        <Field label="User ID">
          <code className="break-all">{user.id}</code>
        </Field>
        <Field label="Profile ID">
          <code className="break-all">{user.profile_id}</code>
        </Field>
        <Field label="Joined">
          <span className="tabular-nums">
            {user.created_at ? new Date(user.created_at).toLocaleString() : "—"}
          </span>
        </Field>
        <Field label="Plan / Status">
          {user.product_id ?? "—"}
          <span className="block text-muted-foreground capitalize">
            {user.subscription_status ?? "no subscription"}
          </span>
        </Field>
      </div>

      {/* Role section */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <RiShieldLine className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-xs text-foreground">
            Role
          </h3>
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="h-8" aria-label="Select new role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="hollow"
            size="sm"
            disabled={selectedRole === user.role || rolePending}
            onClick={handleConfirmRole}
          >
            {rolePending ? "Saving…" : "Confirm"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Role changes go through the admin service and are recorded in the audit log.
        </p>
      </div>

      {/* Danger zone */}
      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <RiAlarmWarningLine className="h-4 w-4 text-destructive" />
          <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-xs text-destructive">
            Danger Zone
          </h3>
        </div>

        {/* DELETE — the prominent destructive action (punch item 1 + 2). */}
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2">
            <RiDeleteBinLine className="h-4 w-4 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Delete this user</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Permanently removes the account, their workspaces, and all associated data.
            This cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setDeleteOpen(true)}
          >
            <RiDeleteBinLine className="mr-1.5 h-4 w-4" />
            Delete user permanently
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
            Reset password
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-8"
            />
            <Button
              variant="hollow"
              size="sm"
              disabled={newPassword.length < 8 || resetPending}
              onClick={handleResetPassword}
            >
              {resetPending ? "Resetting…" : "Reset"}
            </Button>
          </div>
        </div>

        {/* Suspend / restore — demoted below delete, plainly labelled. */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
              Sign-in access
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex" tabIndex={0} aria-label="What suspend does">
                    <RiInformationLine className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px]">
                  <span className="text-xs">Blocks login without deleting any data. Fully reversible.</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="hollow"
              size="sm"
              disabled={revokePending}
              onClick={() => revokeAccess({ userId: user.id })}
            >
              {revokePending ? "Suspending…" : "Suspend sign-in (revocable)"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={restorePending}
              onClick={() => restoreAccess({ userId: user.id })}
            >
              {restorePending ? "Restoring…" : "Restore"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Every action here is verified server-side and written to the audit log. Billing is
          read-only — subscription changes happen in the payment processor.
        </p>
      </div>

      {/* Typed-confirmation delete gate */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteConfirm(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RiDeleteBinLine className="h-5 w-5" />
              Delete user permanently
            </DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium text-foreground">{deleteEmail || "this user"}</span>,
              their workspaces, and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="delete-confirm-email" className="text-xs text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{deleteEmail}</span> to confirm.
            </label>
            <Input
              id="delete-confirm-email"
              autoComplete="off"
              placeholder={deleteEmail}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deletePending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!confirmMatches || deletePending}
              onClick={handleDelete}
            >
              {deletePending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
