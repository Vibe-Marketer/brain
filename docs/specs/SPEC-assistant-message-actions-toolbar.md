# SPEC: Assistant Message Actions Toolbar

## What

Add a ChatGPT-style action toolbar underneath each assistant message bubble in the chat interface. This toolbar provides 5 key actions: Copy (copy message text), Rerun (regenerate with same model), Rerun with different model (unique feature - select and regenerate), Like/Dislike (feedback system), and Share (share message or workflow).

**Files modified:**
- `src/components/chat/message.tsx` - Add MessageActionsToolbar component
- `src/pages/Chat.tsx` - Integrate rerun logic, handle message regeneration
- `supabase/migrations/` - New tables: `message_feedback`, `shared_messages`, `message_context_pairs`

## Why

Users currently lack essential interaction capabilities with AI responses. They must manually select text to copy, cannot retry responses without starting over, have no way to provide feedback on quality, and cannot share useful outputs. This toolbar eliminates these friction points and adds a unique competitive advantage (model switching) that ChatGPT doesn't offer.

## User Experience

### Desktop Experience

Each assistant message shows a subtle toolbar directly underneath the message bubble with 6 buttons in a horizontal row:

```
[📋 Copy] [🔄 Rerun] [🔄📊 Rerun with...] [👍] [👎] [🔗 Share]
```

The toolbar appears on hover (opacity transition) with Inter Medium 12px text labels and 16px Remix icons.

### Mobile Experience (≤768px)

Shows a three-dot menu button that opens a bottom sheet with all 6 actions listed vertically with larger touch targets (44px height minimum).

### Action Behaviors

**1. Copy**
- Click → Full message text (markdown preserved) copied to clipboard
- Button shows "Copied!" confirmation for 2 seconds
- Toast notification: "Message copied to clipboard"
- Handles code blocks and tool calls (extracts text only)

**2. Rerun (Same Model)**
- Click → System extracts original user query from preceding message
- Cancels any active streaming
- Re-sends query with identical model
- **NEW response REPLACES old one in-place** (cleaner UI, user confirmed this behavior)
- Scroll to updated message
- Shows loading spinner during regeneration

**3. Rerun with Different Model**
- Click → Popover opens with model selector (same as header model selector)
- Shows current model with checkmark
- User selects different model
- **NEW response ADDS below old message** (enables comparison, user confirmed)
- Both messages remain visible
- Scroll to new message

**4. Like / Dislike**
- Click 👍 or 👎 → Button shows filled icon, feedback saved
- Clicking same button again removes feedback (toggle off)
- Clicking opposite toggles to new state
- **Always show text input after dislike**: "What could be better?" (required by user)
- Feedback saved with full context (see Database Schemas)

**5. Share**
- Click → Dialog opens with sharing options:
  - Copy link (default)
  - Share conversation summary only (default scope - user confirmed)
  - **Opt-in** to include sources (shows PII warning - user confirmed)
  - Export as markdown
- User chooses what to include (summary, sources, full conversation)
- Generates shareable URL: `/share/:shareId`
- Copies link to clipboard

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| First message in session | Rerun buttons disabled (no preceding user query) |
| Message still streaming | Show "Cancel" instead of "Rerun", disable other actions |
| No user message found | Rerun shows error toast: "Cannot find original query" |
| Clipboard API unavailable | Fallback to `document.execCommand('copy')`, show manual copy dialog if that fails |
| Model doesn't support tools | Show warning: "This model doesn't support tool calling. Some features may not work." |
| Unauthenticated user | Disable Like/Share, show tooltip: "Sign in to use this feature" |
| Message with attachments | Include attachment context in rerun |
| Large context exceeds model limit | Truncate to last N messages (configurable, default 10 - user confirmed) |

## Scope

### Applies to
- `src/components/chat/message.tsx` - New `MessageActionsToolbar` component
- `src/pages/Chat.tsx` - Rerun logic, message regeneration, context handling
- All assistant messages in `/chat` page
- Mobile and desktop viewports

### Does NOT apply to
- User messages (no toolbar)
- System messages
- Tool call messages (only final assistant responses get toolbar)
- Other chat interfaces outside main `/chat` page

## Decisions Made

