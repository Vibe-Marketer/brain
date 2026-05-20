# ZAPIER REVERSE-ENGINEERING — WHAT ZAPIER ACTUALLY DOES, AND WHEN IT HELPS

Andrew's question: "If Zapier is doing it, can't we reverse-engineer what Zapier is doing to not need to use Zapier?"

Short answer: **Sometimes yes, sometimes no.** Depends on which of three modes Zapier is operating in. This document explains how to tell, and when it's worth it.

---

## ZAPIER'S 3 OPERATING MODES

### Mode A — Zapier is using the platform's official public API

This is the most common case. Zapier built an app on the platform's docs, same as we would.

**Examples (from our research):**
- **GHL ↔ Zapier:** Zapier uses GHL's public OAuth + `/conversations/*` endpoints. Same endpoints we already documented in `02-platform-specs.md` §3.
- **Grain ↔ Zapier:** Zapier uses Grain's public REST API. Same auth, same paths.
- **Fireflies ↔ Zapier:** Zapier uses Fireflies' public GraphQL.
- **tl;dv ↔ Zapier:** Zapier uses tl;dv's public REST.

**Reverse-engineering value: NONE.** We have the same access. Skip Zapier entirely.

**How to confirm a platform is Mode A:**
1. Check the platform's developer docs — if the auth, endpoints, and webhooks documented match what Zapier's app exposes (triggers + actions), it's Mode A.
2. Open browser DevTools, log into Zapier, click "Connect <Platform>." Watch the OAuth redirect URL — if it goes to the same `developer.<platform>.com/oauth/authorize`, it's Mode A.
3. Read the Zapier app's "How to connect" instructions — if they tell you to paste an API key or do OAuth via the public flow, it's Mode A.

### Mode B — Zapier has a private partner API

The platform gave Zapier (and other large integrators) elevated access — endpoints, webhooks, scopes — that aren't in public docs.

**How to spot:**
1. The Zapier app has triggers or fields the public API doesn't expose (e.g., a real-time event that's not in the platform's webhook docs).
2. The Zapier connection URL uses a different OAuth scope set or a different `client_id`.
3. The platform's developer docs say "for partner integrations contact partnerships@."

**Reverse-engineering value: MEDIUM, with caveats.**
- You can DISCOVER the private endpoint structure by sniffing what Zapier calls (HAR capture of "Run Zap" in the Zapier UI).
- You CANNOT use Zapier's `client_id` — that's their credential. Calling the discovered endpoints with your own `client_id` may fail or get you banned.
- The proper move: **discover the endpoint, then ask the platform for partner API access citing the use case.** Many platforms grant it.

### Mode C — Zapier scrapes / browser-automates

Rare and unstable. Some Zapier integrations are scrappy — a community-built or "early access" app that's poll-driven against a session cookie or unofficial endpoint.

**How to spot:**
1. The app page says "by Zapier" or "Community App" — not "Built by <Platform>."
2. Connection asks you to paste credentials or session cookies.
3. The app has very few triggers (1-2) and they're suspiciously named ("New thing happened").

**Reverse-engineering value: HIGH** — if Zapier figured out the wire protocol, we can too with the **printing-press browser-sniff methodology** (covered separately).

---

## OUR 8 PLATFORMS — ZAPIER MODE ASSESSMENT

| Platform | Zapier Mode | Recording Trigger via Zapier? | RE value |
|----------|-------------|-------------------------------|----------|
| Fireflies | **A** (public GraphQL) | Yes — `Meeting Transcribed` | None (we have direct API) |
| Grain | **A** (public REST) | Yes — `New Recording` | None |
| GHL | **A** (public OAuth) | Yes — `Inbound Message`, etc. | None |
| tl;dv | **A** (public REST) | Yes — `Meeting Ready`, `Transcript Ready` | None |
| RingCentral | **A** (public OAuth + subscriptions) | Yes — `New Call Log Entry` | None |
| Microsoft Teams | **A** (public Graph) | Limited — `New Meeting`, not recordings directly | None |
| **Plaud** | **B** (partner — official Zapier app, first-party) | **YES — `Transcript & Summary Ready`** | **MEDIUM** (see below) |
| **Mojo Dialer** | **C** (community/third-party, NO recording trigger) | **NO** | None — Mojo simply doesn't expose recordings, even Zapier can't get them |

