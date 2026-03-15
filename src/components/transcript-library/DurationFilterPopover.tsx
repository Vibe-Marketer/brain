import { useState } from "react";
import { RiTimeLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { FilterButton } from "./FilterButton";

interface DurationFilterPopoverProps {
  durationMin?: number;
  durationMax?: number;
  onDurationChange: (min?: number, max?: number) => void;
}

export function DurationFilterPopover({
  durationMin,
  durationMax,
  onDurationChange,
}: DurationFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Single-handle slider value (used for less-than / more-than)
  const [singleValue, setSingleValue] = useState<number>(durationMin || durationMax || 30);
  // Dual-handle slider values for range mode [min, max]
  const [rangeValues, setRangeValues] = useState<number[]>([
    durationMin || 15,
    durationMax || 60,
  ]);

  const handleLessThan = () => {
    onDurationChange(undefined, singleValue);
    setIsOpen(false);
  };

  const handleMoreThan = () => {
    onDurationChange(singleValue, undefined);
    setIsOpen(false);
  };

  const handleBetween = () => {
    onDurationChange(rangeValues[0], rangeValues[1]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onDurationChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiTimeLine className="h-3.5 w-3.5" />}
          label="Duration"
          active={!!(durationMin || durationMax)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-white dark:bg-card" align="start">
        <div className="space-y-5">
          <div className="text-sm font-medium">Call Duration (minutes)</div>

          {/* Single-value slider for less-than / more-than */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Threshold: <span className="font-medium text-foreground">{singleValue} min</span>
            </div>
            <Slider
              value={[singleValue]}
              onValueChange={(value) => setSingleValue(value[0])}
              max={180}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex gap-2 pt-1">
              <Button
                variant="hollow"
                size="sm"
                className="flex-1"
                onClick={handleLessThan}
              >
                Less than {singleValue} min
              </Button>
              <Button
                variant="hollow"
                size="sm"
                className="flex-1"
                onClick={handleMoreThan}
              >
                More than {singleValue} min
              </Button>
            </div>
          </div>

          {/* Dual-value slider for range (between X and Y) */}
          <div className="space-y-2 border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Range: <span className="font-medium text-foreground">{rangeValues[0]}–{rangeValues[1]} min</span>
            </div>
            <Slider
              value={rangeValues}
              onValueChange={(value) => setRangeValues(value as [number, number])}
              max={180}
              min={5}
              step={5}
              minStepsBetweenThumbs={1}
              className="w-full"
            />
            <Button
              variant="hollow"
              size="sm"
              className="w-full"
              onClick={handleBetween}
            >
              Between {rangeValues[0]}–{rangeValues[1]} min
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button variant="hollow" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
