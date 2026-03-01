import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Tabs — Radix UI Tabs primitives with CallVault brand styling.
 *
 * Spec (brand-guidelines-v4.4.md — Tab Navigation section):
 * - TabsList: full-width with bottom border (border-ink / dark:border-white),
 *   flex row left-justified with 24px gap between triggers
 * - TabsTrigger: uppercase text, font-light inactive → font-semibold active,
 *   6px vibe-orange rounded pill at the bottom of active trigger (::after pseudo)
 * - No background on active state — only font weight + color + orange pill
 * - TabsContent: simple wrapper with focus ring
 *
 * Import: uses 'radix-ui' package (NOT '@radix-ui/react-tabs')
 * Export: Tabs (root), TabsList, TabsTrigger, TabsContent
 */

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="w-full border-b border-ink dark:border-white">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        // Base layout
        "flex items-center",
        // ENFORCED: always left-justified, 24px gap — cannot be overridden by className
        // (className before enforced classes so these always win)
        className,
        "justify-start gap-6",
      )}
      {...props}
    />
  </div>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base layout
      "relative inline-flex items-center justify-center whitespace-nowrap",
      // Typography — uppercase, 14px, light weight
      "text-sm font-light uppercase tracking-wide",
      // Inactive color + transition
      "text-muted-foreground transition-all duration-200",
      // ENFORCED spacing: no horizontal padding, only bottom padding for underline room
      // (className before enforced classes so these always win)
      className,
      "px-0 pb-3 pt-0 m-0",
      // Active: font weight + color
      "data-[state=active]:font-semibold",
      "data-[state=active]:text-foreground dark:data-[state=active]:text-white",
      // Active: 6px vibe-orange rounded pill at bottom via ::after pseudo-element
      "data-[state=active]:after:absolute",
      "data-[state=active]:after:bottom-0",
      "data-[state=active]:after:left-0",
      "data-[state=active]:after:right-0",
      "data-[state=active]:after:h-[6px]",
      "data-[state=active]:after:bg-vibe-orange",
      "data-[state=active]:after:rounded-full",
      "data-[state=active]:after:content-['']",
      // Hover
      "hover:text-foreground dark:hover:text-white",
      // Focus
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
      // Disabled
      "disabled:pointer-events-none disabled:opacity-50",
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
