# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **Dead Coach Edge Functions** - Removed 3 unused Supabase Edge Functions per [ADR-0006](docs/adr/0006-dead-code-removal-phase6.md):
  - `supabase/functions/coach-notes/` - No frontend callers
  - `supabase/functions/coach-relationships/` - No frontend callers
  - `supabase/functions/coach-shares/` - No frontend callers
  
- **Orphaned TeamManagement.tsx** - Removed `src/pages/TeamManagement.tsx` (500+ lines) - not routed or imported anywhere

### Notes

- `send-coach-invite` Edge Function preserved (actively used by `useCoachRelationships` hook)
- `useCoachRelationships.ts` hook preserved (used by 5+ components)
- Dashboard cleanup: The removed Edge Functions should also be deleted from the Supabase dashboard
