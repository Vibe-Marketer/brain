import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const selectionButtonVariants = cva(
  [
    "relative flex rounded-lg text-left select-none",
    "border border-transparent",
    "transition-all duration-150 ease-in-out",
    "hover:bg-muted/70",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
  ],
  {
    variants: {
      orientation: {
        vertical: "w-full items-start gap-3",
        horizontal: "items-center gap-2",
      },
      size: {
        sm: "px-3 py-3",
        md: "px-3 py-3",
      },
      selected: {
        true: "bg-muted border-border shadow-sm",
        false: "",
      },
    },
    compoundVariants: [
      {
        orientation: "vertical",
        selected: true,
        className: cn(
          "pl-4",
          "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2",
          "before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
        ),
      },
      {
        orientation: "horizontal",
        selected: true,
        className: cn(
          "before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:-translate-x-1/2",
          "before:h-1 before:w-[65%] before:rounded-full before:bg-vibe-orange",
        ),
      },
    ],
    defaultVariants: {
      orientation: "vertical",
      size: "sm",
      selected: false,
    },
  },
);

export const iconContainerVariants = cva(
  [
    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
    "bg-card",
    "transition-all duration-300 ease-in-out",
  ],
  {
    variants: {
      selected: {
        true: "ring-1 ring-vibe-orange border-transparent",
        false: "border border-border",
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

export const selectionLabelVariants = cva(["block text-sm truncate transition-colors"], {
  variants: {
    selected: {
      true: "text-foreground font-bold",
      false: "text-foreground font-medium",
    },
  },
  defaultVariants: {
    selected: false,
  },
});
