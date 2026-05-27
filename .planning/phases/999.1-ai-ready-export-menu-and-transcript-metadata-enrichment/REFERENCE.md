# REFERENCE — Phase 999.1: AI-ready export menu and transcript metadata enrichment

**Captured:** 2026-05-27
**Source:** Grain product launch announcement
**Loom URL:** https://www.loom.com/share/c7e53b7384d745f68c45e0e200e3a47c
**Presenter:** Jeff (Grain)

---

## Why This Reference Is Here

Andrew flagged this as a competitive-signal capture: Grain just shipped a feature surface that CallVault should match (the per-call AI-export dropdown + richer Markdown transcript metadata for AI consumption) — while also reaffirming that CallVault is already *ahead* on adjacent surfaces (bulk download, multi-source unification). The "perfect language" Grain uses in their pitch is intentionally borrowed for our own positioning when this backlog item is promoted.

The genuinely net-new feature worth building (beyond the dropdown UX itself) is the **participant-history cross-reference** — when exporting a transcript, automatically include links to prior calls with the same participants so the consuming AI has full historical context, not just the single call.

---

## Verbatim Transcript

> 0:00 Hey, this is Jeff from Grain. I'm really excited to share with you some things we just shipped that make it easy for you to work with your meeting data inside of your favorite AI tools.
>
> 0:08 If you look over in the top right corner, we added this little button. Click on the dropdown. There's four actions here.
>
> 0:12 You can open in Cloud, open in Chatshub-T, Copy Transcript for AI, or Download Transcript for AI. And this download is in Markdown.
>
> 0:20 So, if I click Open in Cloud, It opens Cloud in a window with a short prompt and then a link to your meeting.
>
> 0:26 This link expires in just a couple minutes, but then I can add a prompt to this chat. Help me think through how I can manage the risks of this project for fast delivery.
>
> 0:37 Press Go. uh, Cloud will then fetch the transcript associated with that meeting as it works on whatever analysis or task you gave it.
>
> 0:45 One really cool thing about this button is it saves your decision. So if you want, if copy is your primary action, you can just click that to copy.
>
> 0:53 action, it remembers that preference. Let me show you what we did to improve the transcripts to make them better for AI.
>
> 1:01 So I'm going to copy the transcript for AI right here. And then I'll paste it, and you can see that there's much richer metadata here, including links to previous meeting with the participants so that AI can have additional context.
>
> 1:15 And then the transcript is formatted and marked down. The goal of all these changes is to make it so that your grain meeting data is ready and easy to work with your favorite AI tools so you can have meetings and get the work done instantly.

*(Transcript is autocaption — "Cloud" = Claude, "Chatshub-T" = ChatGPT. Preserved verbatim per user instruction.)*

---

## Distilled Feature Set Grain Just Shipped

| # | Feature | What it does |
|---|---|---|
| 1 | **AI-export dropdown** (top-right of call detail) | Single button surfaces four actions |
| 2 | **Open in Claude** | Opens claude.ai with prefilled prompt + short-lived signed URL to fetch the transcript |
| 3 | **Open in ChatGPT** | Same pattern, claude.ai replaced with chatgpt.com |
| 4 | **Copy Transcript for AI** | Copies AI-formatted Markdown to clipboard |
| 5 | **Download Transcript for AI** | Downloads same content as `.md` file |
| 6 | **Sticky default action** | Remembers user's last action; one-click on the main button next time |
| 7 | **Signed URL expiry** | "Expires in just a couple minutes" — short TTL for the transcript-fetch link |
| 8 | **Richer Markdown metadata** | Header block on the transcript with participants, source, date, duration, share URL |
| 9 | **Cross-references to past meetings with same participants** | Markdown links to prior recordings with overlapping participants, embedded in the export header |

---

## How This Maps To CallVault

### What we already have (where we're ahead)

- **Bulk download.** Grain's pitch implies this is something they ship *now* — we've had this. Reference our own bulk export flow when this is promoted; don't regress it.
- **Multi-source unification.** Grain only has Grain data. We unify 7 sources today. The AI-export surface should be source-agnostic from day one.
- **MCP server with workspace-scoped tokens.** Grain has no equivalent. The dropdown's "Open in Claude" path is a UX shortcut for what CallVault's MCP already enables programmatically.

### What's net-new and worth building

- **Per-call AI-export dropdown UX** in `src/components/call-detail/` — four actions, sticky default, source-agnostic
- **AI-ready Markdown transcript formatter** — distinct from raw transcript text; rich metadata header
- **Short-lived signed transcript URL** — for the "Open in Claude / ChatGPT" deep-link pattern (their fetch tool retrieves transcript via the link)
- **Participant cross-reference query** — given a recording's participant set, surface links to prior calls in the same workspace with overlapping participants; inject into the export header

### Cross-cutting

- MCP-04 (`ingest_transcript`) and this backlog item both touch "what does a CallVault transcript look like when an AI consumes it." Schemas should align so the same Markdown shape is used whether the AI reaches via MCP read tool OR via the Open-in-Claude dropdown.
- ONB-05 (support popout) and this backlog item are both top-bar dropdown UX patterns — share component primitives where possible (dropdown shell, sticky-default storage).

---

## Open Questions (resolve when promoted)

1. Does CallVault host its own "ai-ready" Markdown formatter, or does the dropdown call into the MCP read-tool shape (already markdown)? Single source of truth preferred.
2. Signed transcript URL — TTL? 5 min like Grain? Longer for batch workflows? Per-token revocation?
3. Participant cross-reference — how many prior calls to include? Just the participants by name, or also a 1-sentence summary per linked call? Privacy: only calls the *current user* has access to, never calls the participants had in another workspace.
4. Sticky-default storage — does this live in `preferencesStore` (synced cross-tab) or per-recording context only?
5. Does this surface inside the share view (`SharedCallView`) too, or only the authenticated detail view? Probably the latter; share view is for view-only consumers.
6. ChatGPT deep-link pattern — does ChatGPT actually accept a URL-based prompt + fetch-tool param, or is that a Grain workaround?

---

*Saved verbatim per `/gsd-capture --backlog` capture flow. Reference content; promote via `/gsd-review-backlog` when ready to plan.*
