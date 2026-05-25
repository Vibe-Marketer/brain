import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ConnectorSetupInstructionsProps {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ConnectorSetupInstructions({
  title,
  description,
  children,
  className,
}: ConnectorSetupInstructionsProps) {
  if (!title && !description && !children) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {title ? (
        <p className="text-xs font-medium text-foreground">{title}</p>
      ) : null}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
