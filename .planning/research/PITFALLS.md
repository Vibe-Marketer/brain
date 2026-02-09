# Domain Pitfalls: OpenAI Agents SDK

**Research Date:** February 9, 2026  
**Domain:** AI Agent Framework Adoption  
**Context:** CallVault (Vercel AI SDK + OpenRouter + Supabase)

---

## Critical Pitfalls

### Pitfall 1: TypeScript SDK Immaturity

**What goes wrong:** The TypeScript version of OpenAI Agents SDK was released in June 2025, making it only ~8 months old as of February 2026.

**Why it happens:** OpenAI prioritized Python SDK first (released March 2025), with TypeScript following 3 months later.

**Consequences:**
- Fewer Stack Overflow answers
- Less community knowledge
- Potential undiscovered bugs
- Breaking changes in minor versions
- Third-party integrations lagging

**Prevention:**
- Wait 12+ months for TypeScript SDK to mature
- Monitor GitHub issues for patterns
- Test thoroughly in staging

**Detection:**
- Check npm download stats (currently ~330K/week vs Vercel AI SDK's millions)
- Review GitHub issue count and resolution rate
- Search for production case studies

---

### Pitfall 2: Streaming Implementation Complexity

**What goes wrong:** OpenAI Agents SDK has different streaming patterns than Vercel AI SDK, requiring custom implementation for React integration.

**Why it happens:**
- Vercel AI SDK has `useChat()` hook with SSE handling
- Agents SDK uses event-based streaming without React hooks
- Different mental model for consuming streams

**Consequences:**
- Loss of `useChat()` convenience
- Manual SSE handling required
- More frontend code to maintain
- Potential for streaming bugs

**Prevention:**
- Evaluate streaming requirements before migration
- Plan for custom hook development
- Test streaming edge cases thoroughly

**Detection:**
- Early prototypes showing streaming delays
- UI freezing during tool execution
- Lost tokens in stream

**Current CallVault Risk:** HIGH - Heavily relies on `useChat()` hook

---

### Pitfall 3: Provider Abstraction Loss

**What goes wrong:** Migrating from Vercel AI SDK's provider-agnostic approach to OpenAI Agents SDK's OpenAI-centric design.

**Why it happens:**
- Vercel AI SDK has 25+ first-class providers
- Agents SDK supports other providers but requires adapter configuration
- Mental model shifts from "any provider" to "OpenAI-compatible endpoints"

**Consequences:**
- Loss of one-line provider switching
- More complex OpenRouter integration
- Harder to A/B test models
- Potential vendor lock-in

**Prevention:**
- Maintain OpenRouter configuration
- Abstract provider selection
- Keep provider-switching capability

**Current CallVault Risk:** MEDIUM - OpenRouter works but requires more config

---

### Pitfall 4: Tool Migration Overhead

**What goes wrong:** Current 14 RAG tools use Vercel AI SDK's `tool()` primitive which is different from Agents SDK's `function_tool()`.

**Why it happens:**
- Different API signatures
- Different context passing patterns
- Different error handling

**Consequences:**
- All 14 tools need refactoring
- Risk of introducing bugs
- Testing burden for each tool
- Potential performance regressions

**Example Difference:**
```typescript
// Current Vercel AI SDK
tool({
  description: 'Search transcripts',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ }
})

// Agents SDK equivalent
function_tool(async (query: string) => { /* ... */ })
// Or with decorator
@function_tool
async function searchTranscripts(query: string) { /* ... */ }
```

**Prevention:**
- Automate conversion where possible
- Thorough testing of each tool
- Gradual migration (tool by tool)

**Current CallVault Risk:** HIGH - 14 tools is significant

---

### Pitfall 5: Observability Migration

**What goes wrong:** Current Langfuse integration would need reimplementation for Agents SDK's built-in tracing.

**Why it happens:**
- Agents SDK has its own tracing format
- Langfuse integration needs adapter
- Different span/trace structure

**Consequences:**
- Loss of historical comparison
- Potential gaps in monitoring
- Time spent reimplementing

**Prevention:**
- Keep Langfuse as source of truth
- Use Agents SDK's external trace processors
- Test observability parity

**Current CallVault Risk:** MEDIUM - Langfuse integration is important

---

### Pitfall 6: Edge Runtime Uncertainty

**What goes wrong:** OpenAI Agents SDK's compatibility with Supabase Edge Functions (Deno runtime) is untested.

**Why it happens:**
- Agents SDK TypeScript is new
- Deno compatibility claimed but not verified
- Supabase Edge Functions have constraints

**Consequences:**
- Potential runtime errors
- Deployment failures
- Need for workarounds

**Prevention:**
- Test in Supabase staging environment
- Verify all dependencies work in Deno
- Have rollback plan

**Current CallVault Risk:** HIGH - Production Edge Functions are critical

---

### Pitfall 7: Premature Multi-Agent Architecture

**What goes wrong:** Adopting multi-agent patterns when single-agent + tools works fine.

**Why it happens:**
- Excitement about new capabilities
- Over-engineering tendency
- Thinking more agents = better

**Consequences:**
- Unnecessary complexity
- Harder to debug
- More points of failure
- No actual benefit

**Prevention:**
- Evaluate if multi-agent solves real problem
- Keep single-agent if it works
- Add agents only when needed

**Current CallVault Risk:** MEDIUM - Multi-agent isn't needed for current use case

---

### Pitfall 8: Migration Cost Underestimation

**What goes wrong:** Underestimating time and effort for migration.

**Why it happens:**
- "It's just changing imports"
- Not accounting for testing
- Underestimating edge cases

**Realistic Migration Estimate for CallVault:**

| Task | Estimated Time |
|------|----------------|
| Tool refactoring (14 tools) | 3-4 days |
| Streaming implementation | 2-3 days |
| Frontend hook rewrite | 2-3 days |
| OpenRouter configuration | 1 day |
| Observability migration | 2 days |
| Testing (all scenarios) | 3-4 days |
| Bug fixes and polish | 2-3 days |
| **Total** | **2-3 weeks** |

**Prevention:**
- Detailed migration plan
- Parallel implementation
- Feature flags for rollback

---

## Moderate Pitfalls

### Pitfall 9: Different Error Handling

**What goes wrong:** Agents SDK has different error patterns than Vercel AI SDK.

**Consequences:**
- Error handling code needs rewrite
- User-facing error messages may change
- Potential uncaught exceptions

**Prevention:**
- Map error types between SDKs
- Comprehensive error testing

### Pitfall 10: Session Management Confusion

**What goes wrong:** Agents SDK's automatic sessions vs current manual management.

**Consequences:**
- Unexpected state behavior
- Session leaks
- Memory issues

**Prevention:**
- Understand session lifecycle
- Configure session cleanup
- Test long-running conversations

### Pitfall 11: Guardrail Overhead

**What goes wrong:** Agents SDK's guardrails add latency.

**Consequences:**
- Slower response times
- Additional token costs
- Complex configuration

**Prevention:**
- Measure guardrail impact
- Use only necessary guardrails

---

## Minor Pitfalls

### Pitfall 12: Documentation Gaps

**What goes wrong:** TypeScript documentation less complete than Python.

**Mitigation:**
- Read Python docs for concepts
- Check GitHub examples
- Join community Discord

### Pitfall 13: Naming Confusion

**What goes wrong:** "Swarm" vs "Agents SDK" naming still causes confusion.

**Clarification:**
- Swarm = Experimental (October 2024)
- Agents SDK = Production (March 2025 Python, June 2025 TypeScript)
- Swarm is deprecated, use Agents SDK

### Pitfall 14: Ecosystem Fragmentation

**What goes wrong:** Community packages for Vercel AI SDK don't work with Agents SDK.

**Examples:**
- `ai-sdk-rsc` (React Server Components)
- Various middleware packages
- Custom providers

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Evaluation | TypeScript immaturity | Test thoroughly, wait 12+ months |
| Migration Start | Tool refactoring | Automate conversion scripts |
| Implementation | Streaming complexity | Build custom hooks early |
| Testing | Edge runtime issues | Test in actual Supabase environment |
| Deployment | Observability gaps | Keep Langfuse integration |
| Post-launch | Performance regression | Monitor response times closely |

---

## Risk Summary for CallVault

| Pitfall | Risk Level | Mitigation Cost |
|---------|------------|-----------------|
| TypeScript SDK immaturity | HIGH | Wait 12+ months |
| Streaming complexity | HIGH | Custom development |
| Provider abstraction loss | MEDIUM | Adapter configuration |
| Tool migration overhead | HIGH | 3-4 days refactoring |
| Observability migration | MEDIUM | Adapter layer |
| Edge runtime uncertainty | HIGH | Thorough testing |
| Premature multi-agent | MEDIUM | Architectural discipline |
| Migration cost | HIGH | 2-3 weeks effort |

**Overall Assessment:** The risks and costs outweigh the benefits for CallVault's current architecture.

---

## When Pitfalls Are Worth It

Consider accepting these pitfalls when:

1. **True multi-agent requirement** - Need agent handoffs, not just tools
2. **New project** - No existing code to migrate
3. **Python-first** - Using Python SDK (more mature)
4. **Observability priority** - Need built-in tracing without third-party
5. **OpenAI-only** - Not using multiple providers

For CallVault: None of these apply strongly enough to justify the risks.
