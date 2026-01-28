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
      captionLayout="dropdown" // Enable month/year dropdown navigation
      navLayout="around" // Arrows flank the date: [ < ] January 2026 [ > ]
      reverseYears // Most recent years at top of dropdown
      startMonth={startMonth ?? defaultStartMonth}
      endMonth={endMonth ?? defaultEndMonth}
      className={cn("p-3", className)}
      classNames={{
        // Single month layout
        months: "flex flex-col",
        month: "flex flex-col gap-2",
        // Caption row with nav buttons on either side of dropdowns
        month_caption: "flex justify-center items-center gap-2 h-10",
        caption_label: "text-sm font-medium hidden", // Hidden when using dropdown
        // Dropdown styling
        dropdowns: "flex items-center gap-1",
        dropdown: "appearance-none bg-transparent border border-input rounded-lg px-2 py-1 text-sm font-medium cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange",
        months_dropdown: "w-[100px]",
        years_dropdown: "w-[70px]",
        // Navigation buttons - styled hollow buttons with border
        nav: "flex items-center",
        button_previous: cn(
          "h-8 w-8 p-0 rounded-lg border border-input bg-background hover:bg-muted inline-flex items-center justify-center",
        ),
        button_next: cn(
          "h-8 w-8 p-0 rounded-lg border border-input bg-background hover:bg-muted inline-flex items-center justify-center",
        ),
        // Calendar grid
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
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
