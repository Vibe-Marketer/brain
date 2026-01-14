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

# API CONVENTIONS

## Function Prefix Standards

| Prefix | Purpose | Example Functions |
|--------|---------|-------------------|
| `fetch*` | Retrieve data from external APIs | `fetch-meetings`, `fetch-single-meeting` |
| `sync*` | Synchronize data to database | `sync-meetings`, `sync-openrouter-models` |
| `save*` | Persist user settings/config | `save-fathom-key`, `save-webhook-secret` |
| `get*` | Retrieve configuration/status | `get-config-status`, `get-available-models` |
| `test*` | Verify connections/configs | `test-fathom-connection`, `test-env-vars` |
| `create*` | Create new resources | `create-fathom-webhook` |
| `delete*` | Remove data/resources | `delete-all-calls` |
| `load*` | Load internal data | Internal functions only |
| `check*` | Verify status/state | Internal functions only |
| `generate*` | Create derived data | `generate-ai-titles`, `generate-content` |
| `process*` | Process/transform data | `process-embeddings` |
| `embed*` | Create embeddings | `embed-chunks` |
| `enrich*` | Add metadata to data | `enrich-chunk-metadata` |

## Standard Response Format

**Success Response:**
```typescript
return new Response(
  JSON.stringify({
    success: true,
    data: result,           // Optional: response data
    message: 'Operation completed'  // Optional: human-readable message
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

**Error Response:**
```typescript
return new Response(
  JSON.stringify({
    error: 'Error message here',
    details: errorDetails   // Optional: additional context
  }),
  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

**Standard HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Error Handling Patterns

**Standard try-catch pattern:**
```typescript
try {
  // Main logic
} catch (error) {
  console.error('Error in function-name:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Specific error handling:**
```typescript
if (configError) {
  return new Response(
    JSON.stringify({ error: 'Configuration not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## CORS Configuration Requirements

**Standard CORS headers (required for all functions):**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};
```

**Extended CORS (when needed):**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
```

**CORS preflight handler (required at start of every function):**
```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

# DATABASE PATTERNS

## RLS Policy Requirements

**All tables MUST have Row Level Security (RLS) enabled:**

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Standard RLS policy patterns:**

```sql
-- Users can view their own data
CREATE POLICY "Users can view their own records"
  ON table_name
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own data
CREATE POLICY "Users can insert their own records"
  ON table_name
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own data
CREATE POLICY "Users can update their own records"
  ON table_name
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own data
CREATE POLICY "Users can delete their own records"
  ON table_name
  FOR DELETE
  USING (auth.uid() = user_id);
```

## Common Query Patterns

**Select with user isolation:**
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

**Upsert with conflict handling:**
```typescript
const { error } = await supabase
  .from('user_settings')
  .upsert({
    user_id: user.id,
    setting_name: value,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id'
  });
```

**Composite key operations:**
```typescript
const { error } = await supabase
  .from('fathom_calls')
  .upsert(data, {
    onConflict: 'recording_id,user_id'
  });
```

**Single record with maybeSingle():**
```typescript
const { data: settings, error } = await supabase
  .from('user_settings')
  .select('*')
  .eq('user_id', user.id)
  .maybeSingle();  // Returns null if not found, no error
```

## Migration Conventions

**Migration file naming:**
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260108000001_create_single_call_share_tables.sql`

**Migration file structure:**
```sql
-- Migration: Short description
-- Purpose: Detailed explanation
-- Author: Author name
-- Date: YYYY-MM-DD

-- ============================================================================
-- TABLE: table_name
-- ============================================================================
-- Description of what this table stores
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- other columns...
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_table_column ON table_name(column_name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE table_name IS 'Description';
COMMENT ON COLUMN table_name.column IS 'Description';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
```

## Database Field Naming

**All database fields use snake_case:**

```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  recording_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  full_transcript TEXT,
  recording_start_time TIMESTAMPTZ,
  calendar_invitees JSONB
);
```

---

# SECURITY REQUIREMENTS

## Environment Variable Handling

**Required environment variables for Edge Functions:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `SUPABASE_ANON_KEY` - Anonymous key (client-side)

**Accessing environment variables:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
```

**NEVER expose in responses:**
```typescript
// BAD - Never do this
return new Response(JSON.stringify({
  key: Deno.env.get('API_KEY')  // NEVER expose secrets
}));

// GOOD - Only expose non-sensitive info
return new Response(JSON.stringify({
  configured: !!Deno.env.get('API_KEY')
}));
```

## Authentication Verification Patterns

**Standard JWT authentication:**
```typescript
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
```

**Service role for admin operations:**
```typescript
// Use service role when RLS needs to be bypassed
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

## Input Validation Requirements

**Use Zod for input validation:**
```typescript
import { z } from 'https://esm.sh/zod@3.23.8';

const inputSchema = z.object({
  apiKey: z.string()
    .trim()
    .min(20, 'API key appears to be invalid (too short)')
    .max(500, 'API key is too long'),
  email: z.string().email('Invalid email format'),
});

const body = await req.json();
const validation = inputSchema.safeParse(body);

if (!validation.success) {
  const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const { apiKey, email } = validation.data;
```

**Validate all user input before processing:**
- String lengths
- Email formats
- Numeric ranges
- Array contents
- JSON structure

## OWASP Top 10 Concerns

**1. Injection Prevention:**
```typescript
// GOOD - Use parameterized queries (Supabase handles this)
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('user_id', userId);  // Parameterized

// BAD - Never interpolate user input into queries
const query = `SELECT * FROM table WHERE user_id = '${userId}'`;  // SQL injection risk
```

**2. Broken Authentication:**
- Always verify JWT tokens
- Use Supabase auth, never roll your own
- Validate user ownership before operations

**3. Sensitive Data Exposure:**
- Never log sensitive data (API keys, tokens)
- Mask secrets in responses (show only prefix/suffix)
- Use HTTPS for all communications

**4. Security Misconfiguration:**
- Enable RLS on all tables
- Use restrictive CORS in production
- Remove debug endpoints

**5. Cross-Site Scripting (XSS):**
- Sanitize any HTML content before storage
- Use Content-Type: application/json for API responses

**6. Insecure Direct Object References:**
```typescript
// GOOD - Always verify ownership
const { data } = await supabase
  .from('calls')
  .select('*')
  .eq('recording_id', recordingId)
  .eq('user_id', user.id);  // Verify ownership

// BAD - Never trust client-provided IDs alone
const { data } = await supabase
  .from('calls')
  .select('*')
  .eq('recording_id', recordingId);  // No ownership check
```

**7. Rate Limiting:**
```typescript
// Implement rate limiting for external API calls
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 55;
  private readonly windowMs = 60000;

  async throttle(): Promise<void> {
    // ... rate limiting logic
  }
}
```

**8. Logging Security Events:**
```typescript
// Log security-relevant events
console.log('User authentication:', user.id);
console.error('Authorization failed for user:', user.id);
// Never log: passwords, API keys, tokens, PII
```

---

# QUICK REFERENCE

## Naming Conventions Summary

| Item | Convention | Example |
|------|------------|---------|
| Function folders | kebab-case | `fetch-meetings/` |
| Internal functions | camelCase | `processMeetingWebhook()` |
| Database tables | snake_case | `user_settings` |
| Database columns | snake_case | `recording_id` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |

## Checklist Before Deploying

- [ ] CORS preflight handler present
- [ ] JWT authentication verified
- [ ] User ownership checked in queries
- [ ] Input validated with Zod
- [ ] Errors logged (without sensitive data)
- [ ] RLS policies created for new tables
- [ ] Migration file follows naming convention
- [ ] No secrets exposed in responses

---

**END OF SUPABASE BACKEND INSTRUCTIONS**
