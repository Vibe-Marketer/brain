import { useState } from "react";
import { RiVideoLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterButton } from "./FilterButton";
import { FathomIcon, ZoomIcon, YouTubeIcon, UploadIcon } from "./SourcePlatformIcons";
import { getSourceLabel } from "@/lib/source-labels";

interface SourceFilterPopoverProps {
  selectedSources?: string[];
  onSourcesChange: (sources: string[]) => void;
  /** Dynamic list of source_app values available in the current org/workspace */
  availableSources?: string[];
}

/** Map source_app values to their branded icons. Falls back to a generic icon. */
const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  fathom: FathomIcon,
  zoom: ZoomIcon,
  youtube: YouTubeIcon,
  "file-upload": UploadIcon,
};

export function SourceFilterPopover({
  selectedSources = [],
  onSourcesChange,
  availableSources,
}: SourceFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Staged selections — only committed on Apply (mirrors TagFilterPopover pattern)
  const [stagedSources, setStagedSources] = useState<string[]>(selectedSources);

  // Sync staged state when popover opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStagedSources(selectedSources);
    }
    setIsOpen(open);
  };

  const handleSourceToggle = (source: string, checked: boolean) => {
    if (checked) {
      setStagedSources([...stagedSources, source]);
    } else {
      setStagedSources(stagedSources.filter((s) => s !== source));
    }
  };

  const handleApply = () => {
    onSourcesChange(stagedSources);
    setIsOpen(false);
  };

  const handleClear = () => {
    setStagedSources([]);
    onSourcesChange([]);
    setIsOpen(false);
  };

  // If no available sources, don't render the filter at all
  if (!availableSources || availableSources.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiVideoLine className="h-3.5 w-3.5" />}
          label="Source"
          count={selectedSources.length}
          active={selectedSources.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-white dark:bg-card" align="start">
        <div className="p-4 pb-3">
          <div className="text-sm font-medium">Filter by Source</div>
        </div>
        <div className="px-4 pb-3 space-y-3">
          {availableSources.map((source) => {
            const Icon = SOURCE_ICONS[source] ?? UploadIcon;
            return (
              <div key={source} className="flex items-center gap-2">
                <Checkbox
                  id={`source-filter-${source}`}
                  checked={stagedSources.includes(source)}
                  onCheckedChange={(checked) => handleSourceToggle(source, !!checked)}
                />
                <label
                  htmlFor={`source-filter-${source}`}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                  {getSourceLabel(source)}
                </label>
              </div>
            );
          })}
        </div>
        <div className="border-t p-3 flex justify-end gap-2">
          <Button variant="hollow" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
