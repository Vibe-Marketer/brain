# ADR-005: Prompt-Kit for Chat UI Components

**Status:** Accepted

**Date:** 2025-01-23

**Context:** AI Chat Agent System Implementation

## Context

The AI Chat Agent System requires a production-ready chat interface with:

- Real-time message streaming
- Tool call visualization
- Source citation display
- Markdown rendering
- Code syntax highlighting
- Professional, polished UI

The chat UI must:

- Integrate seamlessly with Vercel AI SDK's `useChat` hook
- Follow CallVault's brand guidelines (v3.3)
- Use our existing design system (shadcn/ui + Tailwind CSS)
- Support streaming responses (SSE)
- Be fully customizable

We need components that are:

- Production-ready (not prototypes)
- Well-documented
- TypeScript-first
- Compatible with our stack

## Decision

We will use **prompt-kit** for chat UI components.

Prompt-kit provides:

- Pre-built chat components (ChatContainer, MessageList, PromptInput)
- Built on shadcn/ui (our existing UI library)
- Styled with Tailwind CSS (matches our design system)
- Designed for AI SDK ecosystem (Vercel AI SDK, OpenAI SDK)
- MIT licensed
- Full TypeScript support

### Components We'll Use

```typescript
// From prompt-kit
import { ChatContainer } from '@/components/chat/chat-container';
import { PromptInput } from '@/components/chat/prompt-input';
import { MessageList } from '@/components/chat/message-list';
import { Source } from '@/components/chat/source';
import { CodeBlock } from '@/components/chat/code-block';
```

### Integration with Vercel AI SDK

```tsx
import { useChat } from '@ai-sdk/react';
import { ChatContainer, PromptInput } from 'prompt-kit';

export function Chat() {
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat-stream',
  });

  return (
    <ChatContainer>
      <MessageList messages={messages} />
      <PromptInput onSubmit={sendMessage} disabled={status === 'pending'} />
    </ChatContainer>
  );
}
```

## Alternatives Considered

### 1. Build from Scratch

**Pros:**

- Complete control over features
- No external dependencies
- Exactly matches our needs

**Cons:**

- **Estimated 2-3 weeks development time**
- Need to implement: auto-scroll, streaming indicators, markdown, code highlighting, responsive layout
- High maintenance burden
- Risk of bugs (scroll behavior, message rendering, etc.)
- Reinventing proven patterns

### 2. react-chat-ui or ChatUI Libraries

**Pros:**

- Purpose-built for chat interfaces
- Feature-rich

**Cons:**

- Not Tailwind-based (would conflict with our styles)
- Not designed for AI streaming
- Heavy dependencies (Material UI, Ant Design)
- Difficult to customize for brand guidelines

### 3. Vercel AI SDK Examples Only

**Pros:**

- Directly from AI SDK docs
- Minimal code

**Cons:**

- Just examples, not production components
- No polish or error handling
- Missing features (code highlighting, auto-scroll, etc.)
- Would need significant customization

## Consequences

### Positive

1. **Rapid Development** - Production UI in days instead of weeks
2. **shadcn/ui Alignment** - Uses same primitives we already have
3. **Tailwind Customization** - Easy to adapt to brand-guidelines-v4.1.md
4. **AI SDK Native** - Built specifically for `useChat` hook
5. **MIT License** - Can fork and modify if needed
6. **TypeScript** - Full type safety

### Negative

1. **Dependency** - Reliant on prompt-kit maintenance
   - Mitigation: Components are simple React components we can maintain
2. **Customization Needed** - Must adapt to brand guidelines
   - Required changes: colors, typography, spacing
   - Estimated: 4-6 hours
3. **Learning Curve** - Team needs to learn prompt-kit patterns
   - Minimal: documentation is clear

### Neutral

1. **Bundle Size** - Adds components to bundle
   - Acceptable: ~10KB (tree-shakeable)
2. **Installation Method** - Uses shadcn CLI pattern
   - Familiar: same as our existing shadcn/ui components

## Implementation Notes

### Installation

```bash
# Install individual components
npx shadcn@latest add "https://prompt-kit.com/c/chat-container.json"
npx shadcn@latest add "https://prompt-kit.com/c/prompt-input.json"
npx shadcn@latest add "https://prompt-kit.com/c/code-block.json"
npx shadcn@latest add "https://prompt-kit.com/c/source.json"
```

### Customization for Brand Guidelines

Changes needed to match `brand-guidelines-v4.1.md`:

1. **Colors:**

   ```css
   /* Replace default colors */
   --primary: vibe-green (#D9FC67) → used only for focus states
   --background: viewport (#FCFCFC light, #161616 dark)
   --card: card (#FFFFFF light, #202020 dark)
   ```

2. **Typography:**

   ```css
   /* Headings: Montserrat Extra Bold ALL CAPS */
   /* Body: Inter Light (300) or Regular (400) */
   ```

3. **Icons:**

   ```tsx
   // Replace with Remix Icons
   import { RiSendPlaneLine } from '@remixicon/react';
   ```

4. **Layout:**

   ```tsx
   // Use `bg-viewport` for body
   // Use `bg-card` for message containers
   // 4px grid spacing
   ```

### Component Architecture

```text
src/components/chat/
├── ChatContainer.tsx           # prompt-kit base (customized)
├── ChatMessage.tsx             # Custom: message rendering
├── ChatMessageList.tsx         # Custom: virtualized list
├── ChatInput.tsx               # prompt-kit PromptInput (customized)
├── ChatToolCall.tsx            # Custom: tool visualization
├── ChatSources.tsx             # prompt-kit Source (customized)
├── ChatCodeBlock.tsx           # prompt-kit CodeBlock (customized)
└── ChatSessionSidebar.tsx      # Custom: session management
```

### Example: Customized Message Component

```tsx
import { PromptInput } from '@/components/chat/prompt-input'; // prompt-kit
import { RiSendPlaneLine } from '@remixicon/react';

export function ChatInput({ onSubmit, disabled }: Props) {
  return (
    <PromptInput
      onSubmit={onSubmit}
      disabled={disabled}
      placeholder="Ask about your transcripts..."
      className="bg-card border-cb-border-primary" // Brand colors
      icon={<RiSendPlaneLine className="h-4 w-4" />} // Remix icon
    />
  );
}
```

### Testing Plan

1. **Streaming Behavior** - Verify auto-scroll during streaming
2. **Tool Calls** - Ensure tool invocations display correctly
3. **Sources** - Check citation formatting
4. **Responsive** - Test on mobile/tablet/desktop
5. **Dark Mode** - Verify color contrast

## Related Decisions

- ADR-001: Vercel AI SDK (prompt-kit integrates with `useChat`)
- ADR-002: Remix Icon (replace prompt-kit default icons)
- Brand Guidelines v3.3 (customization target)

## Migration Strategy

No migration needed (new feature). Implementation plan:

1. Install prompt-kit components
2. Customize for brand guidelines (colors, typography, icons)
3. Build custom components (ChatMessage, ChatToolCall, etc.)
4. Integrate with `useChat` hook
5. Test streaming, tools, sources
6. Deploy to `/chat` route

## References

- [Prompt-Kit Chat UI](https://www.prompt-kit.com/chat-ui)
- [Prompt-Kit Documentation](https://www.prompt-kit.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Brand Guidelines v3.3](/docs/design/brand-guidelines-v4.1.md)

**Approved by:** Claude

**Review Date:** 2025-01-23
