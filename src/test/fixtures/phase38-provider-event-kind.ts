export type ProviderEventKind = 'webinar' | 'non_webinar' | 'unknown'

export type Phase38SourceApp =
  | 'zoom'
  | 'fathom'
  | 'fireflies'
  | 'read-ai'
  | 'grain'
  | 'plaud'
  | 'youtube'
  | 'file-upload'
  | 'paste-transcript'
  | 'manual-mcp-import'

export interface Phase38ProviderSignalCase {
  id: string
  sourceApp: Phase38SourceApp
  signal: number | string | null
  metadata: Record<string, unknown>
  expected: ProviderEventKind
}

const zoomCase = (
  signal: number | string | null,
  expected: ProviderEventKind,
): Phase38ProviderSignalCase => ({
  id: `zoom-${String(signal)}`,
  sourceApp: 'zoom',
  signal,
  metadata: { zoom_type: signal },
  expected,
})

export const PHASE38_PROVIDER_SIGNAL_CASES: readonly Phase38ProviderSignalCase[] = [
  zoomCase(1, 'non_webinar'),
  zoomCase(2, 'non_webinar'),
  zoomCase(3, 'non_webinar'),
  zoomCase(4, 'non_webinar'),
  zoomCase(5, 'webinar'),
  zoomCase(6, 'webinar'),
  zoomCase(7, 'non_webinar'),
  zoomCase(8, 'non_webinar'),
  zoomCase(9, 'webinar'),
  zoomCase(99, 'non_webinar'),
  zoomCase(null, 'unknown'),
  zoomCase('malformed', 'unknown'),
  zoomCase(42, 'unknown'),
  { id: 'fathom-unknown', sourceApp: 'fathom', signal: null, metadata: {}, expected: 'unknown' },
  { id: 'fireflies-unknown', sourceApp: 'fireflies', signal: null, metadata: {}, expected: 'unknown' },
  { id: 'read-ai-unknown', sourceApp: 'read-ai', signal: null, metadata: { live_enabled: true }, expected: 'unknown' },
  {
    id: 'grain-free-form-webinar-is-unknown',
    sourceApp: 'grain',
    signal: 'Executive webinar',
    metadata: { grain_meeting_type: { name: 'Executive webinar' } },
    expected: 'unknown',
  },
  { id: 'plaud-unknown', sourceApp: 'plaud', signal: null, metadata: { object_type: 'file' }, expected: 'unknown' },
  { id: 'youtube-unknown', sourceApp: 'youtube', signal: null, metadata: { category: 'Education' }, expected: 'unknown' },
  { id: 'file-upload-unknown', sourceApp: 'file-upload', signal: null, metadata: {}, expected: 'unknown' },
  { id: 'paste-transcript-unknown', sourceApp: 'paste-transcript', signal: null, metadata: {}, expected: 'unknown' },
  { id: 'manual-mcp-import-unknown', sourceApp: 'manual-mcp-import', signal: null, metadata: {}, expected: 'unknown' },
]

export interface Phase38EventAggregationCase {
  id: string
  signals: readonly ProviderEventKind[]
  suppressesDiscovery: boolean
}

export const PHASE38_EVENT_AGGREGATION_CASES: readonly Phase38EventAggregationCase[] = [
  { id: 'webinar-wins-over-unknown', signals: ['webinar', 'unknown'], suppressesDiscovery: true },
  { id: 'webinar-wins-over-non-webinar', signals: ['webinar', 'non_webinar'], suppressesDiscovery: true },
  { id: 'non-webinar-plus-unknown-passes', signals: ['non_webinar', 'unknown'], suppressesDiscovery: false },
  { id: 'unknown-only-passes', signals: ['unknown'], suppressesDiscovery: false },
  { id: 'all-known-non-webinar-passes', signals: ['non_webinar', 'non_webinar'], suppressesDiscovery: false },
]

export type RequesterEvidence =
  | 'verified_confirmed'
  | 'unverified'
  | 'invitee_only'
  | 'organization_only'

export interface Phase38ParticipationBoundaryCase {
  id: string
  providerSignals: readonly ProviderEventKind[]
  confirmedIdentityCount: number
  requesterEvidence: RequesterEvidence
  suppressesDiscovery: boolean
  mayDiscover: boolean
}

export const PHASE38_PARTICIPATION_BOUNDARY_CASES: readonly Phase38ParticipationBoundaryCase[] = [
  {
    id: 'unknown-49-confirmed-allows-verified-confirmed',
    providerSignals: ['unknown'],
    confirmedIdentityCount: 49,
    requesterEvidence: 'verified_confirmed',
    suppressesDiscovery: false,
    mayDiscover: true,
  },
  {
    id: 'unknown-50-confirmed-suppresses',
    providerSignals: ['unknown'],
    confirmedIdentityCount: 50,
    requesterEvidence: 'verified_confirmed',
    suppressesDiscovery: true,
    mayDiscover: false,
  },
  {
    id: 'non-webinar-49-invitee-denied',
    providerSignals: ['non_webinar'],
    confirmedIdentityCount: 49,
    requesterEvidence: 'invitee_only',
    suppressesDiscovery: false,
    mayDiscover: false,
  },
  {
    id: 'unknown-49-org-member-denied',
    providerSignals: ['unknown'],
    confirmedIdentityCount: 49,
    requesterEvidence: 'organization_only',
    suppressesDiscovery: false,
    mayDiscover: false,
  },
  {
    id: 'unknown-49-unverified-denied',
    providerSignals: ['unknown'],
    confirmedIdentityCount: 49,
    requesterEvidence: 'unverified',
    suppressesDiscovery: false,
    mayDiscover: false,
  },
  {
    id: 'non-webinar-50-suppresses',
    providerSignals: ['non_webinar', 'unknown'],
    confirmedIdentityCount: 50,
    requesterEvidence: 'verified_confirmed',
    suppressesDiscovery: true,
    mayDiscover: false,
  },
]
