import { cn } from "@/lib/utils";

interface StepLabelProps {
  step: number;
  label: string;
  className?: string;
}

/**
 * StepLabel - Numbered step indicator with label
 * 
 * Shows a circled number followed by step label text
 * Used in the 3-step sync flow for visual hierarchy
 * 
 * @brand-version v4.2
 */
export function StepLabel({ step, label, className }: StepLabelProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-3", className)}>
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-vibe-orange text-white text-xs font-bold">
        {step}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-ink-muted">
        {label}
      </span>
    </div>
  );
}
