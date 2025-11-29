import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FathomClient } from '../_shared/fathom-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  message: string;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics: DiagnosticResult[] = [];
  let authHeaders: Record<string, string> | null = null;
  let authMethod = '';

  try {
    // Parse request body to check for force_refresh
    let forceRefresh = false;
    try {
      const body = await req.json();
      forceRefresh = !!body.force_refresh;
    } catch {
      // Body might be empty, that's fine
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // TEST 1: Check user settings exist
    // ============================================
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires, oauth_refresh_token, webhook_secret, host_email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) {
      diagnostics.push({
        name: 'User Settings',
        status: 'fail',
        message: 'Failed to load user settings',
        details: { error: configError.message }
      });
    } else if (!settings) {
      diagnostics.push({
        name: 'User Settings',
        status: 'fail',
        message: 'No user settings found. Please configure Fathom in Settings.',
      });
    } else {
      diagnostics.push({
        name: 'User Settings',
        status: 'pass',
        message: 'User settings loaded successfully',
        details: {
          hasApiKey: !!settings.fathom_api_key,
          hasOAuthToken: !!settings.oauth_access_token,
          hasRefreshToken: !!settings.oauth_refresh_token,
          hasWebhookSecret: !!settings.webhook_secret,
          hasHostEmail: !!settings.host_email,
        }
      });
    }

    // ============================================
    // TEST 2: Check OAuth token status
    // ============================================
    if (settings?.oauth_access_token) {
      const now = Date.now();
      const expiresAt = settings.oauth_token_expires;
      const isExpired = !expiresAt || expiresAt < now;
      const expiresIn = expiresAt ? Math.round((expiresAt - now) / 1000 / 60) : 0;

      if (isExpired || forceRefresh) {
        const reason = isExpired ? 'OAuth token is expired' : 'Force refresh requested';
        
        diagnostics.push({
          name: 'OAuth Token Status',
          status: isExpired ? 'warning' : 'pass',
          message: reason,
          details: {
            expiredAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
            hasRefreshToken: !!settings.oauth_refresh_token,
            forceRefresh
          }
        });

        // Try to refresh if we have a refresh token
        if (settings.oauth_refresh_token) {
          try {
            const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
            const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');

            if (clientId && clientSecret) {
              // Note: We don't use FathomClient for token endpoint as it might handle 429s differently 
              // or we want raw control, but we could. For now, sticking to fetch for the auth endpoint
              // is safer to avoid circular dependencies or unexpected retry behavior on auth failure.
              const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  grant_type: 'refresh_token',
                  refresh_token: settings.oauth_refresh_token,
                  client_id: clientId,
                  client_secret: clientSecret,
                }),
              });

              if (tokenResponse.ok) {
                const tokens = await tokenResponse.json();
                const newExpiresAt = Date.now() + (tokens.expires_in * 1000);

                await supabase
                  .from('user_settings')
                  .update({
                    oauth_access_token: tokens.access_token,
                    oauth_refresh_token: tokens.refresh_token,
                    oauth_token_expires: newExpiresAt,
                  })
                  .eq('user_id', user.id);

                diagnostics.push({
                  name: 'OAuth Token Refresh',
                  status: 'pass',
                  message: 'Successfully refreshed OAuth token',
                  details: { expiresIn: Math.round(tokens.expires_in / 60) + ' minutes' }
                });

                // Use the new token for subsequent tests
                authHeaders = {
                  'Authorization': `Bearer ${tokens.access_token}`,
                  'Content-Type': 'application/json',
                };
                authMethod = 'OAuth (refreshed)';
              } else {
                const errorText = await tokenResponse.text();
                diagnostics.push({
                  name: 'OAuth Token Refresh',
                  status: 'fail',
                  message: 'Failed to refresh OAuth token',
                  details: { status: tokenResponse.status, error: errorText }
                });
              }
            }
          } catch (refreshError) {
            diagnostics.push({
              name: 'OAuth Token Refresh',
              status: 'fail',
              message: 'Error during token refresh',
              details: { error: refreshError instanceof Error ? refreshError.message : 'Unknown error' }
            });
          }
        }
      } else {
        diagnostics.push({
          name: 'OAuth Token Status',
          status: 'pass',
          message: `OAuth token is valid (expires in ${expiresIn} minutes)`,
          details: { expiresAt: new Date(expiresAt).toISOString() }
        });
        authHeaders = {
          'Authorization': `Bearer ${settings.oauth_access_token}`,
          'Content-Type': 'application/json',
        };
        authMethod = 'OAuth';
      }
    } else if (settings?.fathom_api_key) {
      diagnostics.push({
        name: 'OAuth Token Status',
        status: 'skipped',
        message: 'No OAuth token configured, using API key',
      });
      authHeaders = {
        'X-Api-Key': settings.fathom_api_key,
        'Content-Type': 'application/json',
      };
      authMethod = 'API Key';
    } else {
      diagnostics.push({
        name: 'Authentication',
        status: 'fail',
        message: 'No Fathom credentials configured',
      });
    }

    // ============================================
    // TEST 3: Test Fathom API - List Meetings
    // ============================================
    if (authHeaders) {
      try {
        // Use FathomClient to test the robust fetch path
        const meetingsResponse = await FathomClient.fetchWithRetry(
          'https://api.fathom.ai/external/v1/meetings?limit=1',
          { 
            headers: authHeaders,
            maxRetries: 3 // Use fewer retries for the test to be snappier
          }
        );

        if (meetingsResponse.ok) {
          const meetingsData = await meetingsResponse.json();
          diagnostics.push({
            name: 'Fathom API - List Meetings',
            status: 'pass',
            message: 'Successfully connected to Fathom API',
            details: {
              hasMoreMeetings: !!meetingsData.next_cursor,
              sampleMeetingCount: meetingsData.items?.length || 0,
              usedClient: 'FathomClient'
            }
          });
        } else {
          const errorText = await meetingsResponse.text();
          diagnostics.push({
            name: 'Fathom API - List Meetings',
            status: 'fail',
            message: `API returned ${meetingsResponse.status}`,
            details: { error: errorText }
          });
        }
      } catch (apiError) {
        diagnostics.push({
          name: 'Fathom API - List Meetings',
          status: 'fail',
          message: 'Failed to connect to Fathom API',
          details: { error: apiError instanceof Error ? apiError.message : 'Unknown error' }
        });
      }

      // ============================================
      // TEST 4: Test Fathom API - Get Transcript (if we have a meeting)
      // ============================================
      try {
        // Get a recent synced call to test transcript retrieval
        const { data: recentCall } = await supabase
          .from('fathom_calls')
          .select('recording_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentCall?.recording_id) {
          const transcriptResponse = await FathomClient.fetchWithRetry(
            `https://api.fathom.ai/external/v1/recordings/${recentCall.recording_id}/transcript`,
            { 
              headers: authHeaders,
              maxRetries: 3
            }
          );

          if (transcriptResponse.ok) {
            diagnostics.push({
              name: 'Fathom API - Get Transcript',
              status: 'pass',
              message: 'Successfully retrieved transcript',
              details: { testedRecordingId: recentCall.recording_id }
            });
          } else {
            diagnostics.push({
              name: 'Fathom API - Get Transcript',
              status: 'warning',
              message: `Transcript retrieval returned ${transcriptResponse.status}`,
              details: { testedRecordingId: recentCall.recording_id }
            });
          }
        } else {
          diagnostics.push({
            name: 'Fathom API - Get Transcript',
            status: 'skipped',
            message: 'No synced meetings to test transcript retrieval',
          });
        }
      } catch (transcriptError) {
        diagnostics.push({
          name: 'Fathom API - Get Transcript',
          status: 'fail',
          message: 'Error testing transcript retrieval',
          details: { error: transcriptError instanceof Error ? transcriptError.message : 'Unknown error' }
        });
      }
    }

    // ============================================
    // TEST 5: Check Webhook Configuration
    // ============================================
    if (settings?.webhook_secret) {
      diagnostics.push({
        name: 'Webhook Configuration',
        status: 'pass',
        message: 'Webhook secret is configured',
        details: {
          secretPrefix: settings.webhook_secret.substring(0, 10) + '...',
          hostEmail: settings.host_email || 'not configured',
        }
      });
    } else {
      diagnostics.push({
        name: 'Webhook Configuration',
        status: 'warning',
        message: 'No webhook secret configured. Webhooks will not be validated.',
      });
    }

    // ============================================
    // TEST 6: Check recent sync jobs
    // ============================================
    const { data: recentJobs } = await supabase
      .from('sync_jobs')
      .select('id, status, progress_current, progress_total, synced_ids, failed_ids, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentJobs && recentJobs.length > 0) {
      const lastJob = recentJobs[0];
      const failedCount = lastJob.failed_ids?.length || 0;
      const syncedCount = lastJob.synced_ids?.length || 0;

      diagnostics.push({
        name: 'Recent Sync Jobs',
        status: failedCount > 0 ? 'warning' : 'pass',
        message: `Last sync: ${lastJob.status} (${syncedCount} synced, ${failedCount} failed)`,
        details: {
          lastJobId: lastJob.id,
          lastJobStatus: lastJob.status,
          lastJobDate: lastJob.created_at,
          totalJobs: recentJobs.length,
        }
      });
    } else {
      diagnostics.push({
        name: 'Recent Sync Jobs',
        status: 'skipped',
        message: 'No sync jobs found',
      });
    }

    // ============================================
    // TEST 7: Check webhook deliveries
    // ============================================
    const { data: recentDeliveries, count: deliveryCount } = await supabase
      .from('webhook_deliveries')
      .select('id, status, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (deliveryCount && deliveryCount > 0) {
      const successCount = recentDeliveries?.filter(d => d.status === 'success').length || 0;
      const failCount = recentDeliveries?.filter(d => d.status === 'failed').length || 0;

      diagnostics.push({
        name: 'Webhook Deliveries',
        status: failCount > successCount ? 'warning' : 'pass',
        message: `Found ${deliveryCount} webhook deliveries (${successCount} success, ${failCount} failed in recent)`,
        details: {
          totalDeliveries: deliveryCount,
          recentSuccess: successCount,
          recentFailed: failCount,
        }
      });
    } else {
      diagnostics.push({
        name: 'Webhook Deliveries',
        status: 'warning',
        message: 'No webhook deliveries recorded. Webhooks may not be configured in Fathom.',
      });
    }

    // ============================================
    // Summary
    // ============================================
    const passCount = diagnostics.filter(d => d.status === 'pass').length;
    const failCount = diagnostics.filter(d => d.status === 'fail').length;
    const warningCount = diagnostics.filter(d => d.status === 'warning').length;

    const overallStatus = failCount > 0 ? 'fail' : warningCount > 0 ? 'warning' : 'pass';

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        status: overallStatus,
        summary: {
          pass: passCount,
          fail: failCount,
          warning: warningCount,
          total: diagnostics.length,
        },
        authMethod,
        diagnostics,
        timestamp: new Date().toISOString(),
      }),
      {
        status: failCount > 0 ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in Fathom diagnostics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    diagnostics.push({
      name: 'System Error',
      status: 'fail',
      message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success: false,
        status: 'fail',
        error: errorMessage,
        diagnostics,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
