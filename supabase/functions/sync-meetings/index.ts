import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FathomClient } from "../_shared/fathom-client.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runPipeline } from "../_shared/connector-pipeline.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getDecryptedOAuthTokens } from "../_shared/oauth-encrypt.ts";
import { getDecryptedUserSettingsFathomTokens } from "../_shared/user-settings-encrypt.ts";
import {
  getRequestedWorkspaceId,
  markConnectorPartialSync,
  markConnectorReconnectRequired,
  resolveConnectorWorkspaceBinding,
  validateRequestedWorkspaceId,
} from "../_shared/connector-function-utils.ts";

// Rate limiter for API calls - conservative to avoid 429 errors
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 30; // Reduced from 55 to be more conservative
  private readonly windowMs = 60000;

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    if (elapsed >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - elapsed;
      console.log(`Rate limit prevention: waiting ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }
}

interface TranscriptSegment {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email?: string;
  };
  text: string;
  timestamp: string;
}

/**
 * Syncs a single Fathom meeting to the recordings table via shared connector pipeline.
 *
 * Returns:
 *   'synced'   — new recording created
 *   'skipped'  — already exists (duplicate)
 *   'failed'   — error during sync
 */
async function syncMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meeting: any,
  workspaceId?: string | null,
  fallbackWorkspaceId?: string | null,
): Promise<"synced" | "skipped" | "failed"> {
  try {
    console.log(`Syncing meeting ${recordingId}: ${meeting.title}`);

    // Build external ID
    const externalId = String(recordingId);

    // Build full transcript text with consolidated speaker turns
    const transcript = meeting.transcript || [];
    const consolidatedSegments: string[] = [];
    let currentSpeaker: string | null = null;
    let currentTimestamp: string | null = null;
    let currentTexts: string[] = [];

    transcript.forEach((seg: TranscriptSegment, index: number) => {
      const speakerName = seg.speaker?.display_name || "Unknown";

      if (speakerName !== currentSpeaker) {
        // Speaker changed - save previous speaker's consolidated text
        if (currentSpeaker !== null && currentTexts.length > 0) {
          consolidatedSegments.push(
            `[${currentTimestamp || "00:00:00"}] ${currentSpeaker}: ${currentTexts.join(" ")}`,
          );
        }

        // Start new speaker turn
        currentSpeaker = speakerName;
        currentTimestamp = seg.timestamp || "00:00:00";
        currentTexts = [seg.text];
      } else {
        // Same speaker - append text
        currentTexts.push(seg.text);
      }

      // Handle last segment
      if (index === transcript.length - 1 && currentTexts.length > 0) {
        consolidatedSegments.push(
          `[${currentTimestamp || "00:00:00"}] ${currentSpeaker}: ${currentTexts.join(" ")}`,
        );
      }
    });

    const fullTranscript = consolidatedSegments.join("\n\n");

    // Extract summary
    const summaryText = meeting.default_summary?.markdown_formatted || null;

    // Calculate duration from start/end times
    const startTime = new Date(meeting.recording_start_time);
    const endTime = meeting.recording_end_time
      ? new Date(meeting.recording_end_time)
      : null;
    const durationSeconds = endTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : undefined;

    // Extract participant emails from calendar_invitees
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participantEmails = (meeting.calendar_invitees || [])
      .map((inv: any) => inv.email)
      .filter(Boolean);

    // Build source_metadata
    const sourceMetadata = {
      fathom_call_id: recordingId,
      fathom_url: meeting.url || null,
      fathom_share_url: meeting.share_url || null,
      recorded_by_name: meeting.recorded_by?.name || null,
      recorded_by_email: meeting.recorded_by?.email || null,
      calendar_invitees: meeting.calendar_invitees || [],
      participant_emails: participantEmails,
      summary: summaryText,
      import_source: "sync-meetings",
      synced_at: new Date().toISOString(),
    };

    // Stage 5 — Run through pipeline (Dedup -> Routing -> Insert)
    const result = await runPipeline(supabase, userId, {
      external_id: externalId,
      source_app: "fathom",
      title: meeting.title,
      full_transcript: fullTranscript,
      summary: summaryText,
      recording_start_time: meeting.recording_start_time,
      duration: durationSeconds,
      source_metadata: sourceMetadata,
      // Pass explicit destination workspace so insertRecording() places the recording
      // in the correct workspace and removes the auto-created HOME entry.
      // Connector binding is a fallback after routing rules, not an override.
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      ...(fallbackWorkspaceId ? { fallback_workspace_id: fallbackWorkspaceId } : {}),
    });

    if (!result.success) {
      if (result.skipped) {
        console.log(
          `Fathom meeting ${recordingId} already exists (pipeline skipped)`,
        );
        return "skipped";
      }
      throw new Error(result.error || "Pipeline failed");
    }

    console.log(
      `Successfully synced Fathom meeting ${recordingId} as recording ${result.recordingId}`,
    );

    // Write to fathom_raw_calls for source-specific detail
    try {
      const { error: rawError } = await supabase
        .from("fathom_raw_calls")
        .upsert(
          {
            recording_id: recordingId,
            user_id: userId,
            canonical_recording_id: result.recordingId,
            title: meeting.title,
            created_at: meeting.created_at,
            recording_start_time: meeting.recording_start_time,
            recording_end_time: meeting.recording_end_time || null,
            url: meeting.url || null,
            share_url: meeting.share_url || null,
            full_transcript: fullTranscript,
            summary: summaryText,
            recorded_by_name: meeting.recorded_by?.name || null,
            recorded_by_email: meeting.recorded_by?.email || null,
            calendar_invitees: meeting.calendar_invitees || null,
            synced_at: new Date().toISOString(),
          },
          {
            onConflict: "recording_id,user_id",
          },
        );

      if (rawError) {
        console.error(
          `Error inserting fathom_raw_calls for ${recordingId} (non-blocking):`,
          rawError,
        );
      }
    } catch (rawErr) {
      console.error(
        `Error writing fathom_raw_calls for ${recordingId} (non-blocking):`,
        rawErr,
      );
    }

    // Insert transcript segments into fathom_raw_transcripts for backward compat
    if (meeting.transcript && meeting.transcript.length > 0) {
      const transcriptRows = meeting.transcript.map(
        (segment: TranscriptSegment) => {
          let speakerEmail = segment.speaker.matched_calendar_invitee_email;

          if (!speakerEmail && meeting.calendar_invitees) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchedInvitee = meeting.calendar_invitees.find(
              (inv: any) =>
                inv.matched_speaker_display_name ===
                  segment.speaker.display_name ||
                inv.name === segment.speaker.display_name,
            );
            if (matchedInvitee) {
              speakerEmail = matchedInvitee.email;
            }
          }

          return {
            recording_id: meeting.recording_id,
            user_id: userId,
            speaker_name: segment.speaker.display_name,
            speaker_email: speakerEmail,
            text: segment.text,
            timestamp: segment.timestamp,
          };
        },
      );

      const { error: transcriptError } = await supabase
        .from("fathom_raw_transcripts")
        .insert(transcriptRows);

      if (transcriptError) {
        // Non-blocking — transcript table is supplementary; recording already committed
        console.error(
          `Error inserting transcripts for ${recordingId} (non-blocking):`,
          transcriptError,
        );
      } else {
        console.log(
          `Synced ${transcriptRows.length} transcript segments for meeting ${recordingId}`,
        );
      }
    }

    return "synced";
  } catch (error) {
    console.error(`Failed to sync meeting ${recordingId}:`, error);
    return "failed";
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // service-role required: cross-import fan-out — pulls from Fathom API + writes fathom_raw_calls + invokes generate-ai-titles + auto-tag-calls downstream.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body FIRST
    const {
      recordingIds = [],
      singleCallId,
      createdAfter,
      createdBefore,
      workspace_id,
      workspaceId,
      sourceId,
    } = await req.json();

    // Support single recording retry
    const targetRecordingIds = singleCallId ? [singleCallId] : recordingIds;

    if (!Array.isArray(targetRecordingIds) || targetRecordingIds.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "recordingIds must be an array or singleCallId must be provided",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get authenticated user from JWT
    // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // We still need the raw JWT for forwarding to downstream edge functions
    // (generate-ai-titles, auto-tag-calls) so they authenticate as the same user.
    const jwt = (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    // ── Resolve Fathom credentials ──────────────────────────────────────────
    // Priority: import_sources (per-account) → user_settings (legacy fallback)
    let creds: {
      oauth_access_token: string | null;
      oauth_refresh_token: string | null;
      oauth_token_expires: number | null;
      fathom_api_key: string | null;
    } | null = null;
    let credSourceId: string | null = sourceId ?? null;
    const credSourceTable: "import_sources" | "user_settings" = sourceId
      ? "import_sources"
      : "import_sources";

    // Phase 28-03 fix (#294): route OAuth token reads through the canonical
    // helper. Direct selects on oauth_access_token were returning PGP-armored
    // ciphertext for encrypted rows and getting 401 from Fathom.
    const loadCredsFromSource = async (rowId: string) => {
      const decrypted = await getDecryptedOAuthTokens(supabase as any, rowId, userId);
      const { data: apiKeyRow } = await supabase
        .from("import_sources")
        .select("fathom_api_key")
        .eq("id", rowId)
        .eq("user_id", userId)
        .maybeSingle();
      return {
        oauth_access_token: decrypted.access_token,
        oauth_refresh_token: decrypted.refresh_token,
        oauth_token_expires: decrypted.token_expires,
        fathom_api_key: apiKeyRow?.fathom_api_key ?? null,
      };
    };

    if (sourceId) {
      creds = await loadCredsFromSource(sourceId);
    }

    // If no sourceId or source row has no tokens, try first active fathom source
    if (!creds?.oauth_access_token && !creds?.fathom_api_key) {
      const { data: firstSource } = await supabase
        .from("import_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("source_app", "fathom")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (firstSource?.id) {
        const fallback = await loadCredsFromSource(firstSource.id);
        if (fallback.oauth_access_token || fallback.fathom_api_key) {
          creds = fallback;
          credSourceId = firstSource.id;
        }
      }
    }

    // Final fallback: user_settings (legacy)
    if (!creds?.oauth_access_token && !creds?.fathom_api_key) {
      const { data: settings, error: configError } = await supabase
        .from("user_settings")
        .select("fathom_api_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (configError) throw configError;

      const decrypted = await getDecryptedUserSettingsFathomTokens(
        supabase,
        userId,
      );
      creds = {
        oauth_access_token: decrypted.access_token,
        oauth_refresh_token: decrypted.refresh_token,
        oauth_token_expires: decrypted.token_expires,
        fathom_api_key: settings?.fathom_api_key ?? null,
      };
    }

    if (!creds?.fathom_api_key && !creds?.oauth_access_token) {
      throw new Error(
        "Fathom credentials not configured. Please add them in Settings.",
      );
    }

    // Determine authentication method - prefer OAuth if available and valid
    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Check if OAuth token is available and not expired
    const oauthTokenExpires = creds.oauth_token_expires
      ? new Date(creds.oauth_token_expires)
      : null;
    const isOAuthValid =
      creds.oauth_access_token &&
      oauthTokenExpires &&
      oauthTokenExpires > new Date();

    if (isOAuthValid) {
      authHeaders["Authorization"] = `Bearer ${creds.oauth_access_token}`;
      console.log("Using OAuth Bearer token authentication for sync-meetings");
    } else if (creds.oauth_access_token && creds.oauth_refresh_token) {
      // OAuth token expired but we have a refresh token - try to refresh
      console.log("OAuth token expired, attempting refresh...");
      try {
        const clientId = Deno.env.get("FATHOM_OAUTH_CLIENT_ID");
        const clientSecret = Deno.env.get("FATHOM_OAUTH_CLIENT_SECRET");

        if (!clientId || !clientSecret) {
          throw new Error("OAuth not configured on server");
        }

        const tokenResponse = await fetch(
          "https://fathom.video/external/v1/oauth2/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: creds.oauth_refresh_token,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          },
        );

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(
            "Token refresh failed:",
            tokenResponse.status,
            errorText,
          );

          if (tokenResponse.status >= 400 && tokenResponse.status < 500) {
            // Clear invalid tokens from whichever table they came from
            if (credSourceId) {
              await supabase
                .from("import_sources")
                .update({
                  oauth_access_token: null,
                  oauth_refresh_token: null,
                  oauth_token_expires: null,
                })
                .eq("id", credSourceId);
              await markConnectorReconnectRequired({
                supabase,
                sourceId: credSourceId,
                userId,
                errorMessage:
                  "Failed to refresh access token. Please reconnect Fathom in Settings.",
              });
            }
            await supabase
              .from("user_settings")
              .update({
                oauth_access_token: null,
                oauth_refresh_token: null,
                oauth_token_expires: null,
              })
              .eq("user_id", userId);
          }

          throw new Error(
            "Failed to refresh access token. Please reconnect Fathom in Settings.",
          );
        }

        const tokens = await tokenResponse.json();
        const expiresAt = Date.now() + tokens.expires_in * 1000;

        // Store new tokens in import_sources if we have a source ID
        if (credSourceId) {
          await supabase
            .from("import_sources")
            .update({
              oauth_access_token: tokens.access_token,
              oauth_refresh_token: tokens.refresh_token,
              oauth_token_expires: expiresAt,
            })
            .eq("id", credSourceId);
        }

        // Also update user_settings for backward compat
        await supabase
          .from("user_settings")
          .update({
            oauth_access_token: tokens.access_token,
            oauth_refresh_token: tokens.refresh_token,
            oauth_token_expires: expiresAt,
          })
          .eq("user_id", userId);

        authHeaders["Authorization"] = `Bearer ${tokens.access_token}`;
        console.log("OAuth token refreshed successfully for sync-meetings");
      } catch (refreshError) {
        console.error("Error refreshing OAuth token:", refreshError);
        if (creds.fathom_api_key) {
          authHeaders["X-Api-Key"] = creds.fathom_api_key;
          console.log(
            "OAuth refresh failed, falling back to API key authentication",
          );
        } else {
          throw new Error(
            "OAuth token expired and refresh failed. Please reconnect Fathom in Settings.",
          );
        }
      }
    } else if (creds.fathom_api_key) {
      authHeaders["X-Api-Key"] = creds.fathom_api_key;
      console.log("Using API key authentication for sync-meetings");
    } else {
      throw new Error(
        "Fathom OAuth token has expired. Please reconnect your Fathom account in Settings.",
      );
    }

    const requestedWorkspaceId = getRequestedWorkspaceId({ workspace_id, workspaceId });
    const validatedWorkspaceId = await validateRequestedWorkspaceId(
      supabase,
      userId,
      requestedWorkspaceId,
      corsHeaders,
    );
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;
    const validatedVaultId: string | null = validatedWorkspaceId;
    let fallbackVaultId: string | null = null;
    if (credSourceId) {
      const binding = await resolveConnectorWorkspaceBinding({
        supabase,
        userId,
        sourceId: credSourceId,
        sourceApp: "fathom",
      });
      fallbackVaultId = binding.workspaceId;
    }

    console.log(`Syncing ${recordingIds.length} meetings with date range:`, {
      createdAfter,
      createdBefore,
    });

    // Create a sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from("sync_jobs")
      .insert({
        user_id: userId,
        recording_ids: targetRecordingIds,
        status: "processing",
        progress_current: 0,
        progress_total: targetRecordingIds.length,
        type: "fathom", // Explicitly set the source type
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    console.log(
      `Created sync job ${jobId} for ${recordingIds.length} meetings`,
    );

    // Helper function to fetch meeting metadata from paginated list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMeetingMetadata = async (
      targetRecordingId: number,
    ): Promise<any | null> => {
      let cursor: string | undefined = undefined;
      const maxPages = 100; // Increase max pages for old meetings

      for (let pageCount = 0; pageCount < maxPages; pageCount++) {
        const url = new URL("https://api.fathom.ai/external/v1/meetings");

        // Add date filters if provided
        if (createdAfter) {
          url.searchParams.append("created_after", createdAfter);
        }
        if (createdBefore) {
          url.searchParams.append("created_before", createdBefore);
        }

        if (cursor) {
          url.searchParams.append("cursor", cursor);
        }

        const response = await FathomClient.fetchWithRetry(url.toString(), {
          headers: authHeaders,
          maxRetries: 3,
        });

        if (!response || !response.ok) {
          console.error(`Failed to fetch meetings page ${pageCount + 1}`);
          break;
        }

        const data = await response.json();
        const found = data.items?.find(
          (m: { recording_id: number }) =>
            m.recording_id === Number(targetRecordingId),
        );

        if (found) {
          return found;
        }

        cursor = data.next_cursor;
        if (!cursor) break;

        // Small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return null;
    };

    // Helper function to fetch transcript and summary separately (like fetch-single-meeting)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMeetingData = async (
      recordingId: number,
    ): Promise<any | null> => {
      try {
        // Fetch summary and transcript separately by recording_id
        const [summaryResponse, transcriptResponse] = await Promise.all([
          FathomClient.fetchWithRetry(
            `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
            { headers: authHeaders, maxRetries: 3 },
          ),
          FathomClient.fetchWithRetry(
            `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
            { headers: authHeaders, maxRetries: 3 },
          ),
        ]);

        if (!summaryResponse.ok && summaryResponse.status !== 404) {
          console.error(
            `Failed to fetch summary for ${recordingId}: ${summaryResponse.status}`,
          );
        }
        if (!transcriptResponse.ok && transcriptResponse.status !== 404) {
          console.error(
            `Failed to fetch transcript for ${recordingId}: ${transcriptResponse.status}`,
          );
        }

        const summaryData = summaryResponse.ok
          ? await summaryResponse.json()
          : { summary: null };
        const transcriptData = transcriptResponse.ok
          ? await transcriptResponse.json()
          : { transcript: [] };

        // Get meeting metadata from paginated list
        const meetingMetadata = await fetchMeetingMetadata(recordingId);

        if (!meetingMetadata) {
          console.error(`Meeting metadata not found for ${recordingId}`);
          return null;
        }

        // Combine data like fetch-single-meeting does
        return {
          ...meetingMetadata,
          transcript: transcriptData.transcript || [],
          default_summary: summaryData.summary || null,
        };
      } catch (error) {
        console.error(`Error fetching meeting data for ${recordingId}:`, error);
        return null;
      }
    };

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: number[] = [];
      const failed: number[] = [];
      let skippedCount = 0;
      const rateLimiter = new RateLimiter();

      console.log(`Background processing started for sync job ${jobId}`);
      console.log(
        `Using NEW direct recording_id approach for ${recordingIds.length} meetings`,
      );

      try {
        // Process each meeting individually using direct recording_id endpoints
        for (const rawId of targetRecordingIds) {
          const recordingId = Number(rawId);
          try {
            await rateLimiter.throttle();

            console.log(
              `Fetching meeting ${recordingId} via direct recording_id endpoints...`,
            );
            const meeting = await fetchMeetingData(recordingId);

            if (!meeting) {
              console.error(
                `Meeting ${recordingId} not found or failed to fetch`,
              );
              failed.push(recordingId);

              // Update progress
              await supabase
                .from("sync_jobs")
                .update({
                  progress_current:
                    synced.length + failed.length + skippedCount,
                  synced_ids: synced,
                  failed_ids: failed,
                  skipped_count: skippedCount,
                })
                .eq("id", jobId);

              continue;
            }

            const outcome = await syncMeeting(
              supabase,
              userId,
              recordingId,
              meeting,
              validatedVaultId,
              fallbackVaultId,
            );

            if (outcome === "synced") {
              synced.push(recordingId);
              console.log(
                `✓ Synced ${recordingId} (${synced.length}/${recordingIds.length})${validatedVaultId ? ` → workspace ${validatedVaultId}` : ""}`,
              );
            } else if (outcome === "skipped") {
              skippedCount++;
              console.log(`→ Skipped ${recordingId} (duplicate)`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync ${recordingId}`);
            }

            // Update job progress (skipped items count toward progress)
            await supabase
              .from("sync_jobs")
              .update({
                progress_current: synced.length + failed.length + skippedCount,
                synced_ids: synced,
                failed_ids: failed,
                skipped_count: skippedCount,
              })
              .eq("id", jobId);

            // Small delay between meetings to be nice to the API
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error processing recording ${recordingId}:`, error);
            failed.push(recordingId);

            // Update progress even on error
            await supabase
              .from("sync_jobs")
              .update({
                progress_current: synced.length + failed.length + skippedCount,
                synced_ids: synced,
                failed_ids: failed,
                skipped_count: skippedCount,
              })
              .eq("id", jobId);
          }
        }

        // Mark job as completed with appropriate status
        const finalStatus =
          failed.length === 0
            ? "completed"
            : synced.length === 0
              ? "failed"
              : "completed_with_errors";

        await supabase
          .from("sync_jobs")
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            skipped_count: skippedCount,
          })
          .eq("id", jobId);
        if (failed.length > 0 && (synced.length > 0 || skippedCount > 0) && credSourceId) {
          await markConnectorPartialSync({
            supabase,
            sourceId: credSourceId,
            userId,
            failedExternalIds: failed.map(String),
          });
        }

        console.log(
          `Sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed, ${skippedCount} skipped`,
        );

        // [DISABLED] Embedding system disabled — pipeline broken
        // if (synced.length > 0) { ... }

        // Fire-and-forget: invoke generate-ai-titles for the synced recordings
        if (synced.length > 0) {
          // This generates descriptive AI titles - respects user preference
          console.log(
            `Triggering AI title generation for ${synced.length} synced meetings...`,
          );
          supabase.functions
            .invoke("generate-ai-titles", {
              body: {
                recordingIds: synced,
                respectPreference: true,
              },
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            })
            .then(({ data, error }) => {
              if (error) {
                console.error(
                  `AI title generation failed for sync job ${jobId}:`,
                  error,
                );
              } else {
                console.log(
                  `AI title generation completed for ${synced.length} meetings:`,
                  data,
                );
              }
            })
            .catch((err) => {
              console.error(
                `AI title invocation failed for sync job ${jobId}:`,
                err,
              );
            });

          // Fire-and-forget: invoke auto-tag-calls for the synced recordings
          console.log(
            `Triggering auto-tagging for ${synced.length} synced meetings...`,
          );
          supabase.functions
            .invoke("auto-tag-calls", {
              body: {
                recordingIds: synced,
                respectPreference: true,
              },
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            })
            .then(({ data, error }) => {
              if (error) {
                console.error(
                  `Auto-tagging failed for sync job ${jobId}:`,
                  error,
                );
              } else {
                console.log(
                  `Auto-tagging completed for ${synced.length} meetings:`,
                  data,
                );
              }
            })
            .catch((err) => {
              console.error(
                `Auto-tag invocation failed for sync job ${jobId}:`,
                err,
              );
            });
        }
      } catch (error) {
        console.error(`Sync job ${jobId} failed:`, error);
        await supabase
          .from("sync_jobs")
          .update({
            status: "failed",
            error_message:
              error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    };

    // Start background processing
    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processSyncJob());

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobId,
        message: `Sync job started for ${targetRecordingIds.length} meetings`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error syncing meetings:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
