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
          variant="hollow"
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
        variant={undefined as any}
        size="sm"
        className={cn(
          "h-8 gap-1.5 text-xs bg-cb-black dark:bg-white text-white dark:text-cb-black hover:bg-cb-hover dark:hover:bg-gray-100 border-none",
          active && "ring-2 ring-cb-black ring-offset-2"
        )}
        onClick={onClick}
      >
        {icon}
        <span>{label}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
            {count}
          </span>
        )}
      </Button>
    );
  }
);

FilterButton.displayName = "FilterButton";
