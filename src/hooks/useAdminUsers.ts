/**
 * Admin Users hooks (16-02) — ported from worktree-admin-center.
 * The branch's deprecated useUpdateUserBilling stub was dropped — billing is
 * read-only in the admin surface and the ported UserProfileDetails never
 * referenced it.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllUsers,
  updateUserRoleAsAdmin,
  resetUserPasswordAsAdmin,
  revokeAccessAsAdmin,
  restoreAccessAsAdmin,
  deleteUserAsAdmin,
} from "@/services/admin-users.service";
import { queryKeys } from "@/lib/query-config";
import { toast } from "sonner";

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: fetchAllUsers,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateUserRoleAsAdmin(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'audit'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
      toast.success("User role updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      resetUserPasswordAsAdmin(userId, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'audit'] });
      toast.success("User password reset");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    },
  });
}

export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => revokeAccessAsAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'audit'] });
      toast.success("User access revoked");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke access: ${error.message}`);
    },
  });
}

export function useRestoreAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => restoreAccessAsAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'audit'] });
      toast.success("User access restored");
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore access: ${error.message}`);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, confirmEmail }: { userId: string; confirmEmail: string }) =>
      deleteUserAsAdmin(userId, confirmEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'audit'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
      toast.success("User permanently deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });
}
