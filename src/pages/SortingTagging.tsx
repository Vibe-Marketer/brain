import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FoldersTab } from "@/components/tags/FoldersTab";
import { TagsTab } from "@/components/tags/TagsTab";
import { RulesTab } from "@/components/tags/RulesTab";
import { RecurringTitlesTab } from "@/components/tags/RecurringTitlesTab";

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
  const [activeTab, setActiveTab] = useState<TabValue>("folders");
  const currentConfig = tabConfig[activeTab];

  return (
    <div className="min-h-screen bg-cb-white dark:bg-card">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <div className="max-w-[1800px] mx-auto pt-2">
          <TabsList>
            <TabsTrigger value="folders">FOLDERS</TabsTrigger>
            <TabsTrigger value="tags">TAGS</TabsTrigger>
            <TabsTrigger value="rules">RULES</TabsTrigger>
            <TabsTrigger value="recurring">RECURRING</TabsTrigger>
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
          <TabsContent value="folders">
            <FoldersTab />
          </TabsContent>

          <TabsContent value="tags">
            <TagsTab />
          </TabsContent>

          <TabsContent value="rules">
            <RulesTab />
          </TabsContent>

          <TabsContent value="recurring">
            <RecurringTitlesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
