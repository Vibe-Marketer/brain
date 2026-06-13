#!/usr/bin/env node

const BASE_URL = process.env.CALLVAULT_API_BASE_URL ?? 'https://api.callvaultai.com/v1'
const TOKEN = process.env.CALLVAULT_API_TOKEN

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error
  out(`Usage:
  callvault workspaces [--dry-run]
  callvault calls [--limit N] [--workspace ID] [--dry-run]
  callvault calls get <id> [--dry-run]
  callvault contacts [--dry-run]
  callvault speakers [--dry-run]

Environment:
  CALLVAULT_API_TOKEN      API token created in CallVault Settings
  CALLVAULT_API_BASE_URL   Optional API base URL, defaults to ${BASE_URL}`)
  process.exit(exitCode)
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function optionValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function request(path) {
  const dryRun = hasFlag('--dry-run')
  const url = new URL(path, `${BASE_URL}/`)

  if (dryRun) {
    console.log(JSON.stringify({ method: 'GET', url: url.toString(), auth: 'Bearer $CALLVAULT_API_TOKEN' }, null, 2))
    return
  }

  if (!TOKEN) {
    console.error('Missing CALLVAULT_API_TOKEN')
    process.exit(1)
  }

  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const body = await response.text()
  if (!response.ok) {
    console.error(body)
    process.exit(1)
  }
  console.log(body)
}

const [, , resource, action, id] = process.argv

if (!resource || resource === '--help' || resource === '-h') usage(0)

if (resource === 'workspaces') {
  await request('workspaces')
} else if (resource === 'calls' && action === 'get' && id) {
  await request(`calls/${id}`)
} else if (resource === 'calls') {
  const params = new URLSearchParams()
  const limit = optionValue('--limit')
  const workspace = optionValue('--workspace')
  if (limit) params.set('limit', limit)
  if (workspace) params.set('workspace_id', workspace)
  await request(`calls${params.size ? `?${params}` : ''}`)
} else if (resource === 'contacts') {
  await request('contacts')
} else if (resource === 'speakers') {
  await request('speakers')
} else {
  usage(1)
}

