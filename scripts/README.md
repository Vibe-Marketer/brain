# Scripts Directory

This directory contains utility scripts for the CallVault project.

## RAG Testing Scripts (WEEK 3 - TASK 3.3)

### Quick Start

1. **Get your user ID:**
   ```bash
   npx tsx scripts/get-user-id.ts your-email@example.com
   ```

2. **Check if embeddings exist:**
   ```bash
   npx tsx scripts/check-embeddings.ts <user_id>
   ```

3. **Run RAG quality tests:**
   ```bash
   npm run test:rag <user_id>
   ```

### Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `test-rag-retrieval.ts` | Measure RAG retrieval quality with MRR and P@K metrics | `npm run test:rag <user_id>` |
| `check-embeddings.ts` | Verify embeddings exist before testing | `npx tsx scripts/check-embeddings.ts <user_id>` |
| `get-user-id.ts` | Get user ID by email or list all users | `npx tsx scripts/get-user-id.ts <email>` |

### Detailed Documentation

See [RAG_TESTING_GUIDE.md](./RAG_TESTING_GUIDE.md) for:
- Detailed usage instructions
- Metric explanations (MRR, Precision@K)
- How to customize test queries
- Baseline creation and tracking improvements
- Troubleshooting guide
- CI/CD integration

## Other Scripts

### Supabase Import Scripts

| Script | Purpose |
|--------|---------|
| `import-from-old-supabase.js` | Import data from old Supabase project |
| `import-simple-bypass.js` | Simple import bypassing constraints |
| `import-with-constraint-bypass.js` | Import with constraint handling |
| `import-with-user-mapping.js` | Import with user ID mapping |
| `compare-schemas.js` | Compare schemas between projects |

### User Management

| Script | Purpose |
|--------|---------|
| `create-user-profile.js` | Create user profile |
| `get-my-user-id.js` | Get current user ID |

### Database Management

| Script | Purpose |
|--------|---------|
| `disable-constraints.sql` | SQL to disable constraints |
| `execute-constraint-sql.js` | Execute constraint SQL |

### Environment Setup

| Script | Purpose |
|--------|---------|
| `setup-secrets.sh` | Setup Supabase secrets |
| `test-environment.sh` | Test environment configuration |

## Prerequisites

### For RAG Testing Scripts

Required in `.env`:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
```

### Install Dependencies

```bash
npm install
```

This installs `tsx` for TypeScript execution.

## Common Workflows

### Testing RAG After Enhancements

```bash
# 1. Check current state
npx tsx scripts/check-embeddings.ts <user_id>

# 2. Run baseline test
npm run test:rag <user_id> > baseline.txt

# 3. Make enhancements (query expansion, re-ranking, etc.)

# 4. Run test again
npm run test:rag <user_id> > enhanced.txt

# 5. Compare results
grep "Average" baseline.txt
grep "Average" enhanced.txt
```

### Setting Up for First Time

```bash
# 1. Find your user ID
npx tsx scripts/get-user-id.ts your-email@example.com

# 2. Verify embeddings exist
npx tsx scripts/check-embeddings.ts <user_id>

# 3. If not ready, run embedding job first
# (Use Supabase Edge Function or API)

# 4. Run tests
npm run test:rag <user_id>
```

## Output Locations

- **Test Reports:** `test-results/rag-test-{timestamp}.json`
- **Console Output:** Printed to stdout
- **Errors:** Printed to stderr

## Notes

- All TypeScript scripts use `tsx` for execution
- Scripts require Node.js 18+ and npm
- Service role key is required (keep it secret!)
- Test results are gitignored automatically