### 1. Rerun Behavior Split (CRITICAL)
- **"Rerun" button**: Replace old response in-place (cleaner, less clutter)
- **"Rerun with different model"**: Add new message below (enables comparison)
- **Why**: User explicitly confirmed this split approach balances UX simplicity with power user needs

### 2. Context Window Size
- Send last **10 messages** as context when rerunning (configurable via constant)
- **Why**: Balances context quality vs. token cost, prevents exceeding model limits
- Truncation strategy: Keep system message + last N user/assistant pairs

### 3. Feedback Form Always Shows
- **Always** show "What could be better?" text input after dislike
- Optional field (can submit empty)
- **Why**: User explicitly requested this to maximize feedback quality

### 4. Share Scope Defaults
- **Default**: Summary only (no sources, no full conversation)
- **Opt-in**: Include sources (shows PII warning: "Call transcripts may contain sensitive information")
- **Why**: User confirmed this privacy-first approach

### 5. Mobile UX Pattern
- Use three-dot menu → action sheet (not inline buttons)
- **Why**: Prevents toolbar crowding on small screens, standard mobile pattern

### 6. Message Pair Tracking
- Explicitly track user-assistant message pairs in new table `message_context_pairs`
- **Why**: Handles edge cases (multiple user messages, tool calls, etc.) reliably

### 7. Markdown Copy Format
- Preserve markdown formatting when copying
- **Why**: Enables pasting into other markdown editors, maintains structure

### 8. Feedback Data Comprehensiveness
- Store full context: user/assistant pair IDs, model info, session metadata, conversation history reference
- **Goal**: Enable future analysis to optimize system messages, tools, prompts based on feedback patterns (user confirmed this goal)

## Technical Architecture

### Component Structure

```
Chat.tsx
└── AssistantMessage
    ├── MessageContent (existing)
    └── MessageActionsToolbar (NEW)
        ├── CopyButton
        ├── RerunButton  
        ├── RerunWithModelButton
        ├── FeedbackButtons
        └── ShareButton
```

### Data Flow

```
User clicks action
    ↓
MessageActionsToolbar captures event
    ↓
Chat.tsx handler function called
    ↓
[For Rerun] Extract context → Call sendMessage() → Update messages
[For Feedback] Save to message_feedback table
[For Share] Create shared_messages record → Copy link
    ↓
UI updates (button state, messages, toast)
```

### State Management

**Component-level state** (MessageActionsToolbar):
- `copyStatus: 'idle' | 'copying' | 'copied'`
- `isRerunning: boolean`
- `showModelSelector: boolean`
- `feedbackState: null | 'like' | 'dislike'`
- `showFeedbackForm: boolean`
- `showShareDialog: boolean`

**Page-level state** (Chat.tsx):
- No new state needed - uses existing `messages`, `sendMessage`, `selectedModel` from useChat

**Server state** (React Query):
- Feedback mutations: `useMutation` for save/delete feedback
- Share mutations: `useMutation` for create/update shared messages

## Database Schemas

### message_feedback (NEW TABLE)

Comprehensive feedback tracking to enable future optimization of prompts, system messages, and tool configurations based on user feedback patterns.

```sql
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core references
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Message pair tracking (CRITICAL for analysis)
  user_message_id UUID NOT NULL,  -- The query that prompted this response
  assistant_message_id UUID NOT NULL,  -- The response being rated
  message_pair_id UUID REFERENCES message_context_pairs(id) ON DELETE SET NULL,
  
  -- Feedback data
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  feedback_comment TEXT,  -- Optional elaboration (always shown for dislike)
  
  -- Context for analysis
  model_used TEXT NOT NULL,  -- Full model ID (e.g., 'openai/gpt-4o')
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  finish_reason TEXT,
  
  -- Session metadata snapshot (for analysis if session deleted)
  filter_snapshot JSONB,  -- Filters active when message sent
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, assistant_message_id)  -- One feedback per message per user
);

-- Indexes for analysis queries
CREATE INDEX idx_message_feedback_user ON message_feedback(user_id);
CREATE INDEX idx_message_feedback_session ON message_feedback(session_id);
CREATE INDEX idx_message_feedback_type ON message_feedback(feedback_type);
CREATE INDEX idx_message_feedback_model ON message_feedback(model_used);
CREATE INDEX idx_message_feedback_created ON message_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own feedback"
  ON public.message_feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.message_feedback IS 'User feedback on assistant responses - enables prompt/tool optimization';
COMMENT ON COLUMN public.message_feedback.message_pair_id IS 'Links to user-assistant message pair for full context';
COMMENT ON COLUMN public.message_feedback.filter_snapshot IS 'Active filters when message sent (for context analysis)';
```

