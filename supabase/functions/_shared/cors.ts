// Allow all origins in development, restrict in production
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  let origin = '*';

  // If a specific origin is provided, we should ideally echo it 
  // especially for authenticated requests to avoid browser "wildcard combined with credentials" issues
  if (requestOrigin) {
    if (allowedOrigins[0] === '*' || allowedOrigins.includes(requestOrigin)) {
      origin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
