/**
 * CallVault Load Test Suite — k6
 *
 * Usage:
 *   k6 run load-tests/callvault.k6.js
 *   BASE_URL=https://callvaultai.com k6 run load-tests/callvault.k6.js
 *
 * Stages:
 *   ramp-up → steady → spike → recovery
 *
 * Thresholds:
 *   P95 response time < 2 s across all scenarios
 *   Error rate < 1%
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// ─── Custom metrics ──────────────────────────────────────────────────────────
const errorRate   = new Rate('errors')
const apiDuration = new Trend('api_duration', true)
const authErrors  = new Counter('auth_errors')

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || 'https://brain-govibey.vercel.app'
const MCP_URL    = __ENV.MCP_URL    || 'https://mcp.callvaultai.com'
const ANON_KEY   = __ENV.SUPABASE_ANON_KEY   || ''
const SUPABASE_URL = __ENV.SUPABASE_URL || ''

// ─── Load Stages ─────────────────────────────────────────────────────────────
export const options = {
  stages: [
    // Ramp up to 20 concurrent users over 1 minute
    { duration: '1m',  target: 20  },
    // Hold 20 VUs for 3 minutes (steady-state baseline)
    { duration: '3m',  target: 20  },
    // Spike to 50 VUs for 1 minute (traffic burst)
    { duration: '1m',  target: 50  },
    // Recover back to 20 VUs
    { duration: '1m',  target: 20  },
    // Ramp down
    { duration: '30s', target: 0   },
  ],

  thresholds: {
    // P95 across all HTTP requests must stay under 2 s
    http_req_duration:   ['p(95)<2000'],
    // Custom API latency tracker
    api_duration:        ['p(95)<2000'],
    // Overall error rate must stay below 1%
    errors:              ['rate<0.01'],
    // Status 200/201/304 rate must be above 99%
    http_req_failed:     ['rate<0.01'],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function jsonHeaders(token) {
  const h = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

function track(res, name) {
  const ok = res.status >= 200 && res.status < 400
  errorRate.add(!ok)
  apiDuration.add(res.timings.duration, { endpoint: name })
  return ok
}

// ─── Scenario: unauthenticated public endpoints ───────────────────────────────
export function publicEndpoints() {
  group('Public / CDN assets', () => {
    const res = http.get(BASE_URL, { tags: { endpoint: 'landing' } })
    const ok = check(res, {
      'landing page 200':     (r) => r.status === 200,
      'landing page < 3s':    (r) => r.timings.duration < 3000,
    })
    track(res, 'landing')
  })

  sleep(Math.random() * 2 + 1)
}

// ─── Scenario: Supabase REST API (reads) ─────────────────────────────────────
export function supabaseReadScenario() {
  if (!SUPABASE_URL || !ANON_KEY) return

  group('Supabase: call_tags read', () => {
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/call_tags?select=id,name,color&limit=50&order=name`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          Accept: 'application/json',
        },
        tags: { endpoint: 'supabase_tags' },
      }
    )

    check(res, {
      'tags status 200 or 401':   (r) => r.status === 200 || r.status === 401,
      'tags response time < 1s':  (r) => r.timings.duration < 1000,
    })

    if (res.status === 401) authErrors.add(1)
    track(res, 'supabase_tags')
  })

  sleep(Math.random() + 0.5)
}

// ─── Scenario: Vercel edge / API routes ──────────────────────────────────────
export function apiRoutes() {
  // Zoom webhook endpoint (POST — should return 401 without signature)
  group('Zoom webhook endpoint availability', () => {
    const res = http.post(
      `${BASE_URL}/api/zoom-webhook`,
      JSON.stringify({ event: 'ping' }),
      {
        headers: jsonHeaders(),
        tags: { endpoint: 'zoom_webhook' },
      }
    )

    // Expect 401 (no signature) or 400 — not 5xx
    const ok = check(res, {
      'webhook not 5xx': (r) => r.status < 500,
      'webhook < 2s':    (r) => r.timings.duration < 2000,
    })
    track(res, 'zoom_webhook')
  })

  // MCP endpoint (should return 401 without valid token)
  group('MCP endpoint availability', () => {
    const res = http.get(
      MCP_URL,
      { headers: jsonHeaders(), tags: { endpoint: 'mcp_endpoint' } }
    )

    check(res, {
      'MCP not 5xx': (r) => r.status < 500,
      'MCP < 2s':    (r) => r.timings.duration < 2000,
    })
    track(res, 'mcp_endpoint')
  })

  sleep(Math.random() * 3 + 1)
}

// ─── Default function (runs all scenarios in one VU) ─────────────────────────
export default function () {
  publicEndpoints()
  supabaseReadScenario()
  apiRoutes()
}

// ─── Setup: basic connectivity check ─────────────────────────────────────────
export function setup() {
  const res = http.get(BASE_URL)
  if (res.status === 0) {
    throw new Error(`Cannot reach ${BASE_URL} — is the app deployed?`)
  }
  console.log(`✓ Target reachable: ${BASE_URL} (${res.status})`)
  return { baseUrl: BASE_URL }
}

// ─── Teardown: print summary stats ───────────────────────────────────────────
export function teardown(data) {
  console.log(`\n✓ Load test complete against ${data.baseUrl}`)
  console.log('  Review thresholds above for pass/fail determination.')
}
