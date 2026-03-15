/**
 * Layout - Top-level layout wrapper
 *
 * Provides:
 * - Viewport background with brand gradient
 * - TopBar navigation header
 * - Main content area (no card wrapper - pages handle their own layout)
 *
 * All pages now use AppShell for the 3-pane architecture.
 * The legacy card wrapper has been removed - pages that need card
 * styling should add it themselves.
 */

import React, { useEffect } from "react";
import { TopBar } from "@/components/ui/top-bar";
import { useLocation } from "react-router-dom";
import { DebugPanel } from "@/components/debug-panel";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { startTour } from "@/lib/tour";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role } = useUserRole();
  const { isFeatureEnabled } = useFeatureFlags(role);
  const { shouldShowOnboarding, loading: onboardingLoading, completeOnboarding } = useOnboarding();

  // Register a global tour starter so OnboardingModal (or any other code) can
  // call `window.__startCallVaultTour()` without importing the module directly.
  useEffect(() => {
    (window as Window & { __startCallVaultTour?: typeof startTour }).__startCallVaultTour = startTour;
    return () => {
      delete (window as Window & { __startCallVaultTour?: typeof startTour }).__startCallVaultTour;
    };
  }, []);

  const getPageLabel = () => {
    if (location.pathname === '/') return 'HOME';
    if (location.pathname.startsWith('/sorting-tagging')) return 'SORTING & TAGGING';
    if (location.pathname.startsWith('/settings')) return 'SETTINGS';
    if (location.pathname === '/shared-with-me') return 'SHARED WITH ME';
    return 'HOME';
  };

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 235, 0, 0.12) 0%, rgba(255, 136, 0, 0.08) 50%, rgba(255, 61, 0, 0.05) 100%), hsl(var(--viewport))'
      }}
    >
      <TopBar pageLabel={getPageLabel()} />
      <main className="fixed inset-2.5 top-[52px]">
        {children}
      </main>
      {isFeatureEnabled('debug_panel') && <DebugPanel />}
      {!onboardingLoading && shouldShowOnboarding && (
        <OnboardingModal
          open={shouldShowOnboarding}
          onComplete={completeOnboarding}
        />
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
