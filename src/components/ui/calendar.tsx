import * as React from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Generate date range for dropdown navigation (v8 uses fromMonth/toMonth)
const currentYear = new Date().getFullYear();
const defaultFromMonth = new Date(currentYear - 10, 0); // 10 years back
const defaultToMonth = new Date(currentYear + 1, 11); // 1 year forward

function Calendar({ className, classNames, showOutsideDays = true, fromMonth, toMonth, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown" // Enable month/year dropdown navigation
      fromMonth={fromMonth ?? defaultFromMonth}
      toMonth={toMonth ?? defaultToMonth}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center gap-1",
        caption_label: "text-sm font-medium hidden", // Hide when using dropdown layout
        // Dropdown styling - styled native selects
        caption_dropdowns: "flex items-center gap-2",
        dropdown: "appearance-none bg-transparent border border-input rounded-md px-2 py-1 text-sm font-medium cursor-pointer hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        dropdown_month: "w-[110px]",
        dropdown_year: "w-[80px]",
        dropdown_icon: "hidden", // Hide default icon, we can add custom one via CSS if needed
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "hollow" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "hollow" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-none"),
        // Selected dates: solid dark fill with white text (high contrast, square)
        day_range_end: "day-range-end bg-foreground text-background hover:bg-foreground hover:text-background rounded-none",
        day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background rounded-none",
        // Today: subtle outline
        day_today: "bg-muted text-foreground ring-1 ring-foreground/30 rounded-none",
        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-foreground/50 aria-selected:text-background aria-selected:opacity-70",
        day_disabled: "text-muted-foreground opacity-50",
        // Range middle: lighter fill
        day_range_middle: "aria-selected:bg-foreground/20 dark:aria-selected:bg-foreground/30 aria-selected:text-foreground rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <RiArrowLeftSLine className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <RiArrowRightSLine className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
