import { RiFileTextLine, RiSearchLine, RiFolderOpenLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "no-transcripts" | "no-results" | "no-category-transcripts";
  onAction?: () => void;
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const configs = {
    "no-transcripts": {
      icon: RiFileTextLine,
      title: "No transcripts yet",
      description: "Sync your Fathom calls to start organizing transcripts.",
      actionLabel: "Go to Dashboard",
    },
    "no-results": {
      icon: RiSearchLine,
      title: "No matching transcripts",
      description: "Try adjusting your search or filters to find what you're looking for.",
      actionLabel: "Clear Search",
    },
    "no-category-transcripts": {
      icon: RiFolderOpenLine,
      title: "No transcripts in this category",
      description: "Start organizing by categorizing transcripts from your library.",
      actionLabel: "View All Transcripts",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {config.description}
      </p>
      {onAction && (
        <Button onClick={onAction} variant="hollow">
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}
