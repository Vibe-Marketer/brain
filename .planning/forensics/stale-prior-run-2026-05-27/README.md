# Stale Prior-Run Artifacts - 2026-05-27

These files were moved out of active phase directories because they caused GSD
to classify phases as planned/executed even though the workflow is being reset
to start fresh from Phase 1.

The artifacts are preserved for forensic reference only. They are not active
context, planning, execution, summary, verification, or learnings records.

Active Phase 1 records after reset:
- `.planning/phases/01-paste-pipeline-polish/01-CONTEXT.md`
- `.planning/phases/01-paste-pipeline-polish/01-DISCUSSION-LOG.md`
- `.planning/phases/01-paste-pipeline-polish/01-RESEARCH.md`
- `.planning/phases/01-paste-pipeline-polish/01-VALIDATION.md`

Phase 2 and Phase 3 context files were also archived because they came from the
same prior run. Phase 2 explicitly skipped discussion, so it must not seed the
fresh phase workflow.
