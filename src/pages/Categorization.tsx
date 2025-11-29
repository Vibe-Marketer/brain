import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RecurringTitlesTab } from "@/components/categorization/RecurringTitlesTab";
import { RulesTab } from "@/components/categorization/RulesTab";
import { CategoriesTab } from "@/components/categorization/CategoriesTab";

type TabValue = "recurring" | "rules" | "categories";

const tabConfig = {
  recurring: {
    title: "RECURRING TITLES",
    description: "View your most common call titles and assign categorization rules.",
  },
  rules: {
    title: "RULES",
    description: "Create and manage rules for automatic call categorization.",
  },
  categories: {
    title: "CATEGORIES",
    description: "View and manage available call categories.",
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
            <TabsTrigger value="categories">CATEGORIES</TabsTrigger>
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

          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
