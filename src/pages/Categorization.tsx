import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RecurringTitlesTab } from "@/components/tags/RecurringTitlesTab";
import { RulesTab } from "@/components/tags/RulesTab";
import { TagsTab } from "@/components/tags/TagsTab";

type TabValue = "recurring" | "rules" | "tags";

const tabConfig = {
  recurring: {
    title: "RECURRING TITLES",
    description: "View your most common call titles and create tagging rules.",
  },
  rules: {
    title: "TAG RULES",
    description: "Create and manage rules for automatic call tagging.",
  },
  tags: {
    title: "TAGS",
    description: "View available call tags. Tags classify calls and control AI behavior.",
  },
};

export default function Categorization() {
  const [activeTab, setActiveTab] = useState<TabValue>("recurring");
  const currentConfig = tabConfig[activeTab];

  return (
    <div className="min-h-screen bg-cb-white dark:bg-card">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <div className="max-w-[1800px] mx-auto pt-2">
          <TabsList>
            <TabsTrigger value="recurring">RECURRING</TabsTrigger>
            <TabsTrigger value="rules">RULES</TabsTrigger>
            <TabsTrigger value="tags">TAGS</TabsTrigger>
          </TabsList>
        </div>

        {/* Full-width black line */}
        <div className="w-full border-b border-cb-black dark:border-cb-white" />

        {/* Page Header */}
        <div className="max-w-[1800px] mx-auto">
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
        <div className="max-w-[1800px] mx-auto">
          <TabsContent value="recurring">
            <RecurringTitlesTab />
          </TabsContent>

          <TabsContent value="rules">
            <RulesTab />
          </TabsContent>

          <TabsContent value="tags">
            <TagsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
