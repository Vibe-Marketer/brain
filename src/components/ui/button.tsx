import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles shared by all variants
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-colors cursor-pointer select-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-vibe-orange focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /**
         * 1. PRIMARY / DEFAULT — Glossy slate gradient for main actions.
         *    Same appearance in light and dark mode (no change needed).
         */
        default: [
          "bg-gradient-to-b from-[#627285] to-[#394655]",
          "border border-[rgba(57,70,85,0.8)]",
          "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]",
          "shadow-[inset_0_4px_6px_rgba(255,255,255,0.25),inset_0_-4px_6px_rgba(0,0,0,0.35),0_10px_20px_rgba(61,74,91,0.2)]",
          "active:translate-y-px active:scale-[0.98]",
          "rounded-xl",
        ],

        /**
         * 2. HOLLOW / PLAIN — Simple border for secondary actions.
         *    Adapts between light and dark mode.
         */
        hollow: [
          "bg-background border border-border text-foreground",
          "hover:bg-muted hover:border-border/80",
          "dark:bg-card dark:hover:bg-secondary",
          "rounded-xl",
        ],

        /**
         * 3. DESTRUCTIVE — Red gradient for dangerous actions.
         *    Same appearance in light and dark mode.
         */
        destructive: [
          "bg-gradient-to-b from-[#E54D4D] to-[#C93A3A]",
          "border border-[rgba(190,50,50,0.8)]",
          "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]",
          "shadow-[inset_0_4px_6px_rgba(255,255,255,0.25),inset_0_-4px_6px_rgba(0,0,0,0.3),0_10px_20px_rgba(0,0,0,0.15)]",
          "active:translate-y-px active:scale-[0.98]",
          "rounded-xl",
        ],

        /**
         * 4. GHOST — Transparent bg, no border, for minimal UI contexts.
         */
        ghost: [
          "bg-transparent text-muted-foreground border-transparent",
          "hover:bg-muted/50 hover:text-foreground",
          "dark:hover:bg-secondary/50 dark:hover:text-white",
          "rounded-lg",
        ],

        /**
         * 5. LINK — Text-only for tertiary actions.
         */
        link: [
          "bg-transparent border-transparent text-foreground",
          "underline underline-offset-4",
          "hover:decoration-vibe-orange hover:decoration-2",
          "focus-visible:decoration-vibe-orange focus-visible:decoration-2",
          "h-auto min-w-0 px-0 py-0 rounded-none",
        ],

        /**
         * 6. OUTLINE — Subtle bordered for toggleable/selectable items.
         */
        outline: [
          "bg-transparent border border-border/40 text-muted-foreground",
          "hover:bg-muted/50 hover:text-foreground hover:border-border",
          "dark:border-border dark:text-muted-foreground",
          "dark:hover:bg-secondary/50 dark:hover:text-white dark:hover:border-border/80",
          "rounded-lg",
        ],
      },

      size: {
        default: "h-10 px-6 text-sm min-w-[120px]",
        sm: "h-9 px-5 text-sm min-w-[100px]",
        lg: "h-11 px-7 text-base min-w-[135px]",
        icon: "h-8 w-8 p-0 min-w-0 rounded-md [&_svg]:size-4",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
