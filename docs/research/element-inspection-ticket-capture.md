# Research: Element Inspection for Ticket Submission

**Status:** Research — not a spec, not scheduled for build
**Last Updated:** 2026-07-30
**Author:** Research pass (Claude, ticket 3f1c0610-0aaa-4e92-bf45-7c28c60a590d)
**Location note:** `docs/research/` is a new folder — `docs/CLAUDE.md` defines conventions for `docs/specs/`, `docs/adr/`, and brand guidelines, but has no dedicated section for research docs yet. This file borrows the SPEC template's structure where useful and otherwise stays freeform. If this becomes a build, promote the relevant sections into a real `docs/specs/SPEC-element-inspection.md`.

---

## Executive Summary

CallVault's ticket flow already auto-captures a screenshot, a bounded console-log buffer, and structured context (URL, commit SHA, app version, user agent, org/workspace IDs) on every ticket — this is not a greenfield problem. The one thing genuinely missing is **"which specific element is the user complaining about."** The cheapest way to get that is a lightweight click-to-highlight picker (borrowing the `driver.js` library already installed for product tours) that writes a DOM path + bounding box + computed styles into the existing `context` JSONB field and optionally crops the existing screenshot to that region. No new vendor, no new infrastructure, no session-replay library. Estimated effort: **1–2 days** for MVP.

---

## Current State (grounding — read before building anything)

Confirmed by reading the live code, not assumed:

- **Entry point:** `src/components/support/SupportPopover.tsx` → auto-captures a screenshot via `captureProblemView()` before the dialog even opens, then opens `src/components/support/SupportTicketDialog.tsx`.
- **Screenshot capture:** `src/lib/screenshot.ts`, using `html2canvas-pro` (MIT, actively maintained fork of `html2canvas` — v2.2.3 released July 2026). Captures full page or a target element, with an `excludeElements` selector list. Up to 5 screenshots per ticket (1 auto + 4 manual/paste).
- **Console log capture:** `src/lib/console-buffer.ts` derives a bounded (100-entry, error-prioritized) snapshot from the pre-existing global `DebugPanelProvider` console interceptor. Already strips sensitive fields (response bodies, app-state snapshots) per a prior security hardening pass (T-15-06). **Do not build a second console wrap** — this is explicitly documented as a one-interceptor system.
- **Structured context already captured:** `tickets.context` JSONB carries `url`, `userAgent`, `appVersion`, `commit`, `replyEmail`, and namespaced-unverified `client_claims: { organization_id, workspace_id }`. Edge function: `supabase/functions/send-support-ticket/index.ts`.
- **Attachments:** `ticket_messages.attachments` JSONB — `{ type: 'screenshot'|'console_log', bucket, path, mime, size_bytes, captured_at }`, stored in a private Supabase Storage bucket (`ticket-attachments`), RLS-enforced.
- **Dedup:** SHA-256 fingerprint over `type + normalized(message)` collapses repeat tickets into `occurrence_count` bumps.
- **Nothing exists today for element targeting.** No `elementFromPoint` usage anywhere in `src/` or `supabase/`. The only `getBoundingClientRect` call is in `src/lib/tour.ts` for the onboarding product tour (`driver.js` v1, MIT, ~26k GitHub stars, actively maintained), checking step-target visibility — not bug reporting.

**Implication:** the server-side "infrastructure to capture and store user selections" the brief asks about is 90% already built. This is a client-side interaction problem (how does a user point at an element) plus a small schema extension (what shape does the selection take in `context`), not a new backend system.

---

## Solutions Evaluated

### 1. Roll-your-own picker on top of `driver.js` (already installed)

`driver.js` already ships hover-highlight and click-target primitives for the product tour. It is not a bug-report element picker out of the box, but its highlight/overlay rendering is directly reusable — you'd add a `mousemove` listener that computes `elementFromPoint`, draws `driver.js`'s existing highlight overlay around the hovered element, and on click captures:

```ts
{
  selector: string,          // e.g. a short, stable CSS path
  tagName: string,
  boundingBox: DOMRect,
  computedStyles?: Record<string, string>,  // optional, curated allowlist only
  textContentPreview?: string,              // truncated, PII risk — see below
}
```

