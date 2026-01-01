import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { FoldersTab } from "@/components/tags/FoldersTab";
import { TagsTab } from "@/components/tags/TagsTab";
import { RulesTab } from "@/components/tags/RulesTab";
import { RecurringTitlesTab } from "@/components/tags/RecurringTitlesTab";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type TabValue = "folders" | "tags" | "rules" | "recurring";

const tabConfig = {
  folders: {
    title: "FOLDERS",
    description: "Create and manage folders to organize your calls.",
  },
  tags: {
    title: "TAGS",
    description: "View available call tags. Tags classify calls and control AI behavior.",
  },
  rules: {
    title: "RULES",
    description: "Create and manage rules for automatic sorting and tagging.",
  },
  recurring: {
    title: "RECURRING TITLES",
    description: "View your most common call titles and create sorting rules.",
  },
};

export default function SortingTagging() {
  // --- Tab Logic ---
  const [activeTab, setActiveTab] = useState<TabValue>("folders");
  const currentConfig = tabConfig[activeTab];

  // --- Responsive Breakpoint ---
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // --- Sidebar Logic ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // Control Nav Rail width (Icon vs Text)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); // Control Middle Panel visibility (default closed for settings)
  const [showMobileNav, setShowMobileNav] = useState(false); // Mobile nav overlay

  // Close mobile overlays when breakpoint changes away from mobile
  useEffect(() => {
    if (!isMobile) {
      setShowMobileNav(false);
    }
  }, [isMobile]);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && showMobileNav && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setShowMobileNav(false)}
        />
      )}

      {/* Mobile navigation overlay */}
      {isMobile && showMobileNav && (
        <div
          className={cn(
            "fixed top-0 left-0 bottom-0 w-[280px] bg-card rounded-r-2xl border-r border-border/60 shadow-lg z-50 flex flex-col py-2",
            "animate-in slide-in-from-left duration-300"
          )}
        >
          <div className="w-full px-2 mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileNav(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
            <span className="text-sm font-semibold mr-auto ml-2">Menu</span>
          </div>
          <SidebarNav
            isCollapsed={false}
            className="w-full flex-1"
            onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
          />
        </div>
      )}

      <div className="h-full flex gap-3 overflow-hidden p-1">

        {/* PANE 1: Navigation Rail (Hidden on mobile, shown as overlay) */}
        {!isMobile && (
          <div
            className={cn(
              "flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10 transition-all duration-300 ease-in-out",
              isSidebarExpanded ? "w-[240px]" : "w-[72px] items-center"
            )}
          >
            <div className="w-full px-2 mb-2 flex items-center justify-between">
              {/* Toggle Sidebar Button (Hamburger/Menu) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
              </Button>
              {isSidebarExpanded && <span className="text-sm font-semibold mr-auto ml-2">Menu</span>}
            </div>

            <SidebarNav
              isCollapsed={!isSidebarExpanded}
              className="w-full flex-1"
              onLibraryToggle={() => setIsLibraryOpen(!isLibraryOpen)}
            />
          </div>
        )}

        {/* PANE 2: Secondary Panel (Hidden on mobile, collapsible - hidden by default for settings pages) */}
        {!isMobile && (
          <div
            className={cn(
              "flex-shrink-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/60 shadow-sm flex flex-col h-full z-10 overflow-hidden transition-all duration-500 ease-in-out",
              isLibraryOpen ? "w-[280px] opacity-100 ml-0" : "w-0 opacity-0 -ml-3 border-0"
            )}
          >
            {/* Empty secondary panel - can be used for future content if needed */}
          </div>
        )}

        {/* PANE 3: Main Content (Settings/Tabs) */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full relative z-0 transition-all duration-300">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
            {/* Mobile header with hamburger menu */}
            {isMobile && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileNav(true)}
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </Button>
                <span className="text-sm font-semibold">Settings</span>
              </div>
            )}
            <div className="px-4 md:px-10 pt-2 flex-shrink-0">
              <TabsList>
                <TabsTrigger value="folders">FOLDERS</TabsTrigger>
                <TabsTrigger value="tags">TAGS</TabsTrigger>
                <TabsTrigger value="rules">RULES</TabsTrigger>
                <TabsTrigger value="recurring">RECURRING</TabsTrigger>
              </TabsList>
            </div>

          {/* Full-width line */}
          <div className="w-full border-b border-cb-black dark:border-cb-white flex-shrink-0" />

          {/* Page Header */}
          <div className="px-4 md:px-10 flex-shrink-0">
            <div className="mt-2 mb-3">
              <p className="text-sm font-semibold text-cb-gray-dark dark:text-cb-gray-light uppercase tracking-wider mb-0.5">
                SETTINGS
              </p>
              <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
                {currentConfig.title}
              </h1>
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">{currentConfig.description}</p>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-auto px-4 md:px-10">
            <TabsContent value="folders" className="mt-0">
              <FoldersTab />
            </TabsContent>

            <TabsContent value="tags" className="mt-0">
              <TagsTab />
            </TabsContent>

            <TabsContent value="rules" className="mt-0">
              <RulesTab />
            </TabsContent>

            <TabsContent value="recurring" className="mt-0">
              <RecurringTitlesTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  </>
  );
}