### message_context_pairs (NEW TABLE)

Explicitly tracks user-assistant message pairs to handle edge cases reliably.

```sql
CREATE TABLE IF NOT EXISTS public.message_context_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core references
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message pair
  user_message_id UUID NOT NULL,  -- User query
  assistant_message_id UUID NOT NULL,  -- Assistant response
  
  -- Context snapshot
  model_used TEXT NOT NULL,
  context_size INTEGER,  -- Number of messages in context window
  had_attachments BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(assistant_message_id)  -- Each assistant message has exactly one pair
);

CREATE INDEX idx_message_pairs_session ON message_context_pairs(session_id);
CREATE INDEX idx_message_pairs_user ON message_context_pairs(user_id);
CREATE INDEX idx_message_pairs_assistant ON message_context_pairs(assistant_message_id);

-- Enable RLS
ALTER TABLE public.message_context_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own message pairs"
  ON public.message_context_pairs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own message pairs"
  ON public.message_context_pairs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.message_context_pairs IS 'Tracks user-assistant message pairs for rerun and feedback context';
```

### shared_messages (NEW TABLE)

```sql
CREATE TABLE IF NOT EXISTS public.shared_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Share identifier
  share_id TEXT UNIQUE NOT NULL,  -- Short code: 8-char alphanumeric (e.g., "a3x9Kp2Q")
  
  -- Core references
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Content
  message_ids UUID[] NOT NULL,  -- Array of message IDs to share
  share_type TEXT NOT NULL CHECK (share_type IN ('single', 'conversation', 'workflow')),
  include_sources BOOLEAN NOT NULL DEFAULT FALSE,  -- User opted in to share sources
  
  -- Privacy & expiration
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,  -- Optional password protection
  expires_at TIMESTAMPTZ,  -- Optional expiration
  
  -- Analytics
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shared_messages_share_id ON shared_messages(share_id);
CREATE INDEX idx_shared_messages_user ON shared_messages(user_id);
CREATE INDEX idx_shared_messages_session ON shared_messages(session_id);
CREATE INDEX idx_shared_messages_created ON shared_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.shared_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own shares"
  ON public.shared_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public shares are viewable by anyone"
  ON public.shared_messages
  FOR SELECT
  USING (is_public = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

COMMENT ON TABLE public.shared_messages IS 'Shareable message links with privacy controls';
COMMENT ON COLUMN public.shared_messages.share_id IS 'Short alphanumeric code for URL (e.g., /share/a3x9Kp2Q)';
```

## Component Specifications

### MessageActionsToolbar Component

**File**: `src/components/chat/message.tsx`

**Props**:
```typescript
interface MessageActionsToolbarProps {
  messageId: string;
  messageContent: string;
  sessionId: string;
  currentModel: string;
  userMessageId?: string;  // Preceding user message (for rerun)
  onRerun?: (model: string) => void;  // Callback for rerun actions
  className?: string;
}
```

**Styling** (Brand Guidelines Compliant):
- Background: Transparent or `bg-card`
- Border: `border-t border-border/40` (1px top border)
- Padding: `py-2 px-3` (8px vertical, 12px horizontal)
- Button style: `variant="ghost"` with icon + text
- Icon size: `h-4 w-4` (16px) from Remix Icon
- Text: `text-xs font-medium text-cb-ink-muted` (Inter Medium 500, 12px)
- Hover: `hover:bg-cb-hover/50 hover:text-cb-ink`
- Active state: `text-cb-ink bg-cb-hover`
- Gap: `gap-2` (8px between buttons)

**Desktop Layout**:
```tsx
<div className="flex items-center gap-2 border-t border-border/40 py-2 px-3">
  <CopyButton />
  <RerunButton />
  <RerunWithModelButton />
  <div className="flex-1" /> {/* Spacer */}
  <FeedbackButtons />
  <ShareButton />
</div>
```

