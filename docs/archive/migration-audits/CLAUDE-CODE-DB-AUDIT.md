# Conversion Brain - Database & Edge Function Audit

**Date:** 2025-11-22
**Purpose:** Identify actively used vs. unused database tables and edge functions before migration
**Project:** Conversion Brain Supabase Migration

---

## 📊 DATABASE TABLES AUDIT

### Total Tables Found: **29**

---

## ✅ CORE TABLES (Actively Used - HIGH PRIORITY)

These tables are referenced in application code and should be migrated.

### 1. User Management (3 tables)

| Table | Used In | References | Priority |
|-------|---------|------------|----------|
| `user_profiles` | AdminTab, AccountTab, UsersTab, UserManagementTable | High usage | **CRITICAL** |
| `user_roles` | AdminTab, UsersTab, ProtectedRoute | Permission system | **CRITICAL** |
| `user_settings` | OAuthCallback, FathomSetupWizard, AccountTab, IntegrationsTab, OAuth functions | User preferences | **CRITICAL** |

**Migration Status:** ✅ **MUST MIGRATE**

---

### 2. Fathom Integration (2 tables)

| Table | Used In | References | Priority |
|-------|---------|------------|----------|
| `fathom_calls` | ProtectedRoute, process-ai-jobs function, test-webhook function | Core call data | **CRITICAL** |
| `fathom_transcripts` | Initial migration | Transcript storage | **HIGH** |

**Migration Status:** ✅ **MUST MIGRATE**

---

### 3. Webhook & Processing (3 tables)

| Table | Used In | References | Priority |
|-------|---------|------------|----------|
| `webhook_deliveries` | WebhookAnalytics component | Analytics dashboard | **HIGH** |
| `processed_webhooks` | test-webhook function | Webhook deduplication | **HIGH** |
| `ai_processing_jobs` | process-ai-jobs function | AI job queue | **HIGH** |

**Migration Status:** ✅ **MUST MIGRATE**

---

### 4. Configuration (1 table)

| Table | Used In | References | Priority |
|-------|---------|------------|----------|
| `app_config` | test-webhook function | Application settings | **HIGH** |

**Migration Status:** ✅ **MUST MIGRATE**

---

### 5. Categorization & Speakers (2 tables)

| Table | Used In | References | Priority |
|-------|---------|------------|----------|
| `call_categories` | QuickCreateCategoryDialog | Call categorization | **MEDIUM** |
| `speakers` | SpeakerManagementDialog | Speaker tracking | **MEDIUM** |

**Migration Status:** ✅ **SHOULD MIGRATE**

---

## ⚠️ SECONDARY TABLES (Relationship/Support Tables - REVIEW NEEDED)

These tables are likely used for relationships but not directly referenced in code.

| # | Table Name | Likely Purpose | Recommendation |
|---|------------|----------------|----------------|
| 12 | `call_category_assignments` | Links calls to categories | **MIGRATE** if using categories |
| 13 | `call_speakers` | Links calls to speakers | **MIGRATE** if using speakers |
| 14 | `call_type_status_mapping` | Call type configuration | **REVIEW** - may be obsolete |
| 15 | `contact_call_associations` | Links contacts to calls | **MIGRATE** if using contacts |
| 16 | `contact_tag_assignments` | Contact tagging | **MIGRATE** if using contacts |
| 17 | `contact_tags` | Tag definitions | **MIGRATE** if using contacts |
| 18 | `contacts` | Contact storage | **MIGRATE** if using contacts |
| 19 | `shared_links` | Link sharing feature | **REVIEW** - check if used |
| 20 | `sync_jobs` | Synchronization tracking | **REVIEW** - may be legacy |
| 21 | `transcript_tag_assignments` | Transcript tagging | **MIGRATE** if using tags |
| 22 | `transcript_tags` | Tag definitions | **MIGRATE** if using tags |

**Migration Status:** ⚠️ **REVIEW BEFORE MIGRATING**

---

