---
created: 2026-05-31T17:03:26.456Z
title: Resync updated Fathom call metadata
area: api
files:
  - supabase/functions/sync-meetings/index.ts
  - supabase/functions/_shared/connector-pipeline.ts
  - src/services/sync-tab.service.ts
---

## Problem

If a call changes upstream in Fathom after the original import, CallVault needs a reliable resync/update path instead of treating the call as permanently done. Examples include Fathom title edits, duration/length changes, transcript or metadata corrections, and other provider-side updates that should reconcile into the canonical CallVault recording without duplicating the call or losing workspace/source identity.

This matters after Phase 05 because connector imports now bind to future landing workspaces and SyncTab reads canonical `recordings`; a Fathom re-sync should update the existing canonical row and related metadata through the same ID-safe boundaries, not create a second record or silently ignore upstream edits.

## Solution

Audit the Fathom sync/import path and shared connector pipeline for idempotent upsert behavior. Ensure the provider external ID maps to the existing canonical recording, then update safe mutable fields such as title, duration/length, transcript metadata, source URL data, timestamps, and sync status while preserving CallVault-owned fields, workspace entries, tags, folders, and manual edits that should not be overwritten.

Add targeted tests for a changed Fathom call re-syncing into an existing CallVault recording. Tests should verify no duplicate recording is created, `toRecordingUuid()` / `toRecordingUuidBatch()` boundaries remain respected, `resolveShareUrl()` remains the share URL source, and SyncTab shows the updated canonical data after the re-sync.
