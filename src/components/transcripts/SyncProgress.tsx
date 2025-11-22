import { Progress } from "@/components/ui/progress";

interface SyncProgressProps {
  current: number;
  total: number;
}

export function SyncProgress({ current, total }: SyncProgressProps) {
  if (total === 0) return null;

  return (
    <div className="p-4 border border-cb-gray-light dark:border-cb-gray-dark rounded-lg bg-white/50 dark:bg-card/50">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Syncing meetings...</span>
          <span className="text-muted-foreground">
            {current} / {total}
          </span>
        </div>
        <Progress value={(current / total) * 100} className="h-2" />
      </div>
    </div>
  );
}
