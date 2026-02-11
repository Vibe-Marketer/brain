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

  // Sharing (Single Call Share)
  sharing: {
    all: ['sharing'] as const,
    links: (callId: string | number) => ['sharing', 'links', callId] as const,
    link: (linkId: string) => ['sharing', 'link', linkId] as const,
    byToken: (token: string) => ['sharing', 'token', token] as const,
    accessLog: (linkId: string) => ['sharing', 'access-log', linkId] as const,
    sharedWithMe: () => ['sharing', 'shared-with-me'] as const,
  },

  // Teams
  teams: {
    all: ['teams'] as const,
    list: () => ['teams', 'list'] as const,
    detail: (teamId: string) => ['teams', 'detail', teamId] as const,
    memberships: (teamId: string) => ['teams', 'memberships', teamId] as const,
    membership: (membershipId: string) => ['teams', 'membership', membershipId] as const,
    shares: (teamId: string) => ['teams', 'shares', teamId] as const,
    directReports: (userId?: string) => ['teams', 'direct-reports', userId] as const,
    managerNotes: (callId: string | number) => ['teams', 'manager-notes', callId] as const,
    hierarchy: (teamId: string) => ['teams', 'hierarchy', teamId] as const,
  },

  // Content Library
  contentLibrary: {
    all: ['content-library'] as const,
    list: (filters?: Record<string, unknown>) => ['content-library', 'list', filters] as const,
    detail: (itemId: string) => ['content-library', 'detail', itemId] as const,
    tags: () => ['content-library', 'tags'] as const,
  },

  // Templates
  templates: {
    all: ['templates'] as const,
    list: (filters?: Record<string, unknown>) => ['templates', 'list', filters] as const,
    detail: (templateId: string) => ['templates', 'detail', templateId] as const,
    shared: () => ['templates', 'shared'] as const,
  },

  // Contacts
  contacts: {
    all: ['contacts'] as const,
    list: () => ['contacts', 'list'] as const,
    detail: (contactId: string) => ['contacts', 'detail', contactId] as const,
    settings: () => ['contacts', 'settings'] as const,
    appearances: (contactId: string) => ['contacts', 'appearances', contactId] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    unread: () => ['notifications', 'unread'] as const,
  },

  // Vaults
  vaults: {
    all: ['vaults'] as const,
    list: () => ['vaults', 'list'] as const,
    detail: (id: string) => ['vaults', 'detail', id] as const,
    members: (vaultId: string) => ['vaults', 'members', vaultId] as const,
    recordings: (vaultId: string) => ['vaults', 'recordings', vaultId] as const,
  },

  // Vault Entries (recording <-> vault assignments)
  vaultEntries: {
    all: ['vault-entries'] as const,
    byRecording: (recordingId: string) => ['vault-entries', 'recording', recordingId] as const,
    byVault: (vaultId: string) => ['vault-entries', 'vault', vaultId] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
