# Backup & Restore Runbook

**Last updated:** 2026-05-31
**Owner:** Andrew Naegele (Information Security Officer)
**Companion to:** [BCDR Policy (BCP-011)](../../.compliance/policies/11-business-continuity-and-dr-policy.md)
**Review cadence:** Annual + on each successful restore drill

---

## 1. Backup mechanism

CallVault relies on **Supabase managed backups** for the production Postgres database. Backup schedule and retention depend on the Supabase plan tier:

| Plan | Backup frequency | Retention |
|------|------------------|-----------|
| Free / Pro | Daily | 7 days |
| Team / Enterprise | Daily + PITR (Point-in-Time Recovery) up to 7-28 days | Plan-dependent |

Current CallVault plan: confirm in `.compliance/facts.yaml` and re-verify at each annual review.

Backups are managed entirely by Supabase. CallVault does not operate a separate offsite backup system.

## 2. Recovery objectives

- **RTO:** 4 hours for application-level issues; **24 hours** for full database restore
- **RPO:** 24 hours (bounded by Supabase daily backup cadence)

## 3. Restore procedure — Supabase dashboard

When a restore is required:

1. **Authorize the restore.** A restore-from-backup is a customer-data-affecting action. The Information Security Officer documents the decision in `.compliance/evidence/{YYYY-MM-DD}/restore-decision.md` before proceeding, including:
   - Trigger (incident ID, data loss event, drill)
   - Target backup timestamp
   - Customer-data implications (any deletions that will be reversed)
   - Customer notification plan if reversing customer-initiated deletions

2. **Navigate to backups.** `https://supabase.com/dashboard/project/<project-ref>/database/backups`

3. **Select the target backup.** Supabase shows daily backups in retention. Pick the most recent backup BEFORE the data-loss event.

4. **Initiate restore.** Click "Restore" on the selected backup. Supabase will prompt to confirm because restore replaces the current database state.

5. **Monitor restore progress.** Supabase dashboard shows status. Expect ~5-30 minutes for typical CallVault data volume.

6. **Verify integrity post-restore.** Run sanity checks:
   - User can log in
   - At least one known organization, workspace, call, and transcript visible
   - MCP tool call against a known-good org succeeds (use `list_workspaces` as smoke test)

7. **Post-restore actions.**
   - Capture screenshots into the Evidence Vault under `.compliance/evidence/{YYYY-MM-DD}/restore/`
   - If the restore reverses customer-initiated deletions, follow the customer-notification path in BCDR Policy §7
   - File a post-mortem if the restore was triggered by an incident (Incident Response Plan §6.7)

## 4. Restore procedure — Point-in-Time Recovery (PITR, paid plans)

If PITR is available on the current plan:

1. Same authorization step as Section 3.1
2. Navigate to backups → PITR
3. Specify the target timestamp (down to the minute)
4. Supabase clones the project to a new database at that point in time
5. Migrate the application to point at the cloned database (update Vercel environment variables)
6. Run the same integrity checks as Section 3.6

PITR is preferred over full-backup restore when the data loss event has a known precise timestamp.

## 5. Restore drill

A restore drill is performed **at least annually** to verify the restore process actually works.

### 5.1 Drill procedure

1. Create a non-production Supabase project (Free tier is sufficient for drill purposes)
2. Pull the most recent production backup file (Supabase paid plans allow download; Free tier requires using the dashboard restore-into-new-project flow)
3. Restore the backup into the drill project
4. Verify:
   - Table count matches production schema
   - At least one row queryable from `calls`, `transcripts`, `contacts`
   - Migrations apply cleanly to the restored database
   - A representative MCP tool call against the restored project returns expected data
5. Capture evidence in `.compliance/evidence/{YYYY-MM-DD}/restore-drill/`:
   - Screenshots of restore initiation + completion
   - SQL query output showing row counts in major tables
   - Output of the MCP tool call

### 5.2 Drill history

| Date | Outcome | Evidence path | Notes |
|------|---------|---------------|-------|
| Pre-2026-05-29 | Successful | not captured at the time | Andrew self-reported in Phase B interview |
| _Next drill_ | scheduled | _to be filled_ | Target: within 12 months of 2026-05-29 |

## 6. Backup verification

**Daily** — verify the most recent backup ran successfully by checking the Supabase dashboard backups view. Successful backups appear in the list with their timestamp.

**Quarterly** — at each quarterly access review, the Information Security Officer confirms:
- Most recent backup is within the last 24 hours
- Backup retention matches the documented plan tier
- Restore drill is scheduled or recently completed

## 7. Edge cases

### 7.1 Suspected backup corruption

If a backup appears corrupt or the restore fails:
- Try the next-most-recent backup
- Open a Supabase support ticket immediately
- Treat as a SEV-1 incident per the Incident Response Plan
- Notify customers if the corruption window overlaps a known data-loss event

### 7.2 Restore that reverses customer deletions

Per Data Retention & Deletion Policy §6 and BCDR Policy §5: restoring a backup that re-introduces customer-initiated-deleted data is itself a customer-affecting event. Notification follows the Incident Response Plan if any customer's deletion is reversed.

### 7.3 Restore to a different region

Not currently supported (single-region CallVault Supabase project per RISK-006). If region failover becomes a requirement, this runbook will be updated.

## 8. Related documents

- BCDR Policy: `.compliance/policies/11-business-continuity-and-dr-policy.md`
- Incident Response Plan: `.compliance/policies/05-incident-response-plan.md`
- Data Retention & Deletion Policy: `.compliance/policies/04-data-retention-and-deletion-policy.md`
- Risk Register: `.compliance/risk-register.yaml` (RISK-001 bus factor, RISK-006 single region)

## 9. Change history

| Date | Author | Change |
|------|--------|--------|
| 2026-05-31 | Claude under Andrew's direction | Initial authored version |
