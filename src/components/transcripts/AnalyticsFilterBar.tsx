import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RiTimeLine, RiArrowDownSLine } from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AnalyticsFilters {
  timeRange: '7d' | '30d' | '90d' | 'all';
  showFolders: boolean;
  showTags: boolean;
  showCallTypes: boolean;
  showMonthly: boolean;
  showDuration: boolean;
  showInvitees: boolean;
}

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
}

export function AnalyticsFilterBar({ filters, onFiltersChange }: AnalyticsFilterBarProps) {
  const updateFilter = (key: keyof AnalyticsFilters, value: boolean | string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const timeRangeLabels: Record<string, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    'all': 'All time'
  };

  return (
    <div className="p-6 bg-white dark:bg-card">
      <div className="flex flex-row items-start gap-8">
        {/* Time Range Selector */}
        <div className="flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="min-w-[180px] h-[44px] text-sm whitespace-nowrap flex items-center justify-center gap-2">
                <RiTimeLine className="h-4 w-4" />
                TIME RANGE
                <RiArrowDownSLine className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuItem onClick={() => updateFilter('timeRange', '7d')}>
                Last 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateFilter('timeRange', '30d')}>
                Last 30 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateFilter('timeRange', '90d')}>
                Last 90 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateFilter('timeRange', 'all')}>
                All time
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mt-2 text-xs text-cb-gray-dark dark:text-cb-gray-light">
            {timeRangeLabels[filters.timeRange]}
          </div>
        </div>

        {/* Chart Visibility Toggles */}
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-medium text-cb-gray-dark dark:text-cb-gray-light mb-2 block">
            Visible Charts
          </Label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="folders"
                checked={filters.showFolders}
                onCheckedChange={(checked) => updateFilter('showFolders', checked)}
              />
              <Label htmlFor="folders" className="text-sm cursor-pointer">
                Folders
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tags"
                checked={filters.showTags}
                onCheckedChange={(checked) => updateFilter('showTags', checked)}
              />
              <Label htmlFor="tags" className="text-sm cursor-pointer">
                Tags
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="callTypes"
                checked={filters.showCallTypes}
                onCheckedChange={(checked) => updateFilter('showCallTypes', checked)}
              />
              <Label htmlFor="callTypes" className="text-sm cursor-pointer">
                Call Types
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="monthly"
                checked={filters.showMonthly}
                onCheckedChange={(checked) => updateFilter('showMonthly', checked)}
              />
              <Label htmlFor="monthly" className="text-sm cursor-pointer">
                Monthly
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="duration"
                checked={filters.showDuration}
                onCheckedChange={(checked) => updateFilter('showDuration', checked)}
              />
              <Label htmlFor="duration" className="text-sm cursor-pointer">
                Duration
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="invitees"
                checked={filters.showInvitees}
                onCheckedChange={(checked) => updateFilter('showInvitees', checked)}
              />
              <Label htmlFor="invitees" className="text-sm cursor-pointer">
                Invitees
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
