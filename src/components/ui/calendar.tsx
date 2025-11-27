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
      navLayout="around" // Navigation arrows on both sides
      reverseYears // Most recent years at top of dropdown
      startMonth={startMonth ?? defaultStartMonth}
      endMonth={endMonth ?? defaultEndMonth}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center items-center h-7 relative",
        caption_label: "text-sm font-medium hidden", // Hidden when using dropdown
        // Dropdown styling
        dropdowns: "flex items-center justify-center gap-2",
        dropdown: "appearance-none bg-transparent border border-input rounded-md px-2 py-1 text-sm font-medium cursor-pointer hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
        months_dropdown: "w-[110px]",
        years_dropdown: "w-[80px]",
        // Navigation
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "hollow" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "hollow" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        // Calendar grid
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "hollow" }),
          "h-9 w-9 p-0 font-normal rounded-none aria-selected:opacity-100"
        ),
        // Selected dates: solid dark fill with white text (high contrast, square)
        selected: "bg-foreground text-background hover:bg-foreground hover:text-background",
        range_start: "bg-foreground text-background hover:bg-foreground hover:text-background rounded-none",
        range_end: "bg-foreground text-background hover:bg-foreground hover:text-background rounded-none",
        range_middle: "bg-foreground/20 dark:bg-foreground/30 text-foreground rounded-none",
        // Today: subtle outline
        today: "bg-muted text-foreground ring-1 ring-foreground/30",
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
