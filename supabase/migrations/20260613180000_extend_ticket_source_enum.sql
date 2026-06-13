-- Migration: Extend ticket_source enum
-- Purpose: SRC-01 — append source attribution values before any migration or
--          code path references them. Keep this file enum-only because
--          Postgres enum values must be committed before later statements use
--          them safely.
-- Author: Phase 18 Plan 01 (source attribution)
-- Date: 2026-06-13

ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'unknown';
ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'nightly_qa';
ALTER TYPE public.ticket_source ADD VALUE IF NOT EXISTS 'internal';
