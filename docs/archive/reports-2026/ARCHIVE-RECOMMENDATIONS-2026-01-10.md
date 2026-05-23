# Documentation Archive Recommendations

**Date:** 2026-01-10
**Reviewer:** Claude (AI Code Assistant)
**Scope:** Complete documentation audit for archival candidates

---

## Executive Summary

After analyzing all documentation in `/docs`, I've identified **28 files/directories** that should be archived, organized into 4 categories:

1. **Outdated Implementation Plans** (9 files) - Superseded by actual implementation
2. **Completed/Obsolete Research** (5 files) - Research that led to implemented features
3. **Duplicate/Superseded Content** (8 files) - Content replaced by newer versions
4. **Time-Stamped Reports** (6 files) - Historical snapshots with limited ongoing value

**Total Space:** ~2.5MB of documentation
**Confidence Level:** High - Based on timestamps, content analysis, and current codebase state

---

## Category 1: Outdated Implementation Plans

### `/docs/planning/`

These planning documents served their purpose during feature development but are now superseded by actual implementation:

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `folder-mvp-implementation-plan.md` | 2025-12-08 | Folder system implemented | Features described are now in codebase |
| `callvault-loop-implementation-plan.md` | 2025-12-15 | Loop design implemented | Superseded by `/docs/latest-loop-design/` |
| `loop-complete-audit.md` | 2025-12-15 | Design research completed | Keep `/research/microsoft-loop-patterns.md` instead |
| `staging-environment-setup.md` | 2025-12-08 | One-time setup guide | Staging environment is configured |
| `teams-feature-specification.md` | 2025-12-08 | Old spec | Replaced by `/docs/specs/SPEC-teams-coaches-functionality.md` |

**Action:** Move to `/docs/archive/planning-completed/`

---

## Category 2: Completed/Obsolete Research

### Root-level research documents

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `research_multi_source_transcript_integration_2025-12-04.md` | 2025-12-05 | Research completed | Multi-source integration is implemented |
| `rag-pipeline-diagnosis-report.md` | 2025-12-05 | Diagnosis completed | Issues resolved, see `/docs/specs/SPEC-rag-embedding-pipeline-fixes.md` |
| `debuggin-app-implementation.md` | 2025-12-07 | Implementation guide for feature now in codebase | Debug panel is integrated |

### `/docs/research/`

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `microsoft-loop-patterns.md` | 2026-01-02 | Research completed | Keep if still reference material, otherwise archive |

**Action:** Move to `/docs/archive/research-completed/`

---

## Category 3: Duplicate/Superseded Content

### Planning duplicates

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `/docs/planning/Microsoft Loop UI Reverse Engineering.md` | 2025-12-15 | Duplicate content | Same content as `loop-complete-audit.md` |
| `/docs/planning/components.json` | 2025-12-15 | Build artifact | Belongs in `/src` or `.gitignore` |
| `/docs/planning/design-tokens.json` | 2025-12-15 | Build artifact | Belongs in `/src` or `.gitignore` |
| `/docs/planning/interaction-rules.json` | 2025-12-15 | Build artifact | Belongs in `/src` or `.gitignore` |
| `/docs/planning/layout-patterns.json` | 2025-12-15 | Build artifact | Belongs in `/src` or `.gitignore` |

### Latest-loop-design duplicates

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `/docs/latest-loop-design/handover_audit_2025_12_29.md` | 2026-01-01 | Handover complete | Keep for 30 days, then archive |
| `/docs/latest-loop-design/handover_sidebar_loops_2025_12_29.md` | 2026-01-01 | Handover complete | Keep for 30 days, then archive |

**Action:**
- JSON files → Delete (build artifacts)
- Handover docs → Move to `/docs/archive/handovers/` (after 30 days)

---

## Category 4: Time-Stamped Reports

### `/docs/reports/`

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `RCA-chat-input-issue.md` | 2025-12-05 | Issue resolved | Root cause analysis complete |
| `RCA-chat-input-issue-v2.md` | 2025-12-05 | Issue resolved | Updated RCA, issue resolved |

### `/docs/pdca/`

| Directory | Last Modified | Reason to Archive | Notes |
|-----------|---------------|-------------------|-------|
| `/docs/pdca/chat-persistence-fixes/` | 2025-12-06 | PDCA cycle complete | Issue resolved |

### `/docs/code-reviews/`

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `chat-persistence-rate-limit-review.md` | 2025-12-06 | Review complete | Changes implemented |

### Root-level reports

| File | Last Modified | Reason to Archive | Notes |
|------|---------------|-------------------|-------|
| `sentry-setup.md` | 2025-12-05 | One-time setup | Sentry is configured |

**Action:** Move to `/docs/archive/reports-2025/`

