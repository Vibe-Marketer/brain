-- Migration: Add in_app_user to ticket_source enum
-- Purpose: RSP-01 / D-00 — establish the source-attribution gate substrate that
--          every Phase 23 comms path depends on. Customer comms fire ONLY for
--          source='in_app_user' and fail closed for everything else, so this
--          value must exist in the DB enum (and downstream generated types)
--          BEFORE any comms trigger or hook can reference it.
--          Append-only: existing values (manual/sentry/unknown/nightly_qa/internal)
--          are untouched. No backfill of historical 'manual' rows — D-00 requires
--          fail-closed; ambiguous 'manual' rows must stay customer-silent.
-- Author: Phase 23 Plan 01 (reporter comms — source gate)
-- Date: 2026-06-14

ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'in_app_user';
