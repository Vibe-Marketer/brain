# Phase 20 — Deferred review follow-ups (non-blocking)

Independent review (Claude) verdict: SHIP. 2 High fixes APPLIED (High-1 per-report fingerprint dedup; High-2 ingest_qa_ticket defense-in-depth: rejects high/critical + never demotes qa_review). Remaining mediums deferred:

- **Med-1 — Cross-source fingerprint collision.** QA and Sentry share `idx_tickets_fingerprint_unique`. A QA fingerprint that collides with a Sentry one could mis-attribute. Fix: namespace QA fingerprints (prefix `qa:`). DEFERRED — changing the dedup space now would orphan already-ingested QA rows; do as a deliberate migration with backfill (candidate Phase 22 recurrence work, which already clusters on fingerprint).
- **Med-2 — `select("*")` on qa_findings** pulls full `context` JSONB (app_url, selectors, repro stderr tails) to the admin browser. Admin-gated so not a leak; narrow the select to rendered columns. DEFERRED — minor hardening.
- **Low — `--repro-reruns 0`** would vacuously pass (every() on empty array); nightly hardcodes 2. Floor should be ≥1 for repro-reruns specifically. DEFERRED.
