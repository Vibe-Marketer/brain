# Assistant Message Actions Toolbar - Implementation Plan

**Date**: 2026-01-10
**Status**: Planning Phase
**Priority**: High - UX Enhancement

---

## Overview

Add a ChatGPT-style action toolbar underneath each assistant message with 5 key actions:
1. Copy - Copy message text to clipboard
2. Rerun - Regenerate response with same model
3. Rerun with different model - **Unique feature** - select model and regenerate
4. Like/Dislike - Feedback system for response quality
5. Share - Share message or workflow

---

## User Experience Goals

### Current Pain Points
- Users must manually select text to copy (keyboard only)
- No way to retry a response without starting over
- No feedback mechanism for response quality
- No sharing capability

### Desired Experience
- One-click copy of entire response
- Quick regeneration without re-typing
- Model switching without context loss
- Easy feedback collection
- Shareable outputs for collaboration

---

## Design Specification

### Visual Design

**Location**: Directly below each assistant message bubble

**Layout** (Horizontal toolbar):
```
[📋 Copy] [🔄 Rerun] [🔄📊 Rerun with...] [👍] [👎] [🔗 Share]
```

**Styling** (Brand guidelines compliant):
- Background: Transparent or `bg-card` (white light / #202020 dark)
- Border: 1px border-top using `border-border/40`
- Padding: 8px (py-2 px-3)
- Button style: `variant="ghost"` with icon + text
- Icon size: 16px (h-4 w-4) from Remix Icon
- Text: Inter Medium 500, 12px, `text-cb-ink-muted`
- Hover: `bg-cb-hover/50`
- Active state: `text-cb-ink` + `bg-cb-hover`

**Responsive Behavior**:
- Desktop: Show all buttons with text labels
- Mobile: Show icons only, use tooltips

---

## Technical Architecture

### Component Structure

```
AssistantMessage.tsx
└── MessageContent (existing)
└── MessageActionsToolbar (NEW)
    ├── CopyButton
    ├── RerunButton
    ├── RerunWithModelButton
    ├── FeedbackButtons (Like/Dislike)
    └── ShareButton
```

### Data Requirements

**For each action button, we need**:
1. **Message ID** - to reference which message
2. **Message content** - for copy/share
3. **Message context** - user query that prompted this response
4. **Session ID** - for rerun functionality
5. **Model used** - to show current model
6. **Feedback state** - current like/dislike status

---

## Feature Breakdown

### 1. Copy Button

**User Flow**:
1. User clicks "Copy" button
2. Full message text copied to clipboard
3. Button shows "Copied!" confirmation (2 seconds)
4. Button reverts to "Copy"

**Implementation**:
```typescript
// Component: CopyButton.tsx
- Use navigator.clipboard.writeText()
- Toast notification: "Message copied to clipboard"
- Icon: RiFileCopyLine (Remix Icon)
- State: idle | copying | copied
```

**Edge Cases**:
- Clipboard API not available (fallback to execCommand)
- Message contains code blocks (preserve formatting)
- Message has tool calls (extract text only)

---

### 2. Rerun Button

**User Flow**:
1. User clicks "Rerun"
2. System extracts original user query
3. System cancels current streaming (if any)
4. System re-sends query with SAME model
5. New response replaces old one
6. Scroll to message

**Implementation**:
```typescript
// Component: RerunButton.tsx
- Access messages array from useChat
- Find preceding user message
- Call sendMessage() with same text
- Show loading state during regeneration
- Icon: RiRefreshLine (Remix Icon)
```

**Technical Details**:
- Use `reload()` from AI SDK v5 (if available)
- OR manually find user message + call `sendMessage()`
- Handle ongoing streams (cancel first)
- Preserve context attachments if any

**Edge Cases**:
- First message (no user query found)
- Message with context attachments
- Streaming in progress (show warning)

---

### 3. Rerun with Different Model

**User Flow**:
1. User clicks "Rerun with..."
2. Popover opens showing available models
3. User selects different model
4. System re-sends query with NEW model
5. New response replaces old one
6. Model selector updates to show new model

**Implementation**:
```typescript
// Component: RerunWithModelButton.tsx
- Opens Popover with ModelSelector
- On model change:
  - Update selectedModel state
  - Extract original user query
  - Cancel current stream
  - sendMessage() with new model
- Icon: RiRefreshLine + RiArrowDownSLine
```

**UI Design**:
```
┌─────────────────────────────────┐
│ Rerun with different model      │
├─────────────────────────────────┤
│ 🤖 OpenAI: GPT-4o          ✓   │ (current)
│ 🧠 Anthropic: Claude Sonnet-4   │
│ ⚡ OpenAI: GPT-4o-mini          │
│ 🎯 DeepSeek: R1                 │
│ ... (see all models)            │
└─────────────────────────────────┘
```

**Unique Value Prop**:
- **Nobody else does this** - ChatGPT doesn't let you rerun with different model
- Great for comparing model outputs
- Users can test which model works best for their query

**Edge Cases**:
- Model doesn't support tools (warn user)
- Model not available (disable option)
- Context too large for model (truncate or warn)

---

### 4. Like/Dislike Feedback

**User Flow**:
1. User clicks 👍 or 👎
2. Button shows active state (filled icon)
3. Feedback saved to database
4. Optional: Show feedback form ("What could be better?")

**Implementation**:
```typescript
// Component: FeedbackButtons.tsx
- Two buttons: Like (👍) / Dislike (👎)
- Icons: RiThumbUpLine / RiThumbDownLine (outline)
- Active: RiThumbUpFill / RiThumbDownFill (filled)
- Save to new table: message_feedback
```

**Database Schema** (NEW):
```sql
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL, -- AI SDK message ID
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  feedback_comment TEXT, -- Optional elaboration
  model_used TEXT, -- Which model generated this response
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id) -- One feedback per message per user
);

CREATE INDEX idx_message_feedback_user ON message_feedback(user_id);
CREATE INDEX idx_message_feedback_session ON message_feedback(session_id);
CREATE INDEX idx_message_feedback_type ON message_feedback(feedback_type);
```

**What We Can Do With Feedback**:

**Option A: Model Performance Tracking**
- Track which models get more likes/dislikes
- Show user: "GPT-4o has 85% positive feedback on similar queries"
- Auto-suggest best model for query type

**Option B: Prompt Optimization**
- Identify prompts that consistently get dislikes
- A/B test prompt variations
- Track improvement over time

**Option C: Fine-Tuning Data**
- Export liked responses as training data
- Fine-tune custom models on high-quality outputs
- Create domain-specific models

**Option D: User Preferences**
- Learn which response styles user prefers
- Personalize future responses
- "You tend to prefer detailed technical explanations"

**Recommended Start**: Option A (model performance tracking) - easiest to implement and provides immediate value

**Edge Cases**:
- User clicks like then dislike (toggle behavior)
- User clicks same button twice (remove feedback)
- Anonymous users (require login)

---

### 5. Share Button

**User Flow**:
1. User clicks "Share"
2. Dialog opens with sharing options:
   - **Copy link** - URL to shared message
   - **Share entire conversation** - URL to full chat
   - **Export as markdown** - Download .md file
   - **Export as PDF** - Download PDF (future)

**Implementation - Phase 1** (Copy link):
```typescript
// Component: ShareButton.tsx
- Creates shareable URL: /share/:shareId
- Copies URL to clipboard
- Icon: RiShareLine (Remix Icon)
```

**Database Schema** (NEW):
```sql
CREATE TABLE shared_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id TEXT UNIQUE NOT NULL, -- Short code like "abc123"
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_ids UUID[], -- Array of message IDs to share
  share_type TEXT NOT NULL CHECK (share_type IN ('single', 'conversation', 'workflow')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ, -- Optional expiration
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_messages_share_id ON shared_messages(share_id);
CREATE INDEX idx_shared_messages_user ON shared_messages(user_id);
```

**Share Page** (`/share/:shareId`):
- Public view (no login required)
- Shows message(s) in read-only format
- Branded header "Shared from CallVault"
- CTA: "Get CallVault" button
- Track views for analytics

**Implementation - Phase 2** (Markdown export):
```typescript
// Export format
---
CallVault Chat Export
Session: [Title]
Date: [Date]
Model: [Model]
---

USER:
[User message]

ASSISTANT:
[Assistant response]

[Tool calls shown as code blocks]
```

**Privacy Considerations**:
- Default: Private (requires link to access)
- Option: Public (indexed by search engines)
- Option: Password-protected
- Option: Expiration (7 days, 30 days, never)
- Always scrub PII (email, phone, sensitive data)

**Edge Cases**:
- Message contains context from private calls (warn user)
- Sharing workflow with multiple messages
- Expired share links (show 404 page)

---

## Implementation Phases

### Phase 1: Core Actions (Week 1)
**Goal**: Get basic toolbar working

**Day 1-2**: Component Structure
- Create `MessageActionsToolbar.tsx`
- Create individual button components
- Add to `AssistantMessage.tsx`
- Style per brand guidelines

**Day 3-4**: Copy + Rerun
- Implement copy to clipboard
- Implement rerun with same model
- Add loading states
- Add error handling

**Day 5**: Testing & Polish
- Test on mobile/desktop
- Test with tool calls
- Test with code blocks
- Fix edge cases

**Deliverable**: Working toolbar with Copy + Rerun

---

### Phase 2: Model Switching (Week 2)
**Goal**: Unique rerun-with-model feature

**Day 1-2**: UI Implementation
- Build model selector popover
- Show current model indicator
- Filter by supports_tools
- Add model descriptions

**Day 3-4**: Integration
- Hook up model change to sendMessage
- Preserve context on rerun
- Handle model-specific limits
- Update UI after switch

**Day 5**: Testing
- Test with all model providers
- Test context preservation
- Test tool-calling models vs non
- Performance testing

**Deliverable**: Working "Rerun with..." feature

---

### Phase 3: Feedback System (Week 3)
**Goal**: Collect user feedback

**Day 1**: Database
- Create migration for message_feedback table
- Add indexes
- Test CRUD operations

**Day 2-3**: UI Implementation
- Build like/dislike buttons
- Add active states
- Optional feedback form
- Save to database

**Day 4-5**: Analytics
- Build feedback dashboard
- Track model performance
- Identify improvement areas
- Export for fine-tuning

**Deliverable**: Working feedback system with basic analytics

---

### Phase 4: Sharing (Week 4)
**Goal**: Enable message sharing

**Day 1**: Database
- Create shared_messages table
- Generate short share IDs
- Add expiration logic

**Day 2-3**: Share Flow
- Build share dialog
- Generate share links
- Copy link to clipboard
- Track view counts

**Day 4-5**: Public Share Page
- Build /share/:shareId route
- Render message(s) read-only
- Add branding
- PII scrubbing

**Deliverable**: Working share functionality

---

## Success Metrics

### User Engagement
- **Copy usage**: 30%+ of messages copied
- **Rerun usage**: 10%+ of messages rerun
- **Model switch usage**: 5%+ try different model
- **Feedback rate**: 15%+ messages rated
- **Share rate**: 5%+ conversations shared

### Quality Metrics
- **Positive feedback ratio**: 70%+ likes
- **Model comparison data**: Track which models perform best
- **Rerun improvement**: Do users like rerun results better?

### Business Metrics
- **Share CTR**: 10%+ click "Get CallVault"
- **Viral coefficient**: Avg shares per user
- **Feature adoption**: 80%+ users try at least one action

---

## Technical Risks & Mitigation

### Risk 1: Performance
**Problem**: Toolbar adds overhead to every message render
**Mitigation**:
- Memoize toolbar components
- Lazy load share dialog
- Debounce feedback saves

### Risk 2: Clipboard API
**Problem**: Not supported in all browsers
**Mitigation**:
- Feature detection
- Fallback to execCommand
- Show manual copy option

### Risk 3: Model Switching Complexity
**Problem**: Different models have different capabilities/limits
**Mitigation**:
- Filter models by supports_tools
- Validate context size before switch
- Clear error messages

### Risk 4: PII in Shared Messages
**Problem**: Users might share sensitive client data
**Mitigation**:
- Add PII detection (regex for email, phone, SSN)
- Warn before sharing
- Option to review/redact

---

## Open Questions

1. **Rerun Behavior**: Should rerun REPLACE the old message or ADD a new message?
   - **Recommendation**: Add new message (preserves history)
   - Alternative: Replace (cleaner UI, but loses context)

2. **Feedback Form**: Should we ask "Why?" after dislike?
   - **Recommendation**: Yes, optional text input
   - Helps identify specific issues

3. **Share Analytics**: Should we show "Shared X times" badge on messages?
   - **Recommendation**: Yes, for Pro users only
   - Gamification + social proof

4. **Model Switching**: Should we warn if model doesn't support tools?
   - **Recommendation**: Yes, with option to proceed anyway
   - "This model doesn't support tool calling. Continue?"

5. **Mobile Experience**: Should we show abbreviated toolbar on mobile?
   - **Recommendation**: Yes, show icons only + tooltips
   - Full labels on tablet+

---

## Brand Guidelines Compliance

### Colors
- Buttons: `text-cb-ink-muted` default, `text-cb-ink` on hover
- Active state: `text-cb-ink` + `bg-cb-hover`
- Icons: `text-cb-ink-muted` (#7A7A7A light / #6B6B6B dark)
- **NO vibe orange** (not approved for button backgrounds)

### Typography
- Button labels: Inter Medium (500), 12px
- Tooltips: Inter Regular (400), 11px

### Icons
- Library: Remix Icon (per ADR-002)
- Size: 16px (h-4 w-4)
- Style: -line (outlined) for inactive, -fill for active

### Spacing
- Toolbar padding: 8px (py-2 px-3)
- Button gap: 8px (gap-2)
- Icon-text gap: 6px (gap-1.5)

### Layout
- Follows 4px grid (Tailwind defaults)
- Flush left alignment
- Border-top: 1px `border-border/40`

---

## Next Steps

1. **User Approval**: Review this plan, confirm priorities
2. **Design Review**: Create Figma mockup of toolbar
3. **Database Schema**: Get approval for new tables
4. **Phase 1 Start**: Begin implementation Week 1

---

**Questions for Product Owner**:

1. Which phase should we prioritize first?
   - Recommendation: Phase 1 (Copy + Rerun) - highest immediate value

2. Should rerun replace or add a new message?
   - Recommendation: Add new (preserves comparison)

3. Do we want feedback form after dislike?
   - Recommendation: Yes, but optional

4. Share feature scope: Just link or also markdown export?
   - Recommendation: Start with link, add export in Phase 4

5. Privacy default for shares: Private or public?
   - Recommendation: Private (safer default)

---

**End of Implementation Plan**
