import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RiLoader2Line,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiArrowUpDownLine,
} from "@remixicon/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string;
  role: "FREE" | "PRO" | "TEAM" | "ADMIN";
  onboarding_completed: boolean;
  created_at: string;
}

interface UserTableProps {
  users: UserProfile[];
  isAdmin: boolean;
  updatingUserId: string | null;
  onRoleChange: (userId: string, newRole: "FREE" | "PRO" | "TEAM" | "ADMIN") => void;
  onManageUser?: (userId: string) => void;
  showActions?: boolean;
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
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const UserTable = React.memo(({
  users,
  isAdmin,
  updatingUserId,
  onRoleChange,
  onManageUser,
  showActions = true,
}: UserTableProps) => {
  const { sortField, sortedData: sortedUsers, handleSort } = useTableSort(users, "created_at");

  const SortButton = ({ field, children }: { field: keyof UserProfile; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="h-8 px-2 inline-flex items-center justify-center gap-2 hover:bg-muted/50 font-medium text-sm rounded-md transition-colors cursor-pointer"
    >
      {children}
      <RiArrowUpDownLine className={`h-3.5 w-3.5 ${sortField === field ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
              <TableHead className="min-w-[200px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="display_name">USER</SortButton>
              </TableHead>
              <TableHead className="min-w-[100px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="role">ROLE</SortButton>
              </TableHead>
              <TableHead className="min-w-[100px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="onboarding_completed">STATUS</SortButton>
              </TableHead>
              <TableHead className="hidden lg:table-cell min-w-[120px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                <SortButton field="created_at">JOINED</SortButton>
              </TableHead>
              {showActions && (
                <TableHead className="text-center w-[120px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
                  ACTIONS
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow
                key={user.user_id}
                className="group h-10 md:h-12 hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark"
              >
                <TableCell className="py-0.5">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                      {user.display_name || "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-0.5 whitespace-nowrap">
                  {isAdmin && updatingUserId !== user.user_id ? (
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        onRoleChange(user.user_id, value as "FREE" | "PRO" | "TEAM" | "ADMIN")
                      }
                    >
                      <SelectTrigger className="w-32">
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
                      {updatingUserId === user.user_id && (
                        <RiLoader2Line className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {user.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-0.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {user.onboarding_completed ? (
                      <RiCheckboxCircleLine className="h-4 w-4 text-success" />
                    ) : (
                      <RiCloseCircleLine className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge
                      variant={user.onboarding_completed ? "default" : "outline"}
                    >
                      {user.onboarding_completed ? "Active" : "Pending"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell py-0.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  {formatDate(user.created_at)}
                </TableCell>
                {showActions && (
                  <TableCell className="py-0.5 whitespace-nowrap text-center">
                    {onManageUser && (
                      <Button
                        variant="hollow"
                        size="sm"
                        onClick={() => onManageUser(user.user_id)}
                      >
                        {isAdmin ? "VIEW DETAILS" : "MANAGE"}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});

UserTable.displayName = "UserTable";
