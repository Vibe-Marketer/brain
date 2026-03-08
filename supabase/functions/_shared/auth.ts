import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Authenticate a request by verifying the JWT from the Authorization header.
 * Returns the authenticated user's ID, or a 401 Response if auth fails.
 *
 * Handles case-insensitive "Bearer" scheme and trims whitespace.
 */
export async function authenticateRequest(
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'No authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Case-insensitive Bearer scheme check
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return new Response(
      JSON.stringify({ error: 'Invalid authorization header format' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = match[1].trim();
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: user.id };
}
