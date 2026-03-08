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
    list: (workspaceId?: string) => ['folders', 'list', workspaceId] as const,
    detail: (folderId: string) => ['folders', 'detail', folderId] as const,
    assignments: (workspaceId?: string) => ['folder-assignments', workspaceId] as const,
  },

  // Tags
  tags: {
    all: ['tags'] as const,
    list: (orgId?: string) => ['tags', 'list', orgId] as const,
    assignments: (recordingIds: number | number[]) => ['tag-assignments', recordingIds] as const,
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

  // Workspaces
  workspaces: {
    all: ['workspaces'] as const,
    list: (orgId?: string) => ['workspaces', 'list', orgId] as const,
    detail: (id: string) => ['workspaces', 'detail', id] as const,
    members: (workspaceId: string) => ['workspaces', 'members', workspaceId] as const,
    recordings: (workspaceId: string) => ['workspaces', 'recordings', workspaceId] as const,
  },

  // Workspace Entries (recording <-> workspace assignments)
  workspaceEntries: {
    all: ['workspace-entries'] as const,
    byRecording: (recordingId: string) => ['workspace-entries', 'recording', recordingId] as const,
    byRecordingBatch: (recordingIds: string[]) => ['workspace-entries', 'recording-batch', recordingIds] as const,
    byWorkspace: (workspaceId: string) => ['workspace-entries', 'workspace', workspaceId] as const,
  },

  // Organizations
  organizations: {
    all: ['organizations'] as const,
    list: () => ['organizations', 'list'] as const,
    detail: (orgId: string) => ['organizations', 'detail', orgId] as const,
    members: (orgId: string) => ['organizations', 'members', orgId] as const,
    invitations: (orgId: string) => ['organizations', 'invitations', orgId] as const,
  },

  // Imports (V2 architecture)
  imports: {
    all: ['imports'] as const,
    sources: () => ['imports', 'sources'] as const,
    counts: () => ['imports', 'counts'] as const,
    history: () => ['imports', 'history'] as const,
    failed: () => ['imports', 'failed'] as const,
  },

  // Routing Rules (V2 architecture)
  routingRules: {
    all: ['routing-rules'] as const,
    list: (orgId?: string) => ['routing-rules', 'list', orgId] as const,
    defaults: (orgId?: string) => ['routing-rules', 'defaults', orgId] as const,
    preview: (orgId?: string) => ['routing-rules', 'preview', orgId] as const,
  },

  // Raw Calls (source-specific detail data)
  rawCalls: {
    fathom: (recordingId: string) => ['raw-calls', 'fathom', recordingId] as const,
    zoom: (recordingId: string) => ['raw-calls', 'zoom', recordingId] as const,
    youtube: (recordingId: string) => ['raw-calls', 'youtube', recordingId] as const,
    upload: (recordingId: string) => ['raw-calls', 'upload', recordingId] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
