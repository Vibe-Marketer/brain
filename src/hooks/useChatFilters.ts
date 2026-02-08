/**
 * useChatFilters - Filter state management for chat
 * 
 * Extracts filter-related state and manipulation functions from Chat.tsx.
 * Manages date range, speakers, categories, and recording ID filters.
 */

import * as React from 'react';
import type { ChatFilters, ChatApiFilters, ChatLocationState, ContextAttachment } from '@/types/chat';

// ==================== Hook Interface ====================

interface UseChatFiltersOptions {
  /** Initial location state from router */
  initialLocationState?: ChatLocationState;
}

interface UseChatFiltersReturn {
  // Filter state
  filters: ChatFilters;
  setFilters: React.Dispatch<React.SetStateAction<ChatFilters>>;
  
  // API-formatted filters (memoized)
  apiFilters: ChatApiFilters;
  
  // Filter manipulation
  clearFilters: () => void;
  toggleSpeaker: (speaker: string) => void;
  toggleCategory: (category: string) => void;
  toggleFolder: (folderId: string) => void;
  toggleCall: (recordingId: number) => void;
  addRecordingId: (recordingId: number) => void;
  setDateRange: (dateStart: Date | undefined, dateEnd: Date | undefined) => void;
  
  // Context attachments
  contextAttachments: ContextAttachment[];
  setContextAttachments: React.Dispatch<React.SetStateAction<ContextAttachment[]>>;
  removeAttachment: (id: number) => void;
  addCallAttachment: (call: { recording_id: number; title: string; created_at: string }) => void;
  
  // Computed
  hasActiveFilters: boolean;
}

/**
 * Hook for managing chat filter state
 * 
 * Extracts all filter-related state from Chat.tsx including:
 * - Date range, speakers, categories, recording IDs
 * - Context attachments (calls attached via "+ Add context")
 * - Filter manipulation functions
 * - API filter formatting
 */
export function useChatFilters(options: UseChatFiltersOptions = {}): UseChatFiltersReturn {
  const { initialLocationState } = options;

  // Initialize filters from location state if available
  const [filters, setFilters] = React.useState<ChatFilters>(() => {
    if (initialLocationState?.prefilter) {
      return {
        dateStart: undefined,
        dateEnd: undefined,
        speakers: [],
        categories: [],
        recordingIds: initialLocationState.prefilter.recordingIds || [],
        folderIds: [],
      };
    }
    return {
      dateStart: undefined,
      dateEnd: undefined,
      speakers: [],
      categories: [],
      recordingIds: [],
      folderIds: [],
    };
  });

  // Context attachments state (calls attached via "+ Add context")
  const [contextAttachments, setContextAttachments] = React.useState<ContextAttachment[]>(() => {
    if (initialLocationState?.initialContext) {
      return initialLocationState.initialContext;
    }
    return [];
  });

  // Build filter object for API - memoized to avoid unnecessary transport recreation
  const apiFilters = React.useMemo<ChatApiFilters>(
    () => ({
      date_start: filters.dateStart?.toISOString(),
      date_end: filters.dateEnd?.toISOString(),
      speakers: filters.speakers?.length > 0 ? filters.speakers : undefined,
      categories: filters.categories?.length > 0 ? filters.categories : undefined,
      recording_ids: filters.recordingIds?.length > 0 ? filters.recordingIds : undefined,
      folder_ids: filters.folderIds?.length > 0 ? filters.folderIds : undefined,
    }),
    [filters]
  );

  // Check if any filters are active
  const hasActiveFilters = React.useMemo(() => {
    return !!(
      filters.dateStart ||
      filters.dateEnd ||
      (filters.speakers?.length ?? 0) > 0 ||
      (filters.categories?.length ?? 0) > 0 ||
      (filters.recordingIds?.length ?? 0) > 0 ||
      (filters.folderIds?.length ?? 0) > 0
    );
  }, [filters]);

  // ==================== Filter Manipulation ====================

  const clearFilters = React.useCallback(() => {
    setFilters({
      dateStart: undefined,
      dateEnd: undefined,
      speakers: [],
      categories: [],
      recordingIds: [],
      folderIds: [],
    });
  }, []);

  const toggleSpeaker = React.useCallback((speaker: string) => {
    setFilters((prev) => ({
      ...prev,
      speakers: prev.speakers.includes(speaker)
        ? prev.speakers.filter((s) => s !== speaker)
        : [...prev.speakers, speaker],
    }));
  }, []);

  const toggleCategory = React.useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const toggleFolder = React.useCallback((folderId: string) => {
    setFilters((prev) => ({
      ...prev,
      folderIds: prev.folderIds.includes(folderId)
        ? prev.folderIds.filter((id) => id !== folderId)
        : [...prev.folderIds, folderId],
    }));
  }, []);

  const toggleCall = React.useCallback((recordingId: number) => {
    setFilters((prev) => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds.filter((id) => id !== recordingId)
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  const addRecordingId = React.useCallback((recordingId: number) => {
    setFilters((prev) => ({
      ...prev,
      recordingIds: prev.recordingIds.includes(recordingId)
        ? prev.recordingIds
        : [...prev.recordingIds, recordingId],
    }));
  }, []);

  const setDateRange = React.useCallback((dateStart: Date | undefined, dateEnd: Date | undefined) => {
    setFilters((prev) => ({
      ...prev,
      dateStart,
      dateEnd,
    }));
  }, []);

  // ==================== Context Attachments ====================

  const removeAttachment = React.useCallback((id: number) => {
    setContextAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addCallAttachment = React.useCallback(
    (call: { recording_id: number; title: string; created_at: string }) => {
      setContextAttachments((prev) => [
        ...prev,
        {
          type: 'call' as const,
          id: call.recording_id,
          title: call.title,
          date: call.created_at,
        },
      ]);
    },
    []
  );

  // Memoize the return object to prevent infinite loops when used in useEffect deps
  return React.useMemo(
    () => ({
      // Filter state
      filters,
      setFilters,
      
      // API-formatted filters
      apiFilters,
      
      // Filter manipulation
      clearFilters,
      toggleSpeaker,
      toggleCategory,
      toggleFolder,
      toggleCall,
      addRecordingId,
      setDateRange,
      
      // Context attachments
      contextAttachments,
      setContextAttachments,
      removeAttachment,
      addCallAttachment,
      
      // Computed
      hasActiveFilters,
    }),
    [
      filters,
      setFilters,
      apiFilters,
      clearFilters,
      toggleSpeaker,
      toggleCategory,
      toggleFolder,
      toggleCall,
      addRecordingId,
      setDateRange,
      contextAttachments,
      setContextAttachments,
      removeAttachment,
      addCallAttachment,
      hasActiveFilters,
    ]
  );
}
