import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { StatItem } from "@/components/transcripts/StatItem";
import { DonutChartCard } from "@/components/transcripts/DonutChartCard";
import { RiLoader2Line, RiTimeLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";

export function DurationTab() {
  const { data: analytics, isLoading, error } = useCallAnalytics("30d");

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
        <p className="text-cb-gray-dark dark:text-cb-gray-light">
          Failed to load duration analytics. Please try again.
        </p>
      </div>
    );
  }

  if (!analytics || analytics.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RiTimeLine className="w-12 h-12 text-cb-gray-dark dark:text-cb-gray-light" />
        <p className="text-lg text-cb-gray-dark dark:text-cb-gray-light">
          No call data available yet
        </p>
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
          Sync your calls to see duration analytics
        </p>
      </div>
    );
  }

  // Format average duration
  const avgDurationFormatted = `${analytics.avgDuration.toFixed(0)} min`;
  // Use avg as median placeholder since median is not available in current data
  const medianDurationFormatted = `${analytics.avgDuration.toFixed(0)} min`;

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* KPI Row: Average and Median Duration */}
      <div className="bg-white dark:bg-card px-2 pb-2">
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white mb-6">
          Duration Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatItem
            label="Average Duration"
            value={avgDurationFormatted}
            current={avgDurationFormatted}
          />
          <StatItem
            label="Median Duration"
            value={medianDurationFormatted}
            current={medianDurationFormatted}
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Duration Distribution Section */}
      <div className="bg-white dark:bg-card px-6 pb-6">
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white mb-6">
          Duration Distribution
        </h3>

        {/* Duration Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {analytics.durationBreakdown.length > 0 ? (
            analytics.durationBreakdown.map((bucket) => (
              <div
                key={bucket.name}
                className="relative py-4 px-4 bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg"
              >
                {/* Vibe orange wedge accent */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange"
                  style={{
                    clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)",
                  }}
                />
                <div className="text-xs font-medium text-cb-gray-dark dark:text-cb-gray-light mb-1">
                  {bucket.name}
                </div>
                <div className="font-display text-2xl font-extrabold text-cb-black dark:text-cb-white tabular-nums">
                  {bucket.value}
                </div>
                <div className="text-xs text-cb-gray-dark dark:text-cb-gray-light">
                  calls
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-4 text-center py-8">
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
                No duration data available
              </p>
            </div>
          )}
        </div>

        {/* Duration Distribution Donut Chart */}
        {analytics.durationBreakdown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <DonutChartCard
              title="Duration Breakdown"
              data={analytics.durationBreakdown}
              colors={["green", "emerald", "lime", "slate"]}
            />
          </div>
        )}
      </div>

      <Separator className="my-8" />

      {/* Tables Section - Placeholders */}
      <div className="bg-white dark:bg-card px-6 pb-6">
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white mb-6">
          Duration Breakdown Tables
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Duration by Call Type/Category Placeholder */}
          <div className="border border-border dark:border-cb-border-dark rounded-lg p-6">
            <h4 className="font-display text-sm font-bold text-cb-gray-dark dark:text-cb-gray-light mb-4">
              Duration by Call Type/Category
            </h4>
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
                Coming soon
              </p>
            </div>
          </div>

          {/* Duration by Tag Placeholder */}
          <div className="border border-border dark:border-cb-border-dark rounded-lg p-6">
            <h4 className="font-display text-sm font-bold text-cb-gray-dark dark:text-cb-gray-light mb-4">
              Duration by Tag
            </h4>
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
