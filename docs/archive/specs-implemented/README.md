# Implemented Specifications

This directory contains specification documents for features that have been fully implemented.

## 2026-01

| Spec | Archived Date | Implementation Date | Related Commits/PRs | Notes |
|------|---------------|---------------------|---------------------|-------|
| `SPEC-table-ui-repair.md` | 2026-01-10 | 2026-01-08 | Multiple commits fixing table styling across CoachesTab, FoldersTab, TagsTab, UserTable, AccessLogViewer | Table styling now consistent with brand guidelines |
| `SPEC-teams-coaches-functionality.md` | 2026-01-10 | ~2025-12 | Merge commit `013-implement-teams-coaches-navigation-and-functionali` | Teams and coaches features implemented |
| `SPEC-rag-embedding-pipeline-fixes.md` | 2026-01-10 | ~2025-12 | Merge commits `014-complete-semantic-search-rag`, `012-repair-hybrid-search-function-missing` | RAG pipeline and hybrid search fully operational |
| `SPEC-icons-and-nav-state.md` | 2026-01-10 | ~2025-12 | Loop-style navigation implemented in `sidebar-nav.tsx` | Remix Icons with line/fill variants, Loop-style selection states |

---

## Active Specs (Not Archived)

The following specs remain in `/docs/specs/` as they are still in progress or draft:

- `SPEC-assistant-message-actions-toolbar.md` - In progress (has GAPS file)
- `SPEC-assistant-message-actions-toolbar-GAPS.md` - Active gaps analysis
- `SPEC-collaboration-navigation-restructure.md` - Recent (2026-01-10), in planning
- `SPEC-content-engine.md` - Draft status
- `SPEC-sharing-and-access-control.md` - In progress
- `SPEC-ui-standardization-analytics-relocation.md` - Recent (2026-01-10), in progress
- `social-agents.md` - Recent (2026-01-10), in planning

---

## Archive Policy

**When to Archive a Spec:**
1. Feature is fully implemented and merged to main
2. All acceptance criteria met
3. No outstanding issues or gaps
4. Implementation has been verified and is stable

**When NOT to Archive:**
- Spec is in draft status
- Feature is partially implemented
- Active GAPS analysis exists
- Implementation is undergoing iteration

**Retention:** Indefinite (preserved in git history)
**Value:** Historical reference for design decisions, future feature enhancements, onboarding

---

**Note:** Archived specs may still be valuable for understanding why features were built a certain way. Always check git history for the full context.
