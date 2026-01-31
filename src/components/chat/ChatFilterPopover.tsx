/**
 * ChatFilterPopover - Filter popover content for chat
 * 
 * Provides UI for filtering chat by:
 * - Date range
 * - Speakers
 * - Categories
 * - Folders
 * - Specific calls
 */

import * as React from 'react';
import { format } from 'date-fns';
import { RiFolderLine } from '@remixicon/react';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import type { ChatFilters, ChatSpeaker, ChatCategory, ChatCall } from '@/types/chat';
import type { Folder } from '@/types/folders';

// ==================== Props Interface ====================

export interface ChatFilterPopoverProps {
  /** Current filter state */
  filters: ChatFilters;
  /** Update filters */
  setFilters: React.Dispatch<React.SetStateAction<ChatFilters>>;
  /** Available speakers */
  availableSpeakers: ChatSpeaker[];
  /** Available categories */
  availableCategories: ChatCategory[];
  /** Available folders */
  availableFolders: Folder[];
  /** Available calls */
  availableCalls: ChatCall[];
  /** Toggle speaker filter */
  toggleSpeaker: (speaker: string) => void;
  /** Toggle category filter */
  toggleCategory: (category: string) => void;
  /** Toggle folder filter */
  toggleFolder: (folderId: string) => void;
  /** Toggle call filter */
  toggleCall: (recordingId: number) => void;
}

// ==================== Component ====================

export function ChatFilterPopover({
  filters,
  setFilters,
  availableSpeakers,
  availableCategories,
  availableFolders,
  availableCalls,
  toggleSpeaker,
  toggleCategory,
  toggleFolder,
  toggleCall,
}: ChatFilterPopoverProps): React.ReactElement {
  return (
    <div className="p-4">
      <h3 className="font-display text-sm font-bold uppercase text-ink mb-3">
        Filter Transcripts
      </h3>

      {/* Date Range */}
      <div className="mb-4">
        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
          Date Range
        </label>
        <DateRangePicker
          dateRange={{ from: filters.dateStart, to: filters.dateEnd }}
          onDateRangeChange={(range) =>
            setFilters((prev) => ({
              ...prev,
              dateStart: range?.from,
              dateEnd: range?.to,
            }))
          }
          placeholder="Select date range"
          showQuickSelect
          numberOfMonths={1}
          disableFuture={false}
          triggerClassName="w-full"
        />
      </div>

      <Separator className="my-4" />

      {/* Speakers */}
      <div className="mb-4">
        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
          Speakers ({availableSpeakers.length})
        </label>
        <ScrollArea className="h-32">
          <div className="space-y-1">
            {availableSpeakers.map((speaker) => (
              <button
                key={speaker.speaker_email || speaker.speaker_name}
                onClick={() => toggleSpeaker(speaker.speaker_name)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                  filters.speakers.includes(speaker.speaker_name)
                    ? 'bg-vibe-orange/10 text-ink'
                    : 'hover:bg-hover text-ink-soft'
                }`}
              >
                <span className="truncate">{speaker.speaker_name}</span>
                <span className="text-xs text-ink-muted">{speaker.call_count} calls</span>
              </button>
            ))}
            {availableSpeakers.length === 0 && (
              <p className="text-sm text-ink-muted py-2">No speakers indexed yet</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator className="my-4" />

      {/* Categories */}
      <div className="mb-4">
        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
          Categories ({availableCategories.length})
        </label>
        <div className="flex flex-wrap gap-1">
          {availableCategories.map((cat) => (
            <Badge
              key={cat.category}
              variant={filters.categories.includes(cat.category) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleCategory(cat.category)}
            >
              {cat.category} ({cat.call_count})
            </Badge>
          ))}
          {availableCategories.length === 0 && (
            <p className="text-sm text-ink-muted py-2">No categories indexed yet</p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Folders */}
      <div className="mb-4">
        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
          Folders ({availableFolders.length})
        </label>
        <ScrollArea className="h-32">
          <div className="space-y-1">
            {availableFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => toggleFolder(folder.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  filters.folderIds.includes(folder.id)
                    ? 'bg-vibe-orange/10 text-ink'
                    : 'hover:bg-hover text-ink-soft'
                }`}
              >
                <RiFolderLine 
                  className="h-4 w-4 flex-shrink-0" 
                  style={{ color: folder.color || '#6B7280' }}
                />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
            {availableFolders.length === 0 && (
              <p className="text-sm text-ink-muted py-2">No folders created yet</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator className="my-4" />

      {/* Specific Calls */}
      <div>
        <label className="text-xs font-medium text-ink-muted uppercase mb-2 block">
          Specific Calls ({availableCalls.length})
        </label>
        <ScrollArea className="h-[150px]">
          <div className="space-y-2 pr-4">
            {availableCalls.map((call) => (
              <div
                key={call.recording_id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-hover transition-colors"
              >
                <Checkbox
                  id={`call-${call.recording_id}`}
                  checked={filters.recordingIds.includes(call.recording_id)}
                  onCheckedChange={() => toggleCall(call.recording_id)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`call-${call.recording_id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <div className="text-ink font-medium truncate">
                    {call.title || 'Untitled Call'}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {format(new Date(call.created_at), 'MMM d, yyyy')}
                  </div>
                </label>
              </div>
            ))}
            {availableCalls.length === 0 && (
              <p className="text-sm text-ink-muted py-2">No calls found</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