## ❌ LIKELY UNUSED TABLES (Candidates for Removal)

These tables appear in migrations but are NOT referenced in application code.

| # | Table Name | Suspected Status | Evidence |
|---|------------|------------------|----------|
| 23 | `agent_delivery_logs` | **UNUSED** | No code references found |
| 24 | `agent_knowledge_base` | **UNUSED** | No code references found |
| 25 | `agent_runs` | **UNUSED** | No code references found |
| 26 | `ai_agents` | **UNUSED** | No code references found |
| 27 | `global_knowledge_base` | **UNUSED** | No code references found |
| 28 | `intel_items` | **UNUSED** | No code references found |
| 29 | `starter_agent_templates` | **UNUSED** | No code references found |

**Migration Status:** ❌ **SKIP (Recommend dropping tables after verification)**

---

## 📋 MIGRATION RECOMMENDATIONS

### Option 1: Core Only (11 tables) - ⚡ **FASTEST**
**Time:** ~2 minutes
**Tables:**
```javascript
[
  'user_profiles',
  'user_roles',
  'user_settings',
  'fathom_calls',
  'fathom_transcripts',
  'webhook_deliveries',
  'processed_webhooks',
  'ai_processing_jobs',
  'app_config',
  'call_categories',
  'speakers'
]
```

### Option 2: Core + Relationships (22 tables) - ⚙️ **RECOMMENDED**
**Time:** ~4 minutes
**Includes:** Core + all relationship tables (categories, speakers, contacts, tags)

### Option 3: Everything (29 tables) - 🔒 **SAFEST**
**Time:** ~5 minutes
**Includes:** All tables (but includes likely obsolete data)

---

## 🔧 EDGE FUNCTIONS AUDIT

### Total Edge Functions Found: **33**

---

## 📂 EDGE FUNCTION INVENTORY

### ✅ ACTIVELY USED FUNCTIONS (Must Migrate)

| Function Name | Used In Code | Tables Accessed | Priority |
|---------------|--------------|-----------------|----------|
| `fetch-meetings` | useMeetingsSync, SyncTab | `fathom_calls` | **CRITICAL** |
| `sync-meetings` | useMeetingsSync, SyncTab | `fathom_calls` | **CRITICAL** |
| `fetch-single-meeting` | useMeetingsSync, CallDetailDialog, SyncTab | `fathom_calls` | **CRITICAL** |
| `process-ai-jobs` | BulkActionToolbarEnhanced | `ai_processing_jobs`, `fathom_calls` | **CRITICAL** |
| `webhook` | FathomSetupWizard, WebhookDeliveryViewer | `fathom_calls`, `processed_webhooks` | **CRITICAL** |
| `fathom-oauth-callback` | OAuth flow | `user_settings` | **CRITICAL** |

**Migration Status:** ✅ **MUST MIGRATE** (6 functions)

---

### ⚙️ SUPPORTING FUNCTIONS (Should Migrate)

| Function Name | Likely Purpose | Tables Accessed | Priority |
|---------------|----------------|-----------------|----------|
| `test-fathom-connection` | Connection testing | `user_settings` | **HIGH** |
| `test-oauth-connection` | OAuth testing | `user_settings` | **HIGH** |
| `create-fathom-webhook` | Webhook creation | `app_config` | **HIGH** |
| `save-fathom-key` | Save API credentials | `user_settings` | **HIGH** |
| `fathom-oauth-refresh` | Token refresh | `user_settings` | **HIGH** |
| `fathom-oauth-url` | OAuth URL generation | None | **HIGH** |
| `save-webhook-secret` | Webhook security | `app_config` | **HIGH** |
| `save-host-email` | Configuration | `user_settings` | **MEDIUM** |
| `get-config-status` | Status checking | `app_config`, `user_settings` | **MEDIUM** |

**Migration Status:** ⚙️ **SHOULD MIGRATE** (9 functions)

---

### 🔍 UTILITY FUNCTIONS (Review Needed)

