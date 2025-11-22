import React from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface ActionButtonProps {
  icon: React.ElementType;
  label?: string;
  onClick?: () => void;
  variant?: "default" | "destructive" | "hollow";
  className?: string;
  title?: string;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, label, onClick, variant = "default", className = "", title }, ref) => {
    const isMobile = useIsMobile();

    if (isMobile) {
      const mobileClasses = variant === "destructive"
        ? "h-8 px-2 gap-1.5 text-destructive hover:bg-destructive/10"
        : "h-8 px-2 gap-1.5";

      return (
        <Button
          ref={ref}
          variant="hollow"
          className={`${mobileClasses} ${className}`}
          onClick={onClick}
          title={title}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      );
    }

    const desktopClasses = variant === "default"
      ? "h-8 gap-2 bg-cb-black text-cb-white hover:bg-cb-hover"
      : variant === "destructive"
      ? "h-8 gap-2"
      : "h-8 gap-2";

    return (
      <Button
        ref={ref}
        variant={variant}
        size="sm"
        className={`${desktopClasses} ${className}`}
        onClick={onClick}
        title={title}
      >
        <Icon className="h-4 w-4" />
        {label && <span className="hidden sm:inline">{label}</span>}
      </Button>
    );
  }
);

ActionButton.displayName = "ActionButton";
