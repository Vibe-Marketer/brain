/**
 * Deno handler tests for sentry-resolve with a mocked outbound Sentry endpoint.
 *
 * Run: deno test supabase/functions/sentry-resolve/__tests__/sentry-resolve.handler.deno.test.ts
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSentryResolveRequest } from "../index.ts";

const SERVICE_ROLE_KEY = "service-role-test-key";
const USER_JWT = "normal-user-jwt";
const SENTRY_TOKEN = "sentry-token-event-write";
const SENTRY_ORG = "ai-simple";

type CapturedFetch = {
  url: string;
  init: RequestInit;
};

function env(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    SENTRY_AUTH_TOKEN: SENTRY_TOKEN,
    SENTRY_ORG,
    ...overrides,
  };
  return {
    get(name: string): string | undefined {
      return values[name];
    },
  };
}

function request(
  body: unknown,
  authorization?: string,
  method = "POST",
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization) headers.set("Authorization", authorization);
  return new Request("https://example.test/functions/v1/sentry-resolve", {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

async function json(response: Response): Promise<unknown> {
  return await response.json();
}

function mockFetch(
  status = 200,
  calls: CapturedFetch[] = [],
): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof url === "string" ? url : url.toString(),
      init: init ?? {},
    });
    return Promise.resolve(
      new Response(JSON.stringify({ ok: status >= 200 && status < 300 }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
}

Deno.test("OPTIONS returns CORS preflight without calling Sentry", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({}, undefined, "OPTIONS"),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("non-POST returns 405 without calling Sentry", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({}, `Bearer ${SERVICE_ROLE_KEY}`, "GET"),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 405);
  assertEquals(calls.length, 0);
});

Deno.test("no Authorization returns 401 and does not call mocked Sentry", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "sentry:12345" }),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test("normal user JWT returns 403 and does not call mocked Sentry", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "sentry:12345" }, `Bearer ${USER_JWT}`),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 403);
  assertEquals(calls.length, 0);
});

Deno.test("service-role daemon request resolves through the mocked Sentry endpoint", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "sentry:12345" }, `Bearer ${SERVICE_ROLE_KEY}`),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 200);
  assertEquals(await json(response), { success: true, resolved: true });
  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].url,
    "https://sentry.io/api/0/organizations/ai-simple/issues/12345/",
  );
  assertEquals(calls[0].init.method, "PUT");
  assertEquals(calls[0].init.body, JSON.stringify({ status: "resolved" }));
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("Authorization"), `Bearer ${SENTRY_TOKEN}`);
  assertEquals(headers.get("Content-Type"), "application/json");
});

Deno.test("already-resolved mocked 200 is idempotent success", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "12345" }, `Bearer ${SERVICE_ROLE_KEY}`),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 200);
  assertEquals(calls.length, 1);
});

Deno.test("mocked Sentry 403 surfaces a generic error and does not leak tokens", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "12345" }, `Bearer ${SERVICE_ROLE_KEY}`),
    { env: env(), fetch: mockFetch(403, calls) },
  );
  const body = await response.text();
  assertEquals(response.status, 502);
  assertEquals(calls.length, 1);
  assert(!body.includes(SENTRY_TOKEN));
  assert(!body.includes(SERVICE_ROLE_KEY));
});

Deno.test("missing Sentry config fails closed without echoing values", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "12345" }, `Bearer ${SERVICE_ROLE_KEY}`),
    {
      env: env({ SENTRY_AUTH_TOKEN: undefined }),
      fetch: mockFetch(200, calls),
    },
  );
  const body = await response.text();
  assertEquals(response.status, 503);
  assertEquals(body, JSON.stringify({ error: "resolve not configured" }));
  assertEquals(calls.length, 0);
  assert(!body.includes(SENTRY_TOKEN));
  assert(!body.includes(SERVICE_ROLE_KEY));
});

Deno.test("invalid issue_id returns 400 and does not call mocked Sentry", async () => {
  const calls: CapturedFetch[] = [];
  const response = await handleSentryResolveRequest(
    request({ issue_id: "123/../../users" }, `Bearer ${SERVICE_ROLE_KEY}`),
    { env: env(), fetch: mockFetch(200, calls) },
  );
  assertEquals(response.status, 400);
  assertEquals(calls.length, 0);
});
