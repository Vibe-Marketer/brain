import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  [
    "inline-flex h-5 shrink-0 items-center justify-center rounded-full border px-2",
    "text-[10px] font-black uppercase tracking-[0.08em] leading-none",
    "whitespace-nowrap align-middle select-none",
  ],
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        beta:
          "min-w-[52px] border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
        connected:
          "min-w-[84px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        setupNeeded:
          "min-w-[112px] border-border bg-muted text-muted-foreground",
        new: "min-w-[56px] border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
        comingSoon:
          "min-w-[112px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        active:
          "min-w-[72px] border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
        currentPlan:
          "min-w-[112px] border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
        inactive:
          "min-w-[84px] border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
        trial:
          "min-w-[72px] border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
        warning:
          "min-w-[84px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        error:
          "min-w-[72px] border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
        success:
          "min-w-[84px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        info: "min-w-[72px] border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
        outline: "border-border bg-transparent text-foreground",
      },
      size: {
        sm: "h-4 px-1.5 text-[9px]",
        md: "h-5 px-2 text-[10px]",
        lg: "h-6 px-2.5 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

type StatusBadgeVariant = NonNullable<
  VariantProps<typeof statusBadgeVariants>["variant"]
>;

const badgeLabelMap = {
  default: "DEFAULT",
  beta: "BETA",
  connected: "CONNECTED",
  setupNeeded: "SETUP NEEDED",
  new: "NEW",
  comingSoon: "COMING SOON",
  active: "ACTIVE",
  currentPlan: "CURRENT PLAN",
  inactive: "INACTIVE",
  trial: "TRIAL",
  warning: "WARNING",
  error: "ERROR",
  success: "SUCCESS",
  info: "INFO",
  outline: "LABEL",
} satisfies Record<StatusBadgeVariant, string>;

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

export function StatusBadge({
  variant = "default",
  size = "md",
  label,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const resolvedVariant = variant ?? "default";
  const resolvedLabel =
    children ?? label ?? badgeLabelMap[resolvedVariant] ?? "DEFAULT";

  return (
    <span
      className={cn(statusBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {resolvedLabel}
    </span>
  );
}
