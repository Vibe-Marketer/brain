# Options Comparison: Refactor vs. Greenfield Rewrite

**Date:** 2026-02-21 (updated same day with full research context)
**Decision:** How to execute the CallVault strategic pivot overhaul — surgically refactor the current repo, or start a new repo from scratch

---

## Strategic Summary

This is not a generic "refactor vs. rewrite" question. The pivot removes ~89K lines of AI/chat/RAG/embeddings code, leaving ~73K lines of organizational core. Combined with a full frontend rewrite and a significantly trimmed Supabase backend (same *project*, but many tables/functions dropped), the recommended path is **Option C: new frontend repo + same Supabase project, with an active reduction plan for the backend**. The Supabase project stays because it holds the auth, the multi-tenant hierarchy, the OAuth integrations, and the billing state — none of which need to change. The repo starts fresh because the existing frontend is deeply entangled with the AI features being removed.

---

## What's Actually Happening (Scope Clarification)

Based on the research across all artifacts, the overhaul has three concurrent operations:

**1. Remove ~89K lines of AI/infrastructure:**
- Hybrid RAG pipeline (pgvector, embeddings, HNSW, RRF re-ranking)
- Chat system (chat-stream-v2, 14 RAG tools, session management)
- Content Hub (7+ edge functions, templates, content library)
- PROFITS extraction
- Auto-processing pipeline
- AI model management (OpenRouter sync, model selector)
- Langfuse observability
- Semantic search (replace with pg_trgm keyword search)

**2. Keep the organizational core (~73K lines):**
- Bank/Vault multi-tenant workspace architecture
- 4-source import (Fathom, Zoom, Google Meet, YouTube)
- Transcript storage, folders, tags, sharing, export
- Invite links, collaboration, roles/permissions
- Polar billing
- Simple automation rules (non-AI)
- Basic analytics (computed from transcript data)

**3. Add new MCP layer:**
- MCP server (~2-3K lines) on Supabase Edge Functions or Cloudflare Workers
- Supabase OAuth 2.1 server for MCP authentication
- Workspace-aware MCP with vault-scoped client tokens
- Minimal in-app chat (no RAG, no embeddings — just transcript-in-context)

**Supabase changes (same project, but significantly reduced):**
- Drop ~15 AI-specific tables (transcript_chunks, embedding_queue, chat_sessions, chat_messages, chat_tool_calls, content_library, templates, ai_processing_jobs, auto_processing_preferences, ai_models, etc.)
- Remove ~23 AI edge functions
- Complete the fathom_calls → recordings/vault_entries migration (Option C from vault-mcp-architecture research)
- ~30 core tables remain, ~42 core edge functions remain
- ~191 RLS policies remain (security posture unchanged)

---

## Decision Criteria

1. **Velocity to working v2** — How fast a shippable pivot lands — Weight: **High**
2. **Cleanliness of result** — Does the outcome actually start fresh or carry baggage? — Weight: **High**
3. **Risk of losing working code** — Import pipelines, OAuth flows, vault hierarchy, billing — Weight: **High**
4. **Infrastructure re-setup cost** — Re-registering OAuth, migrating user data, new billing state — Weight: **High** (because the AI removal changes this calculus significantly)
5. **Dead code elimination** — Actually gets rid of the accumulated cruft — Weight: **Med**
6. **Cognitive load** — Managing parallel environments during transition — Weight: **Med**

---

## Options

### Option A: Full Greenfield (New Repo + New Supabase Project)

New GitHub repo, new Supabase project, new everything. Copy only what's needed.

- **Velocity:** Poor — Must re-setup: Supabase Auth config, OAuth redirect URIs for all 3 integrations (Fathom/Zoom/Google Meet), Polar billing re-connection, user data migration, pgvector indexes, RLS policies on all 30 tables, 42 remaining edge functions re-deployed to new project. This is months of infrastructure work on top of the actual build.
- **Cleanliness:** Excellent — Absolutely zero legacy baggage.
- **Risk of losing working code:** High — The import pipelines, vault hierarchy, billing webhooks, and OAuth refresh flows are deeply interdependent. "Copy what's needed" sounds simple; untangling it is not.
- **Infrastructure re-setup cost:** Very High — New OAuth apps for all 3 platforms, user data migration, re-verified domains, new Polar merchant, new Sentry project. Multiple weeks of setup.
- **Dead code elimination:** Excellent — Everything chosen intentionally.
- **Score: 3/10**

