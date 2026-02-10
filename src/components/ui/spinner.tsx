import { RiLoader2Line } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <RiLoader2Line
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
      aria-hidden="true"
    />
  );
}

export default Spinner;
