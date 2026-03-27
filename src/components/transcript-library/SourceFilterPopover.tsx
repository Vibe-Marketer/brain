import { RiVideoLine } from "@remixicon/react";
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
  const handleSourceToggle = (source: string, checked: boolean) => {
    if (checked) {
      onSourcesChange([...selectedSources, source]);
    } else {
      onSourcesChange(selectedSources.filter((s) => s !== source));
    }
  };

  // If no available sources, don't render the filter at all
  if (!availableSources || availableSources.length === 0) {
    return null;
  }

  return (
    <Popover>
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
        <div className="px-4 pb-4 space-y-3">
          {availableSources.map((source) => {
            const Icon = SOURCE_ICONS[source] ?? UploadIcon;
            return (
              <div key={source} className="flex items-center gap-2">
                <Checkbox
                  id={`source-filter-${source}`}
                  checked={selectedSources.includes(source)}
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
      </PopoverContent>
    </Popover>
  );
}
