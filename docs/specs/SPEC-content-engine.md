# SPEC: Content Hub

**Version:** 2.0
**Status:** Draft
**Created:** 2026-01-10
**Author:** Claude (from user requirements)

---

## 1. Vision

The **Content Hub** is CallVault's content creation center. It transforms call transcripts (and eventually other sources) into ready-to-use marketing content through AI-powered generators.

**This is the foundation for a content platform**, not just a feature. Every decision should consider future expansion: additional generators, custom uploads, team collaboration, and platform integrations.

### Core User Value

> "I had a great sales call. Now I have a week's worth of social content and email copy—grounded in real customer conversations."

### Inspiration

Draw from modern content platforms:
- **Jasper / Copy.ai** - Template-based generation with libraries
- **Taplio / Hypefury** - Hook-first content creation
- **Notion AI** - Contextual generation within workspace
- **Buffer / Later** - Content library management

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CONTENT HUB                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   SOURCES                    GENERATORS              LIBRARIES   │
│   ─────────                  ──────────              ─────────   │
│   ┌─────────┐               ┌──────────┐            ┌─────────┐  │
│   │Transcripts│────────────▶│  Call    │───────────▶│  Hooks  │  │
│   │  (MVP)  │              │ Content  │            └─────────┘  │
│   └─────────┘              │Generator │            ┌─────────┐  │
│   ┌─────────┐              └──────────┘───────────▶│  Posts  │  │
│   │ Uploads │              ┌──────────┐            └─────────┘  │
│   │  (v2)   │─ ─ ─ ─ ─ ─ ─▶│ (Future) │            ┌─────────┐  │
│   └─────────┘              └──────────┘───────────▶│ Emails  │  │
│                                                     └─────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Key Principles:**

1. **Generators are modular** — Each is a self-contained workflow card. Adding new generators doesn't require restructuring.

2. **Libraries are shared** — All generators output to the same libraries. A hook is a hook, regardless of which generator created it.

3. **Sources are extensible** — Transcripts now, uploads and integrations later.

4. **Business context is global** — User profile data feeds all generators.

---

## 3. Navigation & Information Architecture

Content Hub lives as a new top-level section in the sidebar, alongside Home, AI Chat, etc.

```
├── Home
├── AI Chat
├── Sorting
├── Collaboration
├── Content                 ◀── NEW
│   ├── [Overview]          (default landing)
│   ├── Generators
│   └── Library
│       ├── Hooks
│       ├── Posts
│       └── Emails
└── Settings
    └── Business Profile    ◀── NEW (or within existing Settings)
```

### Page Breakdown

| Route | Purpose |
|-------|---------|
| `/content` | Overview dashboard with stats, recent content, quick actions |
| `/content/generators` | Grid of available generators (MVP: just Call Content) |
| `/content/generators/call-content` | The Call Content Generator wizard |
| `/content/library/hooks` | Hooks library with filtering, favorites, copy |
| `/content/library/posts` | Posts library with edit, regenerate, copy |
| `/content/library/emails` | Emails library with edit, regenerate, copy |
| `/settings/business-profile` | Business/offer context (34 fields) |

---

## 4. The Call Content Generator (MVP)

This is the first generator—a 4-step AI workflow that extracts marketing content from call transcripts.

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   CALL CONTENT GENERATOR                         │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  SELECT  │───▶│ EXTRACT  │───▶│  HOOKS   │───▶│ CONTENT  │  │
│  │ SOURCES  │    │ INSIGHTS │    │          │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  Step 1           Step 2           Step 3         Step 4        │
│  Choose calls     AI analyzes      Generate &     Create posts  │
│  + profile        (internal)       save hooks     & emails      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step Details

**Step 1: Select Sources**
- Choose one or more transcripts
- Select which Business Profile to use (if multiple)
- "Continue" button

**Step 2: Extract & Analyze** (AI does the work)
- Agent 1 classifies the call (type, stage, emotional intensity)
- Agent 2 mines insights: pains, dreams, objections, stories, frameworks
- User sees progress indicator
- Insights are **internal processing**—not a library destination
- Results feed directly into Step 3

**Step 3: Generate Hooks**
- Agent 3 generates 3-10 hooks from the extracted insights
- User can:
  - Star/save favorites to Hooks Library
  - Generate more hooks
  - Proceed to content creation with selected hooks
- "Generate More" and "Create Content →" buttons

**Step 4: Create Content**
- Agent 4 generates a social post + email for each selected hook
- Streaming output so user sees content appear
- User can:
  - Edit inline
  - Regenerate individual pieces
  - Save to respective libraries
  - Copy to clipboard

### One-Click Philosophy

The generator should feel like a guided wizard, not a complex tool:
- Minimize decisions at each step
- Smart defaults (auto-select recent calls, default profile)
- Progress is auto-saved (can exit and resume)
- Batch operations where possible

---

## 5. Content Libraries

Three libraries store the user's generated content. All follow consistent patterns.

### Hooks Library

**What it stores:** Short, punchy opening lines (1-2 sentences) that grab attention.

**Key attributes:**
- Hook text
- Topic hint (2-5 word label)
- Virality score (1-5)
- Emotion category
- Status: saved / used
- Favorite toggle
- Source reference (which call it came from)

**Actions:**
- Copy to clipboard
- Create content from hook (opens Step 4 of generator)
- Edit inline
- Archive

