import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate via shared helper (consistent Bearer token extraction)
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const { code, state } = await req.json();

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing code or state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify state and get pending source ID
    const { data: settings } = await supabase
      .from('user_settings')
      .select('oauth_state, pending_import_source_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!settings || settings.oauth_state !== state) {
      return new Response(
        JSON.stringify({ error: 'Invalid state parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let pendingSourceId = settings.pending_import_source_id;
    if (!pendingSourceId) {
      return new Response(
        JSON.stringify({ error: 'No pending import source found. Please try connecting again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get production OAuth credentials
    const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.callvaultai.com';
    const redirectUri = `${siteUrl}/oauth/callback/`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fathom OAuth callback - Production mode');
    console.log('Redirect URI:', redirectUri);
    console.log('Pending source ID:', pendingSourceId);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry (usually 1 hour from now)
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Store tokens ENCRYPTED at rest via pgcrypto pgp_sym_encrypt.
    // The encryption key comes from a server-side secret (OAUTH_ENCRYPTION_KEY).
    // If the key is not set, fall back to plaintext storage with a warning
    // (allows deployment before the secret is configured).
    const encryptionKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');

    if (encryptionKey) {
      // Encrypted path: use RPC that wraps pgp_sym_encrypt
      const { error: encSourceError } = await supabase.rpc('store_encrypted_oauth_tokens', {
        p_source_id: pendingSourceId,
        p_user_id: userId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_token_expires: expiresAt,
        p_encryption_key: encryptionKey,
        p_is_active: true,
      });

      if (encSourceError) {
        console.error('Error storing encrypted tokens in import_sources:', encSourceError);
        throw encSourceError;
      }

      // Also store encrypted tokens in user_settings for backward compatibility
      const { error: encSettingsError } = await supabase.rpc('store_encrypted_user_settings_tokens', {
        p_user_id: userId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_token_expires: expiresAt,
        p_encryption_key: encryptionKey,
      });

      if (encSettingsError) {
        console.warn('Error storing encrypted tokens in user_settings (non-blocking):', encSettingsError);
      }
    } else {
      // Fallback: plaintext storage when OAUTH_ENCRYPTION_KEY is not yet configured
      console.warn('OAUTH_ENCRYPTION_KEY not set — storing OAuth tokens in PLAINTEXT. Set the secret to enable encryption.');

      const { error: sourceUpdateError } = await supabase
        .from('import_sources')
        .update({
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingSourceId)
        .eq('user_id', userId);

      if (sourceUpdateError) {
        console.error('Error storing tokens in import_sources:', sourceUpdateError);
        throw sourceUpdateError;
      }

      await supabase
        .from('user_settings')
        .update({
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires: expiresAt,
          oauth_state: null,
          pending_import_source_id: null,
        })
        .eq('user_id', userId);
    }

    console.log('OAuth tokens stored successfully for user:', userId, 'source:', pendingSourceId);

    // Best-effort: detect the Fathom account email by fetching one meeting
    let detectedEmail: string | null = null;
    try {
      const meResponse = await fetch('https://api.fathom.ai/external/v1/meetings?limit=1', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        const firstMeeting = meData.items?.[0];
        if (firstMeeting?.recorded_by?.email) {
          detectedEmail = firstMeeting.recorded_by.email;
          console.log('Detected Fathom account email:', detectedEmail);

          // Check if this exact Fathom account is already connected (dedup)
          const { data: existingSource } = await supabase
            .from('import_sources')
            .select('id')
            .eq('user_id', userId)
            .eq('source_app', 'fathom')
            .eq('account_email', detectedEmail)
            .neq('id', pendingSourceId)
            .limit(1)
            .maybeSingle();

          if (existingSource) {
            // Same account already connected — update existing row with fresh tokens, delete the new duplicate
            console.log('Duplicate Fathom account detected, merging into existing source:', existingSource.id);

            if (encryptionKey) {
              await supabase.rpc('store_encrypted_oauth_tokens', {
                p_source_id: existingSource.id,
                p_user_id: userId,
                p_access_token: tokens.access_token,
                p_refresh_token: tokens.refresh_token,
                p_token_expires: expiresAt,
                p_encryption_key: encryptionKey,
                p_is_active: true,
              });
            } else {
              await supabase
                .from('import_sources')
                .update({
                  oauth_access_token: tokens.access_token,
                  oauth_refresh_token: tokens.refresh_token,
                  oauth_token_expires: expiresAt,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingSource.id)
                .eq('user_id', userId);
            }

            // Delete the duplicate row we just created
            await supabase
              .from('import_sources')
              .delete()
              .eq('id', pendingSourceId)
              .eq('user_id', userId);

            // Use existing source ID going forward
            pendingSourceId = existingSource.id;
          } else {
            // No duplicate — update account_email on the new row
            await supabase
              .from('import_sources')
              .update({ account_email: detectedEmail })
              .eq('id', pendingSourceId)
              .eq('user_id', userId);
          }
        }
      }
    } catch (emailErr) {
      // Non-blocking — account email detection is best-effort
      console.warn('Could not detect Fathom account email:', emailErr);
    }

    // Auto-set host_email if not already set (for transcript speaker identification)
    if (detectedEmail) {
      try {
        const { data: currentSettings } = await supabase
          .from('user_settings')
          .select('host_email')
          .eq('user_id', userId)
          .maybeSingle();

        if (!currentSettings?.host_email) {
          await supabase
            .from('user_settings')
            .update({ host_email: detectedEmail })
            .eq('user_id', userId);
          console.log('Auto-set host_email to:', detectedEmail);
        }
      } catch (hostErr) {
        console.warn('Could not auto-set host_email:', hostErr);
      }
    }

    // Phase 39: kick off background backfill + webhook registration.
    // These are fire-and-forget — caller gets immediate success response.
    const authHeaderForward = req.headers.get('Authorization') || '';

    const backfillTask = supabase.functions.invoke('fathom-reconcile', {
      body: {
        mode: 'backfill',
        sourceId: pendingSourceId,
      },
      headers: {
        Authorization: authHeaderForward,
        'Content-Type': 'application/json',
      },
    }).then((r) => {
      if (r.error) console.error('[oauth-callback] backfill invoke error:', r.error);
      else console.log('[oauth-callback] backfill triggered for source:', pendingSourceId);
    }).catch((err) => {
      console.error('[oauth-callback] backfill invoke threw:', err);
    });

    const webhookTask = supabase.functions.invoke('create-fathom-webhook', {
      headers: {
        Authorization: authHeaderForward,
        'Content-Type': 'application/json',
      },
    }).then((r) => {
      if (r.error) {
        const errMsg = typeof r.error === 'object' && r.error && 'message' in r.error
          ? (r.error as { message: string }).message
          : String(r.error);
        if (errMsg.includes('already exists') || errMsg.includes('409')) {
          console.log('[oauth-callback] webhook already exists for user — skipping');
        } else {
          console.error('[oauth-callback] webhook create invoke error:', r.error);
        }
      } else {
        console.log('[oauth-callback] webhook auto-registered for user:', userId);
      }
    }).catch((err) => {
      console.error('[oauth-callback] webhook invoke threw:', err);
    });

    // @ts-expect-error EdgeRuntime is a Supabase-injected global
    EdgeRuntime.waitUntil(Promise.allSettled([backfillTask, webhookTask]));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully connected to Fathom. Your call history is syncing in the background.',
        sourceId: pendingSourceId,
        accountEmail: detectedEmail,
        backfillTriggered: true,
        webhookRegistration: 'triggered',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