- **Implementation complexity:** Low. `elementFromPoint` + `getBoundingClientRect` + a CSS-selector generator (e.g. a small `finder`/`optimal-select`-style utility, ~100 lines, or a tiny dependency) is the entire client mechanism. Reuses `driver.js`'s overlay CSS.
- **Browser compatibility:** `elementFromPoint` and `getBoundingClientRect` are universal, IE9+, zero polyfill risk.
- **Performance overhead:** Negligible — one `mousemove` listener active only while the picker mode is on, torn down immediately after capture.
- **Licensing:** MIT (driver.js), no new vendor dependency, no new privacy surface beyond what's already disclosed for screenshots.
- **Server-side infra needed:** None new. Add a `selectedElement` key to the existing `context` JSON blob validated by the existing Zod schema in `send-support-ticket/index.ts`. Optionally crop the existing `html2canvas-pro` capture to the element's bounding box for a "zoomed" screenshot variant — `html2canvas-pro` already supports a `target element` capture mode, so this is a parameter change, not new capture logic.

### 2. Vercel Toolbar (`@vercel/toolbar`)

- What it actually does: in-browser commenting/feedback layer for **Vercel-hosted preview deployments** — pin a comment to a page location, screenshot, layout-shift and accessibility analysis. This is a Vercel-platform product, not a portable open-source widget you embed in your own app's ticket flow.
- **Implementation complexity:** N/A for CallVault's use case — it's scoped to commenting on Vercel deployments/dashboards, not an embeddable "point at an element in production and file a ticket" widget for end users.
- **Verdict:** Not a fit. Interesting as a UX reference (its layout-shift replay and WCAG-violation-per-element UI are good patterns to borrow visually) but not integratable as a library into the ticket flow. [MED confidence — Vercel's docs describe it as a deployment-review tool, not a customer-facing feedback SDK.]

### 3. TanStack (Query) DevTools

- Confirmed: this is a **developer-facing** cache/query inspector for engineers debugging their own app during development, not an end-user element picker. No element-selection-for-bug-reporting capability exists in it. Ruled out — included in the brief as a candidate but doesn't match the use case at all.

### 4. Cmux browser element picker

- Cmux is a **terminal app for running AI coding agents** (Ghostty-based macOS terminal, `manaflow-ai/cmux` on GitHub) with a browser-automation pane for agents to snapshot/click/inspect pages via a socket API. Its "element picker" (Option+Click, tracked as a feature request in `cmux` issue #1975, inspired by Chrome DevTools MCP's own element-picker feature) is built for **AI coding agents to select DOM targets while writing code**, not for end users filing support tickets.
- **Verdict:** Not a fit for the ticket flow — wrong audience (agents/devs, not customers) and not a redistributable client-side library; it's a terminal app. Interesting only as evidence that "click an element, get a stable reference" is a converging pattern across the agent-tooling space right now (2026), which validates the underlying UX pattern even though the tool itself doesn't transfer.

### 5. Commercial visual-feedback widgets — Marker.io, BugHerd, Sentry User Feedback

| Tool | What it does | Element targeting | Cost | Fit |
|---|---|---|---|---|
| **Marker.io** | Embeddable widget, screenshot + annotation, auto-captures console/network/browser metadata, pushes to Jira/Linear/etc. | Screenshot annotation (draw on image), not live DOM selector capture | From €39/mo | Overlaps almost entirely with what CallVault already built in-house (screenshot, console, browser metadata, ticket routing). Adding it means paying monthly for capabilities already shipped, plus a second parallel ticket pipeline to reconcile with the existing `tickets` schema. |
| **BugHerd** | Point-and-click pin widget, captures CSS selector + screenshot/video + browser/OS/resolution + custom metadata | Yes — explicitly captures CSS selector on pin | From $42/mo | Same overlap problem, but notably: BugHerd's core value prop (CSS-selector-on-pin) is exactly the missing feature and confirms it's implementable as a lightweight client feature, not something that requires a $42/mo vendor. |
| **Sentry User Feedback widget** | Screenshot + annotation attached to error events, `enableScreenshot` since SDK v8 | Screenshot-level annotation only, no live element-selector capture found in current docs [MED confidence — 2026 changelog entries beyond early 2024 weren't surfaced in this pass] | Sentry pricing tiers | Notable: the `tickets.source` migration already includes a `sentry` value (`ticket_source` enum, `20260612130000_sentry_ticket_ingestion.sql`) — CallVault already has a Sentry ingestion path for **error-triggered** tickets. That's a separate, already-solved problem (automatic error capture) from user-initiated element selection covered here. |

**Verdict on all three:** none should be adopted. They'd duplicate infrastructure CallVault already built (screenshot, console capture, structured context, storage, dedup) and introduce a second data pipeline to reconcile with the existing `tickets` table. The one feature they'd add — CSS-selector-on-click — is small enough to build directly (see Solution 1) rather than renting a whole SaaS platform for it.

### 6. Session replay (rrweb and similar)

- `rrweb` (MIT, open source) records full DOM mutations + interactions for pixel-perfect replay — the underlying tech behind FullStory/LogRocket/Hotjar-style tools.
- **Implementation complexity:** High — requires a recording buffer running continuously (or on-demand with a rolling window), a storage/replay backend, and careful privacy masking (input values, PII-bearing text) before any of it touches `ticket-attachments`.
- **Verdict:** Overkill for "let the user point at one element." This solves a different problem (reconstructing a whole user session) and should only be considered later if support consistently can't reproduce bugs from a screenshot + console log + element target. Flagging it as a *possible* Phase 3+ item, not recommending it now.

---

## Key Dimensions

**1. User experience path.** A button in `SupportTicketDialog` ("Point to a problem" / similar, non-jargon copy) toggles picker mode: cursor becomes a crosshair, hovered elements get a `driver.js`-style highlight outline, click locks the selection and shows a small confirmation chip ("Got it — captured the [Submit button] area") with an "x" to clear/retry. No new modal — this augments the existing dialog, consistent with how screenshots already work (auto-captured, shown as a thumbnail, retakeable).

**2. Diagnostic data collection — realistic bar.** Capture: DOM path/selector, bounding box, tag name, a short *curated* set of computed styles if useful for CSS bugs (color, font-size, display — not the full computed style object, which can leak values from other parts of the page). Do **not** capture raw `textContent`/`innerText` of the element by default — it can contain names, emails, or account data typed into a form field the user is pointing at. If element text is useful for support triage, truncate hard (~80 chars) and only capture from clearly non-input elements, mirroring the existing console-buffer truncation pattern (500-char message cap) and the T-15-06 precedent of stripping sensitive fields before storage.

**3. Implementation phases.**

| Phase | Scope | Effort | Stack changes | User benefit |
|---|---|---|---|---|
| **MVP** | Click-to-highlight picker reusing `driver.js` overlay; captures selector + bounding box + tag name into `context.selectedElement`; crops existing `html2canvas-pro` capture to that element as an additional screenshot variant | **Low** (1–2 days) | New picker component in `src/components/support/`; extend Zod schema in `send-support-ticket/index.ts` to accept `selectedElement`; no migration needed if using existing JSONB `context` column | Support sees exactly which UI piece the user means, without a screen-share call |
| **Phase 2** | Multi-element selection (e.g. "this AND that overlap"); computed-style snapshot (curated allowlist) for CSS/layout bugs; render the element outline back onto the cropped screenshot for a self-explanatory visual | **Low–Medium** (2–3 days) | Client-only; no schema change if reusing `context` | Sharper triage on visual/CSS bugs specifically |
| **Phase 3+** | Session replay (rrweb) for cases where a single screenshot+element isn't enough to reproduce; or lightweight event-trail capture (last N clicks/route changes before the report) | **High** | New recording pipeline, new storage bucket, privacy-masking layer, replay UI in admin | Reduces "can't reproduce" tickets for genuinely intermittent bugs — only worth it if that's an observed recurring pain point, not preemptively |

**4. AI/confidence messaging.** Follow the existing tone precedent in the ticket flow (plain-language, no jargon per root `CLAUDE.md`'s "AI-ready not AI-powered" constraint and the non-dev audience rule). Suggested copy pattern: *"We captured the button you clicked on, along with a snapshot of that part of the page — the team will see exactly what you saw."* Avoid "AI detected," "we analyzed," or similar — this is a capture feature, not an inference feature, so the messaging should stay concrete and mechanical rather than implying AI judgment happened.

**5. Effort vs. payoff — the actual recommendation.** Solution 1 (custom picker on `driver.js`) is the only option that is both low-effort AND directly closes the gap. Every commercial widget evaluated (Marker.io, BugHerd, Sentry) would replicate infrastructure that already exists in this codebase, and none is meaningfully faster to ship than the ~1–2 day custom build once you're not also standing up screenshot capture, console capture, storage, and dedup from scratch (all already done).

---

## Recommendations, Ranked

1. **Build the custom element picker (Solution 1).** Reuses `driver.js` (already a dependency), extends the existing `context` JSONB and Zod schema (no migration required), and produces the one missing diagnostic — "which element" — without adding a vendor, a monthly bill, or a second ticket pipeline. Highest impact-to-effort ratio by a wide margin.
2. **Skip all three commercial widgets (Marker.io, BugHerd, Sentry User Feedback) as ticket-flow additions.** They solve problems CallVault already solved in-house. BugHerd's CSS-selector-on-pin is worth studying as a UX reference for the confirmation-chip interaction, but not worth licensing.
3. **Defer session replay (rrweb) entirely.** Real infrastructure cost (recording pipeline, masking, replay UI) for a problem not yet shown to exist at CallVault's ticket volume. Revisit only if "couldn't reproduce" becomes a recurring reason tickets stall — that would be the actual trigger, not a diagnostics wishlist.

---

## Confidence Flags

- **[MED]** Sentry User Feedback's 2026-current annotation/element-targeting capabilities — search results topped out around early-2024 changelog entries; if Sentry ships live element-selector capture later in 2026, this comparison should be re-checked before treating it as settled.
- **[MED]** Vercel Toolbar's exact feature boundary — confirmed it's deployment/preview-scoped from docs and blog summaries, not independently verified against a live toolbar session.
- **[HIGH]** Everything in the "Current State" section — read directly from the live repo (file paths and field names quoted verbatim from `src/lib/screenshot.ts`, `src/lib/console-buffer.ts`, `supabase/functions/send-support-ticket/index.ts`, and the `tickets`/`ticket_messages` migrations) as of 2026-07-30.
- **[HIGH]** `driver.js` and `html2canvas-pro` license/maintenance status — MIT, both actively released within the last month as of this research pass (July 2026).

---

## Sources

- [Vercel Toolbar docs](https://vercel.com/docs/vercel-toolbar)
- [Introducing new developer tools in the Vercel Toolbar](https://vercel.com/blog/introducing-new-developer-tools-in-the-vercel-toolbar)
- [cmux — Feature Proposal: Browser element picker via Option+Click](https://github.com/manaflow-ai/cmux/issues/1975)
- [cmux GitHub repo](https://github.com/manaflow-ai/cmux)
- [Marker.io vs BugHerd 2025 comparison](https://bugherd.com/article/bugherd-vs-marker-io-2025)
- [8 Best BugHerd Alternatives in 2026](https://marker.io/blog/bugherd-alternatives)
- [Sentry — Set Up User Feedback (JavaScript)](https://docs.sentry.io/platforms/javascript/user-feedback/)
- [Sentry — Introducing Screenshots and Spam Detection to User Feedback](https://blog.sentry.io/introducing-screenshots-and-spam-detection-to-user-feedback)
- [driver.js](https://driverjs.com/)
- [driver.js GitHub (kamranahmedse)](https://github.com/kamranahmedse/driver.js)
- [html2canvas-pro npm](https://www.npmjs.com/package/html2canvas-pro)
- [html2canvas-pro Snyk maintenance report](https://security.snyk.io/package/npm/html2canvas-pro)
- [rrweb GitHub](https://github.com/rrweb-io/rrweb)
- [rrweb.com](https://rrweb.com/)
