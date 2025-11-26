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
  const [activeTab, setActiveTab] = useState<TabValue>((searchParams.get("tab") as TabValue) || "transcripts");

  // Update URL when tab changes
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab !== activeTab && activeTab !== "transcripts") {
      setSearchParams({ tab: activeTab });
    } else if (activeTab === "transcripts" && currentTab) {
      setSearchParams({});
    }
  }, [activeTab, searchParams, setSearchParams]);

  // Sync tab from URL
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") as TabValue;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const currentConfig = tabConfig[activeTab];

  return (
    <div className="min-h-screen bg-cb-white dark:bg-card">
      {/* Tabs at the very top */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
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