### Posts Library

**What it stores:** Full social media posts (~200 words), ready to publish.

**Key attributes:**
- Post text (editable)
- Platform (LinkedIn, Twitter, etc.)
- Source hook (reference)
- Status: draft / edited / published
- Favorite toggle

**Actions:**
- Edit inline
- Regenerate (re-runs Agent 4)
- Copy to clipboard
- Mark as published
- Archive

### Emails Library

**What it stores:** Email subjects and body openings (first 2 sentences).

**Key attributes:**
- Subject line (editable)
- Body opening (editable)
- Email type (cold, nurture, follow-up)
- Source hook (reference)
- Status: draft / edited / used

**Actions:**
- Edit inline
- Regenerate
- Copy subject / Copy body
- Mark as used
- Archive

### Library UX Patterns

All libraries should share:
- **Table view** with sorting, filtering
- **Quick actions** on row hover
- **Bulk select** for batch operations
- **Favorites filter** to surface best content
- **Search** by text content
- **Filter by source** (which call/generator)

---

## 6. Business Profile

The user's business context grounds all generated content. This is **critical** for quality output.

### Location

Either:
- New section in Settings: `/settings/business-profile`
- Or: Part of onboarding flow with access in Settings

### Fields (34 total)

Organized in logical sections. See `docs/reference/customer-data-fields-formatted.md` for full list.

| Section | Fields |
|---------|--------|
| Company & Product | 5 fields |
| Business Model | 5 fields |
| Marketing & Sales | 7 fields |
| Customer Journey | 2 fields |
| Customer Insights | 4 fields |
| Value Proposition | 2 fields |
| Offers & Pricing | 6 fields |
| Brand & Voice | 3 fields |
| Growth | 1 field |

### Multi-Profile Support

Users can create up to **3 business profiles** (for different offers, brands, or businesses).

- One profile is marked as default
- Generator wizard shows profile selector
- Each piece of content is tagged with which profile was used

### UX

- Auto-save on blur
- Progress indicator showing completion %
- Required fields clearly marked
- Collapsible sections for long form

---

## 7. Agent Pipeline (Technical Reference)

The generator uses 4 AI agents in sequence. Full prompts in `docs/specs/social-agents.md`.

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| 1. Classifier | Determine if call is worth mining | Full transcript | Classification + should_mine flag |
| 2. Insight Miner | Extract marketing-relevant insights | Transcript chunks | Array of insights (pains, dreams, etc.) |
| 3. Hook Generator | Create attention-grabbing hooks | Top insights + business context | 3-10 hooks |
| 4. Content Builder | Create posts and emails from hooks | Hook + insights + context | Social post + email per hook |

**Key points:**
- Agents 1 & 2 run in sequence during Step 2
- Agent 3 runs during Step 3 (can be re-triggered for "more hooks")
- Agent 4 runs during Step 4 with streaming output
- All use OpenRouter per CLAUDE.md standards
- Insights are internal—not exposed as a user-facing library

---

## 8. Future Considerations

These are **not in MVP scope** but the architecture should accommodate them:

### Version 2
- [ ] Custom content uploads (PDFs, docs, notes)
- [ ] Additional generators (Thread Generator, Video Script, etc.)
- [ ] Custom prompts/frameworks users can save
- [ ] Full email body generation

### Version 3+
- [ ] Social platform integrations (Buffer, LinkedIn, etc.)
- [ ] Content calendar view
- [ ] Team collaboration on content
- [ ] Analytics on content performance
- [ ] A/B testing content variations

---

## 9. Implementation Notes

### For the implementing agent:

1. **Follow brand guidelines** — See `docs/design/brand-guidelines-v4.1.md` for all UI patterns

2. **Match existing navigation** — The Content nav item should follow the same patterns as Home, AI Chat, etc. in `sidebar-nav.tsx`

3. **Use existing patterns** — Look at how other features (AI Chat, Sorting) structure their pages

4. **Database design** — Create tables that accommodate:
   - Multiple business profiles per user (up to 3)
   - Content items linked to source + hook + profile
   - Generator run tracking for resumable sessions

5. **API naming** — Follow `docs/architecture/api-naming-conventions.md`

6. **Streaming** — Agent 4 (content generation) must stream to provide good UX

---

## 10. Success Criteria

### MVP Complete When:

- [ ] User can fill out business profile (34 fields, auto-save)
- [ ] User can run Call Content Generator end-to-end
- [ ] Hooks are generated and saveable to library
- [ ] Posts and emails are generated with streaming
- [ ] User can edit and regenerate content
- [ ] Content libraries have filtering, favorites, copy
- [ ] Works on desktop (mobile can be v2)

### Quality Bar:

- Generator feels like a guided wizard, not a complex tool
- Content generation streams smoothly
- Libraries are fast and responsive
- Aligns with CallVault brand guidelines throughout

---

## Appendix: Reference Documents

- [Social Agents Prompts](./social-agents.md) — Full agent prompt definitions
- [Customer Data Fields](../reference/customer-data-fields-formatted.md) — Business profile fields
- [Brand Guidelines](../design/brand-guidelines-v4.1.md) — UI design standards
- [Design Principles](../design/design-principles-callvault.md) — UX philosophy
- [API Naming Conventions](../architecture/api-naming-conventions.md) — Naming standards
