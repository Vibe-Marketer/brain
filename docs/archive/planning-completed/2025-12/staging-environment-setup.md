# Staging Environment Setup Guide

**Created:** 2025-12-08
**Status:** Ready for Implementation
**Priority:** HIGH - Prerequisite for MVP testing

---

## Overview

Set up a staging environment at `test.callvaultai.com` that shares the production Supabase database but runs from a separate `staging` branch.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Production                         Staging                     │
│   ┌──────────────────┐              ┌──────────────────┐        │
│   │ app.callvaultai  │              │ test.callvaultai │        │
│   │     .com         │              │     .com         │        │
│   │                  │              │                  │        │
│   │  main branch     │              │  staging branch  │        │
│   └────────┬─────────┘              └────────┬─────────┘        │
│            │                                  │                  │
│            └──────────────┬──────────────────┘                  │
│                           │                                      │
│                           ▼                                      │
│              ┌────────────────────────┐                         │
│              │   SHARED SUPABASE      │                         │
│              │                        │                         │
│              │  • Same database       │                         │
│              │  • Same auth           │                         │
│              │  • Same Edge Functions │                         │
│              │  • Same storage        │                         │
│              └────────────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Staging Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create staging branch
git checkout -b staging
git push -u origin staging
```

### Step 2: Configure Vercel for Staging

#### Option A: Same Project, Branch Deploy (Recommended)

1. Go to Vercel Dashboard → CallVault project
2. Settings → Domains
3. Add domain: `test.callvaultai.com`
4. Settings → Git → Production Branch: keep as `main`
5. Configure branch alias:
   - Branch: `staging`
   - Domain: `test.callvaultai.com`

**Environment Variables:** Same as production (shared Supabase)

#### Option B: Separate Vercel Project

If you want completely separate deployments:

1. Create new Vercel project from same repo
2. Set production branch to `staging`
3. Add domain: `test.callvaultai.com`
4. Copy all environment variables from production project

### Step 3: DNS Configuration

Add CNAME record in your DNS provider:

```
Type: CNAME
Name: test
Value: cname.vercel-dns.com
TTL: 3600
```

### Step 4: Verify Setup

1. Push a test commit to `staging` branch
2. Verify deployment at `test.callvaultai.com`
3. Test login (same auth, same users)
4. Verify data loads correctly (same database)

---

## Workflow: Development → Staging → Production

### Daily Development Flow

```bash
# 1. Start from main
git checkout main
git pull

# 2. Create feature branch
git checkout -b feature/folder-sidebar

# 3. Develop and test locally
npm run dev

# 4. When ready, merge to staging
git checkout staging
git pull
git merge feature/folder-sidebar
git push

# 5. Test on test.callvaultai.com

# 6. When approved, merge to main
git checkout main
git merge staging
git push

# 7. Verify on app.callvaultai.com
```

### Quick Fix Flow

```bash
# For urgent fixes that need testing
git checkout staging
git cherry-pick <commit-hash>
git push
# Test on staging
# If good, cherry-pick to main
```

---

## Considerations

### Shared Database Implications

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Schema migrations | Both envs affected | Test migrations in local dev first |
| New RLS policies | Both envs protected | Same RLS is actually good |
| Edge Functions | Deployed per branch* | Need manual deploy to test |
| Data mutations | Same data affected | Be careful with test data |

*Note: Supabase Edge Functions are NOT branch-aware. They deploy from the Supabase dashboard or CLI, not from Vercel.

### Edge Functions Consideration

Since Edge Functions are shared:
- New functions work in both environments immediately
- No branch isolation for serverless functions
- Test function changes locally with `supabase functions serve`

### When You'd Want Separate Supabase

Consider separate Supabase project if:
- Running automated tests that create/delete data
- Testing destructive schema migrations
- Need to test with synthetic/fake data
- Multiple developers needing isolated environments

**For your current needs (solo testing of folder features), shared is fine.**

---

## Environment Checklist

### Production (`app.callvaultai.com`)
- [ ] Branch: `main`
- [ ] Supabase Project: `pwscjdytgcyiavqiufqs`
- [ ] All env vars configured

### Staging (`test.callvaultai.com`)
- [ ] Branch: `staging`
- [ ] Same Supabase Project (shared)
- [ ] Same env vars (copy from production)
- [ ] Domain configured in Vercel
- [ ] DNS CNAME record added

---

## Commands Reference

```bash
# Check current branch
git branch

# Switch to staging
git checkout staging

# Sync staging with main
git checkout staging
git merge main
git push

# Sync main with staging (after testing)
git checkout main
git merge staging
git push

# View deployment status
vercel ls

# Force redeploy staging
vercel --prod --scope=<your-scope>
```

---

## Rollback Procedure

If staging breaks and you need to rollback:

```bash
# Option 1: Revert last commit
git checkout staging
git revert HEAD
git push

# Option 2: Reset to main
git checkout staging
git reset --hard main
git push --force  # Be careful!

# Option 3: Via Vercel Dashboard
# Go to Deployments → Select previous deployment → Promote to Production
```

---

## Next Steps After Setup

1. ✅ Staging environment live
2. Develop folder sidebar on feature branch
3. Merge to staging and test
4. When folder MVP complete, merge to main
5. Ship to production users
