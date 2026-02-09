# OpenAI Agents SDK - Executive Summary

**Research Date:** February 9, 2026  
**Current Project:** CallVault (Vercel AI SDK + OpenRouter + Supabase Edge Functions)  
**Research Confidence:** HIGH

---

## What is OpenAI Agents SDK

The **OpenAI Agents SDK** (formerly "Swarm") is OpenAI's official production-ready framework for building multi-agent AI workflows. Launched in March 2025, it represents the evolution of their experimental "Swarm" framework into a stable, maintained SDK.

### Official Status
- **Name:** OpenAI Agents SDK (`openai-agents` on PyPI, `@openai/agents` on npm)
- **Status:** Production-ready GA (not beta)
- **Python Version:** Available since March 2025, actively maintained
- **TypeScript/Node.js Version:** Available since June 2025 (v0.4.5 as of Feb 2026)
- **License:** MIT

### Core Purpose
The SDK provides lightweight primitives for:
1. **Agent Definition** - LLMs with instructions, tools, and handoff capabilities
2. **Multi-Agent Orchestration** - Seamless handoffs between specialized agents
3. **Built-in Observability** - Tracing and debugging out of the box
4. **Safety Controls** - Guardrails for input/output validation

### Key Differentiator from Standard OpenAI API
| Aspect | Standard OpenAI API | OpenAI Agents SDK |
|--------|---------------------|-------------------|
| Abstraction Level | Low-level chat completions | High-level agent orchestration |
| Multi-Agent | Manual implementation | Native handoff primitives |
| State Management | Developer-managed | Built-in Sessions |
| Tool Calling | Raw function calling | Decorated functions with auto-schema |
| Observability | External (Langfuse, etc.) | Built-in tracing + external |
| Provider Flexibility | OpenAI only | 100+ LLMs via OpenAI-compatible APIs |

---

## Key Findings for CallVault's Decision

### 1. Architecture Compatibility: PARTIAL

**Compatible Elements:**
- ✅ Works with OpenRouter (OpenAI-compatible API endpoints)
- ✅ Can run in Supabase Edge Functions (Deno/Node.js compatible)
- ✅ Supports TypeScript (since June 2025)
- ✅ Tool calling patterns are similar

**Incompatible Elements:**
- ❌ Replaces Vercel AI SDK's streaming primitives (different API)
- ❌ Different mental model for agent loops
- ❌ Would require significant refactoring of chat-stream-v2

### 2. Migration Path: COMPLEX

The current CallVault architecture uses:
```typescript
// Current: Vercel AI SDK pattern
import { streamText, tool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const result = streamText({
  model: openRouter('anthropic/claude-3.5-sonnet'),
  tools: { /* 14 RAG tools */ },
  // ...
});
```

Would need to become:
```typescript
// Hypothetical: OpenAI Agents SDK pattern
import { Agent, Runner } from '@openai/agents';

const agent = new Agent({
  name: 'CallVault AI',
  instructions: '...',
  tools: [/* different tool format */],
  handoffs: [/* for multi-agent */],
});

const result = await Runner.run(agent, input);
```

### 3. When OpenAI Agents SDK Shines

Based on research, OpenAI Agents SDK is ideal for:

| Use Case | Fit for CallVault? |
|----------|-------------------|
| Multi-agent routing (triage → specialist agents) | ⚠️ Moderate - could improve the RAG tool organization |
| Complex handoff workflows | ❌ Low - current single-agent approach works well |
| Rapid prototyping of agent systems | ❌ Not needed - already have working system |
| Teams heavily invested in Python | ❌ Irrelevant - CallVault is TypeScript |
| Need built-in observability without third-party | ⚠️ Nice-to-have but Langfuse already integrated |

### 4. Critical Limitations for CallVault

1. **New TypeScript SDK (June 2025)**
   - Only ~8 months old vs Vercel AI SDK's 2+ years
   - Smaller community, fewer Stack Overflow answers
   - Less battle-tested in production

2. **Different Provider Pattern**
   - OpenAI Agents SDK uses its own provider abstraction
   - OpenRouter integration works but requires adapter configuration
   - Would lose Vercel AI SDK's unified provider interface

3. **Edge Runtime Compatibility**
   - Officially supports Node.js 22+, Deno, Bun
   - "Experimental support" for Cloudflare Workers
   - Supabase Edge Functions compatibility is untested (likely works but not guaranteed)

4. **Migration Cost vs Benefit**
   - Current system has 14 RAG tools, complex streaming, business profile injection
   - Migration would touch: chat-stream-v2, frontend hooks, tool definitions
   - Estimated effort: 2-3 weeks vs minimal ongoing maintenance with current stack

---

## Recommendation: STAY WITH VERCEL AI SDK

### Rationale

1. **Vercel AI SDK is Mature and Actively Maintained**
   - Version 6.x with 2+ years of production use
   - Excellent TypeScript/Next.js integration
   - Strong community and ecosystem
   - Multi-provider abstraction is industry-leading

2. **Current Architecture Works Well**
   - chat-stream-v2 with 14 RAG tools is sophisticated and working
   - OpenRouter provider gives access to 300+ models
   - Supabase Edge Functions + Vercel AI SDK is a proven pattern

3. **OpenAI Agents SDK Doesn't Solve Real Pain Points**
   - Not struggling with multi-agent orchestration (single agent with many tools works)
   - Not lacking observability (Langfuse integrated)
   - Not limited by provider options (OpenRouter covers all needs)

4. **Migration Risk Outweighs Benefits**
   - TypeScript SDK is relatively new (June 2025)
   - Would require touching critical chat infrastructure
   - No compelling feature gap that needs closing

### When to Reconsider

Revisit this decision if:
- Need true multi-agent workflows (triage → multiple specialist agents)
- Building new agent-centric features from scratch
- Vercel AI SDK falls behind on agent orchestration patterns
- OpenAI Agents SDK TypeScript version matures significantly (12+ months)

---

## Files Created

| File | Purpose |
|------|---------|
| `SUMMARY.md` | This executive summary |
| `STACK.md` | Detailed technology comparison |
| `FEATURES.md` | Feature landscape and capabilities |
| `ARCHITECTURE.md` | Architecture patterns comparison |
| `PITFALLS.md` | Known limitations and migration risks |
| `MIGRATION_ASSESSMENT.md` | Specific migration path for CallVault |

---

## Research Sources

- [OpenAI Agents SDK Official Docs](https://openai.github.io/openai-agents-python/) - HIGH confidence
- [OpenAI Agents SDK GitHub (Python)](https://github.com/openai/openai-agents-python) - HIGH confidence
- [OpenAI Agents SDK GitHub (TypeScript)](https://github.com/openai/openai-agents-js) - HIGH confidence
- [OpenAI Product Announcement (March 2025)](https://openai.com/index/new-tools-for-building-agents/) - HIGH confidence
- [OpenRouter Documentation](https://openrouter.ai/docs/quickstart) - HIGH confidence
- Community comparisons and reviews (2025) - MEDIUM confidence

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack compatibility | HIGH | Official docs confirm TypeScript/Deno support |
| Feature comparison | HIGH | Direct comparison of documented features |
| Migration complexity | MEDIUM | Based on code analysis of chat-stream-v2 |
| Production readiness | HIGH | Official GA status, but TS SDK is newer |
| Recommendation | HIGH | Clear cost/benefit analysis favors staying |
