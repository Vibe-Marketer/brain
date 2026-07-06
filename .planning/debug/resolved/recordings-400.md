---
status: investigating
trigger: "recordings-400: 400 on `recordings` — auto-crawl captured this request failing on 3 route(s) (/, /transcripts, /import)."
created: 2026-06-28T13:29:17.565Z
updated: 2026-06-28T13:29:17.565Z
source: auto-crawl
evidence_run: ~/dev/auto-crawl/runs/crawl-2026-06-28T08-01-39-170Z
---

## Current Focus

hypothesis: UNINVESTIGATED — seeded by auto-crawl from machine-captured evidence. Root cause not yet determined.
test: trace where the app issues `recordings` and why it returns 400
expecting: a missing table/column, wrong query syntax, or stale schema cache
next_action: investigate the request origin in src/ (services/hooks) and the Supabase schema

## Symptoms

expected: `recordings` request should succeed (2xx)
actual: returns **400** on every load of the affected route(s)
errors: (captured at network layer; no console error correlated)
reproduction: Log in → visit / → request fires on load → 400. Affected routes: /, /transcripts, /import
started: detected by auto-crawl on 2026-06-28 (not bisected)

## Eliminated

(none yet — fresh capture)

## Evidence

- timestamp: 2026-06-28T13:29:17.565Z
  checked: auto-crawl network capture (cmux WebKit, fetch/XHR shim)
  found: 400 https://vltmrnjsubfzrgrtdqey.supabase.co/rest/v1/recordings?select=id%2Clegacy_recording_id%2Corganization_id%2Cowner_user_id%2Ctitle%2Csummary%2Cglobal_tags%2Csource_app%2Csource_metadata%2Cduration%2Crecording_start_time%2Crecording_end_time%2Ccreated_at%2Csynced_at&order=created_at.desc&organization_id=eq.04714fb3-d42c-42ad-801a-a8a49df6d06f&offset=0&limit=20
  implication: the app depends on this endpoint; it fails on every affected page load
- timestamp: 2026-06-28T13:29:17.565Z
  checked: auto-crawl artifacts
  found: screenshot + raw console + network json at ~/dev/auto-crawl/runs/crawl-2026-06-28T08-01-39-170Z/home-transcripts
  implication: full evidence preserved for replay

## Resolution

root_cause: (pending investigation)
fix: (pending)
verification: (pending)
files_changed: []
