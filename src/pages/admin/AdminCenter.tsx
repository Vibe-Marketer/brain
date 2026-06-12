/**
 * Admin Center shell (16-01, Users added in 16-02) — ported from
 * worktree-admin-center.
 *
 * AppShell 4-pane layout with the AdminCategoryPane as the secondary pane.
 * Sections: Dashboard + Tickets (16-01) + Users (16-02). QA/Audit follow.
 * The branch's FlagsSection/Automation/Support sections were stripped —
 * feature flags are deleted on main and the live ticket UI is mounted from
 * main's own components instead of the branch's dead-schema implementation.
 *
 * Detail surfaces:
 *   - Tickets keep main's TicketDetailDialog (owned by the ticket workstream).
 *   - Users get the branch's pane-native detail: UserProfileDetails renders in
 *     a right-hand pane on the same plane as the content (no overlay), driven
 *     by adminDetailStore so the palette and Users table can both open it.
 *     Main's AppShell pane 4 is panelStore-bound, so the pane lives here in
 *     the admin chunk instead of in the shared DetailPaneOutlet.
 */
import { Suspense, lazy, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { AppShell } from "@/components/layout/AppShell";
import {
  AdminCategoryPane,
  AdminCategory,
  ADMIN_CATEGORIES,
} from "@/components/panes/AdminCategoryPane";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/ui/page-header";
import { RiShieldLine, RiUser3Line } from "@remixicon/react";
import DashboardSection from "./DashboardSection";
import TicketsSection from "./TicketsSection";
import UsersSection from "./UsersSection";
import QaSection from "./QaSection";
import AuditSection from "./AuditSection";

// Loaded on demand — only mounts when a user detail opens.
const UserProfileDetails = lazy(() =>
  import("@/components/admin/UserProfileDetails").then((m) => ({
    default: m.UserProfileDetails,
  }))
);

const VALID_SECTIONS = new Set<string>(ADMIN_CATEGORIES.map((c) => c.id));

function DetailPaneFallback() {
  return (
    <div className="h-full p-4 space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function AdminCenter() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { detail, close } = useAdminDetailStore();

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
      case "users":
        return <UsersSection />;
      case "qa":
        return <QaSection />;
      case "audit":
        return <AuditSection />;
      case "dashboard":
      default:
        return <DashboardSection />;
    }
  };

  // Pane-native user detail (tickets use main's dialog inside TicketsSection).
  const userDetailId = detail?.type === "user" ? detail.id : null;

  // The detail pane must not linger when you switch 2nd-pane tabs — close it
  // whenever the active section changes.
  useEffect(() => {
    close();
  }, [activeSection, close]);

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
          detailPane: userDetailId ? (
            <div className="flex h-full min-h-0 flex-col">
              <PageHeader
                title="User Details"
                icon={RiUser3Line}
                showBackButton
                onBack={close}
              />
              <div className="min-h-0 flex-1">
                <Suspense fallback={<DetailPaneFallback />}>
                  <UserProfileDetails id={userDetailId} onClose={close} />
                </Suspense>
              </div>
            </div>
          ) : undefined,
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <PageHeader
            title="Admin Center"
            subtitle="CallVault Superadmin Control Panel"
            icon={RiShieldLine}
            actions={
              <div className="h-8 px-3 rounded-full bg-vibe-orange/10 border border-vibe-orange/20 text-vibe-orange text-xs font-medium flex items-center shadow-[0_0_15px] shadow-vibe-orange/15">
                System Live
              </div>
            }
          />
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6">{renderSection()}</div>
          </ScrollArea>
          <footer className="shrink-0 px-4 py-2" />
        </div>
        <AdminCommandPalette />
      </AppShell>
    </AdminGuard>
  );
}
