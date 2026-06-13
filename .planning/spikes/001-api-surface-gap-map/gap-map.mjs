#!/usr/bin/env node

const currentRoutes = [
  'GET /v1/workspaces',
  'GET /v1/calls',
  'GET /v1/calls/{id}',
  'GET /v1/contacts',
  'GET /v1/speakers',
]

const targetFamilies = [
  {
    family: 'Contract and platform',
    severity: 'P0',
    items: [
      'OpenAPI 3.1 contract committed in docs/api/openapi.yaml',
      'Contract drift check against callvault-api route registry',
      'Stable error catalog and pagination semantics',
      'Rate-limit headers and documented quotas',
      'Versioning policy for /v1 and future /v2',
    ],
  },
  {
    family: 'Core read completeness',
    severity: 'P1',
    items: [
      'Folders and tags list/detail',
      'Workspace entries and folder membership',
      'Transcript segments as structured JSON, not only flattened transcript text',
      'Source/share URL via resolveShareUrl-derived field',
      'Search/filter endpoints for calls, contacts, and speakers',
    ],
  },
  {
    family: 'Write/import API',
    severity: 'P1',
    items: [
      'Paste transcript import',
      'Assign/unassign folders',
      'Add/remove tags',
      'Move recording to workspace',
      'Idempotency keys for import/write commands',
    ],
  },
  {
    family: 'Generated developer surfaces',
    severity: 'P1',
    items: [
      'Generated TypeScript types/client from OpenAPI',
      'CLI command map generated or checked against OpenAPI operationIds',
      'Redacted curl examples and smoke fixtures',
      'SDK/CLI release path outside the main app deploy',
    ],
  },
]

console.log(JSON.stringify({ currentRoutes, targetFamilies }, null, 2))

