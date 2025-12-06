# ADR-001: Use Vercel AI SDK for Chat Features

**Status**: Accepted

**Date**: 2025-11-19

**Author**: AI-assisted with Claude

---

## Context

We're building chat, RAG, and agent features into CallVault. We need to choose an SDK that:
- Supports multiple AI providers (OpenAI, Anthropic, Google)
- Has built-in streaming and tool calling
- Works well with our React/TypeScript/Supabase stack
- Allows swapping models without major refactoring

Options considered:
1. **OpenAI SDK directly** - Vendor lock-in, no provider switching
2. **Langchain** - Too heavy, Python-focused, complex for our needs
3. **Vercel AI SDK** - Provider-agnostic, React-native, TypeScript-first

We're building fast with vibe coding, so we need something that "just works" with minimal setup and excellent documentation.

## Decision

We will use **Vercel AI SDK v4** (`ai` and `@ai-sdk/react`) as the default for all AI, chat, and agent features.

This provides unified interfaces across providers, excellent TypeScript support, and React hooks that match our development workflow. The SDK is actively maintained with a large community, reducing long-term risk.

## Consequences

### Positive
- Switch AI providers in ~5 lines of code (OpenAI → Anthropic → Google)
- Built-in streaming, tool calling, and structured output patterns
- Excellent docs with cookbook examples for common patterns
- useChat and useCompletion hooks integrate seamlessly with React
- Active community and rapid updates as AI landscape evolves

### Negative
- Another dependency in the stack (though lightweight ~50KB)
- Some advanced features optimized for Vercel hosting
- Learning curve for team members unfamiliar with SDK patterns
- May need custom wrappers for very specialized use cases

### Neutral
- Need to keep SDK updated as new AI capabilities emerge
- Changes how we structure agent code (more hooks-based)
- Reference documentation added to context folder for AI assistants

---

**Related**: Informs future ADRs on agent architecture and RAG implementation
