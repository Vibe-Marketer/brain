# CallVault + ClawSimply — Investor Talking Points

**Format:** Screen-share walkthrough with talking points. ~10-15 minutes.

---

## 1. HERE'S WHAT WE BUILT (3 min — screen share the app)

**Walk them through the app while hitting these points:**

- Call intelligence platform for sales teams, coaches, agencies
- Imports calls from Fathom, Zoom, Google Meet, YouTube — all automatic
- Organizes into workspaces: Banks (orgs) > Vaults (teams) > Folders/Tags
- Team collaboration — invite links, roles, permissions, shared call libraries
- Built a full AI layer on top — chat, RAG search, content generation, auto-summaries, sentiment, action items
- Export to DOCX, PDF, ZIP
- Live product, early revenue, active beta users

**Show:** Import flow, vault/folder hierarchy, a transcript, the chat, content hub

---

## 2. WHY WE'RE PIVOTING (2 min — stop sharing, talk direct)

- We built ~89K lines of AI code. It's impressive. And it's the wrong bet.
- **We're competing with Anthropic and OpenAI on AI features — we'll always lose**
- Every competitor (Fireflies, Otter, Gong) builds the same AI features. Nobody differentiates on them. It's commodity.
- Our AI layer is 35-40% of the codebase, our #1 cost center, and our #1 source of bugs
- Meanwhile the part users actually love — the workspace, the team features, the organization — runs independently of all the AI

---

## 3. WHAT CHANGED: MCP (2 min)

- MCP = Model Context Protocol. Universal standard for connecting data to AI.
- **Every major platform adopted it:** Claude, ChatGPT (replaced their plugin system entirely), Gemini, Perplexity, Cursor
- One MCP server = your app works as a plugin for ALL of them simultaneously
- Fireflies, Otter, Gong already shipping MCP servers
- This is table stakes now. Not having one puts us behind.

---

## 4. THE PIVOT (2 min)

- **Strip the AI layer.** Remove ~89K lines, 23 edge functions, 15 database tables, all OpenAI/OpenRouter dependencies
- **Keep the moat.** Workspaces, import, organization, collaboration, export, team features
- **Build one MCP server** (~2-3K lines on Cloudflare Workers). Users paste a URL into Claude or ChatGPT, sign in, done. Their AI now has full access to their organized call library.
- Users get BETTER AI — they use Claude Opus, GPT-5, whatever they already pay for — instead of our in-house version
- Our codebase shrinks 40%. Our costs drop. We ship workspace features 5x faster.

**The new value prop:** *"Your conversations, organized. Your AI, supercharged."*

---

## 5. WHAT MAKES OUR MCP DIFFERENT (1 min)

- Competitors expose flat "search + get transcript" — that's it
- We expose the **organizational layer**: browse vault hierarchies, speaker history across calls, cross-call comparison, topic tracking over time, team analytics
- Plus MCP Prompts (one-click "prepare for meeting with X") and browsable content URIs
- No competitor does any of this. Our moat translates directly into MCP differentiation.

---

## 6. THE BIGGER PICTURE: CLAWSIMPLY (3 min)

- **OpenClaw** = open-source AI agent, 100K+ GitHub stars, connects to WhatsApp/Telegram/Slack/iMessage/etc.
- Problem: it's developer-only. Config files, terminals, API keys. Normal people can't use it.
- Also: **OpenClaw explicitly disabled MCP support.** Closed the feature request as "not planned."
- **ClawSimply** = our fork. Two things:
  1. **Simple OAuth UI** — connect Gmail, Zoom, Calendly, Slack, CRMs with one click. No technical skills needed.
  2. **MCP re-enabled** — connects to any MCP server, including CallVault as a first-party plugin
- We have a working prototype.

**The ecosystem:**
- ClawSimply = the agent (the AI brain that connects to your messaging apps)
- CallVault = the organized data (your call library, structured and permissioned)
- CallVault plugs INTO ClawSimply via MCP
- The agent uses your call data to draft follow-ups, prep meetings, generate content, update CRMs, build persistent memory — all through the apps you already use
- **The AI work happens in the agent layer, not in CallVault.** We stop competing on AI. We win on organized data.

**The flywheel:** ClawSimply users need organized call data → CallVault. CallVault users want an agent → ClawSimply.

---

## 7. THE MOAT (1 min)

- **NOT a moat:** AI features (commodity), MCP servers (anyone can build one)
- **The moat:**
  - Multi-source aggregation (Fathom + Zoom + Meet + YouTube + more, all in one place)
  - Organized workspaces with team collaboration (banks/vaults/roles/permissions)
  - Cross-call intelligence via MCP (no competitor exposes this)
  - ClawSimply as distribution (every ClawSimply user = potential CallVault user)

---

## 8. ASK & TIMELINE (1 min)

- **MCP server:** 2 weeks to ship
- **Strip AI layer:** 6-8 weeks total
- **ClawSimply v1:** 6-12 weeks (prototype exists)
- Funds go to: completing the pivot, shipping ClawSimply, expanding import sources, go-to-market

---

## CLOSER

> "We're not competing with AI companies. We're making AI companies more useful."

---

## IF THEY ASK...

**"What about users who don't have Claude/ChatGPT?"**
→ Minimal in-app chat stays as a bridge. Select calls, ask a question, done. But the real answer is ClawSimply — it IS the AI layer for everyone.

**"Why not just add MCP and keep the AI features?"**
→ We could. But maintaining 89K lines of AI code we'll never beat Anthropic/OpenAI at is a tax on everything else. Every hour debugging RAG is an hour not spent on workspace features — our actual differentiator.

**"What's the revenue model if you remove AI?"**
→ Charge for what's actually valuable: organization, collaboration, team workspaces, MCP access. Not for AI features users can get elsewhere for free.

**"Isn't OpenClaw going to a foundation? Is forking risky?"**
→ That's actually why NOW is the time. The project is in transition. A focused fork with a clear mission (simplify for non-technical users) has room to establish itself.

**"What if MCP gets replaced?"**
→ OpenAI just rebuilt their entire plugin system on it. Google adopted it. It's backed by Anthropic as an open standard. This is as close to "safe bet" as infrastructure standards get.
