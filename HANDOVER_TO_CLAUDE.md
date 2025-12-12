# Handover Document: Admin Model Management & Sync "Failed to Fetch" Bug

**Date:** December 12, 2025
**Feature:** Administrative Model Management System (Supabase + React)
**Status:** Feature Implemented, but Sync Button fails in Browser (Works in Curl).

---

## 1. Project Background & Objective
The goal was to build an **Admin Model Management System** to give administrators granular control over AI models available in the "Chat" and "Analysis" features.
**Requirements:**
-   Database-driven model list (replacing hardcoded arrays).
-   "Sync" button to fetch latest models from OpenRouter API via Edge Function.
-   Admin UI to Enable/Disable, Rename, and Feature models.
-   Role-based access (Admin only).

## 2. Work Completed (Architecture)

### Database
-   **New Table:** `public.ai_models`
-   **Schema:** `id` (text), `name` (text), `provider` (text), `pricing` (jsonb), `is_enabled` (bool), `is_featured` (bool).
-   **Security:** RLS enabled. Selectable by all (where enabled). Insert/Update/Delete by `ADMIN` role only.
-   **Migration File:** `supabase/migrations/20251212000001_create_ai_models.sql`

### Backend (Supabase Edge Functions)
1.  **`sync-openrouter-models`**:
    *   **Purpose:** Fetches models from OpenRouter and upserts them into `ai_models`.
    *   **Method:** POST.
    *   **Auth:** Requires Supabase Auth Bearer token + `ADMIN` role check via RPC.
    *   **CORS:** Implemented with dynamic Origin reflection to support authenticated requests.
2.  **`get-available-models`**:
    *   **Purpose:** Chat UI fetches this list.
    *   **Update:** Modified to read from `ai_models` table instead of hardcoded lists.

### Frontend (React)
-   **Component:** `src/components/settings/AdminModelManager.tsx`
    *   Displays table of models.
    *   "Sync from OpenRouter" button triggers the edge function.
    *   Integrated into `src/components/settings/AITab.tsx`.

### Deployment Status
-   All files committed and pushed to `main`.
-   Edge Functions deployed to project `vltmrnjsubfzrgrtdqey`.
-   Database migration applied.

---

## 3. The Critical Issue: "Failed to fetch" on Sync

**Symptom:**
When the user clicks "Sync from OpenRouter" in the browser, the request fails immediately with:
`TypeError: Failed to fetch`
The browser console (from user logs) shows:
> URL: https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/sync-openrouter-models
> Method: POST
> Error Category: network

**History of Debugging & Fixes Attempted:**

1.  **Initial Implementation:**
    *   Used raw `fetch` in React. Failed with network error.
2.  **Attempt 1 (Client Refactor):**
    *   Switched to `supabase.functions.invoke('sync-openrouter-models', { method: 'POST' })`.
    *   *Rationale:* Better handling of headers/auth by the official library.
    *   *Result:* Still "Failed to fetch".
3.  **Attempt 2 (Strict CORS - Methods):**
    *   Added `Access-Control-Allow-Methods: POST, GET, OPTIONS` to the Edge Function.
    *   *Rationale:* Some browsers block POST if preflight doesn't explicitly allow it.
    *   *Result:* Still "Failed to fetch".
4.  **Attempt 3 (Dynamic Origin CORS):**
    *   Rewrote `sync-openrouter-models` to read `req.headers.get('Origin')` and echo it back in `Access-Control-Allow-Origin`.
    *   *Rationale:* `Access-Control-Allow-Origin: *` is invalid when `Access-Control-Allow-Credentials: true` (or implicitly treated as such by some auth clients). Authenticated requests often require explicit origin matching.
    *   *Result:* **Works in cURL**, fails in Browser.

**Verification Results:**
-   **Terminal (cURL) Verification:**
    *   `OPTIONS` request: Returns 200 OK + correct CORS headers.
    *   `POST` request: Returns expected JSON response (Auth error if no token, Success if valid).
    *   **Conclusion:** The backend is healthy and reachable.
-   **Browser Verification:**
    *   User reports persistent "Failed to fetch".

---

## 4. Hypothesis & Next Steps for Handover

Since the backend works via cURL but fails in the browser, the issue lies in the **Browser <-> Edge Function interaction**.

**Potential Root Causes to Investigate:**

1.  **Environment / Client Config:**
    *   Check `src/integrations/supabase/client.ts`. Is the `supabaseUrl` matching the Edge Function URL?
    *   Is the client causing a pre-flight failure that isn't logged clearly?
2.  **AdBlock / Extension Interference:**
    *   "Failed to fetch" with no network details often means a browser extension (like uBlock Origin, Privacy Badger) cancelled the request before it left the network stack.
    *   *Action:* Ask user to check Incognito mode or disable blocking extensions.
3.  **Localhost vs. Production Origin:**
    *   The user is on `localhost:8080`.
    *   The Edge Function sees `Origin: http://localhost:8080`.
    *   The Dynamic Origin fix *should* handle this, echoing `http://localhost:8080`.
    *   Verify if `Access-Control-Allow-Credentials` is needed. In `supabase.functions.invoke`, if cookies are sent, this header is mandatory. I did *not* explicitly add `Access-Control-Allow-Credentials: true` in the final rewrite (implied by dynamic origin but might need the explicit header).
4.  **Supabase Local Dev vs. Remote:**
    *   User is running the app on `localhost`. Is the Supabase client configured to hit the *local* functions or *remote*?
    *   The error says `vltmrnjsubfzrgrtdqey.supabase.co`, which is REMOTE.
    *   Mixing Localhost App + Remote Supabase Function + Auth Headers is a classic CORS nightmare.

## 5. Files Manifest

**New files created:**
-   `src/components/settings/AdminModelManager.tsx` (The UI)
-   `supabase/functions/sync-openrouter-models/index.ts` (The Backend)
-   `supabase/migrations/20251212000001_create_ai_models.sql` (The Schema)

**Files modified:**
-   `src/components/settings/AITab.tsx` (Integration point)
-   `supabase/functions/get-available-models/index.ts` (Updated to use DB)

---

**Immediate Action for Next Engineer:**
1.  **Modify `sync-openrouter-models`** to explicitly add `Access-Control-Allow-Credentials: true`. This is the most likely missing piece for a Localhost->Remote authenticated request.
2.  **Ask user to inspect the "Network" tab** in Chrome Developer Tools specifically for the *cancelled* request to see if it says "CORS error" or "Blocked by Client".
