# Phase 18: Source Attribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 18-source-attribution
**Areas discussed:** Source taxonomy and labels, legacy backfill behavior, AdminTab source surface, per-source metrics

---

## Todo Folding

| Option | Description | Selected |
|--------|-------------|----------|
| Apply 15-min compliance posture fixes | Low-score match; likely unrelated to source attribution. | |
| Resync updated Fathom call metadata | Low-score match caused by `src` keyword; likely unrelated. | |
| Fold neither | Keep both todos out of Phase 18. | ✓ |

**User's choice:** Fold neither.
**Notes:** Both matches were reviewed and explicitly excluded from Phase 18 scope.

---

## Source Taxonomy and Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-English operator labels | Keep labels easy to understand and avoid raw enum names. | ✓ |
| Raw/source-code labels | Show exact source names like `in_app_user`, `sentry`, `nightly_qa`, `internal`. | |
| Agent discretion | Let the planner choose labels. | |

**User's choice:** Operator-facing labels stay plain-English and easy to understand.
**Notes:** CONTEXT.md captures this as a binding UI-label decision while leaving exact enum names to the planner.

---

## Legacy Backfill Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Aggressive legacy rewrite | Reclassify old rows to new values wherever possible. | |
| Preserve reported-by wording | Do not spend effort on backfill; leave existing manual/reporting presentation natural. | ✓ |
| Agent discretion | Let the planner decide how much backfill is worth doing. | |

**User's choice:** Backfill is not necessary; leave existing rows as "reported by."
**Notes:** Roadmap still requires safe handling for uncertain rows, so CONTEXT.md preserves `unknown` as a safe value without requiring a broad historical rewrite.

---

## AdminTab Source Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Group by source with summary | Add source grouping and source summary if it is easy on the existing surface. | ✓ |
| Simple filter only | Keep to the existing source filter/column if grouping becomes expensive. | ✓ |
| New admin page | Build a separate source-attribution page. | |

**User's choice:** Group by source with source summary if easy; if that takes a lot, keep it simple and just make it a filter.
**Notes:** The implementation should bias toward existing Admin Center Tickets UI and avoid a new top-level surface.

---

## Per-Source Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard only | Put per-source metrics only on the Admin Center dashboard. | |
| Tickets page only | Put per-source metrics only next to ticket filters/list. | |
| Both | Show metrics in both Dashboard and Tickets context. | ✓ |

**User's choice:** Both.
**Notes:** Metrics are volume, fix rate, and cycle time per origin. Survival/autonomy metrics stay in Phase 19.

---

## Claude's Discretion

- Exact enum naming and compatibility strategy.
- Exact source grouping layout.
- Whether grouping is worth implementing or should fall back to a simpler filter-only path.
- Whether metrics are computed client-side from bounded queries or through a dedicated SQL/RPC path.

## Deferred Ideas

- Nightly QA ingestion and flake handling remain Phase 20.
- Sentry debug/fix/resolve remain Phase 21.
- Reporter comms remain Phase 23.
- Survival/autonomy/canary metrics remain Phase 19.
