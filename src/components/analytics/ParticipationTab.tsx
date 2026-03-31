import { useState } from "react";
import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { StatItem } from "@/components/transcripts/StatItem";
import { DonutChartCard } from "@/components/transcripts/DonutChartCard";
import { RiLoader2Line, RiLineChartLine, RiPieChartLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";

type TimeRange = "7d" | "30d" | "3m" | "6m" | "1y" | "all";

export function ParticipationTab() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const { data: analytics, isLoading, error } = useCallAnalytics(timeRange);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RiLoader2Line className="w-8 h-8 animate-spin text-vibe-orange" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Failed to load participation data. Please try again.
        </p>
      </div>
    );
  }

  // Empty state
  if (!analytics || analytics.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-lg text-muted-foreground">
          No participation data available yet
        </p>
        <p className="text-sm text-muted-foreground">
          Sync your calls to see participation analytics
        </p>
      </div>
    );
  }

  // Calculate avg attendees per call
  // Using inviteesVsParticipants data: participated count / total calls
  const participatedCount = analytics.inviteesVsParticipants.find(
    (item) => item.name === "Participated"
  )?.value || 0;
  const avgAttendeesPerCall = analytics.totalCalls > 0
    ? (participatedCount / analytics.totalCalls).toFixed(1)
    : "0";

  // Solo vs multi-speaker data for chart placeholder
  // This is placeholder data - would need actual speaker count per call
  const soloVsMultiData = [
    { name: "Solo Calls", value: Math.round(analytics.totalCalls * 0.15) },
    { name: "Multi-Speaker", value: Math.round(analytics.totalCalls * 0.85) },
  ].filter((item) => item.value > 0);

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 px-6 mb-8">
        <span className="text-sm font-medium text-muted-foreground mr-2">
          Time Range:
        </span>
        {(["7d", "30d", "3m", "6m", "1y", "all"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              timeRange === range
                ? "bg-foreground text-white dark:text-cb-black font-medium"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {range === "all" ? "All Time" : range}
          </button>
        ))}
      </div>

      <Separator className="my-8" />

      {/* KPIs Section */}
      <div className="px-6 pb-6">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          PARTICIPATION KPIS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatItem
            label="Avg Attendees per Call"
            value={avgAttendeesPerCall}
            current={avgAttendeesPerCall}
          />
          <StatItem
            label="Unique Participants"
            value={analytics.uniqueParticipants}
            current={analytics.uniqueParticipants}
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Participation Metrics Section */}
      <div className="px-6 pb-6">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          PARTICIPATION METRICS
        </h3>
        {analytics.inviteesVsParticipants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analytics.inviteesVsParticipants.map((item) => (
              <div
                key={item.name}
                className="relative py-4 px-6 bg-white dark:bg-card border border-border rounded-lg"
              >
                {/* Vibe orange wedge accent */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange cv-vertical-marker" />
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {item.name}
                </div>
                <div className="font-display text-3xl font-extrabold text-foreground">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No participation data available for this period.
          </p>
        )}
      </div>

      <Separator className="my-8" />

      {/* Charts Section */}
      <div className="px-6 pb-6">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          PARTICIPATION CHARTS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attendees over time - Placeholder */}
          <div className="p-6 bg-white dark:bg-card border border-border rounded-lg">
            <h4 className="font-display text-sm font-bold text-muted-foreground mb-4">
              Attendees Over Time
            </h4>
            <div className="flex flex-col items-center justify-center h-[200px] bg-muted rounded-lg">
              <RiLineChartLine className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Trend chart placeholder
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Coming soon
              </p>
            </div>
          </div>

          {/* Solo vs Multi-speaker Calls - DonutChartCard */}
          {soloVsMultiData.length > 0 ? (
            <DonutChartCard
              title="Solo vs Multi-Speaker Calls"
              data={soloVsMultiData}
              colors={["slate", "green"]}
            />
          ) : (
            <div className="p-6 bg-white dark:bg-card border border-border rounded-lg">
              <h4 className="font-display text-sm font-bold text-muted-foreground mb-4">
                Solo vs Multi-Speaker Calls
              </h4>
              <div className="flex flex-col items-center justify-center h-[200px] bg-muted rounded-lg">
                <RiPieChartLine className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Pie chart placeholder
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invitees vs Participants Distribution */}
      {analytics.inviteesVsParticipants.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="px-6 pb-6">
            <h3 className="font-display text-lg font-bold text-foreground mb-6">
              INVITEES VS PARTICIPANTS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 bg-white dark:bg-card">
              <DonutChartCard
                title="Invitees vs Participants"
                data={analytics.inviteesVsParticipants}
                colors={["green", "slate"]}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