**Mobile Layout** (≤768px):
```tsx
<div className="border-t border-border/40 py-2 px-3">
  <Button variant="ghost" size="sm" onClick={openActionSheet}>
    <RiMoreFill className="h-4 w-4" />
    <span className="sr-only">Message actions</span>
  </Button>
</div>
```

### CopyButton

**Icons**: `RiFileCopyLine` (Remix Icon)

**States**:
- `idle`: "Copy" with line icon
- `copying`: "Copying..." with spinner
- `copied`: "Copied!" with checkmark (2 second timeout)

**Implementation**:
```typescript
const handleCopy = async () => {
  setCopyStatus('copying');
  
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(messageContent);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = messageContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    
    setCopyStatus('copied');
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopyStatus('idle'), 2000);
  } catch (err) {
    setCopyStatus('idle');
    toast.error('Failed to copy message');
  }
};
```

### RerunButton

**Icon**: `RiRefreshLine` (Remix Icon)

**Behavior**:
```typescript
const handleRerun = async () => {
  if (!userMessageId) {
    toast.error('Cannot find original query');
    return;
  }
  
  setIsRerunning(true);
  
  try {
    // Extract user message text
    const userMessage = messages.find(m => m.id === userMessageId);
    if (!userMessage) throw new Error('User message not found');
    
    const userText = getMessageTextContent(userMessage);
    
    // Cancel current stream if active
    if (status === 'streaming') {
      stop();
    }
    
    // Build context window (last N messages)
    const contextMessages = getContextWindow(messages, messageId, CONTEXT_WINDOW_SIZE);
    
    // Re-send with same model
    await sendMessage({
      text: userText,
      experimental_context: contextMessages,
    });
    
    // Replace old message with new response (UI handled by AI SDK)
  } catch (err) {
    toast.error('Failed to regenerate response');
  } finally {
    setIsRerunning(false);
  }
};
```

### RerunWithModelButton

**Icon**: `RiRefreshLine` + `RiArrowDownSLine` (Remix Icon)

**Popover Content**:
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">
      <RiRefreshLine className="h-4 w-4" />
      <span>Rerun with...</span>
      <RiArrowDownSLine className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-[320px]">
    <ModelSelector
      value={currentModel}
      onValueChange={handleModelChange}
      showCurrentIndicator
    />
  </PopoverContent>
</Popover>
```

**Behavior**:
```typescript
const handleModelChange = async (newModel: string) => {
  if (newModel === currentModel) {
    toast.info('Already using this model');
    return;
  }
  
  setShowModelSelector(false);
  setIsRerunning(true);
  
  try {
    const userMessage = messages.find(m => m.id === userMessageId);
    if (!userMessage) throw new Error('User message not found');
    
    const userText = getMessageTextContent(userMessage);
    const contextMessages = getContextWindow(messages, messageId, CONTEXT_WINDOW_SIZE);
    
    // Update selected model (triggers transport recreation)
    setSelectedModel(newModel);
    
    // Send new message (ADDS below old one, doesn't replace)
    await sendMessage({
      text: userText,
      experimental_context: contextMessages,
    });
    
    // Scroll to new message
    scrollToBottom();
  } catch (err) {
    toast.error('Failed to regenerate with new model');
  } finally {
    setIsRerunning(false);
  }
};
```

### FeedbackButtons

**Icons**: 
- Like: `RiThumbUpLine` (outline) / `RiThumbUpFill` (filled)
- Dislike: `RiThumbDownLine` (outline) / `RiThumbDownFill` (filled)

**Layout**:
```tsx
<div className="flex items-center gap-1">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleFeedback('like')}
    className={cn(feedbackState === 'like' && 'text-cb-ink bg-cb-hover')}
  >
    {feedbackState === 'like' ? (
      <RiThumbUpFill className="h-4 w-4" />
    ) : (
      <RiThumbUpLine className="h-4 w-4" />
    )}
    <span className="sr-only">Like</span>
  </Button>
  
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleFeedback('dislike')}
    className={cn(feedbackState === 'dislike' && 'text-cb-ink bg-cb-hover')}
  >
    {feedbackState === 'dislike' ? (
      <RiThumbDownFill className="h-4 w-4" />
    ) : (
      <RiThumbDownLine className="h-4 w-4" />
    )}
    <span className="sr-only">Dislike</span>
  </Button>
