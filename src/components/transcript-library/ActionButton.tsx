import React from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType;
  label?: string;
  variant?: "default" | "destructive" | "hollow";
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, label, onClick, variant = "default", className = "", title, ...rest }, ref) => {
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
          {...rest}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      );
    }

    // Use proper button variants - no custom overrides needed
    // default = glossy slate button (per brand guidelines)
    // destructive = glossy red button
    // hollow = white bordered button
    const desktopClasses = "h-8 gap-2";

    return (
      <Button
        ref={ref}
        variant={variant}
        size="sm"
        className={`${desktopClasses} ${className}`}
        onClick={onClick}
        title={title}
        {...rest}
      >
        <Icon className="h-4 w-4" />
        {label && <span className="hidden sm:inline">{label}</span>}
      </Button>
    );
  }
);

ActionButton.displayName = "ActionButton";
