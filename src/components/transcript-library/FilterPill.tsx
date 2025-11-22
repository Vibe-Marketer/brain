import { RiCloseLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";

interface FilterPillProps {
  label: string;
  value: string;
  onRemove: () => void;
  onClick?: () => void;
}

export function FilterPill({ label, value, onRemove, onClick }: FilterPillProps) {
  return (
    <Badge
      variant="secondary"
      className="h-8 gap-2 pl-3 pr-2 text-xs font-normal rounded-md bg-background dark:bg-card border border-border cursor-pointer hover:bg-muted dark:hover:bg-accent"
      onClick={onClick}
    >
      <span className="text-foreground">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-primary">{value}</span>
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-sm hover:bg-muted dark:hover:bg-accent p-0.5"
        aria-label={`Remove ${label} filter`}
      >
        <RiCloseLine className="h-3 w-3" />
      </button>
    </Badge>
  );
}
