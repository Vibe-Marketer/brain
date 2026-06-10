import { describe, expect, it } from 'vitest'

import {
  buildScopedMcpUrl,
  buildSubdomainMcpUrl,
  getMcpUrl,
} from '@/services/mcp-tokens.service'

describe('buildSubdomainMcpUrl', () => {
  it('builds an organization-scoped subdomain URL', () => {
    expect(buildSubdomainMcpUrl('acmecorp')).toBe('https://acmecorp.callvaultai.com/mcp')
  })

  it('builds a workspace-scoped subdomain URL', () => {
    expect(buildSubdomainMcpUrl('acmecorp', 'sales')).toBe('https://acmecorp-sales.callvaultai.com/mcp')
  })

  it('supports numeric org slugs', () => {
    expect(buildSubdomainMcpUrl('abc123')).toBe('https://abc123.callvaultai.com/mcp')
  })

  it('supports numeric workspace slugs', () => {
    expect(buildSubdomainMcpUrl('org1', 'ws2')).toBe('https://org1-ws2.callvaultai.com/mcp')
  })

  it('treats empty workspace slug as absent', () => {
    expect(buildSubdomainMcpUrl('org1', '')).toBe('https://org1.callvaultai.com/mcp')
  })

  it('treats undefined workspace slug as absent', () => {
    expect(buildSubdomainMcpUrl('org1', undefined)).toBe('https://org1.callvaultai.com/mcp')
  })

  it('keeps the legacy scoped URL builder unchanged', () => {
    expect(buildScopedMcpUrl('organization', null)).toBe(getMcpUrl())
    expect(buildScopedMcpUrl('workspace', 'ws-1')).toBe('https://mcp.callvaultai.com/w/ws-1')
  })
})
