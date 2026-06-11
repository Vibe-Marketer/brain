/**
 * Settings → Admin tab (16-02): reduced to a pointer card.
 *
 * 16-01 moved System Overview + Tickets to the Admin Center; 16-02 moved the
 * last remaining section (User Management) there too — the ported
 * UsersSection has server-side authz, audit logging, password reset, and
 * revoke/restore, which this tab's direct-table role editor never had.
 * The tab now exists only to redirect admins who look for admin tools in
 * Settings out of habit.
 */
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  RiArrowRightLine,
  RiLoader2Line,
  RiShieldStarLine,
  RiLockLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

export default function AdminTab() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

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

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Admin Center pointer — everything admin lives at /admin now */}
      <div className="relative flex items-center gap-4 p-5 bg-card border border-border rounded-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-vibe-orange/10 border border-vibe-orange/20 shrink-0">
          <RiShieldStarLine className="h-5 w-5 text-vibe-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Admin Center moved
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            System overview, tickets, and user management now live in the Admin
            Center — dashboard, deploy status, the full ticket queue, and
            audited user controls in one place.
          </p>
        </div>
        <Button variant="hollow" onClick={() => navigate("/admin/dashboard")}>
          Open Admin Center
          <RiArrowRightLine className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
