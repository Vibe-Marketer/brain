# TODO: Call Detail Pane Architecture (Deferred)

Date: 2026-02-10
Status: Deferred by request

## Context

- Keep `/call/:callId` in its current location and experience for now.
- Do not migrate it into a new pane architecture in this pass.

## Deferred Work

1. Decide whether call detail should be:
   - a standalone full page,
   - a 3rd-pane detail view,
   - or a 4th-pane slide-in from an existing list context.
2. Map required 2nd-pane + 4th-pane interactions before implementation.
3. Reuse existing pane patterns/components where possible; avoid net-new layout primitives.
4. Validate route semantics and deep-link behavior for the final pattern.

## Acceptance Criteria (future)

- Consistent with AppShell pane behavior.
- No duplicate UI paradigms for call detail.
- Preserves user ability to deep-link directly to a call.
