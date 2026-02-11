# Root Script Archive

These scripts were previously stored at the repository root.

They are ad-hoc diagnostics/debug utilities (not app runtime files), and were moved to keep the root clean and safer.

## Run

```bash
npx tsx scripts/debug/root/<script-name>.ts
```

## Required Environment Variables

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (for admin/debug scripts)
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `CALLVAULTAI_LOGIN` / `CALLVAULTAI_LOGIN_PASSWORD` (for auth-based RAG tests)
- `DEBUG_TEST_USER_ID` (scripts that need explicit user scope)
- `DEBUG_TEST_USER_EMAIL` (optional override for user-email tests)

## Notes

- No credentials are hardcoded in these scripts anymore.
- Keep this directory out of production workflows; it is for manual debugging only.
