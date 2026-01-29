# TO-DOS

## Missing get_available_metadata Database Function - 2026-01-29 00:25

- **Fix get_available_metadata RPC function** - The chat tool `getAvailableMetadata` fails because the database function doesn't exist. **Problem:** Tool returns error "Could not find the function public.get_available_metadata(p_metadata_type, p_user_id) in the schema cache". This breaks metadata-based searches (topics, speakers, categories). **Files:** `supabase/functions/chat-stream/index.ts` (tool definition), `supabase/migrations/` (needs new migration). **Solution:** Create the missing RPC function in Supabase that returns available metadata values for a given type and user.
