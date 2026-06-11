import React from "react";
import { Link } from "react-router-dom";
import { RiShieldLine } from "@remixicon/react";
import { useUserRole } from "@/hooks/useUserRole";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center bg-background"
        data-testid="admin-guard-loading"
        role="status"
        aria-label="Checking admin access"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center text-center px-6 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
            <RiShieldLine className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Admin Access Required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to administrators. If you think you should
            have access, contact your workspace admin.
          </p>
          <Button variant="hollow" className="mt-6" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
