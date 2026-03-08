---
created: 2026-01-28T21:06
title: Make chat sources section collapsible
area: ui
files:
  - src/components/chat/* (sources display components)
---

## Problem

The "sources" section at the bottom of chat messages displays all cited calls inline, which can take up significant vertical space and distract from the conversation flow. Users need to see that sources exist (for trust/transparency) but don't always need to see the full list expanded.

A collapsible UI pattern would:
- Show sources are available (collapsed by default)
- Allow users to expand when they want to verify citations
- Keep the chat interface cleaner and more scannable

## Solution

TBD - Implement a collapsible/accordion component for the sources section:
- Collapsed state: "Sources (N)" or similar indicator
- Expanded state: Full list of calls with links
- Click to toggle between states
- Consider animation for smooth expand/collapse
