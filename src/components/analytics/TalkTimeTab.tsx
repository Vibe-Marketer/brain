import { RiLoader2Line, RiMicLine, RiUserLine, RiTimeLine, RiBarChartLine } from "@remixicon/react";
import { useCallAnalytics } from "@/hooks/useCallAnalytics";
import { StatItem } from "@/components/transcripts/StatItem";
import { Separator } from "@/components/ui/separator";

interface TalkTimeRoleCard {
  role: string;
  percentage: number;
  label: string;
}

const TALK_TIME_ROLES: TalkTimeRoleCard[] = [
  { role: "Host", percentage: 45, label: "Primary speaker / meeting organizer" },
  { role: "Closer", percentage: 25, label: "Sales representative or presenter" },
  { role: "Client", percentage: 20, label: "External participants" },
  { role: "Support", percentage: 7, label: "Technical or administrative support" },
  { role: "Other", percentage: 3, label: "Unclassified participants" },
];

const TALK_TIME_CATEGORIES = [
  { category: "Sales Calls", hostPercent: 40, othersPercent: 60 },
  { category: "Team Meetings", hostPercent: 55, othersPercent: 45 },
  { category: "Client Reviews", hostPercent: 30, othersPercent: 70 },
  { category: "Training Sessions", hostPercent: 75, othersPercent: 25 },
  { category: "One-on-Ones", hostPercent: 50, othersPercent: 50 },
];

function RoleCard({ role, percentage, label }: TalkTimeRoleCard) {
  return (
    <div className="relative py-3 px-4 bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg">
      {/* Vibe orange wedge accent */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange"
        style={{
          clipPath: 'polygon(0 0, 100% 20%, 100% 80%, 0 100%)'
        }}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-bold text-cb-black dark:text-cb-white uppercase">
            {role}
          </div>
          <div className="text-xs text-cb-gray-dark dark:text-cb-gray-light mt-0.5">
            {label}
          </div>
        </div>
        <div className="font-display text-2xl font-extrabold text-cb-black dark:text-cb-white tabular-nums">
          {percentage}%
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ category, hostPercent, othersPercent }: { category: string; hostPercent: number; othersPercent: number }) {
  return (
    <div className="flex items-center py-2 border-b border-border dark:border-cb-border-dark last:border-0">
      <div className="w-40 text-sm text-ink dark:text-cb-white truncate">{category}</div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-6 bg-hover dark:bg-cb-border-dark rounded overflow-hidden flex">
          <div
            className="h-full bg-vibe-orange transition-all"
            style={{ width: `${hostPercent}%` }}
          />
          <div
            className="h-full bg-slate-400 dark:bg-slate-600 transition-all"
            style={{ width: `${othersPercent}%` }}
          />
        </div>
        <div className="w-20 text-right text-sm tabular-nums text-ink-soft dark:text-cb-gray-light">
          {hostPercent}% / {othersPercent}%
        </div>
      </div>
    </div>
  );
}

export function TalkTimeTab() {
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
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">Failed to load analytics. Please try again.</p>
      </div>
    );
  }

  if (!analytics || analytics.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RiMicLine className="w-12 h-12 text-ink-muted" />
        <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">No call data available yet</p>
        <p className="text-xs text-ink-muted">Sync your calls to see talk time analytics</p>
      </div>
    );
  }

  // Placeholder values for talk time metrics
  const hostTalkTimePercent = 42;
  const othersTalkTimePercent = 58;
  const avgMonologueLength = "1m 45s";

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* KPI Section */}
      <div className="px-2 pb-2">
        <h3 className="font-display text-sm font-bold text-cb-black dark:text-cb-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <RiTimeLine className="w-4 h-4 text-ink-muted" />
          KEY METRICS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatItem
            label="Host Talk Time"
            value={`${hostTalkTimePercent}%`}
            current={`${hostTalkTimePercent}%`}
          />
          <StatItem
            label="Others Talk Time"
            value={`${othersTalkTimePercent}%`}
            current={`${othersTalkTimePercent}%`}
          />
          <StatItem
            label="Avg Monologue Length"
            value={avgMonologueLength}
            current={avgMonologueLength}
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Talk Time by Role Section */}
      <div className="px-2 pb-2">
        <h3 className="font-display text-sm font-bold text-cb-black dark:text-cb-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <RiUserLine className="w-4 h-4 text-ink-muted" />
          TALK TIME BY ROLE
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TALK_TIME_ROLES.map((roleData) => (
            <RoleCard key={roleData.role} {...roleData} />
          ))}
        </div>
      </div>

      <Separator className="my-8" />

      {/* Talk Time by Category Section */}
      <div className="px-2 pb-2">
        <h3 className="font-display text-sm font-bold text-cb-black dark:text-cb-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <RiBarChartLine className="w-4 h-4 text-ink-muted" />
          TALK TIME BY CATEGORY
        </h3>
        <div className="bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg p-4">
          <div className="flex items-center gap-4 mb-4 text-xs text-ink-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-vibe-orange" />
              <span>Host</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-400 dark:bg-slate-600" />
              <span>Others</span>
            </div>
          </div>
          {TALK_TIME_CATEGORIES.map((cat) => (
            <CategoryRow key={cat.category} {...cat} />
          ))}
        </div>
      </div>

      <Separator className="my-8" />

      {/* Stacked Bar Chart Placeholder */}
      <div className="px-2 pb-6">
        <h3 className="font-display text-sm font-bold text-cb-black dark:text-cb-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <RiBarChartLine className="w-4 h-4 text-ink-muted" />
          TALK TIME DISTRIBUTION
        </h3>
        <div className="bg-white dark:bg-card border border-border dark:border-cb-border-dark rounded-lg p-6">
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center">
              <RiBarChartLine className="w-12 h-12 text-ink-muted mx-auto mb-3" />
              <p className="text-sm text-cb-gray-dark dark:text-cb-gray-light">
                Stacked Bar Chart
              </p>
              <p className="text-xs text-ink-muted mt-1">
                Talk time distribution by role over time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
