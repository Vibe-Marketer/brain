/**
 * k6_load_test_template.js
 *
 * Production-ready k6 load test for SaaS launch readiness.
 * Tests: auth flow, dashboard, API endpoints, and key user journeys.
 *
 * Usage:
 *   k6 run k6_load_test_template.js
 *   k6 run --vus 50 --duration 5m k6_load_test_template.js
 *   k6 run -e BASE_URL=https://staging.example.com k6_load_test_template.js
 *
 * Stages (9 minutes total):
 *   0-2m:  Ramp from 0 -> 20 VUs  (warm-up)
 *   2-5m:  Hold at 20 VUs          (average load)
 *   5-7m:  Ramp from 20 -> 50 VUs  (peak load)
 *   7-8m:  Hold at 50 VUs          (stress test)
 *   8-9m:  Ramp down to 0          (cool-down)
 *
 * Thresholds (launch gates):
 *   - 95% of requests complete in < 2s
 *   - 99% of requests complete in < 5s
 *   - Error rate < 1%
 *   - Auth endpoint p95 < 3s
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authDuration = new Trend('auth_duration', true);
const dashboardDuration = new Trend('dashboard_duration', true);

// Configuration — override via -e BASE_URL=... at runtime.
// Default is localhost so the script is safe to run as a smoke test out of the box.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || BASE_URL;
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@example.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'loadtest-password';

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Warm up
    { duration: '3m', target: 20 },   // Steady state (average load)
    { duration: '2m', target: 50 },   // Ramp to peak
    { duration: '1m', target: 50 },   // Hold peak
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    // Global thresholds — launch gates
    http_req_duration: [
      'p(95)<2000',  // 95% of requests under 2s
      'p(99)<5000',  // 99% of requests under 5s
    ],
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
    errors: ['rate<0.01'],

    // Per-endpoint thresholds
    auth_duration: ['p(95)<3000'],     // Auth endpoint p95 < 3s
    dashboard_duration: ['p(95)<2000'], // Dashboard p95 < 2s
  },
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Setup runs once before all VUs start.
export function setup() {
  console.log(`Load test target: ${BASE_URL}`);
  console.log(`Stages: warm-up -> steady -> peak -> cool-down`);
  return { baseUrl: BASE_URL };
}

// Default function — VU logic.
export default function (data) {
  const baseUrl = data.baseUrl;

  // 1. Homepage load
  group('Homepage', () => {
    const res = http.get(baseUrl, { tags: { name: 'homepage' } });
    const ok = check(res, {
      'homepage: status 200': (r) => r.status === 200,
      'homepage: loads in < 3s': (r) => r.timings.duration < 3000,
    });
    errorRate.add(!ok);
  });

  sleep(1);

  // 2. Auth flow
  group('Auth', () => {
    const start = Date.now();

    const loginRes = http.post(
      `${baseUrl}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      { headers: jsonHeaders, tags: { name: 'auth_login' } }
    );

    authDuration.add(Date.now() - start);

    const loginOk = check(loginRes, {
      'auth: login status 200': (r) => r.status === 200,
      'auth: returns access_token': (r) => {
        try {
          return JSON.parse(r.body).access_token !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!loginOk);

    if (loginOk) {
      const token = JSON.parse(loginRes.body).access_token;
      const authHeaders = {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      };

      // 3. Authenticated API calls
      group('Dashboard API', () => {
        const dashStart = Date.now();

        const dashRes = http.get(
          `${baseUrl}/rest/v1/calls?order=created_at.desc&limit=20`,
          { headers: authHeaders, tags: { name: 'api_calls_list' } }
        );

        dashboardDuration.add(Date.now() - dashStart);

        check(dashRes, {
          'api: calls list status 200': (r) => r.status === 200,
          'api: calls list under 2s': (r) => r.timings.duration < 2000,
        });
        errorRate.add(dashRes.status !== 200);
      });

      sleep(0.5);

      // 4. Search / filter
      group('Search', () => {
        const searchRes = http.get(
          `${baseUrl}/rest/v1/calls?title=ilike.*test*&limit=10`,
          { headers: authHeaders, tags: { name: 'api_search' } }
        );
        check(searchRes, {
          'search: status 200': (r) => r.status === 200,
          'search: under 2s': (r) => r.timings.duration < 2000,
        });
        errorRate.add(searchRes.status !== 200);
      });
    }
  });

  sleep(Math.random() * 3 + 1); // Random think time: 1-4s
}

// Teardown runs once after all VUs finish.
export function teardown(data) {
  console.log('Load test complete.');
  console.log(`Target: ${data.baseUrl}`);
}