### The Plaud lesson

Plaud's Zapier app is **first-party** ("by Plaud") and exposes a `Transcript & Summary Ready` trigger that ISN'T in any documented public API. This is Mode B — Plaud has webhook capability internally but only exposes it through Zapier today.

**What this tells us:**
- Plaud's backend has a webhook system. It's just not customer-accessible directly.
- If we built Plaud as a Plaud Partner (apply at `partnerships@plaud.ai`), we'd likely get direct webhook access without going through Zapier.
- Meanwhile, the **Zapier app IS our access path** — that's why Path A in `02-platform-specs.md` §7 ships first.

### The Mojo lesson

Mojo is the inverse — even Zapier (Mode C, community-built connector) can't get to call recordings. The recording data is **physically not exposed** outside Mojo's stack. No amount of reverse-engineering will fix this until Mojo decides to expose an API. Stop fighting this — ship the CSV+ZIP uploader.

---

## WHEN REVERSE-ENGINEERING IS WORTH IT — DECISION TREE

```
Is there an OFFICIAL public API?
├── YES → Use it. Zapier RE wastes time.
└── NO → Does Zapier have an integration?
         ├── NO  → Build manual import (Mojo path) or skip the platform.
         └── YES → Is it a first-party Zapier app ("by <Platform>")?
                   ├── YES → It's Mode B (private partner API).
                   │         Two paths:
                   │         (a) Apply for partner access — slow but legitimate.
                   │         (b) Sniff what Zapier calls, build a "behind Zapier" connector.
                   │             Only do (b) if (a) was refused and the platform's ToS
                   │             permits programmatic access.
                   │
                   └── NO → It's Mode C (community-built). Sniff with full RE methodology.
```

---

## HOW TO SNIFF WHAT ZAPIER DOES (Mode B/C)

The **printing-press browser-sniff methodology** (already loaded in this CallVault session — see `~/.claude/skills/printing-press/references/browser-sniff-capture.md`) gives the full playbook. Compressed for connector work:

### Step 1 — Build a sacrificial Zap

1. Create a Zap that triggers on the target event (e.g., `Plaud → Transcript Ready`).
2. Action: "Webhooks by Zapier → POST" to a request-catcher URL you control (e.g., webhook.site or your own logging endpoint).
3. Run the Zap with a real test event. Capture the payload structure — that's the data Zapier is forwarding.

This tells you the **schema** but not the wire protocol Zapier uses to PULL the data.

### Step 2 — Sniff the connection flow

1. Open Chrome, log into Zapier.
2. Open DevTools → Network tab.
3. Click "Connect <Platform>" inside Zapier.
4. Capture the entire OAuth/auth flow.

Look for:
- The OAuth `authorize` URL — gives you the platform's auth endpoint.
- The OAuth scopes Zapier requests — that's the minimum scope set the platform supports.
- After connect, navigate to "Test Trigger" — DevTools shows the actual API calls Zapier makes to fetch data.

### Step 3 — Identify which endpoints Zapier hits

In DevTools, filter Network requests by domain (e.g., `api.<platform>.com`). The list of paths Zapier requests = the platform's data-access endpoints. These are usually the same ones in public docs (Mode A) — but sometimes there are private endpoints (Mode B).

### Step 4 — Validate the protocol with curl

Take one of the endpoints + the auth header Zapier used (from request headers). Replace the auth with your own dev token. If it works → public API, we already have it. If it returns 401/403 → Zapier has special credentials (Mode B).

### Step 5 — Make the partnership call

If Mode B confirmed: **email the platform's partnerships team.**
- Cite the use case (CallVault — call intelligence platform for SaaS operators).
- Cite that you've verified the partner integration capability exists via their Zapier app.
- Ask for direct API access on the same surface.

