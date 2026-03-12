# CallVault Into Pricing

### **1\. “Free” Tier Limits**

**Final Free limit:**

* **10 imports per month**  
* 1 user  
* 1 workspace  
* Smart import allowed (titles, tags, action items)  
* **No MCP / External AI integrations** (Claude, ChatGPT, etc.)

That’s your attraction tier. It lets a solo rep feel the value, but anyone serious will hit friction and upgrade. Classic “different avatars, different willingness to pay” pricing ladder.

---

### **2\. Define Single “AI Action” Unit**

To keep COGS sane and UI simple, everything burns from **one shared AI actions pool** per account:

An **AI Action** is:

1. **Smart import on a call** (auto-title, auto-tags, and eventually action items \[action items not available at launch\] in one shot)  
2. **Auto-name** on an existing call  
3. **Auto-tag** on an existing call  
4. **One AI chat message** in the minimal in-app chat with attached transcripts (Pro/Team only)

Behind the scenes:

* Smart import \= 1 action per call  
* Auto-name action  
* Auto-tag action  
* Each user chat message in the AI side-panel \= 1 action

You don’t expose “credits” marketing-wise; just show a usage bar in Settings.

### **3\. Monthly AI actions by tier**

All quotas **reset monthly** (even for annual billing).

**Free ($0 per mo.)**

* 10 imports / month  
* **25 AI actions / month**  
* Can use Smart import, auto-name, auto-tag until the 25 actions are gone  
* **No AI chat**  
* No MCP

Behavior when limit hit:

* Block Smart import / rename / tag buttons  
* Inline message:   
  *“You’ve used your included AI actions on Free. Upgrade to Pro to keep using smart features.”*

**Pro ($29 Monthly & $278 Annual)**

* 1 user  
* Unlimited imports  
* Multiple workspaces  
* Full MCP access (personal)  
* **1,000 AI actions / month per account**

Includes:

* Unlimited Smart import usage within that 1,000 pool  
* Auto-name / auto-tag  
* **Minimal AI chat:** user can attach up to, say, **5 transcripts per chat** and ask questions (each message \= 1 action)

When they hit 1,000:

* Disable AI buttons and chat sending  
* Message: “You’ve used your included AI for this month. Your calls and MCP continue to work. Upgrade to Team or contact us for higher limits.”

**Team ($79 Monthly & $758 Annual)**

* 3–10 users, flat price  
* Everything in Pro  
* Shared workspaces, roles/permissions, admin dashboard  
* **5,000 AI actions / month, pooled across the team**

Same rules as Pro, just a bigger pool, shared by all members.

Behavior:

* Usage bar in Admin dashboard  
* When pool is exhausted: same pattern as Pro \+ “Talk to us about higher-usage plans” link

This keeps AI as **ongoing value** correctly priced into the recurring fee instead of you accidentally eating variable COGS on a “fixed” SaaS.

**BUTTON FOR AUTO-NAMING/TAGGING – on by default in settings, but can be switched on/off** *(consumes AI Credits automatically when on)*

---

### **4\. Trial behavior (Free \+ 14‑day Pro)**

* New user starts on **Free \+ optional 14‑day Pro trial**.  
* When trial is active: use **Pro limits** (unlimited imports, 1,000 AI actions, AI chat, MCP).  
* When trial ends:  
  * Revert to Free limits (10 imports, 25 AI actions, no chat, no MCP).  
  * Extra workspaces \+ MCP configs \+ team stuff become **read-only**.  
  * AI chat threads stay visible but sending new messages is blocked with an upgrade CTA.

---

### **5\. Why this is “done”**

* Clear ladder: Free (solo tester), Pro (serious individual), Team (org).   
* AI cost is collapsed into **one simple lever** you can tune (actions per month) instead of messy per-feature billing.  
* You can always bump numbers up once you see real COGS; don’t start generous & regret it.