| Function Name | Purpose | Status | Recommendation |
|---------------|---------|--------|----------------|
| `test-webhook` | Webhook testing | Testing utility | **MIGRATE** if testing webhooks |
| `test-webhook-connection` | Connection test | Testing utility | **MIGRATE** if testing webhooks |
| `test-webhook-endpoint` | Endpoint verification | Testing utility | **MIGRATE** if testing webhooks |
| `test-webhook-signature` | Signature validation test | Testing utility | **MIGRATE** if testing webhooks |
| `process-call-ai` | AI processing | May be superseded by `process-ai-jobs` | **REVIEW** |
| `ai-analyze-transcripts` | Transcript analysis | May be legacy | **REVIEW** |
| `generate-call-title` | Title generation | Utility | **REVIEW** usage |
| `auto-tag-call` | Automatic tagging | Automation | **REVIEW** usage |
| `enrich-speaker-emails` | Email enrichment | Enhancement | **REVIEW** usage |

**Migration Status:** ⚠️ **REVIEW** (9 functions)

---

### 🗑️ DATA MANAGEMENT FUNCTIONS (Dangerous - Use Carefully)

| Function Name | Purpose | Risk Level | Recommendation |
|---------------|---------|------------|----------------|
| `delete-all-calls` | Bulk delete calls | ⚠️ HIGH RISK | **MIGRATE** but use carefully |
| `resync-all-calls` | Re-sync all data | ⚠️ MEDIUM RISK | **MIGRATE** |
| `delete-account` | Account deletion | ⚠️ HIGH RISK | **MIGRATE** |

**Migration Status:** ⚠️ **MIGRATE WITH CAUTION** (3 functions)

---

### 📤 SHARING & DELIVERY FUNCTIONS

| Function Name | Purpose | Tables Accessed | Priority |
|---------------|---------|-----------------|----------|
| `create-share-link` | Link sharing | `shared_links` | **MEDIUM** |
| `deliver-to-slack` | Slack integration | `agent_delivery_logs` | **LOW** |
| `upload-knowledge-file` | Knowledge base upload | `agent_knowledge_base` | **LOW** |

**Migration Status:** 📤 **MIGRATE IF USING FEATURE** (3 functions)

---

### ❌ MIGRATION TOOLKIT FUNCTIONS (Do NOT Migrate)

| Function Name | Purpose | Status |
|---------------|---------|--------|
| `test-env-vars` | Credential extraction | ❌ **DELETE** after migration |
| `get-credentials` | Credential access | ❌ **DELETE** after migration |
| `export-full-database` | Data export utility | ❌ **DELETE** after migration |
| `export-database-direct` | Direct database export | ❌ **DELETE** after migration |

**Migration Status:** ❌ **DO NOT MIGRATE** - Delete these security risks! (4 functions)

---

## 🎯 EDGE FUNCTION MIGRATION PLAN

### Priority 1: Critical Functions (Deploy First)
```bash
# Must be deployed immediately
supabase functions deploy fetch-meetings
supabase functions deploy sync-meetings
supabase functions deploy fetch-single-meeting
supabase functions deploy process-ai-jobs
supabase functions deploy webhook
supabase functions deploy fathom-oauth-callback
```

### Priority 2: OAuth & Configuration (Deploy Second)
```bash
supabase functions deploy test-fathom-connection
supabase functions deploy test-oauth-connection
supabase functions deploy create-fathom-webhook
supabase functions deploy save-fathom-key
supabase functions deploy fathom-oauth-refresh
supabase functions deploy fathom-oauth-url
supabase functions deploy save-webhook-secret
supabase functions deploy save-host-email
supabase functions deploy get-config-status
```

### Priority 3: Utilities & Testing (Deploy Third)
```bash
supabase functions deploy test-webhook
supabase functions deploy test-webhook-connection
supabase functions deploy test-webhook-endpoint
supabase functions deploy test-webhook-signature
supabase functions deploy process-call-ai
supabase functions deploy ai-analyze-transcripts
supabase functions deploy generate-call-title
supabase functions deploy auto-tag-call
supabase functions deploy enrich-speaker-emails
```

