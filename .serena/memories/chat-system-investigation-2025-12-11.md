# Chat System Investigation - December 11, 2025

## Issues Identified

### CRITICAL ISSUES FOUND:

1. **User Messages Not Appearing in Chat**
   - Location: Chat.tsx, line 954-960
   - Problem: UserMessage component receives `textContent` but this relies on `getMessageTextContent(message)` function
   - The function only extracts text from `parts` array where type === 'text'
   - IF the AI SDK is not properly populating `message.parts` with text parts, messages won't show
   - Also: UserMessage only displays if `message.role === 'user'` - role must be exactly 'user'

2. **Assistant Responses Not Showing or Streaming**
   - Location: chat-stream/index.ts, lines 827-876
   - Problem: Streaming implementation yields event types that need proper conversion
   - The backend sends events like 'text', 'text-delta', 'text-start', 'text-end'
   - DefaultChatTransport from AI SDK v5 MUST properly parse these events
   - If transport doesn't parse correctly, frontend never gets messages
   - Frontend only renders if `textContent.trim().length > 0` (line 998)
   - If no content AND no toolParts: message is SKIPPED (line 1012 returns null)

3. **"Thinking" State Stuck**
   - Location: Chat.tsx, lines 998-1012
   - Logic: Shows ThinkingLoader only if:
     - NO textContent (hasContent = false)
     - AND there ARE toolParts (isThinking = true)
   - If tool parts exist but don't finish executing, stuck in thinking
   - If textContent arrives but is empty/whitespace, still shows thinking

4. **Conversation Naming/Titling Fails Silently**
   - Location: useChatSession.ts, lines 250-267
   - Problem: Title only generated from FIRST user message
   - Logic: `if (firstUserMessage) { ... if (!sessionData.title && ...) { ... } }`
   - If session already has title OR firstUserMessage is falsy, no title set
   - Async/race condition: If saveMessages called multiple times, may skip title generation
   - No error handling or logging if title update fails

5. **Message Persistence Issues**
   - Location: Chat.tsx, line 326 - messages only saved when `status === 'ready'`
   - Problem: saveMessages is debounced by 500ms
   - If user closes chat before debounce fires, messages are LOST
   - If session not created yet, messages don't save (but this is handled)
   - Backend errors silently logged, frontend continues as if saved

6. **Model Mismatch with Non-Basic Models**
   - Location: Chat.tsx, line 193 & chat-stream/index.ts, line 746
   - Frontend default: 'openai/gpt-4o-mini'
   - Backend default: 'openai/gpt-4o-mini' (line 746)
   - Problem: If user selects non-basic model, backend may not handle tool calls properly
   - Tool calling works with gpt-4o-mini but FAILS with some other models
   - No error message when model doesn't support tool calling

7. **Streaming Transport Configuration Bug**
   - Location: Chat.tsx, lines 247-262
   - Transport uses getters: `get filters()`, `get model()`, `get sessionId()`
   - Problem: DefaultChatTransport may evaluate these ONCE at creation, not per-request
   - If refs not updated properly, old values sent to backend
   - Session filters may be stale when messages loaded

## Key Data Flows:

### User Message Send Flow:
```
User types → textarea onChange → handleInputChangeWithMentions → setInput (from AI SDK)
→ User clicks Send → handleChatSubmit 
→ sendMessage({ text: inputToSubmit }) [from AI SDK]
→ DefaultChatTransport sends to /chat-stream endpoint
→ Backend processes and streams back
```

### Response Receive Flow:
```
Backend: /chat-stream → ReadableStream with SSE events
→ DefaultChatTransport parses events
→ useChat hook processes into messages array
→ Chat.tsx maps messages → UserMessage/AssistantMessage components
```

### Message Persistence Flow:
```
messages state changes → useEffect at line 324
→ debouncedSaveMessages (500ms delay)
→ useChatSession.saveMessages mutation
→ Supabase insert chat_messages
→ If first user message, update chat_sessions.title
```

## Critical File Locations:

- Frontend: `/Users/Naegele/dev/brain/src/pages/Chat.tsx` (1150 lines)
- Frontend Transport: `/Users/Naegele/dev/brain/src/components/chat/prompt-input.tsx`
- Backend Streaming: `/Users/Naegele/dev/brain/supabase/functions/chat-stream/index.ts` (955 lines)
- Message Handling: `/Users/Naegele/dev/brain/src/hooks/useChatSession.ts`
- Components: 
  - Message display: `/Users/Naegele/dev/brain/src/components/chat/message.tsx`
  - Tool calls: `/Users/Naegele/dev/brain/src/components/chat/tool-call.tsx`
  - Model selector: `/Users/Naegele/dev/brain/src/components/chat/model-selector.tsx`

## Debugging Steps:

1. Check browser console for errors on message send
2. Check Supabase function logs for /chat-stream errors
3. Verify DefaultChatTransport is properly parsing SSE stream
4. Check if messages array is being updated in Chat.tsx
5. Verify message.parts structure from backend
6. Check if sendMessage is being called
7. Verify transport headers have auth token
8. Check if sessionId is being passed to backend

## Likely Root Causes (in order of probability):

1. **DefaultChatTransport not parsing backend SSE correctly**
   - Backend sends correct format but transport doesn't parse
   - Frontend never receives messages in messages array

2. **Backend streaming protocol mismatch**
   - Backend sends wrong event structure
   - Transport expects different format

3. **Message.parts not populated correctly**
   - AI SDK creating messages without parts
   - getMessageTextContent() returns empty string
   - Messages render as empty

4. **Session/Filter race condition**
   - Filters not loaded before first message sent
   - Backend filters stale
   - Tool results use wrong filter context

5. **Tool calling failure**
   - Model doesn't support tool calling
   - Tool execution fails silently
   - Message stuck in thinking state
