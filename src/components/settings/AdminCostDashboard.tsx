/**
 * AdminCostDashboard - System-wide AI cost visualization for admins
 *
 * Shows aggregated cost data across all users with breakdowns by:
 * - Model (which models cost most)
 * - Feature (chat vs embedding vs search vs enrichment)
 * - User (top consumers by cost)
 *
 * Includes period selector for time filtering.
 *
 * @pattern settings-tab-section
 * @brand-version v4.2
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RiCpuLine,
  RiRobot2Line,
  RiUserLine,
  RiTimeLine,
} from "@remixicon/react";
import { BarChart } from "@tremor/react";
import {
  useAdminCosts,
  type AdminCostPeriod,
  centsToUsd,
  formatUsd,
  formatTokens,
} from "@/hooks/useAdminCosts";

/**
 * Period options for the selector
 */
const PERIOD_OPTIONS: { value: AdminCostPeriod; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "all", label: "All Time" },
];

/**
 * Human-readable feature names
 */
const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  embedding: "Embeddings",
  search: "Search",
  enrichment: "Enrichment",
};

export default function AdminCostDashboard() {
  const [period, setPeriod] = useState<AdminCostPeriod>("month");
  const summaryAccentClass = "cv-side-indicator-pill";
  const { byModel, byFeature, byUser, totals, isLoading, error } =
    useAdminCosts(period);

  // Transform model data for bar chart
  const modelChartData = byModel.map((m) => ({
    name: m.model.split("/").pop() || m.model, // Strip provider prefix for display
    cost: centsToUsd(m.costCents),
    requests: m.requests,
  }));

  // Transform feature data for bar chart
  const featureChartData = byFeature.map((f) => ({
    name: FEATURE_LABELS[f.feature] || f.feature,
    cost: centsToUsd(f.costCents),
    requests: f.requests,
  }));

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm text-red-600 dark:text-red-400">
        Failed to load admin cost data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
            <RiCpuLine className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold">System Costs</h3>
            <p className="text-xs text-muted-foreground">
              AI usage across all users
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiTimeLine className="h-4 w-4 text-muted-foreground" />
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as AdminCostPeriod)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative py-3 px-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
              <div className={summaryAccentClass} aria-hidden="true" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Cost
              </p>
              <p className="text-2xl font-extrabold tabular-nums mt-1">
                {formatUsd(centsToUsd(totals.costCents))}
              </p>
            </div>
            <div className="relative py-3 px-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
              <div className={summaryAccentClass} aria-hidden="true" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Requests
              </p>
              <p className="text-2xl font-extrabold tabular-nums mt-1">
                {totals.requests.toLocaleString()}
              </p>
            </div>
            <div className="relative py-3 px-4 bg-card border border-border dark:border-cb-border-dark rounded-lg">
              <div className={summaryAccentClass} aria-hidden="true" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Tokens
              </p>
              <p className="text-2xl font-extrabold tabular-nums mt-1">
                {formatTokens(totals.tokens)}
              </p>
            </div>
          </div>

          {/* By Model Breakdown */}
          {modelChartData.length > 0 ? (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <RiRobot2Line className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Cost by Model</h4>
                <Badge variant="outline" className="text-xs">
                  {byModel.length} models
                </Badge>
              </div>
              <BarChart
                data={modelChartData}
                index="name"
                categories={["cost"]}
                colors={["blue"]}
                valueFormatter={(value) => formatUsd(value)}
                yAxisWidth={60}
                className="h-48"
                showAnimation={true}
              />
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              <RiRobot2Line className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No model usage data for this period</p>
            </div>
          )}

          {/* By Feature Breakdown */}
          {featureChartData.length > 0 ? (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <RiCpuLine className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Cost by Feature</h4>
              </div>
              <div className="space-y-2">
                {byFeature.map((f) => {
                  const percentage =
                    totals.costCents > 0
                      ? (f.costCents / totals.costCents) * 100
                      : 0;
                  return (
                    <div
                      key={f.feature}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm truncate">
                          {FEATURE_LABELS[f.feature] || f.feature}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {f.requests.toLocaleString()} requests
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium tabular-nums w-20 text-right">
                          {formatUsd(centsToUsd(f.costCents))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              <RiCpuLine className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No feature usage data for this period</p>
            </div>
          )}

          {/* By User Breakdown - Top 20 */}
          {byUser.length > 0 ? (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <RiUserLine className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Top Users by Cost</h4>
                <Badge variant="outline" className="text-xs">
                  Top {byUser.length}
                </Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {byUser.map((u, idx) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="text-sm truncate max-w-[200px]">
                        {u.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {u.requests.toLocaleString()} reqs
                      </span>
                      <span className="text-sm font-medium tabular-nums w-16 text-right">
                        {formatUsd(centsToUsd(u.costCents))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
              <RiUserLine className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No user usage data for this period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
