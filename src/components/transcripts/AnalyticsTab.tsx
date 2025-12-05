import { useState } from "react";
import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { DonutChartMetric } from "./DonutChartMetric";
import { DonutChartCard } from "./DonutChartCard";
import { StatItem } from "./StatItem";
import { AnalyticsFilterBar, type AnalyticsFilters } from "./AnalyticsFilterBar";
import { RiLoader2Line } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";

export function AnalyticsTab() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    timeRange: "30d",
    showFolders: true,
    showTags: true,
    showCallTypes: true,
    showMonthly: true,
    showDuration: true,
    showInvitees: true,
  });

  const { data: analytics, isLoading, error } = useCallAnalytics(filters.timeRange);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RiLoader2Line className="w-8 h-8 animate-spin text-vibe-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-cb-gray-dark dark:text-cb-gray-light">Failed to load analytics. Please try again.</p>
      </div>
    );
  }

  if (!analytics || analytics.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-lg text-cb-gray-dark dark:text-cb-gray-light">No call data available yet</p>
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">Sync your calls to see analytics</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Filter Bar */}
      <AnalyticsFilterBar filters={filters} onFiltersChange={setFilters} />

      <Separator className="my-12" />

      {/* Hero Metrics - 3 Large Donut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 bg-white dark:bg-card mt-8">
        <DonutChartMetric
          title="Completed Calls"
          value={analytics.totalCalls}
          percentage={100}
          category="Total calls"
        />
        <DonutChartMetric
          title="Participation Rate"
          value={`${analytics.participationRate}%`}
          percentage={analytics.participationRate}
          category="Engagement"
        />
        <DonutChartMetric
          title="Avg Call Duration"
          value={`${analytics.avgDuration.toFixed(0)} min`}
          percentage={Math.min(100, Math.round((analytics.avgDuration / 60) * 100))}
          category="Duration"
        />
      </div>

      {/* Impact Overview - Stat Boxes with Vibe Green Accent */}
      <div className="bg-white dark:bg-card px-2 pb-2 mt-4">
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white mb-6">Impact Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatItem
            label="Total recording time"
            value={analytics.totalRecordingTime}
            current={analytics.totalRecordingTime}
          />
          <StatItem
            label="Unique participants"
            value={analytics.uniqueParticipants}
            current={analytics.uniqueParticipants}
          />
          <StatItem label="Active folders" value={analytics.activeFolders} current={analytics.activeFolders} />
        </div>
      </div>

      {/* Distribution Analytics - Grid of Donut Charts */}
      <div className="bg-white dark:bg-card px-6 pb-6 mt-8">
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white mb-6">Call Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 bg-white dark:bg-card">
          {filters.showFolders && (
            <DonutChartCard
              title="Calls by Folder"
              data={analytics.callsByFolder}
              colors={["green", "emerald", "lime", "teal", "slate"]}
            />
          )}
          {filters.showTags && (
            <DonutChartCard
              title="Calls by Tag"
              data={analytics.callsByTag}
              colors={["emerald", "green", "lime", "slate", "gray"]}
            />
          )}
          {filters.showCallTypes && (
            <DonutChartCard
              title="Call Type"
              data={analytics.callTypeDistribution}
              colors={["green", "lime", "slate"]}
            />
          )}
          {filters.showMonthly && (
            <DonutChartCard
              title="Monthly Trend"
              data={analytics.monthlyDistribution}
              colors={["green", "emerald", "lime", "teal", "slate", "gray"]}
            />
          )}
          {filters.showDuration && (
            <DonutChartCard
              title="Duration Breakdown"
              data={analytics.durationBreakdown}
              colors={["green", "lime", "slate", "gray"]}
            />
          )}
          {filters.showInvitees && (
            <DonutChartCard
              title="Invitees vs Participants"
              data={analytics.inviteesVsParticipants}
              colors={["green", "slate"]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
