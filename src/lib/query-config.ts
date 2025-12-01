/**
 * Centralized Query Keys for TanStack Query
 * Using factory pattern for type-safe, consistent query keys
 */

export const queryKeys = {
  // User related
  user: {
    all: ['user'] as const,
    settings: (userId: string) => ['user-settings', userId] as const,
    profile: (userId: string) => ['user-profile', userId] as const,
    role: (userId: string) => ['user-role', userId] as const,
  },

  // Calls/Transcripts
  calls: {
    all: ['calls'] as const,
    list: (filters?: Record<string, unknown>) => ['calls', 'list', filters] as const,
    detail: (recordingId: string | number) => ['calls', 'detail', recordingId] as const,
    transcripts: (recordingId: string | number) => ['call-transcripts', recordingId] as const,
    categories: (recordingId: string | number) => ['call-categories', recordingId] as const,
    tags: (recordingId: string | number) => ['call-tags', recordingId] as const,
    speakers: (recordingId: string | number) => ['call-speakers', recordingId] as const,
  },

  // Categories
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
    assignments: (recordingIds: number[]) => ['category-assignments', recordingIds] as const,
  },

  // Sync jobs
  syncJobs: {
    all: ['sync-jobs'] as const,
    active: () => ['sync-jobs', 'active'] as const,
    detail: (jobId: string) => ['sync-jobs', jobId] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    summary: (filters?: Record<string, unknown>) => ['analytics', 'summary', filters] as const,
  },

  // Chat
  chat: {
    all: ['chat'] as const,
    sessions: () => ['chat', 'sessions'] as const,
    session: (sessionId: string) => ['chat', 'session', sessionId] as const,
    messages: (sessionId: string) => ['chat', 'messages', sessionId] as const,
  },

  // Config
  config: {
    status: () => ['config-status'] as const,
  },

  // Folders
  folders: {
    all: ['folders'] as const,
    list: () => ['folders', 'list'] as const,
    detail: (folderId: string) => ['folders', 'detail', folderId] as const,
    assignments: () => ['folder-assignments'] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
