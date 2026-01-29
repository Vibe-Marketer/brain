import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";
import { usePanelStore } from "@/stores/panelStore";
import { FolderDetailPanel } from "@/components/panels/FolderDetailPanel";
import { TagDetailPanel } from "@/components/panels/TagDetailPanel";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { RiCloseLine } from "@remixicon/react";
import { SortingCategoryPane, type SortingCategory } from "@/components/panes/SortingCategoryPane";
import { SortingDetailPane } from "@/components/panes/SortingDetailPane";

// Valid category IDs for URL validation
const VALID_CATEGORY_IDS: SortingCategory[] = ["folders", "tags", "rules", "recurring"];

export default function SortingTagging() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();

  // --- Responsive Breakpoint ---
  const { isMobile } = useBreakpointFlags();

  // --- Pane System Logic ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] = useState<SortingCategory | null>(null);

  // Mobile-specific state
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false);

  // --- Deep Link Handling ---
  // On initial load, read category from URL and validate
  useEffect(() => {
    if (urlCategory) {
      // Validate the category from URL
      if (VALID_CATEGORY_IDS.includes(urlCategory as SortingCategory)) {
        // Only update if different to prevent unnecessary re-renders
        setSelectedCategory((prev) =>
          prev !== urlCategory ? (urlCategory as SortingCategory) : prev
        );
      } else {
        // Invalid category in URL, redirect to base sorting-tagging
        setSelectedCategory(null);
        navigate("/sorting-tagging", { replace: true });
      }
    } else {
      // Auto-select first category if no URL category
      const firstCategory = VALID_CATEGORY_IDS[0];
      if (firstCategory) {
        setSelectedCategory((prev) =>
          prev !== firstCategory ? firstCategory : prev
        );
        navigate(`/sorting-tagging/${firstCategory}`, { replace: true });
      }
    }
    // Note: selectedCategory removed from deps to prevent circular updates
    // URL is the source of truth, handled by urlCategory changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCategory, navigate]);

  // Note: URL sync is handled by user interaction handlers below
  // This prevents infinite re-render loop between URL and state effects

  // --- Panel Store ---
  const { isPanelOpen, panelType, panelData, closePanel } = usePanelStore();
  const showRightPanel = isPanelOpen && (panelType === 'folder-detail' || panelType === 'tag-detail');

  // --- Keyboard Shortcuts ---
  // Escape: Close the detail panel
  const handleEscapeShortcut = useCallback(() => {
    if (showRightPanel) {
      closePanel();
    }
  }, [showRightPanel, closePanel]);

  useKeyboardShortcut(handleEscapeShortcut, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: showRightPanel
  });

  // Sync mobile bottom sheet with panel state
  useEffect(() => {
    if (isMobile && showRightPanel) {
      setShowMobileBottomSheet(true);
    } else if (!isMobile) {
      setShowMobileBottomSheet(false);
    }
  }, [isMobile, showRightPanel]);

  // Close mobile overlays when breakpoint changes away from mobile
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
      setShowMobileBottomSheet(false);
    }
  }, [isMobile]);

  // Handle closing the mobile bottom sheet
  const handleCloseMobileBottomSheet = useCallback(() => {
    setShowMobileBottomSheet(false);
    closePanel();
  }, [closePanel]);

  // --- Pane System Handlers ---
  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: SortingCategory) => {
    setSelectedCategory(category);
    navigate(`/sorting-tagging/${category}`, { replace: true });
  }, [navigate]);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
    navigate("/sorting-tagging", { replace: true });
  }, [navigate]);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
    navigate("/sorting-tagging", { replace: true });
  }, [navigate]);

  // Mobile-only: Render custom layout with category/detail toggle
  if (isMobile) {
    return (
      <>
        {/* Mobile overlay backdrop - for nav or bottom sheet */}
        {(showMobileNav || showMobileBottomSheet) && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            onClick={() => {
              if (showMobileNav) setShowMobileNav(false);
              if (showMobileBottomSheet) handleCloseMobileBottomSheet();
            }}
            aria-hidden="true"
          />
        )}

        {/* Mobile navigation overlay */}
        {showMobileNav && (
          <nav
            role="navigation"
            aria-label="Mobile navigation menu"
            className={cn(
              "fixed top-0 left-0 bottom-0 w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
              "animate-in slide-in-from-left duration-300"
            )}
          >
            <div className="w-full px-2 mb-2 flex items-center justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileNav(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close navigation menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
            <div className="w-full flex-1" />
          </nav>
        )}

        <div className="h-full flex gap-3 overflow-hidden p-1">
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            {/* Mobile: Show category pane when no category selected */}
            {!selectedCategory && (
              <div
                className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
                role="navigation"
                aria-label="Sorting and tagging categories"
              >
                {/* Mobile header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileNav(true)}
                    className="text-muted-foreground hover:text-foreground h-10 w-10"
                    aria-label="Open navigation menu"
                    aria-expanded={showMobileNav}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </Button>
                  <span className="text-sm font-semibold">Sorting & Tagging</span>
                </div>
                <SortingCategoryPane
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                  className="flex-1 min-h-0"
                />
              </div>
            )}

            {/* Mobile: Show detail pane when category is selected */}
            {selectedCategory && (
              <div
                className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
                role="region"
                aria-label="Sorting detail"
              >
                {/* Mobile header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileNav(true)}
                    className="text-muted-foreground hover:text-foreground h-10 w-10"
                    aria-label="Open navigation menu"
                    aria-expanded={showMobileNav}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </Button>
                  <span className="text-sm font-semibold">Sorting & Tagging</span>
                </div>
                <SortingDetailPane
                  category={selectedCategory}
                  onClose={handleCloseDetailPane}
                  onBack={handleBackFromDetail}
                  showBackButton={true}
                  className="flex-1 min-h-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Sheet - Detail view for selected folder/tag */}
        {showMobileBottomSheet && (
          <aside
            role="complementary"
            aria-label={panelType === 'folder-detail' ? "Folder detail panel" : panelType === 'tag-detail' ? "Tag detail panel" : "Detail panel"}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl border-t border-border/60 shadow-xl flex flex-col",
              "max-h-[85vh] animate-in slide-in-from-bottom duration-300"
            )}
          >
            {/* Bottom sheet handle/header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto"
                  aria-hidden="true"
                />
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
            {/* Bottom sheet content */}
            <div className="flex-1 overflow-y-auto">
              {showRightPanel && panelType === 'folder-detail' && panelData?.folderId && (
                <FolderDetailPanel folderId={panelData.folderId} />
              )}
              {showRightPanel && panelType === 'tag-detail' && panelData?.tagId && (
                <TagDetailPanel tagId={panelData.tagId} />
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
          <SortingCategoryPane
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        ),
        showDetailPane: true,
      }}
    >
      {selectedCategory && (
        <SortingDetailPane
          category={selectedCategory}
          onClose={handleCloseDetailPane}
          onBack={handleBackFromDetail}
          showBackButton={false}
        />
      )}
    </AppShell>
  );
}
