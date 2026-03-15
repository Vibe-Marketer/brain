// Default allowed origins — used when ALLOWED_ORIGINS env var is not set.
// Includes production domains and common local dev ports.
const DEFAULT_ORIGINS = [
  'https://callvault.vercel.app',
  'https://app.callvaultai.com',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:5173',
];

const rawOrigins = Deno.env.get('ALLOWED_ORIGINS')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = rawOrigins && rawOrigins.length > 0 ? rawOrigins : DEFAULT_ORIGINS;

// Static default headers for imports that don't have access to the request origin.
// Prefer getCorsHeaders(requestOrigin) in handlers where the request is available.
export const corsHeaders = getCorsHeaders();

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
    'Vary': 'Origin',
  };
}
