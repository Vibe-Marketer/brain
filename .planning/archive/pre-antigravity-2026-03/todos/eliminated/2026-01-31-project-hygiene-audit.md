---
created: 2026-01-31T12:00
title: Project Hygiene Audit - Full codebase/folder/docs cleanup
area: infrastructure
files:
  - .serena/ (abandoned Serena tooling?)
  - .vercel/ (Vercel config - needed?)
  - .vscode/ (VS Code settings - review)
  - .worktrees/ (git worktrees - in use?)
  - autoclaude/ (legacy Claude config?)
  - ralph/ (Ralph tooling - still needed?)
  - docs/ (documentation - validate/archive)
  - .planning/ (old plans/decisions - migrate to GSD or archive)
---

## Problem

The codebase has accumulated various configuration folders, abandoned tools, outdated documentation, and legacy planning artifacts that need to be audited and cleaned up. This includes:

1. **System/Config Folders**: `.serena`, `.vercel`, `.vscode`, `.worktrees`, `autoclaude`, `ralph` - need to determine if still necessary or can be removed/archived

2. **Documentation**: Validate docs are current, archive outdated content, ensure alignment with GSD framework

3. **Planning Artifacts**: Old plans, outdated decisions, abandoned ideas in various locations need to be either:
   - Migrated to GSD framework (`.planning/` structure)
   - Documented as todos if still relevant
   - Archived/deleted if obsolete

4. **Database Migrations**: Review for abandoned/outdated migrations that never ran or are no longer relevant

**NOT IN SCOPE**: The `/specs` folder should NOT be touched.

## Solution

Create a dedicated plan (Phase 6.5 or standalone) that:

1. **Inventories** all system folders, config files, and documentation
2. **Classifies** each as: keep, archive, delete, or migrate-to-GSD
3. **Traces references** before deletion (don't break anything)
4. **Documents** significant removals in ADRs
5. **Updates CHANGELOG** for removed functionality
6. **Cleans up Supabase dashboard** for any removed Edge Functions

This is a comprehensive project hygiene effort that goes beyond the code-focused Phase 6 requirements. Should be done after Phase 6 code health is complete to ensure a fully clean codebase.

## Context from Discussion

User explicitly requested this during Phase 6 context discussion. They want:
- Full audit of codebase folders, not just code
- Review of tooling remnants (serena, autoclaude, ralph)
- Validation of docs/plans against GSD framework
- Proper archival/deletion with documentation
- CHANGELOG entries for significant removals
