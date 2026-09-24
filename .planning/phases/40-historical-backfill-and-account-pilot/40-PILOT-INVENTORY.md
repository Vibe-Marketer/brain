# Clickable Impact: read-only pilot inventory

Observed 2026-09-24T05:51:46.599Z. Production backend exact ref checked. Saved-login identity matched exactly once across a bounded complete Auth inventory; selected organization matched exactly once among that user's owner memberships. No identifiers, addresses, titles, transcript contents, or credentials retained here.

## Recording inventory

- recordings: 249
- operatorOwned: 38
- linked: 0
- unlinked: 249
- validStart: 249
- validOrderedInterval: 200
- positiveDuration: 56

## Source distribution

- fathom: 247
- other: 1
- fireflies: 1

## Evidence availability (counts only)

- Recordings with non-null source metadata: 249
- Recordings with non-null full transcript: 249
- Recordings with non-null transcript segments: 219
- Participant rows for scoped recordings: 924
- Participant rows with non-null email: 919
- Participant rows linked to identity: 0
- Participant rows with confirmed speech: 0
- Transcript chunk rows linked through canonical UUIDs: 0

## Limits and next steps

This was a GET/HEAD-only inventory; it performed no DB mutations, source resolver invocations, feature-flag changes, or provider messages. Source records remained unchanged. Queries were sequential and not a transaction snapshot, so concurrent customer imports could cause count drift. Non-null evidence does not prove nonempty, valid, matching, or sufficient evidence. Chunk count is not recording coverage; legacy numeric-only chunk links are excluded and need the established UUID/BIGINT mapping for follow-up. Other-member-owned recordings are not authorized for an operator-only apply merely by org ownership.

Source review: current runShadowSweep is a proposal-writing routine, so it was deliberately not invoked by this read-only inventory. Deterministic extraction currently supports Zoom occurrence UUID metadata only; other provider metadata and reusable meeting IDs must not authorize historical merges.

Next: build the Phase40 bounded dry-run and executable plan with exact per-recording coverage, evidence validation, singleton/unmatched outcomes, input-drift rejection, explicit owner/content access boundaries, rollback and audit, notification silence, and real TEST proof. Inspect existing decisions and scheduler activation separately. This report neither proposes particular merges nor authorizes application. Phase39 email gate and final main-release approval remain in force.
