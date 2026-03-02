/**
 * WorkspacesPage - Main workspaces management interface
 *
 * Provides 3-pane layout with workspace list sidebar, main content area,
 * and detail panel outlet. Organization context controls which workspaces are visible.
 *
 * Route: /workspaces and /workspaces/:workspaceId
 *
 * @pattern app-shell
 * @brand-version v4.2
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from 'react-error-boundary';
import { useBreakpointFlags } from '@/hooks/useBreakpoint';
import { usePanelStore } from '@/stores/panelStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { WorkspaceListPane } from '@/components/panes/WorkspaceListPane';
import { WorkspaceDetailPane } from '@/components/panes/WorkspaceDetailPane';
import { WorkspaceMemberPanel } from '@/components/panels/WorkspaceMemberPanel';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  RiSafeLine,
  RiCloseLine,
  RiArrowLeftLine,
  RiErrorWarningLine,
} from '@remixicon/react';

function WorkspacesErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <RiErrorWarningLine className="h-16 w-16 text-destructive/60 mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {error.message || 'An unexpected error occurred while loading the workspaces page.'}
        </p>
        <div className="flex items-center gap-3 justify-center">
          <Button
            variant="default"
            onClick={resetErrorBoundary}
            aria-label="Try again"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            aria-label="Go home"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId?: string }>();
  const navigate = useNavigate();

  // Page title
  useEffect(() => {
    document.title = 'Workspaces | CallVault';
    return () => { document.title = 'CallVault'; };
  }, []);

  // Responsive breakpoint
  const { isMobile } = useBreakpointFlags();

  // Organization context
  const { activeOrgId } = useOrganizationContext();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId);

  // Selected workspace state from URL
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(urlWorkspaceId || null);

  // Mobile-specific state
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileWorkspaceList, setShowMobileWorkspaceList] = useState(false);
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false);

  // Panel store
  const { isPanelOpen, panelType, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && panelType === 'workspace-member';

  // Deep link handling: sync URL to state
  useEffect(() => {
    if (urlWorkspaceId) {
      // Validate workspace exists in current organization
      if (!workspacesLoading && workspaces.length > 0) {
        const workspaceExists = workspaces.some((v) => v.id === urlWorkspaceId);
        if (workspaceExists) {
          setSelectedWorkspaceId(urlWorkspaceId);
        } else {
          // Invalid workspace ID, redirect to base
          navigate('/workspaces', { replace: true });
        }
      } else {
        // Set while loading, will validate after load
        setSelectedWorkspaceId(urlWorkspaceId);
      }
    } else if (!workspacesLoading && workspaces.length > 0 && !selectedWorkspaceId) {
      // Auto-select first workspace if none selected
      const firstWorkspace = workspaces[0];
      setSelectedWorkspaceId(firstWorkspace.id);
      navigate(`/workspaces/${firstWorkspace.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWorkspaceId, workspaces, workspacesLoading, navigate]);

  // Handle workspace selection
  const handleWorkspaceSelect = useCallback(
    (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId);
      navigate(`/workspaces/${workspaceId}`, { replace: true });

      // Close mobile workspace list overlay
      if (isMobile) {
        setShowMobileWorkspaceList(false);
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
      setShowMobileWorkspaceList(false);
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
        {(showMobileNav || showMobileWorkspaceList || showMobileBottomSheet) && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-500"
            onClick={() => {
              if (showMobileNav) setShowMobileNav(false);
              if (showMobileWorkspaceList) setShowMobileWorkspaceList(false);
              if (showMobileBottomSheet) handleCloseMobileBottomSheet();
            }}
            aria-hidden="true"
          />
        )}

        {/* Mobile workspace list overlay */}
        {showMobileWorkspaceList && (
          <div
            className={cn(
              'fixed top-0 left-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-md rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col',
              'animate-in slide-in-from-left duration-500'
            )}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 bg-white/50 dark:bg-black/20">
              <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">
                Workspaces
              </h2>
              <button
                onClick={() => setShowMobileWorkspaceList(false)}
                className="text-muted-foreground hover:text-foreground h-6 w-6"
                aria-label="Close workspace list"
              >
                <RiCloseLine className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden pt-2">
              <WorkspaceListPane
                selectedWorkspaceId={selectedWorkspaceId}
                onWorkspaceSelect={handleWorkspaceSelect}
              />
            </div>
          </div>
        )}

        {/* Mobile main content */}
        <div className="h-full flex gap-3 overflow-hidden p-1">
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            <ErrorBoundary FallbackComponent={WorkspacesErrorFallback}>
              <div
              className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
              role="main"
              aria-label="Workspaces"
              >
                {/* Mobile: Show WorkspaceDetailPane or empty state */}
                {selectedWorkspaceId ? (
                  <WorkspaceDetailPane
                    workspaceId={selectedWorkspaceId}
                    showBackButton
                    onBack={() => setShowMobileWorkspaceList(true)}
                  />
                ) : (
                  <>
                    <PageHeader 
                      title="Workspaces"
                      icon={RiSafeLine}
                      onBack={() => setShowMobileWorkspaceList(true)}
                      showBackButton={true}
                    />
                    <div className="flex-1 flex items-center justify-center p-6">
                      <div className="text-center">
                        <RiArrowLeftLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
                        <p className="text-sm font-semibold text-foreground mb-1">Select a workspace</p>
                        <p className="text-xs text-muted-foreground">
                          Choose a workspace from the list to view recordings and members
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ErrorBoundary>
          </div>
        </div>

        {/* Mobile Bottom Sheet */}
        {showMobileBottomSheet && (
          <aside
            role="complementary"
            aria-label="Workspace member panel"
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl border-t border-border/60 shadow-xl flex flex-col',
              'max-h-[85vh] animate-in slide-in-from-bottom duration-500'
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
              {selectedWorkspaceId && (
                <WorkspaceMemberPanel workspaceId={selectedWorkspaceId} />
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
          <WorkspaceListPane
            selectedWorkspaceId={selectedWorkspaceId}
            onWorkspaceSelect={handleWorkspaceSelect}
          />
        ),
        showDetailPane: true,
      }}
    >
      <ErrorBoundary FallbackComponent={WorkspacesErrorFallback}>
        {/* Main content */}
        <WorkspaceDetailPane
          workspaceId={selectedWorkspaceId}
          onClose={() => {
            setSelectedWorkspaceId(null);
            navigate('/workspaces', { replace: true });
          }}
        />
      </ErrorBoundary>
    </AppShell>
  );
}
