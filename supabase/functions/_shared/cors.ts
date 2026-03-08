// Default allowed origins — used when ALLOWED_ORIGINS env var is not set.
// Includes production domains and common local dev ports.
const DEFAULT_ORIGINS = [
  'https://callvault.vercel.app',
  'https://app.callvaultai.com',
  'http://localhost:8080',
  'http://localhost:5173',
];

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || DEFAULT_ORIGINS;

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Default to first allowed origin (never wildcard)
  let origin = allowedOrigins[0];

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    // Echo back the request origin if it's in our allow list
    origin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
