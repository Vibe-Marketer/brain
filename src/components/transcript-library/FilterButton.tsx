import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReactNode, forwardRef } from "react";

interface FilterButtonProps {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ icon, label, count, active, onClick }, ref) => {
    const isMobile = useIsMobile();

    if (isMobile) {
      return (
        <Button
          ref={ref}
          variant="default"
          size="icon-sm"
          className="h-8 w-8"
          onClick={onClick}
        >
          {icon}
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        variant="default"
        size="sm"
        className={cn(
          "h-8 gap-1.5 text-xs",
          active && "ring-2 ring-vibe-orange ring-offset-2"
        )}
        onClick={onClick}
      >
        {icon}
        <span>{label}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-2xs bg-vibe-orange text-white rounded-full px-1.5 py-0.5">
            {count}
          </span>
        )}
      </Button>
    );
  }
);

FilterButton.displayName = "FilterButton";
