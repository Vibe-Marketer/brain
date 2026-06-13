#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const spec = readFileSync(resolve(root, '.planning/spikes/002a-openapi-first-toolchain/openapi.yaml'), 'utf8')
const index = readFileSync(resolve(root, 'supabase/functions/callvault-api/index.ts'), 'utf8')

const expected = [
  ['/workspaces', '/v1/workspaces'],
  ['/calls', '/v1/calls'],
  ['/calls/{id}', '/v1/calls/'],
  ['/contacts', '/v1/contacts'],
  ['/speakers', '/v1/speakers'],
]

const failures = []
for (const [specPath, routeNeedle] of expected) {
  if (!spec.includes(`  ${specPath}:`)) failures.push(`missing OpenAPI path ${specPath}`)
  if (!index.includes(routeNeedle)) failures.push(`implementation missing route needle ${routeNeedle}`)
}

const operationIds = [...spec.matchAll(/operationId:\s*([A-Za-z0-9_]+)/g)].map((match) => match[1])
if (operationIds.length !== expected.length) {
  failures.push(`expected ${expected.length} operationIds, found ${operationIds.length}`)
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, operationIds }, null, 2))

