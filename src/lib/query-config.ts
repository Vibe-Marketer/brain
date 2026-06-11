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

  // Recordings
  recordings: {
    all: ['recordings'] as const,
    availableSources: (orgId: string, workspaceId?: string | null) =>
      ['recordings', 'available-sources', orgId, workspaceId] as const,
  },

  // Folder Assignments (per-call folder membership map)
  folderAssignments: {
    all: ['folder-assignments'] as const,
    list: (workspaceId?: string) => ['folder-assignments', 'list', workspaceId] as const,
  },

  // Tag Assignments (per-recording tag membership map)
  tagAssignments: {
    all: ['tag-assignments'] as const,
    list: (recordingIds?: (number | string)[]) =>
      ['tag-assignments', 'list', recordingIds] as const,
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

  // Sync tab — paginated list of already-synced transcripts
  transcripts: {
    all: ['transcripts'] as const,
    synced: (filters?: Record<string, unknown>) =>
      ['transcripts', 'synced', filters] as const,
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
    detail: (tagId: string) => ['tags', 'detail', tagId] as const,
    counts: (orgId?: string) => ['tags', 'counts', orgId] as const,
    rules: (orgId?: string) => ['tags', 'rules', orgId] as const,
    recurringTitles: (orgId?: string) => ['tags', 'recurring-titles', orgId] as const,
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

  // Contact Folders
  contactFolders: {
    all: ['contact-folders'] as const,
    list: (orgId?: string) => ['contact-folders', 'list', orgId] as const,
  },

  // Contacts
  contacts: {
    all: ['contacts'] as const,
    list: (orgId?: string) => ['contacts', 'list', orgId] as const,
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

  // Integrations (per-user connection + sync status snapshot)
  integrations: {
    all: () => ['integrations', 'statuses'] as const,
  },

  // Routing Rules (V2 architecture)
  routingRules: {
    all: ['routing-rules'] as const,
    list: (orgId?: string) => ['routing-rules', 'list', orgId] as const,
    // Shared per-org cache: ONE query returns every routing default, consumers
    // slice their source_app via TanStack Query `select`. Collapses what was
    // an N+1 (one network call per connector) into a single round trip.
    defaultsAll: (orgId?: string) => ['routing-rules', 'defaults-all', orgId] as const,
    preview: (orgId?: string) => ['routing-rules', 'preview', orgId] as const,
  },

  // Admin center (16-01: dashboard + needs-you; later waves add users/qa/audit)
  admin: {
    all: ['admin'] as const,
    dashboard: () => ['admin', 'dashboard'] as const,
    needsYou: () => ['admin', 'needs-you'] as const,
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

// === Cache invalidation audit (Phase 36-02 BUG-03) ===
// Snapshot taken 2026-05-11 when adding invalidateCallListCaches().
//
// Hooks that mutate the call list (move/delete/tag/assign to folder|workspace)
// were each invalidating a DIFFERENT subset of caches, producing stale UI
// after mutations. Audit findings:
//
// useFolderAssignment.ts:
//   - assignToFolder / removeFromFolder / moveBetweenFolders
//   - Invalidates: folders.detail(id), folder-assignments (LEGACY string!),
//     recordings.all (UNDEFINED until this commit — fix below)
//   - Missing: workspace-entries.all, calls.all
//
// useFolders.ts:
//   - moveCallToFolder / removeCallFromFolder (and folder CRUD)
//   - Invalidates: folders.list, ['folder_assignments'] (LEGACY string!),
//     ['folders', 'archived', workspaceId] (LEGACY string)
//   - Missing: calls.all, recordings.all, workspace-entries
//
// useTags.ts:
//   - Tag CRUD, assignment via useCallTags (in useCallDetailMutations)
//   - Invalidates: tags.list, tags.counts, tags.rules (correct for tag tables)
//   - Missing: calls.all (so the tag pill doesn't show on the row), recordings.all
//
// useCallDetailMutations.ts:
//   - Delete call, update title, tag assign/remove (via useCallTags)
//   - Invalidates: calls.all, calls.detail, ['tag-calls'] (LEGACY), workspaces.all
//   - Decent — but doesn't invalidate workspaceEntries (so workspace col stale)
//
// useWorkspaceAssignment.ts:
//   - Add/remove call from workspace
//   - Invalidates: workspaceEntries.all, ['workspace-entries', 'recording-batch']
//   - Missing: calls.all (so the Workspaces column on home doesn't refresh)
//
// Fix: unified `invalidateCallListCaches(queryClient)` helper invalidates the
// six canonical hubs that back every call-list surface. Every mutation hook
// calls this helper in onSettled (always runs, even on error rollback).

/**
 * Phase 36-02 BUG-03: Invalidate every cache that backs the call list.
 *
 * Call this from every mutation that affects what shows in the home table,
 * workspace table, folder table, or call detail surface — move, delete, tag,
 * assign-to-folder, assign-to-workspace, etc. Single source of truth for
 * cache-staleness fixes.
 *
 * Belt-and-suspenders: also invalidates the legacy string-array keys that
 * pre-factory hooks still use (workspace-entries, folder_assignments,
 * tag-calls, recordings).
 */
export function invalidateCallListCaches(
  queryClient: import('@tanstack/react-query').QueryClient,
): void {
  // Canonical factory-routed keys (the six hubs)
  queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.workspaceEntries.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.folderAssignments.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.tagAssignments.all });

  // Legacy string-array keys still in use by un-migrated hooks.
  // Safe to remove once every hook has been audited and migrated.
  queryClient.invalidateQueries({ queryKey: ['workspace-entries'] });
  queryClient.invalidateQueries({ queryKey: ['folder_assignments'] });
  queryClient.invalidateQueries({ queryKey: ['tag-calls'] });
  queryClient.invalidateQueries({ queryKey: ['recordings'] });
}
