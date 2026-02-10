/**
 * VaultsPage - Main vaults management interface
 *
 * Provides 3-pane layout with vault list sidebar, main content area,
 * and detail panel outlet. Bank context controls which vaults are visible.
 *
 * Route: /vaults and /vaults/:vaultId
 *
 * @pattern app-shell
 * @brand-version v4.2
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useBreakpointFlags } from '@/hooks/useBreakpoint';
import { usePanelStore } from '@/stores/panelStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useBankContext } from '@/hooks/useBankContext';
import { useVaults } from '@/hooks/useVaults';
import { VaultListPane } from '@/components/panes/VaultListPane';
import { VaultDetailPane } from '@/components/panes/VaultDetailPane';
import { VaultMemberPanel } from '@/components/panels/VaultMemberPanel';
import { Button } from '@/components/ui/button';
import {
  RiSafeLine,
  RiCloseLine,
  RiArrowLeftSLine,
} from '@remixicon/react';

export default function VaultsPage() {
  const { vaultId: urlVaultId } = useParams<{ vaultId?: string }>();
  const navigate = useNavigate();

  // Page title
  useEffect(() => {
    document.title = 'Vaults | CallVault';
    return () => { document.title = 'CallVault'; };
  }, []);

  // Responsive breakpoint
  const { isMobile } = useBreakpointFlags();

  // Bank context
  const { activeBankId } = useBankContext();
  const { vaults, isLoading: vaultsLoading } = useVaults(activeBankId);

  // Selected vault state from URL
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(urlVaultId || null);

  // Mobile-specific state
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileVaultList, setShowMobileVaultList] = useState(false);
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false);

  // Panel store
  const { isPanelOpen, panelType, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && panelType === 'vault-member';

  // Deep link handling: sync URL to state
  useEffect(() => {
    if (urlVaultId) {
      // Validate vault exists in current bank
      if (!vaultsLoading && vaults.length > 0) {
        const vaultExists = vaults.some((v) => v.id === urlVaultId);
        if (vaultExists) {
          setSelectedVaultId(urlVaultId);
        } else {
          // Invalid vault ID, redirect to base
          navigate('/vaults', { replace: true });
        }
      } else {
        // Set while loading, will validate after load
        setSelectedVaultId(urlVaultId);
      }
    } else if (!vaultsLoading && vaults.length > 0 && !selectedVaultId) {
      // Auto-select first vault if none selected
      const firstVault = vaults[0];
      setSelectedVaultId(firstVault.id);
      navigate(`/vaults/${firstVault.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlVaultId, vaults, vaultsLoading, navigate]);

  // Handle vault selection
  const handleVaultSelect = useCallback(
    (vaultId: string) => {
      setSelectedVaultId(vaultId);
      navigate(`/vaults/${vaultId}`, { replace: true });

      // Close mobile vault list overlay
      if (isMobile) {
        setShowMobileVaultList(false);
      }
    },
    [navigate, isMobile]
  );

  // Keyboard shortcuts
  // Escape: Close the detail panel
  const handleEscapeShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    }
  }, [showRightPanel, closePanel]);

  useKeyboardShortcut(handleEscapeShortcut, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: showRightPanel,
  });

  // Sync mobile bottom sheet with panel state
  useEffect(() => {
    if (isMobile && showRightPanel) {
      setShowMobileBottomSheet(true);
    } else if (!isMobile) {
      setShowMobileBottomSheet(false);
    }
  }, [isMobile, showRightPanel]);

  // Close mobile overlays when breakpoint changes
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
      setShowMobileVaultList(false);
      setShowMobileBottomSheet(false);
    }
  }, [isMobile]);

  const handleCloseMobileBottomSheet = useCallback(() => {
    setShowMobileBottomSheet(false);
    closePanel();
  }, [closePanel]);

  // Mobile layout
  if (isMobile) {
    return (
      <>
        {/* Mobile overlay backdrop */}
        {(showMobileNav || showMobileVaultList || showMobileBottomSheet) && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            onClick={() => {
              if (showMobileNav) setShowMobileNav(false);
              if (showMobileVaultList) setShowMobileVaultList(false);
              if (showMobileBottomSheet) handleCloseMobileBottomSheet();
            }}
            aria-hidden="true"
          />
        )}

        {/* Mobile vault list overlay */}
        {showMobileVaultList && (
          <div
            className={cn(
              'fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col',
              'animate-in slide-in-from-left duration-300'
            )}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
              <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">
                Vaults
              </h2>
              <button
                onClick={() => setShowMobileVaultList(false)}
                className="text-muted-foreground hover:text-foreground h-6 w-6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden pt-2">
              <VaultListPane
                selectedVaultId={selectedVaultId}
                onVaultSelect={handleVaultSelect}
              />
            </div>
          </div>
        )}

        {/* Mobile main content */}
        <div className="h-full flex gap-3 overflow-hidden p-1">
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            <div
              className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
              role="main"
              aria-label="Vaults"
            >
              {/* Mobile: Show VaultDetailPane or empty state */}
              {selectedVaultId ? (
                <VaultDetailPane
                  vaultId={selectedVaultId}
                  showBackButton
                  onBack={() => setShowMobileVaultList(true)}
                />
              ) : (
                <>
                  {/* Mobile header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMobileVaultList(true)}
                      className="text-muted-foreground hover:text-foreground h-10 w-10"
                      aria-label="Open vault list"
                    >
                      <RiSafeLine className="h-5 w-5" />
                    </Button>
                    <span className="text-sm font-semibold">Vaults</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                      <RiSafeLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Select a vault to view recordings and members
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Sheet */}
        {showMobileBottomSheet && (
          <aside
            role="complementary"
            aria-label="Vault member panel"
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl border-t border-border/60 shadow-xl flex flex-col',
              'max-h-[85vh] animate-in slide-in-from-bottom duration-300'
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" aria-hidden="true" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseMobileBottomSheet}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
                aria-label="Close panel"
              >
                <RiCloseLine className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedVaultId && (
                <VaultMemberPanel vaultId={selectedVaultId} />
              )}
            </div>
          </aside>
        )}
      </>
    );
  }

  // Desktop/Tablet: Use AppShell
  return (
    <AppShell
      config={{
        secondaryPane: (
          <VaultListPane
            selectedVaultId={selectedVaultId}
            onVaultSelect={handleVaultSelect}
          />
        ),
        showDetailPane: true,
      }}
    >
      <ErrorBoundary
        fallback={
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <RiSafeLine className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                An error occurred while loading the vault view. Please try again.
              </p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="default"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        }
      >
        {/* Main content */}
        {selectedVaultId ? (
          <VaultDetailPane
            vaultId={selectedVaultId}
            onClose={() => {
              setSelectedVaultId(null);
              navigate('/vaults', { replace: true });
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <RiSafeLine className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Select a Vault
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Select a vault from the sidebar to view recordings and members
              </p>
              <RiArrowLeftSLine className="h-6 w-6 text-muted-foreground/40 mx-auto mt-2" aria-hidden="true" />
            </div>
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
