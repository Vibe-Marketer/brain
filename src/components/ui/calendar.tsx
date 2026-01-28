import * as React from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Generate date range for dropdown navigation (v9 uses startMonth/endMonth)
const currentYear = new Date().getFullYear();
const defaultStartMonth = new Date(currentYear - 10, 0); // 10 years back
const defaultEndMonth = new Date(currentYear + 1, 11); // 1 year forward

function Calendar({ className, classNames, showOutsideDays = true, startMonth, endMonth, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      startMonth={startMonth ?? defaultStartMonth}
      endMonth={endMonth ?? defaultEndMonth}
      className={cn("p-3", className)}
      classNames={{
        // Layout - centered
        months: "flex flex-col items-center",
        month: "flex flex-col gap-2",
        // Hide built-in caption when using custom navigation
        month_caption: "hidden",
        caption_label: "hidden",
        // Hide built-in nav when using custom navigation
        nav: "hidden",
        button_previous: "hidden",
        button_next: "hidden",
        // Calendar grid - centered
        month_grid: "border-collapse",
        weekdays: "flex justify-center",
        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem] text-center",
        week: "flex justify-center mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "hollow" }),
          "h-9 w-9 p-0 font-normal rounded-full aria-selected:opacity-100"
        ),
        // Selected dates: gray fill with circular shape
        selected: "bg-neutral-600 text-white hover:bg-neutral-700 dark:bg-neutral-400 dark:text-neutral-900 dark:hover:bg-neutral-300 rounded-full",
        range_start: "bg-neutral-600 text-white hover:bg-neutral-700 dark:bg-neutral-400 dark:text-neutral-900 rounded-full",
        range_end: "bg-neutral-600 text-white hover:bg-neutral-700 dark:bg-neutral-400 dark:text-neutral-900 rounded-full",
        range_middle: "bg-neutral-200 dark:bg-neutral-700 text-foreground rounded-full",
        // Today: subtle gray outline
        today: "bg-neutral-100 dark:bg-neutral-800 text-foreground ring-1 ring-neutral-400 dark:ring-neutral-500 rounded-full",
        outside: "text-muted-foreground opacity-50 aria-selected:bg-foreground/50 aria-selected:text-background aria-selected:opacity-70",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <RiArrowLeftSLine className="h-4 w-4" />;
          }
          return <RiArrowRightSLine className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
