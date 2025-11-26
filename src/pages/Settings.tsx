import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiLoader2Line } from "@remixicon/react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSetupWizard } from "@/hooks/useSetupWizard";
import AccountTab from "@/components/settings/AccountTab";
import BillingTab from "@/components/settings/BillingTab";
import IntegrationsTab from "@/components/settings/IntegrationsTab";
import UsersTab from "@/components/settings/UsersTab";
import AdminTab from "@/components/settings/AdminTab";
import AITab from "@/components/settings/AITab";
import FathomSetupWizard from "@/components/settings/FathomSetupWizard";

export default function Settings() {
  const { role, loading: roleLoading, isAdmin, isTeam } = useUserRole();
  const { wizardCompleted, loading: wizardLoading, markWizardComplete } = useSetupWizard();
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    // Show wizard if not completed (blocking mode handled in redirect logic)
    if (!wizardLoading && !wizardCompleted) {
      setShowWizard(true);
    }
  }, [wizardLoading, wizardCompleted]);

  const handleWizardComplete = async () => {
    await markWizardComplete();
    setShowWizard(false);
  };

  if (roleLoading || wizardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RiLoader2Line className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine default tab based on role
  const getDefaultTab = () => {
    if (!wizardCompleted) return "account";
    return "account";
  };

  return (
    <>
      <Tabs defaultValue={getDefaultTab()}>
        {/* Tabs at the very top */}
        <div className="max-w-[1800px] mx-auto pt-2">
          <TabsList>
            <TabsTrigger value="account">ACCOUNT</TabsTrigger>
            {(isTeam || isAdmin) && (
              <TabsTrigger value="users">USERS</TabsTrigger>
            )}
            <TabsTrigger value="billing">BILLING</TabsTrigger>
            <TabsTrigger value="integrations">INTEGRATIONS</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin">ADMIN</TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Full-width black line */}
        <div className="w-full border-b border-cb-black dark:border-cb-white" />

        {/* Page Header */}
        <div className="max-w-[1800px] mx-auto">
          <div className="mt-2 mb-3">
            <h1 className="font-display text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
              Settings
            </h1>
            <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
              Manage your account, integrations, and preferences
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-[1800px] mx-auto">
          {/* ACCOUNT TAB */}
          <TabsContent value="account" className="space-y-0">
            <AccountTab />
          </TabsContent>

          {/* USERS TAB (TEAM/ADMIN only) */}
          {(isTeam || isAdmin) && (
            <TabsContent value="users" className="space-y-0">
              <UsersTab />
            </TabsContent>
          )}

          {/* BILLING TAB */}
          <TabsContent value="billing" className="space-y-0">
            <BillingTab />
          </TabsContent>

          {/* INTEGRATIONS TAB */}
          <TabsContent value="integrations" className="space-y-0">
            <IntegrationsTab />
          </TabsContent>

          {/* AI TAB */}
          <TabsContent value="ai" className="space-y-0">
            <AITab />
          </TabsContent>

          {/* ADMIN TAB (ADMIN only) */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-0">
              <AdminTab />
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Fathom Setup Wizard */}
      {showWizard && (
        <FathomSetupWizard
          open={showWizard}
          onComplete={handleWizardComplete}
        />
      )}
    </>
  );
}