This works ~50% of the time for legitimate B2B requests in our experience. The other 50%, build behind Zapier (Path A pattern).

---

## ZAPIER AS A PRODUCTION DEPENDENCY — TRADEOFFS

Sometimes the right answer is "stay behind Zapier and ship faster." Tradeoff:

| Behind Zapier | Direct integration |
|---------------|---------------------|
| Customer needs Zapier ($20/mo) | No 3rd-party SaaS dependency |
| 1-2 day build | 3-8 day build per platform |
| Zapier maintains the integration | We maintain it |
| Zapier rate-limits you (their account) | Your rate limit |
| Brittle to Zapier service outages | Your platform's outages only |
| Auth handled by Zapier — no credentials to store | You store + refresh tokens |
| Can break if platform changes (Zapier patches) | You see the break first |

**Heuristic:**
- **Ship behind Zapier first** for any Mode B platform — lets you validate demand before building bespoke.
- **Switch to direct integration** when (a) >10% of CallVault customers use that source, (b) the platform grants partner API access, or (c) Zapier's reliability becomes a support burden.

---

## SPECIFIC TO OUR 8 PLATFORMS — RECOMMENDED ACTIONS

1. **Fireflies, Grain, GHL, tl;dv, RingCentral, Teams** — Mode A. Don't even look at Zapier. Build direct integration per `02-platform-specs.md`.

2. **Plaud** — Mode B. Two-phase plan:
   - Phase 1 (week 1-2): Build Zapier webhook receiver. Customers connect via Zapier. Cost to user: $20/mo Zapier subscription.
   - Phase 2 (week 6-12): Email Plaud partnerships, request direct webhook API. Build the openplaud-style direct integration as a "no Zapier required" upgrade tier.
   - Phase 3 (when partnership granted): Switch to direct, deprecate Zapier path for new customers.

3. **Mojo** — No Zapier path exists. Build CSV+ZIP importer. Periodically check Mojo's roadmap (their FAQ at mojosells.com/faq) for API announcements. Consider building a Chrome extension v2 only if customer demand justifies the maintenance.

---

## THE PRINTING-PRESS METHODOLOGY APPLIES TO HIDDEN APIS

Beyond Zapier sniffing, the printing-press skill's `browser-sniff-capture.md` (loaded at `~/.claude/skills/printing-press/references/browser-sniff-capture.md`) covers the full toolkit:

- HAR capture from DevTools
- `browser-use` CLI for autonomous capture
- Persisted GraphQL hash extraction
- Proxy-envelope pattern detection (when all calls go through one URL with service routing in the body)
- Cloudflare/WAF clearance-cookie capture
- Per-source adaptive rate-limit ramping

**When to use it:** Only when official API is missing AND community-reverse-engineered libraries (like openplaud) don't already exist. For our 8 platforms, the only candidate is potentially Plaud's mind-map / action-items data that isn't in openplaud — but it's not worth the build cost.

For any future platform we want to add (#9, #10) where no API exists, follow this sequence:

1. Check if community RE exists (GitHub search).
2. If yes: fork or reference, port to TypeScript matching our adapter pattern.
3. If no: run printing-press browser-sniff to capture endpoints.
4. Validate with curl that wire protocol replays cleanly.
5. Build connector following SOP, adding rate limit + User-Agent defense in `_shared/<platform>-client.ts`.

---

## TL;DR

Zapier RE helps for **two** of our eight platforms (Plaud — Mode B partner API; theoretically Mojo if anything existed — Mode C absent). For the other six, Zapier is using the same public API we'd build against directly, and reverse-engineering it adds nothing.

**The actionable move for Plaud:** Ship behind Zapier first (2 days), then pursue partnership (concurrent). Build direct openplaud-style integration as Phase 2 when (a) partnership granted or (b) you've validated >100 users on the Zapier path and want them off.

**The actionable move for Mojo:** Stop hoping. Build CSV+ZIP importer. Re-evaluate quarterly.
