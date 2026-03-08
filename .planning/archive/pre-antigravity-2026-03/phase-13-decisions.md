# Phase 13 Strategic Decisions

## 1. AI Positioning

**Decision: MCP-First with Optional Bridge Chat**

CallVault v2 is a **data layer, not an AI product**. The core value is organizing call recordings into searchable workspaces. AI happens elsewhere (Claude Desktop, Cursor, custom tools) via MCP.

**Bridge chat is optional**: If users want quick in-app queries ("summarize this call"), we can add a lightweight chat interface later (Phase 19-21). But it's NOT the core product story.

**Marketing angle**: "Your calls, organized. Your AI, connected."

**Implication**: Polar tiers are NOT priced on AI usage. MCP is infrastructure, not a feature.

---

## 2. Value Anchor

**Decision: Workspace Organization + MCP Access**

Customers pay for:
- **Workspace count** (free = 3, paid = unlimited)
- **Import volume** (free = 50/month, paid = unlimited)
- **MCP connector access** (free = read-only, paid = full CRUD)
- **Advanced connectors** (YouTube, Zoom, etc. - paid only)

**NOT priced on**: AI queries, transcripts, storage (those are table stakes).

**Free tier gives a real taste**: 3 workspaces, 50 imports/month, basic MCP. Enough to feel useful, limited enough to convert.

**Paid unlock**: Scale (more workspaces, unlimited imports) + automation (Zapier webhooks, advanced connectors).

---

## 3. Target Customer

**Primary persona: Solo sales rep / coach with 10-50 calls/week**

- **NOT for**: Enterprise sales teams (they have Gong/Chorus)
- **NOT for**: Casual users with 1-2 calls/month (not enough pain)
- **FOR**: Individual contributors who do discovery calls, coaching sessions, customer success check-ins

**Specific person**: 
- Sales rep at a 10-50 person B2B SaaS company
- Solo coach running 15-20 client calls/week
- Recruiter doing 30+ phone screens/month
- Customer success manager tracking ongoing client conversations

**They want**: A place to organize calls by client/project, search transcripts, and connect to their AI workflow (Claude, Cursor, etc.). They DON'T want another AI chatbot.

**Messaging**: "Stop losing call context. CallVault organizes your recordings so your AI actually knows what happened."

---

## 4. Free Tier Philosophy

**Decision: Generous enough to convert, gated enough to monetize**

**Free tier**:
- 3 workspaces (enough for "Prospects", "Clients", "Internal")
- 50 imports/month (2-3 weeks of active use)
- Read-only MCP (can query, can't create/update via AI)
- Basic connectors only (file upload, Google Drive)

**Paid unlock triggers**:
- Hit workspace limit ("Need a 4th workspace for Partners")
- Hit import limit ("I do 60+ calls/month")
- Want automation (Zapier, YouTube auto-import, Zoom integration)
- Want full MCP CRUD (AI can create workspaces, tag calls, etc.)

**Philosophy**: Free tier should feel useful for 2-3 weeks, then naturally hit limits. NOT a永久免费 product, NOT a "pay to unlock basics" trap.

---

## Next Steps

These decisions unlock:
- **STRAT-01**: MCP-first positioning (finalize in Phase 14)
- **BILL-01**: Pricing anchor = workspaces + imports + MCP access
- **BILL-02**: Update Polar tiers with these limits
- **BILL-03**: Free tier = 3 workspaces, 50 imports, read-only MCP
- **BILL-04**: Upgrade prompts trigger on workspace/import limits

**Ready for Plan Phase**: Yes. Context is clear.
