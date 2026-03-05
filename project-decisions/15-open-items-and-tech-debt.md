# Open Items & Tech Debt

---

## Immediate Blockers / Next Actions

### Phase 16.2 — User Approval Needed

- [ ] Present V2 visual screenshots to user for sign-off on all pages
- [ ] After approval, Phase 16.2 closes and Phase 19 can begin

### Phase 16.1 — Two Gaps to Close

- [ ] Update design system skill `canonical_reference` to point to v4.3 instead of v4.2 (lines 10, 17, 556 in `.claude/skills/callvault-design-system.md`)
- [ ] Add v4.3 entry to `docs/design/brand-guidelines-changelog.md` (latest entry is v4.1.3)

### Phase 17 — Visual + E2E Verification Needed

- [ ] Verify the visual layout of /import page (4 source cards, grid, status badges)
- [ ] Test file upload end-to-end: drag a file -> Whisper transcribes -> recording appears in call list
- [ ] Test OAuth connection end-to-end: redirect -> auto-sync -> completion toast

### Phase 18 — Browser Verification Needed

- [ ] Verify Sources/Rules tab navigation renders correctly
- [ ] Verify default destination auto-save fires toast
- [ ] Verify slide-over spring animation, live preview, AND/OR toggle, rule save with toast
- [ ] Verify drag-to-reorder persists after page refresh
- [ ] Verify disabled rule opacity-60 + strikethrough visual, re-enable restores full opacity

### MCP Connectivity

- [ ] Test MCP end-to-end connectivity (deferred to Phase 19 audit)

---

## Dark Mode Decision

- [ ] V1 light mode is the approved visual source of truth
- [ ] V1 dark mode is NOT approved — user is unsure if it's right
- [ ] User needs to visually approve V1 dark mode before any dark mode rules are codified as final
- [ ] Until approved: do not enforce dark mode design rules

---

## Tech Debt (from `.planning/todos/tech-debt/`)

All legacy v1 carry-overs that need to be triaged for v2 relevance:

### Chat Context Library + Assistant Message Actions

- [ ] Legacy specs describe chat UX capabilities that were never built: assistant toolbar, non-call context assets, message feedback buttons
- [ ] Decide: Are these relevant to v2's bridge chat, or should they be permanently archived?
- [ ] If relevant, re-scope to the v2 model (minimal bridge chat, no RAG)

### PRPs Legacy Merge

- [ ] Legacy PRP (Product Requirements Plan) documents need merging/triaging into v2 planning structure
- [ ] Some may contain relevant feature ideas; most are likely superseded

### Strategic Legacy Epics (4 Items)

- [ ] **Sorting/tagging UX rework** — the current sorting/tagging system may need redesign for v2's workspace model
- [ ] **Profile creation/management flow redesign** — user profiles in v2 context
- [ ] **Knowledge base indexing visibility** — how users see what's indexed (may be irrelevant if AI/embeddings are removed)
- [ ] **Content/agent strategy consolidation** — includes PROFITS trigger alignment; likely superseded by MCP-first strategy

### Top-Level Specs + UI Polish PRDs

- [ ] Legacy spec canonization work — decide what's still relevant
- [ ] Legacy UI polish PRDs — merge useful ideas into v2 planning or archive

---

## Frontend Design Audit (Documented, Not Scheduled)

18 improvement areas identified in a Feb 2026 audit, organized by priority:

### Tier 1 (High Priority)

- [ ] Button styling consistency across all pages
- [ ] Hover scale interactions (consistent interaction feedback)
- [ ] Nav pill enhancement (refine the 4-layer active state)
- [ ] Empty state messaging quality and consistency

### Tier 2 (Medium Priority)

- [ ] Loading animations (skeleton screens, progress indicators)
- [ ] Keyboard shortcut tooltips
- [ ] Type scale system (consistent heading/body hierarchy)
- [ ] Command palette expansion

### Tier 3 (Lower Priority)

- [ ] Mobile touch targets (minimum 44px)
- [ ] Dark mode polish (pending dark mode approval)
- [ ] Accessibility audit (WCAG compliance check)
- [ ] Data visualization components

### Tier 4 (Future)

- [ ] Swipe gestures for mobile
- [ ] Virtual scrolling for large lists
- [ ] Density mode toggle (compact vs comfortable)

---

## Known Database Issues to Address

- [ ] `transcript_chunks` has FK to deprecated `fathom_calls` table instead of `recordings` — fix in Phase 22
- [ ] `filter_recording_ids` uses BIGINT[] but recordings table uses UUID PKs — type mismatch
- [ ] Missing indexes: composite (user_id, call_date), partial (user_id WHERE embedding IS NOT NULL)
- [ ] `team_memberships` RLS recursion fix migration — verify it has been applied to production
- [ ] Compatibility VIEW `fathom_calls` was applied directly to production SQL Editor, not in a migration file — Phase 22 will DROP this

---

## Open Research Questions

- [ ] Supabase Custom Access Token Hook — is it available on the current plan tier? Fallback exists (lookup in workspace_mcp_tokens table) but the hook would be cleaner
- [ ] Hard cutover date for brain/ repo — when does v1 stop being the live frontend? Must be communicated before Phase 19 ships
- [ ] Third-party OAuth app callback URL audit — Fathom and Zoom callback URLs need to be verified/updated for the new domain

---

## Future Build Items

- [ ] **create-brand-skill**: Build a reusable skill in the plugins-and-skills repo for capturing brand systems from live apps (dev-browser for auth apps, Dembrandt for public pages, Firecrawl for structured extraction)
- [ ] **Dark mode approval workflow**: User needs to visually approve V1 dark mode before dark mode rules are locked
