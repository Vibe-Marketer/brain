import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TranscriptsTab } from "@/components/transcripts/TranscriptsTab";
import { SyncTab } from "@/components/transcripts/SyncTab";
import { AnalyticsTab } from "@/components/transcripts/AnalyticsTab";

type TabValue = "transcripts" | "sync" | "analytics";

const tabConfig = {
  transcripts: {
    title: "TRANSCRIPTS",
    description: "Organize, search, and manage all your transcripts in one place.",
  },
  sync: {
    title: "SYNC",
    description: "Search and sync transcripts from your connected sources.",
  },
  analytics: {
    title: "ANALYTICS",
    description: "Insights and metrics about your call patterns and performance.",
  },
};

const TranscriptsNew = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive initial tab from URL, defaulting to "transcripts"
  const getTabFromUrl = (): TabValue => {
    const urlTab = searchParams.get("tab") as TabValue;
    if (urlTab && ["transcripts", "sync", "analytics"].includes(urlTab)) {
      return urlTab;
    }
    return "transcripts";
  };

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromUrl);

  // Single effect to handle URL changes (browser back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // Only depend on searchParams - activeTab changes are handled by handleTabChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle tab changes from user clicks
  const handleTabChange = (newTab: TabValue) => {
    setActiveTab(newTab);
    // Update URL immediately
    if (newTab === "transcripts") {
      // Remove tab param for default tab
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("tab");
      setSearchParams(newParams, { replace: true });
    } else {
      setSearchParams({ tab: newTab }, { replace: true });
    }
  };

  const currentConfig = tabConfig[activeTab];

  return (
    <div className="min-h-screen bg-cb-white dark:bg-card">
      {/* Tabs at the very top */}
      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)}>
        <div className="max-w-[1800px] mx-auto pt-2">
          <TabsList>
            <TabsTrigger value="transcripts">TRANSCRIPTS</TabsTrigger>
            <TabsTrigger value="sync">SYNC</TabsTrigger>
            <TabsTrigger value="analytics">ANALYTICS</TabsTrigger>
          </TabsList>
        </div>

        {/* Full-width black line */}
        <div className="w-full border-b border-cb-black dark:border-cb-white" />

        {/* Page Header - dynamic based on tab */}
        <div className="max-w-[1800px] mx-auto">
          <div className="mt-2 mb-3">
            <p className="text-sm font-semibold text-cb-gray-dark dark:text-cb-gray-light uppercase tracking-wider mb-0.5">
              LIBRARY
            </p>
            <h1 className="font-display text-2xl md:text-4xl font-extrabold text-cb-black dark:text-cb-white uppercase tracking-wide mb-0.5">
              {currentConfig.title}
            </h1>
            <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">{currentConfig.description}</p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-[1800px] mx-auto">
          <TabsContent value="transcripts">
            <TranscriptsTab />
          </TabsContent>

          <TabsContent value="sync">
            <SyncTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default TranscriptsNew;
