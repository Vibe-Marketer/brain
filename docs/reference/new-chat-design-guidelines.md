# CONVERSION BRAIN CHAT PAGE - COMPLETE STRUCTURAL DOCUMENTATION

## Executive Summary

This document provides a **pixel-perfect implementation guide** for the Conversion Brain chat interface that mirrors how desktop applications work: a main viewport (like your screen) contains an application window (like opening Kortex in a browser).

**The Two-Card System:**
- **BG-CARD-MAIN**: The "browser window" - the outermost application container
- **BG-CARD-INNER**: The "web app content" - contains chat messages and input

**Critical Principle:** Both cards use **identical styling rules**. The only difference is their **navigation pattern**:
- BG-CARD-MAIN has NO navigation (it's just the container frame)
- BG-CARD-INNER has a **sidebar** for chat session navigation

Think of it like this: BG-CARD-MAIN is your browser window, BG-CARD-INNER is the website inside it. The website has its own navigation (sidebar), but the browser window itself doesn't.

***

## Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ VIEWPORT (bg-viewport)                                          │
│ = Your desktop background                                       │
│ Color: #FCFCFC (light) / #161616 (dark)                        │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ TOPBAR                                                    │   │
│ │ = Browser tab bar (like Chrome tabs)                     │   │
│ │ Height: 52px                                              │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ BG-CARD-MAIN                                              │   │
│ │ = Browser window (like Chrome window)                    │   │
│ │ Color: #FFFFFF (light) / #202020 (dark)                  │   │
│ │ rounded-2xl, shadow-lg, border, px-10                     │   │
│ │                                                            │   │
│ │ [flex gap-4 layout starts here - NO header, NO wrapper]   │   │
│ │                                                            │   │
│ │ ┌──────────────┬────────────────────────────────────────┐ │   │
│ │ │ SIDEBAR      │ BG-CARD-INNER                          │ │   │
│ │ │              │ = Website content (like kortex.app)    │ │   │
│ │ │ Navigation   │ Color: #FFFFFF (light) / #202020 (dark)│ │   │
│ │ │ for chat     │ rounded-2xl, shadow-lg, border         │ │   │
│ │ │ sessions     │                                        │ │   │
│ │ │              │ ┌──────────────────────────────────┐   │ │   │
│ │ │ - Pinned     │ │ HEADER                           │   │ │   │
│ │ │ - Recent     │ │ "AI Chat" + buttons              │   │ │   │
│ │ │ - Archived   │ └──────────────────────────────────┘   │ │   │
│ │ │              │                                        │ │   │
│ │ │              │ ┌──────────────────────────────────┐   │ │   │
│ │ │              │ │ MESSAGES (scrollable)            │   │ │   │
│ │ │              │ │ - Welcome                        │   │ │   │
│ │ │              │ │ - User messages                  │   │ │   │
│ │ │              │ │ - AI responses                   │   │ │   │
│ │ │              │ └──────────────────────────────────┘   │ │   │
│ │ │              │                                        │ │   │
│ │ │              │ ┌──────────────────────────────────┐   │ │   │
│ │ │              │ │ INPUT (fixed at bottom)          │   │ │   │
│ │ │              │ │ - Textarea                       │   │ │   │
│ │ │              │ │ - Model selector                 │   │ │   │
│ │ │              │ │ - Send button                    │   │ │   │
│ │ │              │ └──────────────────────────────────┘   │ │   │
│ │ └──────────────┴────────────────────────────────────────┘ │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

***

## The Two-Card System Explained

### BG-CARD-MAIN (Browser Window)

**What it is:** The outermost application container, like a browser window (Chrome, Arc, Comet).

**What it does:** 
- Provides a rounded, elevated surface for the entire application
- Creates the "frame" with padding (gutters) around the content
- Has NO navigation of its own - it's just a container

**Styling (MEMORIZE THESE - THEY APPLY TO BOTH CARDS):**

```tsx
className="bg-card rounded-2xl shadow-lg border border-border px-10 overflow-hidden"
```

| Property | Value | Why |
|----------|-------|-----|
| `bg-card` | `#FFFFFF` (light) / `#202020` (dark) | Main surface color |
| `rounded-2xl` | 16px border radius | Smooth, premium corners |
| `shadow-lg` | Large shadow | Floating/elevated effect |
| `border border-border` | 1px subtle border | Edge definition |
| `px-10` | 40px horizontal padding | Side gutters |
| `overflow-hidden` | Clips children | Prevents content overflow |

**What goes inside:**
```tsx
<div className="bg-card rounded-2xl shadow-lg border border-border px-10 overflow-hidden h-full">
  <div className="flex gap-4 h-full py-4">
    <Sidebar />           {/* Chat session navigation */}
    <BG-CARD-INNER />     {/* The actual chat interface */}
  </div>
</div>
```

**Key point:** The `flex gap-4 h-full py-4` layout is the ONLY child of BG-CARD-MAIN. No header, no wrapper, no intermediate containers.

***

### BG-CARD-INNER (Website Content)

**What it is:** The nested card containing the actual chat interface, like a website loaded in the browser window.

**What it does:**
- Contains the chat header ("AI Chat" title + buttons)
- Contains the messages area (scrollable)
- Contains the input area (fixed at bottom)

**Styling (IDENTICAL to BG-CARD-MAIN):**

```tsx
className="flex-1 bg-card rounded-2xl shadow-lg border border-border overflow-hidden flex flex-col"
```

| Property | Value | Why |
|----------|-------|-----|
| `flex-1` | Grows to fill space | Takes remaining width after sidebar |
| `bg-card` | `#FFFFFF` (light) / `#202020` (dark) | **SAME as BG-CARD-MAIN** |
| `rounded-2xl` | 16px border radius | **SAME as BG-CARD-MAIN** |
| `shadow-lg` | Large shadow | **SAME as BG-CARD-MAIN** |
| `border border-border` | 1px subtle border | **SAME as BG-CARD-MAIN** |
| `overflow-hidden` | Clips children | **SAME as BG-CARD-MAIN** |
| `flex flex-col` | Vertical stacking | Header → Messages → Input |

**What goes inside:**
```tsx
<div className="flex-1 bg-card rounded-2xl shadow-lg border border-border overflow-hidden flex flex-col">
  <Header />          {/* "AI Chat" + New Chat/Filters buttons */}
  <Messages />        {/* Scrollable chat content */}
  <InputArea />       {/* Fixed at bottom */}
</div>
```

***

## The Card Styling Rules (Universal)

**These rules apply to BOTH BG-CARD-MAIN and BG-CARD-INNER:**

### Core Card Properties

| Property | Value | Light Mode | Dark Mode | Purpose |
|----------|-------|------------|-----------|---------|
| **Background** | `bg-card` | `#FFFFFF` | `#202020` | Main surface color |
| **Border Radius** | `rounded-2xl` | 16px | 16px | Smooth corners |
| **Shadow** | `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | `0 10px 15px -3px rgba(0,0,0,0.3)` | Elevation/depth |
| **Border** | `border border-border` | `#E5E5E5` | `#3A3A3A` | Edge definition |
| **Overflow** | `overflow-hidden` | - | - | Clips content to border radius |

### How Depth is Created

Since both cards use the **same background color**, depth is achieved through:

1. **Shadow**: `shadow-lg` creates a floating effect
2. **Border**: Subtle 1px border provides edge definition
3. **Spacing**: 16px gap (`gap-4`) between elements
4. **Z-index**: Layering when needed (mobile sidebar overlay)

**NOT through different background colors!** Both cards are `bg-card` - the same color.

***

## Component Hierarchy with Clear Labels

### Level 0: Viewport (Desktop Background)

```tsx
<div className="min-h-screen w-full bg-viewport relative">
  {/* Everything lives here */}
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| `bg-viewport` | `#FCFCFC` (light) / `#161616` (dark) | Subtle gray background |
| `min-h-screen` | 100vh | Full viewport height |
| `w-full` | 100% | Full viewport width |

**What it represents:** Your desktop background or browser chrome.

***

### Level 1: TopBar (Browser Tab Bar)

```tsx
<TopBar /> {/* 52px height */}
```

| Property | Value | Purpose |
|----------|-------|---------|
| Height | `52px` | Fixed height |
| Width | `100%` | Full width |
| Position | `relative` | Normal flow |

**What it represents:** Browser tabs (like Chrome's tab bar at the top).

***

### Level 2: BG-CARD-MAIN (Browser Window)

```tsx
<main className="fixed inset-2 top-[52px]">
  <div 
    className="bg-card rounded-2xl shadow-lg border border-border px-10 overflow-hidden h-full"
    id="BG-CARD-MAIN"
  >
    {/* Level 3 goes here */}
  </div>
</main>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Position | `fixed inset-2 top-[52px]` | 8px gutters, 52px top offset |
| Background | `bg-card` | Main surface |
| Border Radius | `rounded-2xl` (16px) | Smooth corners |
| Shadow | `shadow-lg` | Elevation |
| Border | `border border-border` | Edge definition |
| Padding | `px-10` (40px) | Side gutters |
| Overflow | `overflow-hidden` | Clips children |
| Height | `h-full` | Fills available space |

**What it represents:** A browser window (Chrome, Arc, Comet) containing a web application.

**What goes inside:** A flex layout with sidebar + inner card (NO header, NO wrapper).

***

### Level 3: Flex Container (Direct Child of BG-CARD-MAIN)

```tsx
<div className="flex gap-4 h-full py-4">
  {/* Sidebar */}
  {/* BG-CARD-INNER */}
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Display | `flex` | Side-by-side layout |
| Gap | `gap-4` (16px) | Space between sidebar and inner card |
| Height | `h-full` | Fills BG-CARD-MAIN |
| Padding | `py-4` (16px) | Top/bottom spacing |

**CRITICAL:** This is a **direct child** of BG-CARD-MAIN. No header above it, no wrapper around it.

***

### Level 4a: Sidebar (Chat Session Navigation)

```tsx
<div className="w-[280px] flex-shrink-0">
  <div className="bg-card h-full flex flex-col rounded-lg border border-border">
    {/* Sidebar content */}
  </div>
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Width | `w-[280px]` | Fixed 280px (expanded) |
| Width (collapsed) | `w-[60px]` | Icon-only mode |
| Flex Shrink | `flex-shrink-0` | Prevents compression |
| Background | `bg-card` | **SAME as both cards** |
| Border Radius | `rounded-lg` (8px) | Slightly less rounded than main cards |
| Border | `border border-border` | Edge definition |

**What it represents:** Navigation for chat sessions (like a file explorer sidebar).

**Contains:**
- Header with "Chat History" title + collapse toggle
- Pinned sessions (scrollable, max 200px)
- Recent sessions (scrollable, fills remaining space)
- Archived sessions (collapsible section)

***

### Level 4b: BG-CARD-INNER (Chat Interface)

```tsx
<div 
  className="flex-1 bg-card rounded-2xl shadow-lg border border-border overflow-hidden flex flex-col"
  id="BG-CARD-INNER"
>
  {/* Level 5 goes here */}
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Flex | `flex-1` | Fills remaining width after sidebar |
| Background | `bg-card` | **SAME as BG-CARD-MAIN** |
| Border Radius | `rounded-2xl` (16px) | **SAME as BG-CARD-MAIN** |
| Shadow | `shadow-lg` | **SAME as BG-CARD-MAIN** |
| Border | `border border-border` | **SAME as BG-CARD-MAIN** |
| Overflow | `overflow-hidden` | **SAME as BG-CARD-MAIN** |
| Display | `flex flex-col` | Vertical stacking (header, messages, input) |

**What it represents:** The actual chat interface (like the Kortex web app content).

**Contains:**
- Header ("AI Chat" title + action buttons)
- Messages area (scrollable)
- Input area (fixed at bottom)

***

### Level 5: BG-CARD-INNER Children

#### Header Section

```tsx
<div className="px-6 py-4 border-b border-border flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Button className="md:hidden" onClick={() => setShowSidebar(true)}>
      <RiMenuLine />
    </Button>
    <h1 className="font-display text-lg font-extrabold uppercase text-cb-ink">
      AI Chat
    </h1>
  </div>
  <div className="flex gap-2">
    <Button variant="hollow" size="sm">New Chat</Button>
    <Button variant="outline" size="sm">Filters</Button>
  </div>
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Padding | `px-6 py-4` | 24px horizontal, 16px vertical |
| Border | `border-b border-border` | Bottom separator |
| Display | `flex items-center justify-between` | Horizontal layout with space-between |

#### Messages Area

```tsx
<ChatContainerRoot className="flex-1 overflow-hidden">
  <ChatContainerContent className="px-6 py-4">
    {/* ChatWelcome, UserMessage, AssistantMessage, etc. */}
  </ChatContainerContent>
  <ScrollButton />
</ChatContainerRoot>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Flex | `flex-1` | Fills space between header and input |
| Overflow | `overflow-hidden` | Scrolls internally |
| Padding | `px-6 py-4` | 24px horizontal, 16px vertical |

#### Input Area

```tsx
<div className="border-t border-border px-6 py-4">
  <PromptInput>
    <PromptInputTextarea />
    <PromptInputFooter>
      <ModelSelector />
      <Button type="submit">Send</Button>
    </PromptInputFooter>
  </PromptInput>
  <PromptInputHintBar>
    <KeyboardHint label="Send with" shortcut="Enter" />
  </PromptInputHintBar>
</div>
```

| Property | Value | Purpose |
|----------|-------|---------|
| Border | `border-t border-border` | Top separator |
| Padding | `px-6 py-4` | 24px horizontal, 16px vertical |
| Background | `bg-card` | **SAME as container** (no separate color) |

***

## The Mirror Principle

**BG-CARD-MAIN** and **BG-CARD-INNER** are **mirrors** of each other with ONE difference:

### What's the SAME:
- ✅ Background color (`bg-card`)
- ✅ Border radius (`rounded-2xl` = 16px)
- ✅ Shadow (`shadow-lg`)
- ✅ Border (`border border-border`)
- ✅ Overflow handling (`overflow-hidden`)

### What's DIFFERENT:
- ❌ **Navigation pattern only**
  - BG-CARD-MAIN: NO navigation (just a container)
  - BG-CARD-INNER: Has header with title + action buttons

**Think of it like:**
- **BG-CARD-MAIN** = Browser window (no navigation inside the window frame)
- **BG-CARD-INNER** = Website (has its own navigation/header)

The browser window doesn't have navigation. The website inside it does.

***

## Naming Convention Reference

| Label | What It Is | CSS Classes | Color |
|-------|-----------|-------------|-------|
| **VIEWPORT** | Desktop background | `bg-viewport` | `#FCFCFC` / `#161616` |
| **TOPBAR** | Browser tabs | `h-[52px]` | Component-specific |
| **BG-CARD-MAIN** | Browser window | `bg-card rounded-2xl shadow-lg border px-10` | `#FFFFFF` / `#202020` |
| **SIDEBAR** | Session navigation | `bg-card rounded-lg border` | `#FFFFFF` / `#202020` |
| **BG-CARD-INNER** | Chat interface | `bg-card rounded-2xl shadow-lg border` | `#FFFFFF` / `#202020` |

**Notice:** SIDEBAR, BG-CARD-MAIN, and BG-CARD-INNER all use `bg-card` - the **same color**.

***

## Quick Reference: The Two Cards Side-by-Side

| Aspect | BG-CARD-MAIN | BG-CARD-INNER |
|--------|--------------|---------------|
| **Purpose** | Browser window frame | Chat interface content |
| **Background** | `bg-card` (`#FFFFFF` / `#202020`) | `bg-card` (`#FFFFFF` / `#202020`) ✓ SAME |
| **Border Radius** | `rounded-2xl` (16px) | `rounded-2xl` (16px) ✓ SAME |
| **Shadow** | `shadow-lg` | `shadow-lg` ✓ SAME |
| **Border** | `border border-border` | `border border-border` ✓ SAME |
| **Overflow** | `overflow-hidden` | `overflow-hidden` ✓ SAME |
| **Padding** | `px-10` (40px sides) | None (padding in children) |
| **Direct Children** | Flex layout (sidebar + inner card) | Header, Messages, Input |
| **Navigation** | NONE (just container) | Header with title + buttons |
| **Can have header above?** | ❌ NO - breaks the design | ✓ YES - header goes INSIDE |

***

## Implementation Code with Clear Labels

```tsx
export default function Chat() {
  return (
    <div className="flex h-[calc(100vh-52px)] bg-viewport">
      {/* LABEL: VIEWPORT */}
      
      {/* Mobile sidebar backdrop */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" />
      )}

      {/* LABEL: BG-CARD-MAIN CONTAINER */}
      <div className="flex-1 p-2 md:p-4">
        <div 
          className="bg-card rounded-2xl shadow-lg border border-border h-full px-10 overflow-hidden flex gap-4 py-4"
          data-component="BG-CARD-MAIN"
        >
          {/* ⚠️ CRITICAL: NO HEADER HERE - Flex layout starts immediately */}
          
          {/* LABEL: SIDEBAR (Chat Session Navigation) */}
          <div className={`
            ${showSidebar ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden'}
            md:block md:relative md:z-auto md:shadow-none
            ${sidebarCollapsed ? 'w-[60px]' : 'w-[280px]'}
            flex-shrink-0 transition-all duration-200
          `}>
            <div 
              className="bg-card h-full flex flex-col rounded-lg border border-border"
              data-component="SIDEBAR"
            >
              {/* Sidebar Header */}
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-display text-xs font-extrabold uppercase">
                  Chat History
                </h3>
                <Button variant="ghost" size="icon" onClick={toggleCollapse}>
                  <RiMenuLine />
                </Button>
              </div>

              {/* Pinned, Recent, Archived sections */}
              {/* ... */}
            </div>
          </div>

          {/* LABEL: BG-CARD-INNER (Chat Interface) */}
          <div 
            className="flex-1 bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col"
            data-component="BG-CARD-INNER"
          >
            
            {/* HEADER - Goes INSIDE BG-CARD-INNER */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                <Button className="md:hidden" onClick={() => setShowSidebar(true)}>
                  <RiMenuLine />
                </Button>
                <h1 className="font-display text-lg font-extrabold uppercase">
                  AI Chat
                </h1>
              </div>
              <div className="flex gap-2">
                <Button variant="hollow" size="sm">New Chat</Button>
                <Button variant="outline" size="sm">Filters</Button>
              </div>
            </div>

            {/* MESSAGES AREA */}
            <ChatContainerRoot className="flex-1 overflow-hidden">
              <ChatContainerContent className="px-6 py-4">
                {messages.length === 0 && <ChatWelcome />}
                {messages.map(m => (
                  <div key={m.id}>
                    {m.role === 'user' && <UserMessage>{m.content}</UserMessage>}
                    {m.role === 'assistant' && <AssistantMessage>{m.content}</AssistantMessage>}
                  </div>
                ))}
                {isLoading && <ThinkingLoader />}
              </ChatContainerContent>
              <ScrollButton />
            </ChatContainerRoot>

            {/* INPUT AREA */}
            <div className="border-t border-border px-6 py-4">
              <PromptInput>
                <PromptInputTextarea placeholder="Ask about your transcripts..." />
                <PromptInputFooter>
                  <ModelSelector />
                  <Button type="submit">Send</Button>
                </PromptInputFooter>
              </PromptInput>
              <PromptInputHintBar>
                <KeyboardHint label="Send with" shortcut="Enter" />
              </PromptInputHintBar>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
```

***

## Beginner-Friendly Summary

**If you've never seen this project before, here's what you need to know:**

1. **Two cards, same styling:** BG-CARD-MAIN and BG-CARD-INNER look identical (same color, border radius, shadow, border)

2. **BG-CARD-MAIN is the browser window:** It's the outer frame. It has NO navigation, NO header - just a container with padding.

3. **BG-CARD-INNER is the website:** It's the chat interface inside the browser. It HAS a header with "AI Chat" and buttons.

4. **Sidebar sits BETWEEN the cards:** At the same level as BG-CARD-INNER, it provides chat session navigation.

5. **Direct flex layout:** BG-CARD-MAIN's only child is a flex container with sidebar + inner card. No wrappers, no intermediate containers.

6. **Same rules for both cards:**
   - Background: `bg-card` (white/dark gray)
   - Corners: `rounded-2xl` (16px)
   - Shadow: `shadow-lg`
   - Border: `border border-border` (1px)

7. **The ONLY difference:** BG-CARD-MAIN has no navigation; BG-CARD-INNER has a header with navigation buttons.

**Think:** Browser window (BG-CARD-MAIN) → Sidebar (navigation) → Website (BG-CARD-INNER)

That's it! Everything else is just details.

Sources