Why lower than before: The AI removal doesn't help here. The AI tables/functions are the *easy* part to leave behind. The hard infrastructure (auth, OAuth, vault hierarchy, billing) is entirely in what's *staying*, and it all lives in Supabase.

### Option B: In-Place Refactor (Current Repo, Current Supabase)

Work directly in the current repo. Remove AI features, clean up, build MCP on top.

- **Velocity:** Good — Everything works today. Zero setup time.
- **Cleanliness:** Poor-OK — After removing 89K lines of intertwined AI code from a 112K line codebase, what remains will still carry the ghost of the previous architecture: component imports, routing assumptions, Zustand store structure all shaped around the AI features. The frontend in particular will need the same amount of work as a rewrite to get truly clean.
- **Risk of losing working code:** Low — Nothing is discarded; history is preserved.
- **Infrastructure re-setup cost:** None.
- **Dead code elimination:** Poor — Removing AI code from the current frontend is tantamount to a rewrite anyway (the chat system, content hub, and processing pipeline are woven into routing, layout, and state). Doing it in-place adds complexity without the clean-slate benefit.
- **Score: 5/10**

The problem with in-place: you're doing 90% of the work of a rewrite with 10% of the benefit. The AI features aren't cleanly separable modules — they're in the routing, the AppShell layout decisions, the panel store, the Zustand stores, the hook layer. Removing them surgically is harder than starting clean.

### Option C: New Frontend Repo + Same Supabase Project (Recommended)

New GitHub repo for the frontend (and new edge functions where needed). Keep the existing Supabase project. Execute the AI table/function removal as a separate database operation.

- **Velocity:** Good-Excellent — Supabase auth, OAuth connections, user data, all 30 remaining core tables, billing state — all live and working from day one of v2 development. The new frontend calls the same Supabase project immediately.
- **Cleanliness:** Excellent — The repo has zero legacy baggage. Every file is intentional. No AI entanglement, no orphaned pages, no debug scripts, no duplicate chat implementations.
- **Risk of losing working code:** Low — The organizational core (vault hierarchy, import pipelines, OAuth flows, billing) stays in Supabase untouched during the frontend build. Drop the AI tables/functions only after the new frontend is live.
- **Infrastructure re-setup cost:** Low — New GitHub repo + new Vercel deployment (~2 hours). Supabase project unchanged. OAuth redirect URIs: only dev localhost may differ; prod URIs unchanged.
- **Dead code elimination:** Excellent — Frontend: intentionally built from zero. Edge functions: copy only the 42 keepers; AI functions stay in old repo, never copied. DB cleanup is a separate, sequenced migration operation.
- **Score: 9/10**

---

## Comparison Matrix

| Criterion | A: Full Greenfield | B: In-Place Refactor | C: New Repo + Same Supabase |
|---|---|---|---|
| Velocity to v2 | Poor | Good | Good-Excellent |
| Cleanliness of result | Excellent | Poor-OK | Excellent |
| Risk of losing working code | High | Low | Low |
| Infrastructure re-setup cost | Very High | None | Low |
| Dead code elimination | Excellent | Poor | Excellent |
| Cognitive load | Very High | Low | Medium |
| **Score** | **3/10** | **5/10** | **9/10** |

---

## Recommendation

**New frontend repo, same Supabase project, sequenced backend cleanup.**

The key insight from the full research context: **the AI removal is what makes Option C so strong here**. In a normal refactor-vs-rewrite decision, keeping Supabase is partly about preserving existing frontend work. But the existing frontend is being thrown away anyway because it's built around the AI features being removed. So:

- You're rewriting the frontend either way (Option B in-place costs almost as much as Option C fresh start)
- The Supabase project holds all the infrastructure that *isn't* changing (auth, OAuth, vault hierarchy, billing)
- A new Supabase project would require re-migrating exactly the parts that are hardest to migrate

The conclusion is decisive.

### Execution sequence

**Phase 0 — Before writing a line of v2 code (1-3 days):**
1. Confirm which edge function is actually deployed as `chat-stream` in production (dashboard check)
2. Verify DB_VERIFICATION_REPORT issues are resolved (hybrid_search, fathom_calls.bank_id, call_categories)
3. Complete the fathom_calls → recordings/vault_entries migration (the `get_unified_recordings` RPC approach from vault-mcp research)
4. ADR: PROFITS — keep or kill. Document the decision.

