import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { RiLoader2Line } from "@remixicon/react";

interface StatBoxProps {
  label: string;
  value: string | number;
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div className="relative py-2 px-4 bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg">
      {/* Vibe orange wedge accent - trapezoid shape */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange"
        style={{
          clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)",
        }}
      />

      <div className="text-xs font-medium text-cb-gray-dark dark:text-cb-gray-light mb-1">
        {label}
      </div>
      <div className="font-display text-2xl font-extrabold text-cb-black dark:text-cb-white">
        {value}
      </div>
    </div>
  );
}

function formatHoursFromRecordingTime(totalRecordingTime: string): string {
  // totalRecordingTime format is "Xh Ym" (e.g., "5h 30m")
  const hoursMatch = totalRecordingTime.match(/(\d+)h/);
  const minutesMatch = totalRecordingTime.match(/(\d+)m/);

  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

  // Return total hours with decimal for minutes
  const totalHours = hours + minutes / 60;
  return `${totalHours.toFixed(1)}h`;
}

export function OverviewTab() {
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
          Failed to load analytics. Please try again.
        </p>
      </div>
    );
  }

  if (!analytics || analytics.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-lg text-cb-gray-dark dark:text-cb-gray-light">
          No call data available yet. Sync your calls to see analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white uppercase tracking-wide">
          Key Metrics
        </h3>
      </div>

      {/* KPI Row - 5 metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatBox label="Total Calls" value={analytics.totalCalls} />
        <StatBox
          label="Total Hours"
          value={formatHoursFromRecordingTime(analytics.totalRecordingTime)}
        />
        <StatBox
          label="Avg Duration"
          value={`${analytics.avgDuration.toFixed(0)} min`}
        />
        <StatBox
          label="Avg % Talk Time"
          value={`${analytics.participationRate}%`}
        />
        <StatBox label="Unique Speakers" value={analytics.uniqueParticipants} />
      </div>

      {/* Charts Section Header */}
      <div>
        <h3 className="font-display text-lg font-bold text-cb-black dark:text-cb-white uppercase tracking-wide">
          Trends
        </h3>
      </div>

      {/* Charts Section - Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls per day/week placeholder */}
        <div className="bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg p-6">
          <h4 className="font-display text-sm font-semibold text-cb-black dark:text-cb-white uppercase tracking-wide mb-4">
            Calls Per Day/Week
          </h4>
          <div className="flex items-center justify-center h-48 bg-hover dark:bg-cb-hover-dark rounded">
            <p className="text-cb-gray-dark dark:text-cb-gray-light text-sm">
              Line chart coming soon
            </p>
          </div>
        </div>

        {/* Minutes per day/week placeholder */}
        <div className="bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg p-6">
          <h4 className="font-display text-sm font-semibold text-cb-black dark:text-cb-white uppercase tracking-wide mb-4">
            Minutes Per Day/Week
          </h4>
          <div className="flex items-center justify-center h-48 bg-hover dark:bg-cb-hover-dark rounded">
            <p className="text-cb-gray-dark dark:text-cb-gray-light text-sm">
              Bar chart coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
