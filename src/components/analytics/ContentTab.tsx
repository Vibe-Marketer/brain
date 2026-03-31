import { RiLoader2Line, RiFilmLine, RiCheckLine, RiTrophyLine, RiUploadCloud2Line, RiPercentLine } from "@remixicon/react";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder data types for clips (feature may not exist yet)
interface ClipData {
  id: string;
  title: string;
  sourceCall: string;
  tags: string[];
  published: boolean;
  winningHook: boolean;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface ContentAnalytics {
  totalClips: number;
  callsWithClipsPercent: number;
  publishedCount: number;
  publishedRate: number;
  winnersCount: number;
  clips: ClipData[];
}

interface ContentTabProps {
  isLoading?: boolean;
}

// StatCard component for KPIs - follows brand guidelines metric card pattern
function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative py-2 px-4 bg-white dark:bg-card border border-border rounded-lg">
      {/* Vibe orange wedge accent - trapezoid shape per brand guidelines */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-vibe-orange cv-vertical-marker" />
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-muted-foreground">
          {label}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-display text-2xl font-extrabold text-foreground">
        {value}
      </div>
    </div>
  );
}

// Placeholder chart component
function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white dark:bg-card border border-border rounded-lg p-6">
      <h4 className="font-display text-sm font-bold text-muted-foreground mb-4">
        {title}
      </h4>
      <div className="h-48 flex items-center justify-center bg-gray rounded-md">
        <p className="text-sm text-muted-foreground">
          Chart coming soon
        </p>
      </div>
    </div>
  );
}

export function ContentTab({ isLoading = false }: ContentTabProps) {
  // Placeholder analytics data - all zeros since clips feature may not exist
  const analytics: ContentAnalytics = {
    totalClips: 0,
    callsWithClipsPercent: 0,
    publishedCount: 0,
    publishedRate: 0,
    winnersCount: 0,
    clips: [],
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RiLoader2Line className="w-8 h-8 animate-spin text-vibe-orange" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card">
      {/* Top separator for breathing room */}
      <Separator className="mb-8" />

      {/* KPI Row */}
      <div className="px-2">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          Content Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total clips"
            value={analytics.totalClips}
            icon={RiFilmLine}
          />
          <StatCard
            label="% Calls with clips"
            value={`${analytics.callsWithClipsPercent}%`}
            icon={RiPercentLine}
          />
          <StatCard
            label="# Published"
            value={analytics.publishedCount}
            icon={RiUploadCloud2Line}
          />
          <StatCard
            label="Published rate"
            value={`${analytics.publishedRate}%`}
            icon={RiCheckLine}
          />
          <StatCard
            label="# Winners"
            value={analytics.winnersCount}
            icon={RiTrophyLine}
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Charts Section */}
      <div className="px-2">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          Content Trends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartPlaceholder title="Clips Created Over Time" />
          <ChartPlaceholder title="Clips per Call Histogram" />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Clips Table */}
      <div className="px-2 pb-8">
        <h3 className="font-display text-lg font-bold text-foreground mb-6">
          Clips Library
        </h3>

        {analytics.clips.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 bg-gray rounded-lg">
            <RiFilmLine className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              No clips created yet
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Create your first clip from a call transcript.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase font-medium">
                  Clip Title
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Source Call
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Tags
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Published
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Winning Hook
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Notes
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Created By
                </TableHead>
                <TableHead className="text-xs uppercase font-medium">
                  Created At
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.clips.map((clip) => (
                <TableRow key={clip.id}>
                  <TableCell className="font-medium">{clip.title}</TableCell>
                  <TableCell>{clip.sourceCall}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {clip.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {clip.published ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        No
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {clip.winningHook ? (
                      <RiTrophyLine className="h-4 w-4 text-vibe-orange" />
                    ) : (
                      <span className="text-muted-foreground">
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {clip.notes || "-"}
                  </TableCell>
                  <TableCell>{clip.createdBy}</TableCell>
                  <TableCell className="tabular-nums">
                    {clip.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