### Priority 4: Data Management (Deploy with Caution)
```bash
supabase functions deploy delete-all-calls
supabase functions deploy resync-all-calls
supabase functions deploy delete-account
```

### Priority 5: Optional Features
```bash
# Only if using these features
supabase functions deploy create-share-link
supabase functions deploy deliver-to-slack
supabase functions deploy upload-knowledge-file
```

---

## 🚨 SECURITY CLEANUP - DELETE THESE!

**After migration is complete, DELETE these security-risk functions from SOURCE:**

```bash
# From OLD Supabase (source)
cd your-project

# Remove credential-exposing functions
rm -rf supabase/functions/test-env-vars
rm -rf supabase/functions/get-credentials
rm -rf supabase/functions/export-full-database
rm -rf supabase/functions/export-database-direct

# Commit the deletion
git add .
git commit -m "security: remove credential-exposing functions after migration"
git push
```

**⚠️ CRITICAL:** These functions expose your service role key and database credentials!

---

## 🎯 FINAL MIGRATION PLAN

### Phase 1: Schema Migration
1. Push migrations to target: `supabase db push`
2. Verify schema matches source

### Phase 2: Data Migration (Recommended Approach)
**Migrate Core + Relationships (Option 2):**

```javascript
const tablesToMigrate = [
  // Core User Management
  'user_profiles',
  'user_roles',
  'user_settings',

  // Fathom Integration
  'fathom_calls',
  'fathom_transcripts',

  // Webhooks & Processing
  'webhook_deliveries',
  'processed_webhooks',
  'ai_processing_jobs',

  // Configuration
  'app_config',

  // Categorization
  'call_categories',
  'call_category_assignments',
  'speakers',
  'call_speakers',

  // Contacts (if used)
  'contacts',
  'contact_call_associations',
  'contact_tags',
  'contact_tag_assignments',

  // Tags (if used)
  'transcript_tags',
  'transcript_tag_assignments',

  // Other relationships
  'shared_links',
  'sync_jobs',
  'call_type_status_mapping'
];
```

### Phase 3: Edge Function Migration
1. Deploy all active edge functions to target
2. Update environment variables
3. Test each function
4. **DELETE `test-env-vars` function from source**

### Phase 4: Verification
1. Check row counts match in target
2. Test application functionality
3. Verify webhooks working
4. Test AI processing
5. Confirm OAuth flow

---

## 🗑️ POST-MIGRATION CLEANUP

### Tables to Consider Dropping (After Verification):

```sql
-- ONLY run these after confirming they're truly unused!

-- DROP TABLE IF EXISTS agent_delivery_logs CASCADE;
-- DROP TABLE IF EXISTS agent_knowledge_base CASCADE;
-- DROP TABLE IF EXISTS agent_runs CASCADE;
-- DROP TABLE IF EXISTS ai_agents CASCADE;
-- DROP TABLE IF EXISTS global_knowledge_base CASCADE;
-- DROP TABLE IF EXISTS intel_items CASCADE;
-- DROP TABLE IF EXISTS starter_agent_templates CASCADE;
```

**⚠️ WARNING:** Do NOT drop these tables until:
1. Migration is complete and verified
2. Application tested thoroughly in new environment
3. Data export backup saved
4. Confirm 100% these aren't used

---

## 📊 ESTIMATED MIGRATION TIME

| Phase | Estimated Time |
|-------|---------------|
| Schema migration (`supabase db push`) | 2-3 minutes |
| Data migration (22 tables) | 3-5 minutes |
| Edge function deployment | 2-3 minutes |
| Verification & testing | 5-10 minutes |
| **TOTAL** | **12-21 minutes** |

---

## 🚨 CRITICAL REMINDERS

1. **Backup First:** Export creates automatic backup file
2. **Test Target:** Verify schema is correct before data migration
3. **Delete test-env-vars:** Remove credential-exposing function after migration
4. **Update App Config:** Change environment variables to point to new Supabase
5. **Monitor First 24h:** Watch for errors in new environment

