import * as React from "react";
import { format } from "date-fns";
import { RiCalendarLine, RiCloseLine, RiRefreshLine } from "@remixicon/react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

interface DateRangePickerProps {
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  showQuickSelect?: boolean;
  numberOfMonths?: number;
  disableFuture?: boolean;
  placeholder?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  disabled?: boolean;
  triggerClassName?: string;
  onFetch?: () => void;
  fetchButtonText?: string;
  /** Show extended quick select options (90 days, 6 months, year options) */
  extendedQuickSelect?: boolean;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  showQuickSelect = true,
  numberOfMonths = 1,
  disableFuture = false,
  placeholder = "Pick a date range",
  align = "start",
  className,
  disabled = false,
  triggerClassName,
  onFetch,
  fetchButtonText = "Fetch",
  extendedQuickSelect = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  // Use 1 month on mobile, otherwise use the prop value
  const displayMonths = isMobile ? 1 : numberOfMonths;

  /**
   * Normalize date range to ensure same-day selections span the full day.
   * When from and to are the same calendar day, set from to 00:00:00 and to to 23:59:59.999
   * This prevents zero-width time ranges when querying databases.
   */
  const normalizeDateRange = (range: { from?: Date; to?: Date }): { from?: Date; to?: Date } => {
    if (!range.from || !range.to) return range;

    // Check if from and to are the same calendar day
    const isSameDay =
      range.from.getFullYear() === range.to.getFullYear() &&
      range.from.getMonth() === range.to.getMonth() &&
      range.from.getDate() === range.to.getDate();

    if (!isSameDay) return range;

    // Same day - normalize times to span full day
    const normalizedFrom = new Date(range.from);
    normalizedFrom.setHours(0, 0, 0, 0);

    const normalizedTo = new Date(range.to);
    normalizedTo.setHours(23, 59, 59, 999);

    return { from: normalizedFrom, to: normalizedTo };
  };

  const getQuickSelectRange = (preset: string): { from: Date; to: Date } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (preset) {
      case 'today': {
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        return { from: today, to: endOfToday };
      }
      case 'yesterday': {
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        return { from: yesterday, to: endOfYesterday };
      }
      case 'last7': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        return { from: last7, to: today };
      }
      case 'thisMonth': {
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: thisMonthStart, to: today };
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: lastMonthStart, to: lastMonthEnd };
      }
      case 'last30': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        return { from: last30, to: today };
      }
      case 'last90': {
        const last90 = new Date(today);
        last90.setDate(last90.getDate() - 90);
        return { from: last90, to: today };
      }
      case 'last6Months': {
        const last6Months = new Date(today);
        last6Months.setMonth(last6Months.getMonth() - 6);
        return { from: last6Months, to: today };
      }
      case 'thisYear': {
        const thisYearStart = new Date(today.getFullYear(), 0, 1);
        return { from: thisYearStart, to: today };
      }
      case 'lastYear': {
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        return { from: lastYearStart, to: lastYearEnd };
      }
      default:
        return { from: today, to: today };
    }
  };

  const handleQuickSelect = (preset: string) => {
    const range = getQuickSelectRange(preset);
    onDateRangeChange(range);
    // Don't close automatically - let user see the selection
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange({});
  };

  const hasSelection = dateRange?.from || dateRange?.to;

  // Calculate the default month to display
  // When disableFuture is true and showing multiple months, offset backward
  // so the current month appears on the right side
  const getDefaultMonth = () => {
    if (disableFuture && displayMonths > 1) {
      const today = new Date();
      const defaultMonth = new Date(today.getFullYear(), today.getMonth() - (displayMonths - 1), 1);
      return defaultMonth;
    }
    return undefined; // Let react-day-picker use default behavior
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="sm"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !hasSelection && "text-muted-foreground",
            triggerClassName
          )}
        >
          <RiCalendarLine className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              (() => {
                // Check if same calendar day to show cleaner single-day format
                const isSameDay =
                  dateRange.from.getFullYear() === dateRange.to.getFullYear() &&
                  dateRange.from.getMonth() === dateRange.to.getMonth() &&
                  dateRange.from.getDate() === dateRange.to.getDate();

                if (isSameDay) {
                  return format(dateRange.from, "MMM d, yyyy");
                }

                return (
                  <>
                    {format(dateRange.from, "MMM d, yyyy")} -{" "}
                    {format(dateRange.to, "MMM d, yyyy")}
                  </>
                );
              })()
            ) : (
              format(dateRange.from, "MMM d, yyyy")
            )
          ) : (
            <span>{placeholder}</span>
          )}
          {hasSelection && (
            <RiCloseLine
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("!w-auto p-0 max-h-[90vh]", className)} align={align}>
        <div className="p-4 space-y-4 pointer-events-auto overflow-y-auto max-h-[calc(90vh-2rem)]">
          {showQuickSelect && (
            <div>
              <Label className="text-xs font-medium mb-2 block">Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('today')}
                  className="h-7 text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('yesterday')}
                  className="h-7 text-xs"
                >
                  Yesterday
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('last7')}
                  className="h-7 text-xs"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('thisMonth')}
                  className="h-7 text-xs"
                >
                  This Month
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('lastMonth')}
                  className="h-7 text-xs"
                >
                  Last Month
                </Button>
                <Button
                  variant="hollow"
                  size="sm"
                  onClick={() => handleQuickSelect('last30')}
                  className="h-7 text-xs"
                >
                  Last 30 Days
                </Button>
                {extendedQuickSelect && (
                  <>
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => handleQuickSelect('last90')}
                      className="h-7 text-xs"
                    >
                      Last 90 Days
                    </Button>
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => handleQuickSelect('last6Months')}
                      className="h-7 text-xs"
                    >
                      Last 6 Months
                    </Button>
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => handleQuickSelect('thisYear')}
                      className="h-7 text-xs"
                    >
                      This Year
                    </Button>
                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => handleQuickSelect('lastYear')}
                      className="h-7 text-xs"
                    >
                      Last Year
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          <div>
            {showQuickSelect && (
              <Label className="text-xs font-medium mb-2 block">Select Date Range</Label>
            )}
            <Calendar
              mode="range"
              selected={dateRange as DateRange}
              onSelect={(range) => {
                if (range) {
                  // Normalize same-day selections to span full day
                  const normalized = normalizeDateRange(range);
                  onDateRangeChange(normalized);
                } else {
                  onDateRangeChange(range);
                }
              }}
              numberOfMonths={displayMonths}
              defaultMonth={getDefaultMonth()}
              disabled={disableFuture ? (date) => date > new Date() : undefined}
              endMonth={disableFuture ? new Date() : undefined}
              autoFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          {onFetch && (
            <div className="px-4 pb-4 pt-2 flex justify-center">
              <Button
                onClick={() => {
                  onFetch();
                  setOpen(false);
                }}
                disabled={!dateRange?.from || !dateRange?.to || disabled}
                size="sm"
                className="uppercase"
              >
                <RiRefreshLine className="mr-2 h-4 w-4" />
                {fetchButtonText}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
