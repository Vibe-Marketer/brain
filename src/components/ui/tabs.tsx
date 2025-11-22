import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="w-full border-b border-cb-gray-light dark:border-cb-gray-dark">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex items-center",
        className,
        // ENFORCED: Always left-justified with 24px gap - cannot be overridden
        "justify-start gap-6",
      )}
      {...props}
    />
  </div>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base styles
      "relative inline-flex items-center justify-center whitespace-nowrap",
      "text-sm font-light uppercase",
      // Inactive state
      "text-cb-ink-muted transition-all duration-200",
      // Active state - font weight and color
      "data-[state=active]:font-semibold",
      "data-[state=active]:text-cb-ink dark:data-[state=active]:text-white",
      // Active state - 6px vibe green underline (angular shape via CSS)
      "data-[state=active]:after:absolute",
      "data-[state=active]:after:bottom-0",
      "data-[state=active]:after:left-0",
      "data-[state=active]:after:right-0",
      "data-[state=active]:after:h-[6px]",
      "data-[state=active]:after:bg-vibe-green",
      "data-[state=active]:after:content-['']",
      // Hover state
      "hover:text-cb-ink dark:hover:text-white",
      // Focus state
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
      // ENFORCED: No horizontal padding, only bottom padding for underline space
      "px-0 pb-3 pt-0 m-0",
    )}
    style={{
      // Angular clip-path for the ::after pseudo-element applied via CSS
    }}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
