# CALLVAULT CHAT PAGE - COMPLETE STRUCTURAL DOCUMENTATION

## OVERVIEW

The Chat Page requires a Kortex-style two-column responsive layout that fits WITHIN the existing Main BG-CARD structure. The design maintains the current app shell (TopBar + Main Card) while introducing a new internal layout with a collapsible sidebar for conversation history and a nested inner BG-CARD for the active chat area.

---

## CRITICAL REQUIREMENTS - WHAT STAYS THE SAME

### 1. APP SHELL (DO NOT MODIFY)

The outer application structure remains **100% UNCHANGED**:

| Component | Description | Keep Exactly As-Is |
|-----------|-------------|---------------------|
| TopBar | 52px height, full width, "CallVault" logo left, "HOME" center, search/settings right | ✅ YES |
| Viewport Background | `bg-viewport` (#FCFCFC light / #161616 dark) | ✅ YES |
| Main BG-CARD | `rounded-2xl`, `shadow-lg`, `border border-cb-border`, positioned with `inset-2 top-[52px]` | ✅ YES |
| Card Gutters | 8px right/bottom/left (via `inset-2`) | ✅ YES |
| Bottom Navigation Dock | Home, AI Chat, Settings buttons (floating bottom dock) | ✅ YES |

### 2. MAIN BG-CARD OUTER CONTAINER

The main card container that currently holds the chat page content remains structurally identical:

```html
<!-- THIS OUTER STRUCTURE STAYS EXACTLY THE SAME -->
<main className="fixed inset-2 top-[52px]">
  <div className="bg-card rounded-2xl shadow-lg border border-cb-border h-full overflow-hidden">
    <!-- CHAT PAGE CONTENT GOES HERE - This is what changes -->
  </div>
</main>
```

---

## NEW INTERNAL STRUCTURE - WHAT CHANGES

### Architecture Overview

The INTERIOR of the Main BG-CARD transforms from a single content area to a two-column Kortex-style layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│ MAIN BG-CARD (existing - bg-card, rounded-2xl, shadow-lg)           │
│ ┌──────────────────┬──────────────────────────────────────────────┐ │
│ │                  │                                              │ │
│ │   CONVERSATIONS  │     INNER CHAT BG-CARD                       │ │
│ │   SIDEBAR        │     (new bg-card container)                  │ │
│ │                  │                                              │ │
│ │   - Header       │     ┌──────────────────────────────────────┐ │ │
│ │   - + New Chat   │     │ Chat Header (AI CHAT + Actions)     │ │ │
│ │   - Chat List    │     ├──────────────────────────────────────┤ │ │
│ │   - Scrollable   │     │                                      │ │ │
│ │                  │     │  Chat Messages Area                  │ │ │
│ │   Collapse ←→    │     │  (scrollable)                        │ │ │
│ │                  │     │                                      │ │ │
│ │   W: 280px       │     ├──────────────────────────────────────┤ │ │
│ │   (expanded)     │     │ Input Area (Kortex-style)            │ │ │
│ │                  │     │ + Add context                        │ │ │
│ │   W: 56px        │     │ + Text input                         │ │ │
│ │   (collapsed)    │     │ + Controls bar                       │ │ │
│ │                  │     └──────────────────────────────────────┘ │ │
│ └──────────────────┴──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. SIDEBAR CONTAINER (Left Column - Conversations List)

### 1.1 Main Sidebar Wrapper

| Property | Collapsed State | Expanded State | CSS/Tailwind |
|----------|----------------|----------------|--------------|
| Width | 56px | 280px | `w-[56px]` / `w-[280px]` |
| Height | 100% of parent | 100% of parent | `h-full` |
| Background | Transparent (inherits from card) | Same | `bg-transparent` |
| Border Right | 1px solid #E5E5E5 (light) / #3A3A3A (dark) | Same | `border-r border-cb-border dark:border-cb-border-dark` |
| Transition | 300ms ease-in-out | Same | `transition-all duration-300 ease-in-out` |
| Overflow | Hidden | Auto (vertical scroll) | `overflow-hidden` / `overflow-y-auto` |
| Position | Relative | Same | `relative` |
| Flex Shrink | 0 (don't shrink) | Same | `flex-shrink-0` |

```html
<div className={cn(
  "h-full flex-shrink-0 border-r border-cb-border dark:border-cb-border-dark",
  "transition-all duration-300 ease-in-out overflow-hidden",
  isCollapsed ? "w-[56px]" : "w-[280px]"
)}>
  <!-- Sidebar content -->
</div>
```

### 1.2 Sidebar Header

| Property | Value | CSS/Tailwind |
|----------|-------|--------------|
| Height | 56px | `h-14` |
| Padding | 16px horizontal | `px-4` |
| Display | Flex, space-between, items-center | `flex justify-between items-center` |
| Border Bottom | 1px solid border color | `border-b border-cb-border dark:border-cb-border-dark` |

#### Header Content (Expanded State)

```html
<div className="h-14 px-4 flex justify-between items-center border-b border-cb-border dark:border-cb-border-dark">
  <!-- Title - visible when expanded -->
  <h2 className={cn(
    "font-display text-sm font-extrabold uppercase tracking-wider text-cb-ink dark:text-white",
    "transition-opacity duration-200",
    isCollapsed ? "opacity-0" : "opacity-100"
  )}>
    Conversations
  </h2>

  <!-- New Chat Button -->
  <Button variant="hollow" size="icon" aria-label="New chat">
    <RiAddLine className="h-4 w-4" />
  </Button>
</div>
```

#### Header Content (Collapsed State)

- Title fades out (`opacity-0`)
- - Only "+" icon button visible
  - - Icon button centered in 56px width

    - ### 1.3 Collapse/Expand Toggle Button

    - | Property | Value | Notes |
    - |----------|-------|-------|
    - | Position | Absolute, right edge of sidebar | Overlaps border |
    - | Top | 50% with -translate-y-1/2 | Vertically centered |
    - | Right | -12px (extends outside sidebar) | Creates overlap with main content |
    - | Size | 24px × 24px | `h-6 w-6` |
    - | Background | `bg-card` | Matches card background |
    - | Border | 1px solid border color | `border border-cb-border` |
    - | Border Radius | Full circle | `rounded-full` |
    - | Icon | Chevron left (expanded) / Chevron right (collapsed) | `RiArrowLeftSLine` / `RiArrowRightSLine` |
    - | Z-Index | 10 | Sits above content |
    - | Hover | Background brightens | `hover:bg-cb-hover` |

    - ```html
      <button
        onClick={toggleSidebar}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -right-3",
          "h-6 w-6 rounded-full",
          "bg-card border border-cb-border dark:border-cb-border-dark",
          "flex items-center justify-center",
          "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
          "transition-colors duration-150",
          "z-10 cursor-pointer"
        )}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <RiArrowRightSLine className="h-4 w-4 text-cb-ink-muted" />
        ) : (
          <RiArrowLeftSLine className="h-4 w-4 text-cb-ink-muted" />
        )}
      </button>
      ```

      ### 1.4 Conversation List Container

      | Property | Value | CSS/Tailwind |
      |----------|-------|--------------|
      | Height | Remaining height after header | `flex-1` |
      | Overflow | Vertical scroll | `overflow-y-auto` |
      | Padding | 8px | `p-2` |
      | Scrollbar | Custom explorer-scrollbar | `explorer-scrollbar` |

      ```html
      <div className="flex-1 overflow-y-auto p-2 explorer-scrollbar">
        {conversations.map((conv) => (
          <ConversationItem key={conv.id} {...conv} isCollapsed={isCollapsed} />
        ))}
      </div>
      ```

      ### 1.5 Conversation Item

      #### Expanded State

      | Property | Value | CSS/Tailwind |
      |----------|-------|--------------|
      | Height | Auto (min 44px for touch) | `min-h-[44px]` |
      | Padding | 10px 12px | `py-2.5 px-3` |
      | Border Radius | 8px | `rounded-lg` |
      | Background (Default) | Transparent | `bg-transparent` |
      | Background (Hover) | #F8F8F8 light / #2A2A2A dark | `hover:bg-cb-hover dark:hover:bg-cb-panel-dark` |
      | Background (Active/Selected) | Subtle accent | See below |
      | Text | 14px, font-medium, truncate | `text-sm font-medium truncate` |
      | Text Color | #111111 light / #FFFFFF dark | `text-cb-ink dark:text-white` |
      | Transition | 150ms | `transition-colors duration-150` |
      | Cursor | Pointer | `cursor-pointer` |

      #### Active/Selected State

      ```css
      /* Selected conversation indicator */
      background-color: rgba(217, 252, 103, 0.08); /* Very subtle vibe green tint */
      border-left: 3px solid #D9FC67; /* Vibe green left indicator */
      ```

      #### Collapsed State

      - Show only first letter or chat icon
      - - Tooltip on hover showing full title
        - - Width: 40px, Height: 40px
          - - Centered in 56px sidebar width

            - ```html
              <!-- Expanded conversation item -->
              <div className={cn(
                "min-h-[44px] py-2.5 px-3 rounded-lg cursor-pointer",
                "transition-colors duration-150",
                "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
                isActive && "bg-vibe-green bg-opacity-[0.08] border-l-[3px] border-l-vibe-green"
              )}>
                <p className="text-sm font-medium text-cb-ink dark:text-white truncate">
                  {conversation.title || "New conversation"}
                </p>
                <p className="text-xs text-cb-ink-muted truncate mt-0.5">
                  {formatRelativeTime(conversation.updatedAt)}
                </p>
              </div>

              <!-- Collapsed conversation item (icon only) -->
              <div className={cn(
                "h-10 w-10 mx-auto rounded-lg cursor-pointer",
                "flex items-center justify-center",
                "transition-colors duration-150",
                "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
                isActive && "bg-vibe-green bg-opacity-[0.08]"
              )}>
                <RiChat1Line className="h-5 w-5 text-cb-ink-muted" />
              </div>
              ```

              ### 1.6 Sidebar Animation & Transition Specifications

              | Property | Collapsed | Expanded | Transition |
              |----------|-----------|----------|------------|
              | Width | 56px | 280px | `duration-300 ease-in-out` |
              | Title Opacity | 0 | 1 | `duration-200` (slightly faster) |
              | Title Pointer Events | none | auto | Immediate |
              | Item Labels | Hidden | Visible | `duration-200 delay-100` |
              | Toggle Icon | → (right) | ← (left) | Immediate |

              ---

              ## 2. INNER CHAT BG-CARD (Right Column - Main Chat Area)

              This is a **NEW nested bg-card** container that lives inside the main card, to the right of the sidebar.

              ### 2.1 Inner Card Wrapper

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Flex | 1 (fill remaining space) | `flex-1` |
              | Height | 100% of parent | `h-full` |
              | Display | Flex column | `flex flex-col` |
              | Background | `bg-card` (#FFFFFF light / #202020 dark) | `bg-card` |
              | Border Radius | 16px (top-right and bottom-right only) | `rounded-r-2xl` |
              | Border | 1px solid (left edge only if needed) | `border-l border-cb-border` OR no border |
              | Overflow | Hidden | `overflow-hidden` |
              | Margin | 8px (right, top, bottom) for inner spacing | `m-2 ml-0` |
              | Shadow | Subtle inner shadow (optional) | `shadow-sm` |

              **CRITICAL**: This inner card creates the distinct "card within card" appearance like Kortex, providing visual separation between the sidebar and chat area.

              ```html
              <div className={cn(
                "flex-1 h-full flex flex-col",
                "bg-card rounded-r-2xl",
                "border border-cb-border dark:border-cb-border-dark",
                "m-2 ml-0 overflow-hidden"
              )}>
                <!-- Chat Header -->
                <!-- Chat Messages -->
                <!-- Chat Input -->
              </div>
              ```

              ### 2.2 Chat Header Section

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Height | 56px | `h-14` |
              | Padding | 16px horizontal | `px-4` |
              | Display | Flex, space-between, items-center | `flex justify-between items-center` |
              | Border Bottom | 1px solid border color | `border-b border-cb-border dark:border-cb-border-dark` |
              | Background | Inherit from card | `bg-transparent` |

              ```html
              <div className="h-14 px-4 flex justify-between items-center border-b border-cb-border dark:border-cb-border-dark">
                <!-- Left: Title -->
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-lg font-extrabold uppercase tracking-wide text-cb-ink dark:text-white">
                    AI Chat
                  </h1>
                  <!-- Optional: Context badges -->
                  <Badge variant="outline" className="text-xs">1 call</Badge>
                </div>

                <!-- Right: Actions -->
                <div className="flex items-center gap-2">
                  <Button variant="hollow" size="sm">
                    <RiAddLine className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                  <Button variant="outline" size="sm">
                    <RiFilterLine className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>
              </div>
              ```

              ### 2.3 Chat Messages Area

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Flex | 1 (fill available space) | `flex-1` |
              | Overflow | Vertical scroll | `overflow-y-auto` |
              | Padding | 24px | `p-6` |
              | Scrollbar | Custom explorer-scrollbar | `explorer-scrollbar` |
              | Max Width | Centered content, max 800px | Content uses `max-w-3xl mx-auto` |

              ```html
              <div className="flex-1 overflow-y-auto p-6 explorer-scrollbar">
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} {...message} />
                  ))}
                </div>
              </div>
              ```

              ### 2.4 Message Bubble Specifications

              #### User/Host Messages

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Alignment | Right | `ml-auto` |
              | Max Width | 80% | `max-w-[80%]` |
              | Background | #007AFF (light) / #0A84FF (dark) | `bg-[#007AFF] dark:bg-[#0A84FF]` |
              | Text Color | White | `text-white` |
              | Padding | 12px 16px | `py-3 px-4` |
              | Border Radius | 16px (top-left sharp option) | `rounded-2xl rounded-tr-sm` |
              | Font | 14px, regular | `text-sm font-normal` |

              ```html
              <div className="ml-auto max-w-[80%]">
                <div className="bg-[#007AFF] dark:bg-[#0A84FF] text-white py-3 px-4 rounded-2xl rounded-tr-sm">
                  <p className="text-sm font-normal">{message.content}</p>
                </div>
              </div>
              ```

              #### AI/Assistant Messages

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Alignment | Left | `mr-auto` |
              | Max Width | 85% | `max-w-[85%]` |
              | Background | #F8F8F8 (light) / #2A2A2A (dark) | `bg-cb-hover dark:bg-cb-panel-dark` |
              | Text Color | #111111 (light) / #FFFFFF (dark) | `text-cb-ink dark:text-white` |
              | Border | 1px solid subtle | `border border-cb-border-soft dark:border-cb-border-dark` |
              | Padding | 12px 16px | `py-3 px-4` |
              | Border Radius | 16px (top-right sharp option) | `rounded-2xl rounded-tl-sm` |
              | Font | 14px, light (300) | `text-sm font-light` |

              ```html
              <div className="mr-auto max-w-[85%]">
                <div className="bg-cb-hover dark:bg-cb-panel-dark text-cb-ink dark:text-white py-3 px-4 rounded-2xl rounded-tl-sm border border-cb-border-soft dark:border-cb-border-dark">
                  <p className="text-sm font-light">{message.content}</p>
                </div>
              </div>
              ```

              ### 2.5 Tool/Action Cards (Collapsible)

              When the AI uses tools (like "Get Call Details"), display as collapsible cards:

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Background | Transparent | `bg-transparent` |
              | Border | 1px solid | `border border-cb-border` |
              | Border Radius | 8px | `rounded-lg` |
              | Padding | 8px 12px | `py-2 px-3` |
              | Icon | Tool-specific (RiToolsLine) | `h-4 w-4 text-cb-ink-muted` |
              | Text | 13px, medium | `text-[13px] font-medium` |
              | Chevron | Expand/collapse indicator | `RiArrowDownSLine` / `RiArrowUpSLine` |

              ```html
              <div className="border border-cb-border dark:border-cb-border-dark rounded-lg py-2 px-3 flex items-center justify-between cursor-pointer hover:bg-cb-hover dark:hover:bg-cb-panel-dark transition-colors">
                <div className="flex items-center gap-2">
                  <RiToolsLine className="h-4 w-4 text-cb-ink-muted" />
                  <span className="text-[13px] font-medium text-cb-ink dark:text-white">Get Call Details</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCheckLine className="h-4 w-4 text-green-600" />
                  <RiArrowDownSLine className="h-4 w-4 text-cb-ink-muted" />
                </div>
              </div>
              ```

              ---

              ## 3. INPUT AREA (Kortex-Style Premium Input)

              The input area sits at the bottom of the Inner Chat BG-CARD and follows the Kortex inspiration exactly.

              ### 3.1 Input Container Wrapper

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Padding | 16px | `p-4` |
              | Border Top | 1px solid | `border-t border-cb-border dark:border-cb-border-dark` |
              | Background | Inherit from card | `bg-transparent` |

              ### 3.2 Input Card (Inner Container)

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Background | Slightly different tint | `bg-cb-hover dark:bg-cb-panel-dark` OR `bg-[#FAFAFA] dark:bg-[#1A1A1A]` |
              | Border | 1px solid | `border border-cb-border dark:border-cb-border-dark` |
              | Border Radius | 16px | `rounded-2xl` |
              | Padding | 8px | `p-2` |
              | Shadow | Subtle | `shadow-sm` |

              ```html
              <div className="p-4 border-t border-cb-border dark:border-cb-border-dark">
                <div className="bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-cb-border dark:border-cb-border-dark rounded-2xl p-2 shadow-sm">
                  <!-- Add Context Row -->
                  <!-- Text Input -->
                  <!-- Controls Bar -->
                </div>
              </div>
              ```

              ### 3.3 Add Context Row

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Height | 28px | `h-7` |
              | Padding | 4px 8px | `py-1 px-2` |
              | Display | Flex, start | `flex justify-start items-center` |

              ```html
              <div className="h-7 py-1 px-2 flex justify-start items-center">
                <button className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-xl",
                  "border border-cb-border-soft dark:border-cb-border-dark",
                  "text-xs text-cb-ink-muted",
                  "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
                  "hover:text-cb-ink dark:hover:text-white",
                  "transition-colors duration-150 cursor-pointer"
                )}>
                  <RiAddLine className="h-3.5 w-3.5" />
                  <span>Add context</span>
                </button>
              </div>
              ```

              ### 3.4 Text Input Area

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Min Height | 40px | `min-h-[40px]` |
              | Max Height | 320px (scrollable) | `max-h-[320px]` |
              | Padding | 8px | `p-2` |
              | Background | Transparent | `bg-transparent` |
              | Font | 14px Inter | `text-sm font-normal` |
              | Text Color | #111111 (light) / #FFFFFF (dark) | `text-cb-ink dark:text-white` |
              | Placeholder Color | #7A7A7A | `placeholder:text-cb-ink-muted` |
              | Overflow | Auto (vertical) | `overflow-y-auto` |
              | Outline | None | `focus:outline-none` |
              | Resize | None | `resize-none` |

              ```html
              <div className="p-2 min-h-[40px] max-h-[320px] overflow-y-auto explorer-scrollbar">
                <textarea
                  placeholder="Ask about your transcripts... (type @ to mention a call)"
                  className={cn(
                    "w-full bg-transparent resize-none",
                    "text-sm font-normal text-cb-ink dark:text-white",
                    "placeholder:text-cb-ink-muted",
                    "focus:outline-none"
                  )}
                />
                {/* OR use contenteditable div for rich text like Kortex */}
              </div>
              ```

              ### 3.5 Controls Bar (Footer)

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Height | 40px | `h-10` |
              | Padding | 8px | `p-2` |
              | Display | Flex, space-between, center | `flex justify-between items-center` |
              | Border Top | 1px solid subtle | `border-t border-cb-border-soft dark:border-cb-border-dark` |

              ```html
              <div className="h-10 p-2 flex justify-between items-center border-t border-cb-border-soft dark:border-cb-border-dark">
                <!-- Left: AI Mode & Model Selector -->
                <div className="flex items-center gap-2">
                  <!-- kAI Mode Tag (optional) -->
                  <button className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-xl",
                    "bg-accent-periwinkle bg-opacity-20",
                    "border border-accent-periwinkle border-opacity-50",
                    "text-xs text-accent-periwinkle",
                    "hover:bg-opacity-30 transition-colors cursor-pointer"
                  )}>
                    <RiSparklingLine className="h-3.5 w-3.5" />
                    <span>kAI</span>
                  </button>

                  <!-- Model Selector Dropdown -->
                  <button className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
                    "border border-cb-border dark:border-cb-border-dark",
                    "text-xs text-cb-ink dark:text-white",
                    "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
                    "transition-colors cursor-pointer"
                  )}>
                    <img src="/gemini-logo.svg" className="h-4 w-4" alt="" />
                    <span>Gemini 2 Flash</span>
                    <RiArrowDownSLine className="h-3.5 w-3.5 text-cb-ink-muted" />
                  </button>

                  <!-- Web Search Toggle -->
                  <button className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-xl",
                    "border border-cb-border dark:border-cb-border-dark",
                    "text-cb-ink-muted",
                    "hover:bg-cb-hover dark:hover:bg-cb-panel-dark hover:text-cb-ink dark:hover:text-white",
                    "transition-colors cursor-pointer"
                  )}>
                    <RiGlobalLine className="h-4 w-4" />
                  </button>
                </div>

                <!-- Right: Voice Input & Send -->
                <div className="flex items-center gap-2">
                  <!-- Voice Input -->
                  <button className="p-2 text-cb-ink-muted hover:text-cb-ink dark:hover:text-white transition-colors cursor-pointer">
                    <RiMicLine className="h-5 w-5" />
                  </button>

                  <!-- Send Button -->
                  <Button variant="default" size="sm">
                    <RiSendPlaneLine className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
              ```

              ### 3.6 Keyboard Hint Bar

              | Property | Value | CSS/Tailwind |
              |----------|-------|--------------|
              | Padding | 4px 8px | `py-1 px-2` |
              | Font | 11px | `text-[11px]` |
              | Color | Dim (#7A7A7A) | `text-cb-ink-muted` |
              | Display | Flex, space-between | `flex justify-between items-center` |

              ```html
              <div className="py-1 px-2 text-[11px] text-cb-ink-muted flex justify-between items-center">
                <span>
                  Send with <kbd className="px-1.5 py-0.5 text-[9px] bg-cb-hover dark:bg-cb-panel-dark rounded border border-cb-border dark:border-cb-border-dark font-mono">Enter</kbd>
                </span>
                <span>
                  New line <kbd className="px-1.5 py-0.5 text-[9px] bg-cb-hover dark:bg-cb-panel-dark rounded border border-cb-border dark:border-cb-border-dark font-mono">Shift+Enter</kbd>
                </span>
              </div>
              ```

              ---

              ## 4. COMPLETE HTML/JSX STRUCTURE

              ```jsx
              {/* App Shell - UNCHANGED */}
              <div className="min-h-screen w-full bg-viewport relative">
                <TopBar /> {/* 52px, full width - UNCHANGED */}

                <main className="fixed inset-2 top-[52px]">
                  {/* Main BG-CARD - Container stays the same, INTERIOR changes */}
                  <div className="bg-card rounded-2xl shadow-lg border border-cb-border dark:border-cb-border-dark h-full overflow-hidden">

                    {/* NEW: Flex container for sidebar + chat */}
                    <div className="flex h-full">

                      {/* ===== SIDEBAR (Conversations List) ===== */}
                      <div className={cn(
                        "relative h-full flex-shrink-0",
                        "border-r border-cb-border dark:border-cb-border-dark",
                        "flex flex-col",
                        "transition-all duration-300 ease-in-out",
                        isCollapsed ? "w-[56px]" : "w-[280px]"
                      )}>
                                {/* Sidebar Header */}
                        <div className="h-14 px-4 flex justify-between items-center border-b border-cb-border dark:border-cb-border-dark">
                          <h2 className={cn(
                            "font-display text-sm font-extrabold uppercase tracking-wider",
                            "text-cb-ink dark:text-white",
                            "transition-opacity duration-200",
                            isCollapsed ? "opacity-0" : "opacity-100"
                          )}>
                            Conversations
                          </h2>
                          <Button variant="hollow" size="icon" aria-label="New chat">
                            <RiAddLine className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Conversation List */}
                        <div className="flex-1 overflow-y-auto p-2 explorer-scrollbar">
                          {conversations.map((conv) => (
                            <ConversationItem
                              key={conv.id}
                              {...conv}
                              isCollapsed={isCollapsed}
                              isActive={conv.id === activeConversationId}
                            />
                          ))}
                        </div>

                        {/* Collapse Toggle */}
                        <button
                          onClick={toggleSidebar}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 -right-3 z-10",
                            "h-6 w-6 rounded-full",
                            "bg-card border border-cb-border dark:border-cb-border-dark",
                            "flex items-center justify-center",
                            "hover:bg-cb-hover dark:hover:bg-cb-panel-dark",
                            "transition-colors duration-150 cursor-pointer"
                          )}
                        >
                          {isCollapsed ? (
                            <RiArrowRightSLine className="h-4 w-4 text-cb-ink-muted" />
                          ) : (
                            <RiArrowLeftSLine className="h-4 w-4 text-cb-ink-muted" />
                          )}
                        </button>
                      </div>

                      {/* ===== INNER CHAT BG-CARD ===== */}
                      <div className="flex-1 h-full flex flex-col m-2 ml-0 bg-card rounded-r-2xl border border-cb-border dark:border-cb-border-dark overflow-hidden">

                        {/* Chat Header */}
                        <div className="h-14 px-4 flex justify-between items-center border-b border-cb-border dark:border-cb-border-dark">
                          <div className="flex items-center gap-3">
                            <h1 className="font-display text-lg font-extrabold uppercase tracking-wide text-cb-ink dark:text-white">
                              AI Chat
                            </h1>
                            {contextBadges}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="hollow" size="sm">
                              <RiAddLine className="h-4 w-4 mr-2" />
                              New Chat
                            </Button>
                            <Button variant="outline" size="sm">
                              <RiFilterLine className="h-4 w-4 mr-2" />
                              Filters
                            </Button>
                          </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 explorer-scrollbar">
                          <div className="max-w-3xl mx-auto space-y-4">
                            {messages.map((message) => (
                              <ChatMessage key={message.id} {...message} />
                            ))}
                          </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-cb-border dark:border-cb-border-dark">
                          <div className="bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-cb-border dark:border-cb-border-dark rounded-2xl p-2 shadow-sm">

                            {/* Add Context Row */}
                            <div className="h-7 py-1 px-2 flex justify-start items-center">
                              <AddContextButton />
                            </div>

                            {/* Text Input */}
                            <div className="p-2 min-h-[40px] max-h-[320px] overflow-y-auto explorer-scrollbar">
                              <ChatInput placeholder="Ask about your transcripts... (type @ to mention a call)" />
                            </div>

                            {/* Controls Bar */}
                            <div className="h-10 p-2 flex justify-between items-center border-t border-cb-border-soft dark:border-cb-border-dark">
                              <div className="flex items-center gap-2">
                                <AIModeBadge />
                                <ModelSelector />
                                <WebSearchToggle />
                              </div>
                              <div className="flex items-center gap-2">
                                <VoiceInputButton />
                                <SendButton />
                              </div>
                            </div>

                          </div>

                          {/* Keyboard Hints */}
                          <div className="py-1 px-2 text-[11px] text-cb-ink-muted flex justify-between items-center">
                            <span>Send with <kbd>Enter</kbd></span>
                            <span>New line <kbd>Shift+Enter</kbd></span>
                          </div>
                        </div>

                      </div>
                      {/* End Inner Chat BG-CARD */}

                    </div>
                    {/* End Flex Container */}

                  </div>
                  {/* End Main BG-CARD */}
                </main>

                <BottomDock /> {/* UNCHANGED */}
              </div>
              ```

              ---

              ## 5. RESPONSIVE BEHAVIOR

              ### Desktop (≥1024px)

              - Sidebar expanded by default (280px)
              - - User can toggle collapse/expand
                - - Full two-column layout

                  - ### Tablet (768px - 1023px)

                  - - Sidebar collapsed by default (56px)
                    - - Tap toggle to expand (with overlay)
                      - - When expanded, slight backdrop blur on chat area

                        - ### Mobile (<768px)

                        - - Sidebar completely hidden by default
                          - - Hamburger menu or slide-out drawer pattern
                            - - Full-width chat area
                              - - Floating action button for new chat

---

## 6. ANIMATION SPECIFICATIONS

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Sidebar width | Width transition | 300ms | `ease-in-out` |
| Sidebar labels | Opacity fade | 200ms | `ease` (100ms delay on expand) |
| Toggle button icon | None (instant) | 0ms | - |
| Conversation hover | Background color | 150ms | `ease-out` |
| Message appear | Fade + slide up | 200ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Input focus | Border color | 100ms | `ease` |
| Button hover | Background | 150ms | `ease-out` |

---

## 7. COLOR REFERENCE (FROM BRAND GUIDELINES)

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Viewport BG | #FCFCFC | #161616 |
| Card BG | #FFFFFF | #202020 |
| Inner Input BG | #FAFAFA | #1A1A1A |
| Panel/Hover BG | #F8F8F8 | #2A2A2A |
| Primary Text | #111111 | #FFFFFF |
| Secondary Text | #444444 | #B0B0B0 |
| Muted Text | #7A7A7A | #6B6B6B |
| Border | #E5E5E5 | #3A3A3A |
| Border Soft | #F2F2F2 | #2A2A2A |
| Vibe Green | #D9FC67 | #D9FC67 |
| User Message | #007AFF | #0A84FF |

---

## 8. DOCUMENT VERSION

**Version:** 1.0.0
**Last Updated:** November 27, 2025
**Status:** Complete & Ready for Implementation
**Purpose:** Single source of truth for Chat Page structural implementation

---

## END OF CHAT PAGE STRUCTURE DOCUMENTATION v1.0.0
