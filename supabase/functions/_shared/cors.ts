// Allow all origins in development, restrict in production
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  let origin = '*';

  if (allowedOrigins[0] !== '*' && requestOrigin) {
    // Check if request origin is in allowed list
    if (allowedOrigins.includes(requestOrigin)) {
      origin = requestOrigin;
    } else {
      origin = allowedOrigins[0]; // Fallback to first allowed origin
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Backwards compatible export for existing code
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