</div>

{/* Always show feedback form after dislike */}
{showFeedbackForm && (
  <div className="mt-2 p-3 bg-cb-hover/30 rounded-lg">
    <label className="text-xs font-medium text-cb-ink-muted block mb-1">
      What could be better?
    </label>
    <Textarea
      value={feedbackComment}
      onChange={(e) => setFeedbackComment(e.target.value)}
      placeholder="Optional feedback..."
      className="text-sm"
      rows={2}
    />
    <div className="flex justify-end gap-2 mt-2">
      <Button variant="hollow" size="sm" onClick={() => setShowFeedbackForm(false)}>
        Cancel
      </Button>
      <Button size="sm" onClick={handleSubmitFeedback}>
        Submit
      </Button>
    </div>
  </div>
)}
```

**Mutation Hook**:
```typescript
const saveFeedback = useMutation({
  mutationFn: async ({ type, comment }: { type: 'like' | 'dislike'; comment?: string }) => {
    const { error } = await supabase
      .from('message_feedback')
      .upsert({
        user_id: userId,
        session_id: sessionId,
        user_message_id: userMessageId,
        assistant_message_id: messageId,
        feedback_type: type,
        feedback_comment: comment,
        model_used: currentModel,
        prompt_tokens: message.prompt_tokens,
        completion_tokens: message.completion_tokens,
        finish_reason: message.finish_reason,
        filter_snapshot: getCurrentFilters(),
      });
    
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success('Feedback saved');
  },
  onError: () => {
    toast.error('Failed to save feedback');
  },
});
```

### ShareButton

**Icon**: `RiShareLine` (Remix Icon)

**Dialog Content**:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghost" size="sm">
      <RiShareLine className="h-4 w-4" />
      <span>Share</span>
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Share Message</DialogTitle>
      <DialogDescription>
        Choose what to include in the shareable link
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Scope selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">What to share</label>
        <RadioGroup value={shareScope} onValueChange={setShareScope}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="summary" id="summary" />
            <label htmlFor="summary" className="text-sm">
              Summary only (default)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="with-sources" id="with-sources" />
            <label htmlFor="with-sources" className="text-sm">
              Include sources
            </label>
          </div>
        </RadioGroup>
        
        {shareScope === 'with-sources' && (
          <Alert variant="warning">
            <RiAlertLine className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Call transcripts may contain sensitive information (PII)
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      {/* Expiration */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Expires</label>
        <Select value={expiration} onValueChange={setExpiration}>
          <SelectItem value="never">Never</SelectItem>
          <SelectItem value="7d">7 days</SelectItem>
          <SelectItem value="30d">30 days</SelectItem>
        </Select>
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="hollow" onClick={() => setShowShareDialog(false)}>
        Cancel
      </Button>
      <Button onClick={handleCreateShare}>
        Create Link
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Share Creation**:
```typescript
const createShare = useMutation({
  mutationFn: async () => {
    // Generate short share ID
    const shareId = generateShareId(); // 8-char alphanumeric
    
    const { data, error } = await supabase
      .from('shared_messages')
      .insert({
        share_id: shareId,
        user_id: userId,
        session_id: sessionId,
        message_ids: [messageId],
        share_type: 'single',
        include_sources: shareScope === 'with-sources',
        expires_at: calculateExpiration(expiration),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    const shareUrl = `${window.location.origin}/share/${data.share_id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard');
    setShowShareDialog(false);
  },
  onError: () => {
    toast.error('Failed to create share link');
  },
});

// Share ID generator (8-char alphanumeric)
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

## API Contracts

### Edge Function: None Required

All functionality uses existing `chat-stream` Edge Function. Rerun simply calls `sendMessage()` again through the AI SDK.

### Client-Side Mutations

**Save Feedback**:
```typescript
// Input
{
  user_id: UUID,
  session_id: UUID,
  user_message_id: UUID,
  assistant_message_id: UUID,
  feedback_type: 'like' | 'dislike',
  feedback_comment?: string,
  model_used: string,
  prompt_tokens?: number,
  completion_tokens?: number,
  finish_reason?: string,
  filter_snapshot: JSONB
}

// Response
{
  id: UUID,
  created_at: string
}
```

**Create Share**:
```typescript
// Input
{
  share_id: string,  // 8-char alphanumeric
  user_id: UUID,
  session_id: UUID,
  message_ids: UUID[],
  share_type: 'single' | 'conversation' | 'workflow',
  include_sources: boolean,
  expires_at?: string
}

// Response
{
  id: UUID,
  share_id: string,
  created_at: string
}
```

**View Share (Public Page)**:
```typescript
// GET /share/:shareId
// Returns public-safe message data (no PII if include_sources=false)

{
  share_id: string,
  messages: Array<{
    role: 'user' | 'assistant',
    content: string,
    created_at: string
  }>,
  sources?: Array<{  // Only if include_sources=true
    recording_id: number,
    text: string,
    call_title: string,
    call_date: string
  }>,
  view_count: number,
  created_at: string,
  expires_at?: string
}
```

## Implementation Phases

### Phase 1: Core Actions (Week 1)

**Day 1-2: Component Structure**
- Create `MessageActionsToolbar` component in `message.tsx`
- Add individual button components (CopyButton, RerunButton, etc.)
- Implement brand-compliant styling
- Add to `AssistantMessage` component
- Test mobile/desktop responsive behavior

**Day 3-4: Copy + Rerun**
- Implement clipboard copy with fallback
- Add "Copied!" confirmation state
- Implement rerun logic in `Chat.tsx`
- Extract user message, build context window
- Handle streaming cancellation
- Test with various message types (code blocks, tool calls)

**Day 5: Testing & Polish**
- Test on mobile (Safari, Chrome) and desktop
- Test with code blocks, tool calls, markdown
- Fix edge cases (no user message, first message, streaming)
- Accessibility audit (keyboard nav, screen readers)

**Deliverable**: Working toolbar with Copy + Rerun buttons

---

### Phase 2: Model Switching (Week 2)

**Day 1-2: UI Implementation**
- Build model selector popover integration
- Show current model with checkmark indicator
- Add model descriptions/metadata
- Filter by `supports_tools` flag
- Style per brand guidelines

**Day 3-4: Integration**
- Hook up model change to `setSelectedModel`
- Preserve context on rerun
- Handle model-specific limits (token windows)
- Update transport with new model
- Ensure new message ADDS (doesn't replace)

**Day 5: Testing**
- Test with all OpenRouter providers
- Test context preservation
- Test tool-calling vs. non-tool models
- Performance testing (rapid model switches)
- Edge case handling (unavailable models, timeout)

**Deliverable**: Working "Rerun with different model" feature

---

### Phase 3: Feedback System (Week 3)

**Day 1: Database**
- Create migration for `message_feedback` table
- Create migration for `message_context_pairs` table
- Add indexes (user, session, model, created_at)
- Enable RLS policies
- Test CRUD operations

**Day 2-3: UI Implementation**
- Build like/dislike toggle buttons
- Add active/inactive states (outline vs. filled icons)
- Implement "What could be better?" form
- Save feedback with full context
- Handle toggle logic (like → dislike, remove feedback)

**Day 4-5: Analytics Foundation**
- Create basic feedback dashboard (admin only)
- Track model performance metrics
- Query feedback by model, session, time period
- Export feedback data for analysis
- Document feedback schema for future ML use

**Deliverable**: Working feedback system with basic analytics

---

### Phase 4: Sharing (Week 4)

**Day 1: Database**
- Create migration for `shared_messages` table
- Generate short share IDs (8-char alphanumeric)
- Add expiration logic (triggers or cron)
- Add view count tracking

**Day 2-3: Share Flow**
- Build share dialog with scope selection
- Implement share creation mutation
- Generate shareable links
- Copy link to clipboard
- Show PII warning for sources
- Track share analytics (view count)

**Day 4-5: Public Share Page**
- Build `/share/:shareId` route
- Render messages read-only (no toolbar)
- Add CallVault branding header
- Implement PII scrubbing (if include_sources=false)
- Handle expired/invalid shares (404 page)
- Add "Get CallVault" CTA

**Deliverable**: Working share functionality with public view page

## Success Metrics

### User Engagement (30-day rolling)
- **Copy usage**: ≥30% of assistant messages copied
- **Rerun usage**: ≥10% of messages rerun (same model)
- **Model switch usage**: ≥5% try different model
- **Feedback rate**: ≥15% of messages rated (like or dislike)
- **Share rate**: ≥5% of conversations shared

### Quality Metrics
- **Positive feedback ratio**: ≥70% likes vs. dislikes
- **Rerun satisfaction**: Track if rerun messages get better feedback than originals
- **Model performance**: Rank models by like/dislike ratio
- **Feedback comment rate**: ≥40% of dislikes include comment

### Business Metrics
- **Share CTR**: ≥10% of share page viewers click "Get CallVault"
- **Viral coefficient**: Average shares per active user
- **Feature adoption**: ≥80% of users try at least one action
- **Retention impact**: Compare retention of users who use toolbar vs. those who don't

### Technical Metrics
- **Toolbar render time**: <50ms (no perceptible lag)
- **Copy success rate**: ≥99.5% (including fallback)
- **Rerun error rate**: <2%
- **Share page load time**: <1.5s (p95)

## Brand Compliance

### Colors (STRICT)
- **NO vibe orange** on buttons (prohibited for button backgrounds)
- Use `text-cb-ink-muted` (#7A7A7A light / #6B6B6B dark) for default state
- Use `text-cb-ink` (#111111 light / #FFFFFF dark) on hover/active
- Active feedback buttons: `bg-cb-hover` with `text-cb-ink`

### Typography
- **Button labels**: Inter Medium (500), 12px (`text-xs font-medium`)
- **Tooltips**: Inter Regular (400), 11px
- **Feedback form label**: Inter Medium (500), 12px uppercase
- **Never use** Montserrat in this component (reserved for headings)

### Icons (Remix Icon Library)
- **Library**: `@remixicon/react` (per ADR-002)
- **Size**: 16px (`h-4 w-4`) for all toolbar icons
- **Style**: `-line` (outlined) for inactive, `-fill` for active
- **Color**: `text-cb-ink-muted` default, `text-cb-ink` on hover

**Icon Mapping**:
- Copy: `RiFileCopyLine`
- Rerun: `RiRefreshLine`
- Model selector dropdown: `RiArrowDownSLine`
- Like: `RiThumbUpLine` / `RiThumbUpFill`
- Dislike: `RiThumbDownLine` / `RiThumbDownFill`
- Share: `RiShareLine`
- More (mobile): `RiMoreFill`
- Alert (PII warning): `RiAlertLine`

### Spacing (4px Grid)
- Toolbar padding: `py-2 px-3` (8px vertical, 12px horizontal)
- Button gap: `gap-2` (8px)
- Icon-text gap: `gap-1.5` (6px)
- Feedback form margin: `mt-2` (8px)

### Layout
- **Border**: `border-t border-border/40` (1px top, 40% opacity)
- **Background**: Transparent default, `bg-card` on hover
- **Alignment**: Left-justified, items-center
- **Mobile breakpoint**: 768px (`md:`)

### Accessibility (WCAG AA)
- **Contrast**: All text meets 4.5:1 minimum
- **Touch targets**: 44x44px minimum on mobile
- **Keyboard nav**: All buttons focusable, Enter/Space to activate
- **Screen readers**: `aria-label` on icon-only buttons, `sr-only` text for mobile
- **Focus states**: 2px outline on keyboard focus

## Open Questions

None - All critical decisions confirmed by user during spec process.

## Priority

### Must Have (Phase 1)
- Copy button with clipboard integration
- Rerun button with same model
- Basic toolbar UI (desktop + mobile)
- Error handling and edge cases

### Should Have (Phase 2-3)
- Rerun with different model selector
- Like/Dislike feedback system
- Feedback analytics foundation
- Message pair tracking

### Nice to Have (Phase 4)
- Share functionality
- Public share page
- Markdown export
- Share analytics dashboard

---

**Document Version**: 1.0
**Created**: 2026-01-09
**Status**: Ready for Implementation

END OF SPEC
