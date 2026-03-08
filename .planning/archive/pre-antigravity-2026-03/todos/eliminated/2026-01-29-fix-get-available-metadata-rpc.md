---
created: 2026-01-29T00:30
title: Fix missing get_available_metadata database function
area: database
files:
  - supabase/functions/chat-stream/index.ts
  - supabase/migrations/
---

## Problem

The chat tool `getAvailableMetadata` fails because the database function doesn't exist in Supabase.

Error from chat:
```
{
  "error": "Failed to retrieve metadata",
  "details": "Could not find the function public.get_available_metadata(p_metadata_type, p_user_id) in the schema cache"
}
```

This breaks metadata-based searches in chat (topics, speakers, categories). The tool tries to call an RPC function that was never created.

## Solution

Create the missing RPC function in Supabase via migration:
- Function: `public.get_available_metadata(p_metadata_type text, p_user_id uuid)`
- Returns: Available values for the given metadata type (topics, speakers, categories, etc.)
- Used by: `getAvailableMetadata` tool in chat-stream