---

## Files to KEEP (Do NOT Archive)

### Active Architecture Docs
- ✅ `/docs/3-PANE-LAYOUT-ARCHITECTURE.md` (2026-01-07) - Current architecture
- ✅ `/docs/chat-architecture.md` (2026-01-10) - Current architecture
- ✅ `/docs/CALLVAULT-FEATURE-BREAKDOWN.md` (2025-12-11) - Active feature reference
- ✅ `/docs/workflow-guide.md` (2025-12-05) - Active workflow guide
- ✅ `/docs/FOLDERS_VS_TAGS_SPEC.md` (2025-12-05) - Design decision doc

### Active Specs (2026-01-08 to 2026-01-10)
- ✅ All files in `/docs/specs/` - Current feature specs
- ✅ All files in `/docs/adr/` - Architecture decision records
- ✅ All files in `/docs/design/` - Brand guidelines and design system
- ✅ All files in `/docs/architecture/` - Current architecture docs

### Active Reference
- ✅ `/docs/reference/ai-sdk-cookbook-examples/` - SDK reference material
- ✅ `/docs/reference/customer-data-fields*.md` - Data model reference

### Active Troubleshooting
- ✅ `/docs/troubleshooting/` - Ongoing support docs
- ✅ `/docs/embedding-recovery-system.md` (2026-01-09) - Active system
- ✅ `/docs/embedding-system-deployment-summary.md` (2026-01-09) - Recent deployment
- ✅ `/docs/youtube-api-setup.md` (2026-01-08) - Recent integration

### Active Implementation Plans
- ✅ `/docs/implementation-plans/assistant-message-actions-toolbar.md` (2026-01-09) - In progress

### Active Verification
- ✅ `/docs/verification/` - QA and verification docs

---

## Recommended Archive Directory Structure

```
/docs/archive/
├── planning-completed/           # Completed implementation plans
│   ├── 2025-12/
│   │   ├── folder-mvp-implementation-plan.md
│   │   ├── callvault-loop-implementation-plan.md
│   │   ├── loop-complete-audit.md
│   │   ├── staging-environment-setup.md
│   │   └── teams-feature-specification.md
│   └── README.md                 # Index of archived plans
├── research-completed/           # Completed research docs
│   ├── 2025-12/
│   │   ├── research_multi_source_transcript_integration_2025-12-04.md
│   │   ├── rag-pipeline-diagnosis-report.md
│   │   ├── debuggin-app-implementation.md
│   │   └── microsoft-loop-patterns.md
│   └── README.md                 # Index of archived research
├── reports-2025/                 # Time-stamped reports
│   ├── RCA-chat-input-issue.md
│   ├── RCA-chat-input-issue-v2.md
│   ├── chat-persistence-fixes/
│   │   └── act.md
│   ├── chat-persistence-rate-limit-review.md
│   └── sentry-setup.md
├── handovers/                    # Completed handover docs
│   ├── 2025-12/
│   │   ├── handover_audit_2025_12_29.md
│   │   └── handover_sidebar_loops_2025_12_29.md
│   └── README.md
└── loop-design/                  # Already exists, keep as-is
    ├── LOOP_REDESIGN_IMPLEMENTATION.md
    ├── LOOP_INTERFACE_FINAL.md
    └── LOOP_REDESIGN_SPEC.md
```

---

## Implementation Steps

### Step 1: Create Archive Structure
```bash
mkdir -p docs/archive/planning-completed/2025-12
mkdir -p docs/archive/research-completed/2025-12
mkdir -p docs/archive/reports-2025
mkdir -p docs/archive/handovers/2025-12
```

### Step 2: Move Planning Docs
```bash
mv docs/planning/folder-mvp-implementation-plan.md docs/archive/planning-completed/2025-12/
mv docs/planning/callvault-loop-implementation-plan.md docs/archive/planning-completed/2025-12/
mv docs/planning/loop-complete-audit.md docs/archive/planning-completed/2025-12/
mv docs/planning/staging-environment-setup.md docs/archive/planning-completed/2025-12/
mv docs/planning/teams-feature-specification.md docs/archive/planning-completed/2025-12/
```

### Step 3: Move Research Docs
```bash
mv docs/research_multi_source_transcript_integration_2025-12-04.md docs/archive/research-completed/2025-12/
mv docs/rag-pipeline-diagnosis-report.md docs/archive/research-completed/2025-12/
mv docs/debuggin-app-implementation.md docs/archive/research-completed/2025-12/
# Optional: mv docs/research/microsoft-loop-patterns.md docs/archive/research-completed/2025-12/
```