**Phase 1 — New repo, core scaffold (1 week):**
- New GitHub repo, Vite + React + TypeScript
- Same Supabase project, same env vars
- New Vercel deployment
- AppShell concept rebuilt clean (4-pane, `duration-500` only, Remix Icons only, no inline SVGs)
- TanStack Query + query key factory (copy directly, it's clean)
- Zustand stores (copy selectively, strip AI stores)
- Auth, routing, basic navigation

**Phase 2 — Core features (2-3 weeks):**
- Bank/vault workspace switching
- Call import (all 4 sources) — use existing edge functions, just write new frontend hooks
- Transcript view + editing
- Folders, tags, organization
- Sharing + invite links

**Phase 3 — MCP server + minimal chat (1-2 weeks):**
- MCP server on Supabase Edge Functions (mcp-lite) or Cloudflare Workers
- Supabase OAuth 2.1 for MCP auth
- Workspace-aware MCP with vault-scoped tokens
- Minimal in-app chat (transcript-in-context, no RAG, ~100 lines of edge function)

**Phase 4 — Backend cleanup (parallel with Phase 3, can be sequenced):**
- Drop AI edge functions: chat-stream-v2, chat-stream-legacy, semantic-search, embed-chunks, process-embeddings, rerank-results, content-builder, and the other 16 AI functions
- Drop AI tables: transcript_chunks, embedding_queue, embedding_jobs, chat_sessions, chat_messages, chat_tool_calls, content_library, templates, ai_processing_jobs, auto_processing_preferences, ai_models (archive first, then drop)
- Remove OpenAI, OpenRouter, Langfuse dependencies
- Per-call AI processing cost drops to $0

---

## What to Copy (Directly, Without Modification)

- `supabase/functions/_shared/` — search pipeline utilities, CORS, rate limiter, response helpers
- `src/lib/query-config.ts` — query key factory (textbook clean)
- `src/stores/panelStore.ts`, `uiStore.ts`, `authStore.ts` — clean Zustand implementations
- `src/hooks/` — selectively: filter hooks, breakpoint, keyboard shortcuts, virtual list hooks. Leave AI hooks behind.
- Brand guidelines, CLAUDE.md hierarchy, ADR records — all of this is institutional knowledge worth keeping
- All test infrastructure (playwright.config.ts, vitest.config.ts, all E2E specs for non-AI flows)
- `supabase/functions/` — the 42 non-AI edge functions (import, sync, webhooks, billing, OAuth flows)

## What NOT to Copy (Leave Behind)

| What | Why |
|---|---|
| `chat-stream-v2`, `chat-stream-legacy` | Entire feature being removed |
| `semantic-search`, `embed-chunks`, `process-embeddings`, `rerank-results` | RAG pipeline removed |
| All content generation edge functions | Content Hub removed |
| `src/pages/AutomationRules.tsx` (692 lines) | Orphaned, never rendered |
| `src/pages/CollaborationPage.tsx` (329 lines) | Orphaned, never imported |
| `src/components/chat/`, `src/components/content/` | AI features being removed |
| `src/components/profits/` | Feature in limbo — decide and act |
| `@tremor/react` | Redundant with recharts; don't reinstall |
| `next-themes` alongside custom ThemeContext | Pick one |
| Root debug scripts (`check-*.ts`, `test-rag-*.ts`) | Dev artifacts, don't copy |
| `tailwind.config.ts.bak` | Backup file |
| All 38 `any` type instances | Start with strict TypeScript from day one |
| `duration-300` anywhere | Mandate `duration-500` only from day one |

---

## Runner-Up

**Option B: In-Place Refactor** — only if:
- You need something in users' hands in < 2 weeks and can't afford new repo setup time
- The planned changes are smaller in scope than described here

Given the actual scope (89K lines removed, full frontend reshape, MCP addition), Option B in-place costs almost as much work as Option C while delivering worse cleanliness. The calculus doesn't favor it.

---

## Implementation Context

```yaml
chosen:
  option: New Frontend Repo + Same Supabase Project
  
  repo_setup:
    - New GitHub repo (callvault or callvault-v2)
    - npm create vite@latest . -- --template react-ts
    - Same VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as current project
    - New Vercel project pointing to new repo — same env vars
    - NO new Supabase project — same project URL throughout
    - Update localhost OAuth redirect URIs if new dev port differs
  
  supabase_project:
    status: Keep, same project
    immediate: Verify DB_VERIFICATION_REPORT issues resolved before building
    migration: Complete fathom_calls -> recordings unification (get_unified_recordings RPC)
    cleanup_phase: Drop AI tables and functions AFTER v2 frontend is live
    tables_dropping: transcript_chunks, embedding_queue, embedding_jobs, chat_sessions,
                     chat_messages, chat_tool_calls, ai_tool_calls, content_library,
                     templates, ai_processing_jobs, auto_processing_preferences, ai_models
    functions_dropping: chat-stream-v2, chat-stream-legacy, semantic-search, embed-chunks,
                        process-embeddings, rerank-results, enrich-chunk-metadata,
                        content-builder and 6 other content functions, PROFITS function,
                        ai-title-generation, automation-sentiment (AI action part only),
                        sync-openrouter-models, langfuse utilities
  
  mcp_server:
    deployment: Supabase Edge Functions with mcp-lite (OR Cloudflare Workers — both viable)
    auth: Supabase OAuth 2.1 server (already partially built — OAuthConsentPage exists)
    tools_day_one: list_banks, list_vaults, list_recordings, get_transcript,
                   search_recordings, set_active_workspace
    tools_differentiating: browse_vault_hierarchy, get_speaker_history,
                           get_vault_analytics, compare_recordings, get_topic_timeline,
                           batch_get_transcripts, get_recording_context
    resources: callvault://{bank_id}/vault/{vault_id}/recording/{recording_id}
    prompts: prepare_for_meeting, weekly_digest, compare_prospects
  
  copy_directly:
    - supabase/functions/_shared/ (search utils, CORS, rate limiter)
    - src/lib/query-config.ts (query key factory)
    - src/stores/panelStore.ts, uiStore.ts, authStore.ts
    - src/hooks/ (filter hooks, breakpoint, keyboard shortcuts — skip AI hooks)
    - All Playwright E2E specs for non-AI user flows
    - CLAUDE.md hierarchy, ADRs, brand guidelines

  gotchas:
    - OAuth redirect URIs: check if new dev port differs; update Fathom/Zoom/Google OAuth apps
    - Polar billing webhooks: point to new Vercel URL when v2 is live
    - The chat-stream ambiguity: confirm in Supabase dashboard whether chat-stream-v2
      is deployed as "chat-stream" — irrelevant for v2 but need to know for cleanup
    - Drop AI tables AFTER v2 is live, not before — de-risk the transition
    - fathom_calls migration: run get_unified_recordings RPC approach first so MCP
      sees all data while migration completes in background

runner_up:
  option: In-Place Refactor
  when: Scope is actually smaller than described, or < 2 week timeline is hard constraint
  switch_cost: Zero — just stop using new repo if you change your mind, nothing was migrated

integration:
  supabase_project: Shared throughout — v2 frontend calls same project from day one
  testing: Playwright E2E tests run against new frontend + existing Supabase from day one
  verification: Run DB_VERIFICATION_REPORT queries against production before starting
  rollback: Old Vercel deployment stays live until v2 is confirmed stable
```

---

## Supporting Research (All Read for This Analysis)

| Document | Key Finding |
|---|---|
| `2026-02-17-callvault-via-negativa.md` | ~40% of codebase is AI surface area; bank/vault architecture is the moat |
| `2026-02-17-callvault-strategic-pivot-thin-app-mcp-feasibility.md` | 89K lines removable; MCP serves all platforms; verdict: "Go with conditions" |
| `2026-02-18-callvault-strategic-pivot-pitch.md` | Full investor-facing case for the pivot; confirms MCP convergence on single standard |
| `2026-02-21-convex-vs-supabase-options.md` | Stay on Supabase; pivot only removes 14% of Supabase calls; migration would take 12-19 weeks |
| `2026-02-21-vault-mcp-architecture-options.md` | Data path unification (get_unified_recordings RPC); workspace-aware MCP design |
| `2026-02-18-callvault-mcp-plugin-architecture-technical.md` | MCP tool inventory, resource scheme, multi-platform integration architecture |

---

**Next Action:** Set up new repo scaffold, verify Supabase project health (DB_VERIFICATION_REPORT), begin Phase 1 build.
