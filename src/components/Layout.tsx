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
 *
 * Onboarding:
 * - New (non-invited) users who haven't completed onboarding are
 *   redirected to /setup (full-page wizard).
 * - Invited users (those with workspace memberships beyond their
 *   personal org) see a dismissible banner instead.
 */

import React, { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/top-bar";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { DebugPanel } from "@/components/debug-panel";
import { ConnectionHealthGate } from "@/components/connectors/ConnectionHealthGate";
import { useOnboarding } from "@/hooks/useOnboarding";
import { startTour } from "@/lib/tour";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { RiCloseLine, RiDownloadCloud2Line } from "@remixicon/react";
import { TrialCountdownBadge } from "@/components/billing/TrialCountdownBadge";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldShowOnboarding, loading: onboardingLoading, completeOnboarding } = useOnboarding();

  const [isInvitedUser, setIsInvitedUser] = useState<boolean | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Check if the user was invited (has workspace memberships beyond their personal org)
  useEffect(() => {
    if (onboardingLoading || !shouldShowOnboarding) {
      setIsInvitedUser(null);
      return;
    }

    let cancelled = false;

    const checkInvitedStatus = async () => {
      try {
        const { user, error: authError } = await getSafeUser();
        if (authError || !user || cancelled) {
          setIsInvitedUser(false);
          return;
        }

        // Count organization memberships for this user
        const { data: memberships, error } = await supabase
          .from("organization_memberships")
          .select("id, organization_id")
          .eq("user_id", user.id);

        if (error || cancelled) {
          setIsInvitedUser(false);
          return;
        }

        // If user has more than 1 org membership, they were likely invited
        // (everyone gets a personal org on signup, so >1 means invited to another)
        const invited = (memberships?.length ?? 0) > 1;
        if (!cancelled) {
          setIsInvitedUser(invited);
        }
      } catch {
        if (!cancelled) setIsInvitedUser(false);
      }
    };

    checkInvitedStatus();
    return () => { cancelled = true; };
  }, [onboardingLoading, shouldShowOnboarding]);

  // Register a global tour starter so OnboardingModal (or any other code) can
  // call `window.__startCallVaultTour()` without importing the module directly.
  useEffect(() => {
    (window as Window & { __startCallVaultTour?: typeof startTour }).__startCallVaultTour = startTour;
    return () => {
      delete (window as Window & { __startCallVaultTour?: typeof startTour }).__startCallVaultTour;
    };
  }, []);

  const getPageLabel = () => {
    const p = location.pathname;
    if (p === '/' || p.startsWith('/transcripts')) return 'CALLS';
    if (p.startsWith('/import')) return 'IMPORT';
    if (p.startsWith('/rules')) return 'RULES';
    if (p.startsWith('/people')) return 'PEOPLE';
    if (p.startsWith('/organization')) return 'ORGANIZATION';
    if (p.startsWith('/settings')) return 'SETTINGS';
    if (p.startsWith('/analytics')) return 'ANALYTICS';
    if (p.startsWith('/call/')) return 'CALL DETAIL';
    if (p.startsWith('/sorting-tagging')) return 'SORTING & TAGGING';
    if (p.startsWith('/admin')) return 'ADMIN';
    return 'HOME';
  };

  const handleDismissBanner = async () => {
    setBannerDismissed(true);
    await completeOnboarding();
  };

  // Show a dismissible banner for invited users who haven't completed onboarding
  const showBanner =
    !onboardingLoading &&
    shouldShowOnboarding &&
    isInvitedUser === true &&
    !bannerDismissed;

  if (onboardingLoading || (shouldShowOnboarding && isInvitedUser === null)) {
    return (
      <div
        className="min-h-screen w-full bg-viewport"
        aria-busy="true"
        aria-label="Loading setup"
      />
    );
  }

  if (shouldShowOnboarding && isInvitedUser === false) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 235, 0, 0.12) 0%, rgba(255, 136, 0, 0.08) 50%, rgba(255, 61, 0, 0.05) 100%), hsl(var(--viewport))'
      }}
    >
      <TopBar pageLabel={getPageLabel()} />
      <TrialCountdownBadge />

      {showBanner && (
        <div className="fixed top-[52px] left-2 right-2 z-30 bg-vibe-orange/10 border border-vibe-orange/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <RiDownloadCloud2Line className="h-4 w-4 text-vibe-orange shrink-0" />
          <p className="text-sm text-foreground flex-1">
            <span className="font-medium">Connect a call recorder</span>{" "}
            <span className="text-muted-foreground">
              to start importing your meetings.{" "}
              <button
                onClick={() => navigate("/import")}
                className="text-vibe-orange hover:underline underline-offset-2 font-medium"
              >
                Go to Import
              </button>
            </span>
          </p>
          <button
            onClick={handleDismissBanner}
            className="shrink-0 h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Dismiss"
          >
            <RiCloseLine className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <main className={`fixed inset-2 top-[52px] ${showBanner ? "!top-[100px]" : ""}`}>
        {children}
      </main>
      <ConnectionHealthGate />
      <DebugPanel />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
