/**
 * Admin Center shell (16-01) — ported from worktree-admin-center.
 *
 * AppShell 4-pane layout with the AdminCategoryPane as the secondary pane.
 * Wave 1 sections: Dashboard + Tickets. Wave 2 adds Users; QA/Audit follow.
 * The branch's FlagsSection/Automation/Support sections were stripped —
 * feature flags are deleted on main and the live ticket UI is mounted from
 * main's own components instead of the branch's dead-schema implementation.
 */
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { AppShell } from "@/components/layout/AppShell";
import {
  AdminCategoryPane,
  AdminCategory,
  ADMIN_CATEGORIES,
} from "@/components/panes/AdminCategoryPane";
import DashboardSection from "./DashboardSection";
import TicketsSection from "./TicketsSection";

const VALID_SECTIONS = new Set<string>(ADMIN_CATEGORIES.map((c) => c.id));

export default function AdminCenter() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();

  // Unknown section in the URL → send back to the dashboard.
  if (section && !VALID_SECTIONS.has(section)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const activeSection = (section as AdminCategory) || "dashboard";

  const handleCategorySelect = (category: AdminCategory) => {
    navigate(`/admin/${category}`);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "tickets":
        return <TicketsSection />;
      case "dashboard":
      default:
        return <DashboardSection />;
    }
  };

  return (
    <AdminGuard>
      <AppShell
        config={{
          secondaryPane: (
            <AdminCategoryPane
              selectedCategory={activeSection}
              onCategorySelect={handleCategorySelect}
            />
          ),
          secondaryPaneTitle: "Admin",
        }}
      >
        <div className="flex-1 overflow-auto bg-card relative z-0 min-h-0 h-full">
          <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-montserrat font-extrabold uppercase tracking-wide text-foreground">
                  Admin Center
                </h1>
                <p className="mt-2 text-muted-foreground">
                  CallVault Superadmin Control Panel
                </p>
              </div>
              <div className="h-8 px-3 rounded-full bg-vibe-orange/10 border border-vibe-orange/20 text-vibe-orange text-xs font-medium flex items-center shadow-[0_0_15px] shadow-vibe-orange/15">
                System Live
              </div>
            </div>
            {renderSection()}
          </div>
        </div>
        <AdminCommandPalette />
      </AppShell>
    </AdminGuard>
  );
}