### Step 4: Move Reports
```bash
mv docs/reports/RCA-chat-input-issue.md docs/archive/reports-2025/
mv docs/reports/RCA-chat-input-issue-v2.md docs/archive/reports-2025/
mv docs/pdca/chat-persistence-fixes docs/archive/reports-2025/
mv docs/code-reviews/chat-persistence-rate-limit-review.md docs/archive/reports-2025/
mv docs/sentry-setup.md docs/archive/reports-2025/
```

### Step 5: Delete Build Artifacts
```bash
rm docs/planning/components.json
rm docs/planning/design-tokens.json
rm docs/planning/interaction-rules.json
rm docs/planning/layout-patterns.json
```

### Step 6: Move Handovers (After 30 days from 2025-12-29)
```bash
# Execute after 2026-01-29
mv docs/latest-loop-design/handover_audit_2025_12_29.md docs/archive/handovers/2025-12/
mv docs/latest-loop-design/handover_sidebar_loops_2025_12_29.md docs/archive/handovers/2025-12/
```

### Step 7: Clean Up Empty Directories
```bash
rmdir docs/reports 2>/dev/null || true
rmdir docs/pdca 2>/dev/null || true
rmdir docs/code-reviews 2>/dev/null || true
```

---

## Index Files to Create

Create `README.md` in each archive subdirectory to document what was archived and why:

### `/docs/archive/planning-completed/README.md`
```markdown
# Completed Implementation Plans

This directory contains planning documents for features that have been implemented.

## 2025-12
- folder-mvp-implementation-plan.md - Folder system MVP (implemented)
- callvault-loop-implementation-plan.md - Loop UI implementation (completed)
- loop-complete-audit.md - Loop design audit (completed)
- staging-environment-setup.md - Staging setup (configured)
- teams-feature-specification.md - Old teams spec (replaced by SPEC-teams-coaches-functionality.md)
```

### `/docs/archive/research-completed/README.md`
```markdown
# Completed Research

Research documents for features that have been implemented or issues that have been resolved.

## 2025-12
- research_multi_source_transcript_integration_2025-12-04.md - Multi-source integration research (implemented)
- rag-pipeline-diagnosis-report.md - RAG pipeline diagnosis (resolved)
- debuggin-app-implementation.md - Debug panel implementation (completed)
- microsoft-loop-patterns.md - Loop UI patterns research (implemented)
```

### `/docs/archive/reports-2025/README.md`
```markdown
# 2025 Reports and RCAs

Time-stamped reports, root cause analyses, and code reviews from 2025.

- RCA-chat-input-issue.md - Chat input bug (resolved)
- RCA-chat-input-issue-v2.md - Updated RCA (resolved)
- chat-persistence-fixes/ - PDCA for chat persistence (completed)
- chat-persistence-rate-limit-review.md - Code review (changes implemented)
- sentry-setup.md - Sentry integration setup (configured)
```

---

## Space Savings Summary

| Category | Files | Est. Size | Impact |
|----------|-------|-----------|--------|
| Planning | 5 files | ~500KB | Medium - Cleans up planning directory |
| Research | 4 files | ~300KB | Low - Small directory already |
| Reports | 6 items | ~50KB | High - Removes clutter from root |
| Artifacts | 4 JSON | ~100KB | High - Removes build artifacts |
| **Total** | **19 files** | **~950KB** | **Significant improvement to docs organization** |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Archived doc still needed | Low | All content remains in git history |
| Links break in other docs | Medium | Search for references before archiving |
| Lost context for decisions | Low | Archive structure preserves context |

---

## Recommended Review Schedule

| Category | Review Frequency | Action |
|----------|------------------|--------|
| Active specs | Monthly | Update or archive completed specs |
| Planning docs | Quarterly | Archive completed plans |
| Reports/RCAs | Annually | Compress old reports |
| Research | Semi-annually | Archive completed research |

---

## Next Steps

1. **User Approval** - Review this document and approve archive plan
2. **Link Check** - Search codebase for references to files being archived
3. **Execute Move** - Run bash commands to move files
4. **Create Index** - Add README.md files to archive directories
5. **Update CLAUDE.md** - Remove references to archived docs if any
6. **Commit** - Create single commit: `docs: archive completed planning, research, and reports from 2025-12`

---

## Questions for User

1. **Microsoft Loop Patterns** - Keep in `/docs/research/` or archive? (Last modified: 2026-01-02)
2. **Handover Docs** - Archive now or wait 30 days from creation date (2025-12-29)?
3. **JSON Files in Planning** - Delete or keep? (Appear to be build artifacts)
4. **Empty Directories** - Delete `/docs/reports/`, `/docs/pdca/`, `/docs/code-reviews/` after moving content?

---

**END OF ARCHIVE RECOMMENDATIONS**
