# Supabase Backend - CLAUDE INSTRUCTIONS

**Location:** `/supabase/`
**Last Updated:** 2026-01-14

This document defines conventions and patterns for Supabase Edge Functions, database schema, and backend API development.

---

## TABLE OF CONTENTS

1. [Function Organization](#function-organization)
2. [API Conventions](#api-conventions)
3. [Database Patterns](#database-patterns)
4. [Security Requirements](#security-requirements)

---

# FUNCTION ORGANIZATION

## Folder Naming Convention

**All Edge Functions use kebab-case for folder names.**

```
supabase/functions/
  fetch-meetings/          # Correct: kebab-case
  sync-meetings/           # Correct: kebab-case
  fathom-oauth-callback/   # Correct: kebab-case
```

**Regex validation:**
```regex
^[a-z0-9]+(-[a-z0-9]+)*$
```

## Shared Utilities Location

Shared code lives in the `_shared/` directory:

```
supabase/functions/
  _shared/
    cors.ts              # CORS header utilities
    fathom-client.ts     # Fathom API client with retry logic
    google-client.ts     # Google API client
    zoom-client.ts       # Zoom API client
    deduplication.ts     # Meeting deduplication logic
    dedup-fingerprint.ts # Fingerprint generation
    usage-tracker.ts     # API usage tracking
    vtt-parser.ts        # VTT transcript parsing
    response.ts          # Standard response helpers
```

**Import pattern from shared:**
```typescript
import { FathomClient } from '../_shared/fathom-client.ts';
import { corsHeaders } from '../_shared/cors.ts';
```

## index.ts Structure Template

Every Edge Function follows this structure:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

Deno.serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Authenticate user from JWT
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

    // 4. Parse request body (if applicable)
    const body = await req.json();

    // 5. Main logic here
    const result = { success: true };

    // 6. Return success response
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // 7. Error handling
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Example Function Directory Structure

```
supabase/functions/
  fetch-meetings/
    index.ts             # Main handler
  sync-meetings/
    index.ts             # Main handler
  _shared/
    cors.ts              # Shared CORS utilities
    fathom-client.ts     # Shared API client
```

---

**END OF SUPABASE BACKEND INSTRUCTIONS**