---

## 📈 SUMMARY STATISTICS

### Database Tables
- **Total Tables:** 29
- **Core/Critical:** 11 tables (38%)
- **Secondary/Relationships:** 11 tables (38%)
- **Likely Unused:** 7 tables (24%)

### Edge Functions
- **Total Functions:** 33
- **Critical (Must Migrate):** 6 functions (18%)
- **Supporting (Should Migrate):** 9 functions (27%)
- **Utilities (Review):** 9 functions (27%)
- **Data Management (Caution):** 3 functions (9%)
- **Optional Features:** 3 functions (9%)
- **Security Risks (DELETE):** 4 functions (12%)

### Migration Effort Estimate
- **Tables to Migrate:** 22 tables (recommended)
- **Edge Functions to Deploy:** 24+ functions
- **Total Time:** 12-21 minutes
- **Complexity:** Medium

---

## ✅ QUICK MIGRATION CHECKLIST

### Pre-Migration
- [ ] Review this audit document
- [ ] Decide which tables to migrate (recommend: Option 2 - 22 tables)
- [ ] Verify target Supabase project created
- [ ] Run `supabase db push` on target to sync schema
- [ ] Back up current database (automated-full-migration.js does this)

### Data Migration
- [ ] Run automated migration script with custom table list
- [ ] Verify row counts match between source and target
- [ ] Check export backup file created

### Edge Function Migration
- [ ] Deploy Priority 1 (Critical) functions
- [ ] Deploy Priority 2 (OAuth & Config) functions
- [ ] Deploy Priority 3 (Utilities) as needed
- [ ] Deploy Priority 4 (Data Management) carefully
- [ ] Deploy Priority 5 (Optional) only if using features
- [ ] Test each critical function after deployment

### Post-Migration
- [ ] Update application environment variables (VITE_SUPABASE_URL, etc.)
- [ ] Test application thoroughly in new environment
- [ ] Verify OAuth flow works
- [ ] Test webhook delivery
- [ ] Test AI processing
- [ ] Monitor for 24 hours for errors
- [ ] **DELETE security-risk functions from source**
- [ ] Consider dropping unused tables after verification

---

## 🎯 RECOMMENDED MIGRATION COMMAND

Based on this audit, here's the recommended table list for migration:

```bash
# Create custom migration script with this table list
cat > migrate-core-tables.js << 'EOF'
// Copy automated-full-migration.js and replace table discovery with:
const tablesToMigrate = [
  // Core User Management (3)
  'user_profiles',
  'user_roles',
  'user_settings',

  // Fathom Integration (2)
  'fathom_calls',
  'fathom_transcripts',

  // Webhooks & Processing (3)
  'webhook_deliveries',
  'processed_webhooks',
  'ai_processing_jobs',

  // Configuration (1)
  'app_config',

  // Categorization (4)
  'call_categories',
  'call_category_assignments',
  'speakers',
  'call_speakers',

  // Contacts (4)
  'contacts',
  'contact_call_associations',
  'contact_tags',
  'contact_tag_assignments',

  // Tags (2)
  'transcript_tags',
  'transcript_tag_assignments',

  // Other (3)
  'shared_links',
  'sync_jobs',
  'call_type_status_mapping'
];
// Total: 22 tables
EOF

# Then run the migration
SOURCE_URL="https://phfwibxcuavoqykrlcir.supabase.co" \
SOURCE_KEY="your-source-key" \
TARGET_URL="https://slpwswcrycartdxwqngs.supabase.co" \
TARGET_KEY="your-target-key" \
node migrate-core-tables.js
```

---

**Audit Created:** 2025-11-22
**Audited By:** Claude Code + Andrew Naegele
**Status:** ✅ Ready for migration planning
**Recommended Approach:** Option 2 (22 tables) + 24 edge functions
**Estimated Time:** 15-20 minutes total
