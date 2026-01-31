import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RiLoader2Line } from "@remixicon/react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSetupWizard } from "@/hooks/useSetupWizard";
import { usePanelStore } from "@/stores/panelStore";
import FathomSetupWizard from "@/components/settings/FathomSetupWizard";
import { type SettingHelpTopic } from "@/components/panels/SettingHelpPanel";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { SettingsCategoryPane, type SettingsCategory, SETTINGS_CATEGORIES } from "@/components/panes/SettingsCategoryPane";
import { SettingsDetailPane } from "@/components/panes/SettingsDetailPane";
import { AppShell } from "@/components/layout/AppShell";

// Valid category IDs for URL validation
const VALID_CATEGORY_IDS = SETTINGS_CATEGORIES.map((c) => c.id);

export default function Settings() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const { loading: roleLoading, isAdmin, isTeam } = useUserRole();
  const { wizardCompleted, loading: wizardLoading, markWizardComplete } = useSetupWizard();

  // --- Pane System Logic ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory | null>(null);

  // --- Deep Link Handling ---
  // On initial load, read category from URL and validate
  useEffect(() => {
    if (urlCategory) {
      // Validate the category from URL
      if (VALID_CATEGORY_IDS.includes(urlCategory as SettingsCategory)) {
        // Check role-based access for restricted categories
        const categoryConfig = SETTINGS_CATEGORIES.find((c) => c.id === urlCategory);
        const hasAccess = !categoryConfig?.requiredRoles?.length ||
          (categoryConfig.requiredRoles.includes("ADMIN") && isAdmin) ||
          (categoryConfig.requiredRoles.includes("TEAM") && (isTeam || isAdmin));

        if (hasAccess && selectedCategory !== urlCategory) {
          setSelectedCategory(urlCategory as SettingsCategory);
        } else if (!hasAccess) {
          // Redirect to base settings if user doesn't have access
          navigate("/settings", { replace: true });
        }
      } else {
        // Invalid category in URL, redirect to base settings
        navigate("/settings", { replace: true });
      }
    } else if (!roleLoading) {
      // Auto-select first category if no URL category
      const firstCategory = SETTINGS_CATEGORIES[0];
      if (firstCategory && selectedCategory !== firstCategory.id) {
        setSelectedCategory(firstCategory.id);
        navigate(`/settings/${firstCategory.id}`, { replace: true });
      }
    }
  }, [urlCategory, isAdmin, isTeam, navigate, roleLoading]);

  // Sync URL when selectedCategory changes (for user interactions)
  useEffect(() => {
    // Skip URL sync on initial load (handled by urlCategory effect above)
    // Only sync when category changes via user interaction
    if (selectedCategory && selectedCategory !== urlCategory) {
      navigate(`/settings/${selectedCategory}`, { replace: true });
    } else if (!selectedCategory && urlCategory) {
      // If category is deselected, go back to base settings URL
      navigate("/settings", { replace: true });
    }
  }, [selectedCategory, urlCategory, navigate]);

  // --- Panel Store ---
  const { isPanelOpen, panelType, panelData, openPanel, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && panelType === 'setting-help';

  // Helper function to open help panel for a specific topic
  const openHelpPanel = (topic: SettingHelpTopic) => {
    openPanel('setting-help', { type: 'setting-help', topic });
  };

  // Get help topic based on current category
  const getHelpTopicForCategory = (category: SettingsCategory): SettingHelpTopic => {
    const topicMap: Record<SettingsCategory, SettingHelpTopic> = {
      account: "profile",
      business: "profile", // Business uses profile help for now
      users: "users",
      billing: "billing",
      integrations: "integrations",
      ai: "ai",
      admin: "admin",
    };
    return topicMap[category] || "profile";
  };

  // --- Keyboard Shortcuts ---
  // Escape: Close the help panel
  const handleEscapeShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    }
  }, [showRightPanel, closePanel]);

  // Cmd+/: Toggle help panel for current category
  const handleHelpShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    } else if (selectedCategory) {
      openHelpPanel(getHelpTopicForCategory(selectedCategory));
    }
  }, [showRightPanel, closePanel, selectedCategory]);

  useKeyboardShortcut(handleEscapeShortcut, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: showRightPanel
  });

  useKeyboardShortcut(handleHelpShortcut, { key: '/' });

  const handleWizardComplete = async () => {
    await markWizardComplete();
  };

  // --- Pane System Handlers ---
  // Handle Settings nav item click (no-op for Settings page, already on Settings)
  const handleSettingsNavClick = useCallback(() => {
    // No-op: already on settings page
  }, []);

  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: SettingsCategory) => {
    setSelectedCategory(category);
  }, []);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (roleLoading || wizardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RiLoader2Line className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <AppShell
        config={{
          secondaryPane: (
            <SettingsCategoryPane
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
            />
          ),
          showDetailPane: true, // Enable DetailPaneOutlet for SettingHelpPanel
          onSettingsClick: handleSettingsNavClick
        }}
      >
        {/* Settings Detail Pane - shown when category is selected */}
        {selectedCategory && (
          <SettingsDetailPane
            category={selectedCategory}
            onClose={handleCloseDetailPane}
            onBack={handleBackFromDetail}
            showBackButton={false}
          />
        )}
      </AppShell>

      {/* Fathom Setup Wizard */}
      {!wizardCompleted && (
        <FathomSetupWizard
          open={!wizardCompleted}
          onComplete={handleWizardComplete}
          onDismiss={handleWizardComplete}
        />
      )}
    </>
  );
}
