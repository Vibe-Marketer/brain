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
         * 1. PRIMARY / DEFAULT — Slate gradient, subtle depth.
         *    Apple-inspired: suggests dimension without heavy 3D.
         *    Same appearance in light and dark mode.
         */
        default: [
          "bg-gradient-to-b from-[#627285] to-[#394655]",
          "border border-[rgba(57,70,85,0.8)]",
          "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.2)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.12),0_2px_8px_rgba(61,74,91,0.1)]",
          "active:translate-y-px active:scale-[0.98]",
          "rounded-xl",
        ],

        /**
         * 2. HOLLOW — Bordered secondary action with subtle gradient.
         *    Shares the same design language as default (lighter treatment).
         *    Adapts between light and dark mode.
         */
        hollow: [
          "bg-gradient-to-b from-white to-gray-50 border border-border text-foreground",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.06)]",
          "hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-100 hover:border-border/80",
          "dark:from-card dark:to-secondary dark:hover:from-secondary dark:hover:to-secondary/80",
          "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)]",
          "rounded-xl",
        ],

        /**
         * 3. DESTRUCTIVE — Red gradient with same subtle depth as default.
         *    Same appearance in light and dark mode.
         */
        destructive: [
          "bg-gradient-to-b from-[#E54D4D] to-[#C93A3A]",
          "border border-[rgba(190,50,50,0.8)]",
          "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.2)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]",
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
         *    Light gradient hint ties it to the same family as default/hollow.
         */
        outline: [
          "bg-gradient-to-b from-white/80 to-transparent border border-border/40 text-muted-foreground",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          "hover:bg-gradient-to-b hover:from-gray-50 hover:to-transparent hover:text-foreground hover:border-border",
          "dark:from-transparent dark:border-border dark:text-muted-foreground",
          "dark:hover:from-secondary/30 dark:hover:text-white dark:hover:border-border/80",
          "dark:shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
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
