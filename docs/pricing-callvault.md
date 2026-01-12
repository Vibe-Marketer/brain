# CallVault SaaS Pricing

## 1. Core SaaS Pricing (End Users / Students / Reps)

All real usage money flows from here. Everything else (affiliates, white-label, custom GPT) sits on top of this.

### Free

- 1 user  
- Hard cap on usage (e.g. 300 min/month, limited storage)  
- No Teams, no coaching relationships  
- Can receive links to calls, but only as view-only

### Solo

- **$29/mo** or **$278/yr** (20% off)  
- 1 user  
- “Unlimited” calls / AI summaries within fair use  
- Folders, tags, AI search  
- Coaching: 1 coach + 1 coachee, 10 notes per call  
- No Teams

### Team

- **$99/mo** or **$950/yr**  
- Includes up to **5 full users** (anyone who can record/store calls)  
- Extra seats: **$20/mo per user** up to 20 total  
- Unlocks: Team hierarchy, manager auto-access, shared folders  
- Coaching: 2 coaches / 3 coachees, unlimited notes  

### Business

- **$249/mo** or **$2,390/yr**  
- Includes up to **20 full users**  
- Extra seats: **$18/mo per user** above 20 until Enterprise  
- All Team features + advanced admin & analytics, 5 coaches / 10 coachees, priority support

### Enterprise

- **Custom (starting around $1,500/mo)**  
- 20+ seats, volume discount, SSO, custom security, dedicated CSM, SLA

Billing: show monthly + “save 20% with annual” as the default anchor. [$100M Playbook Pricing, Page 40],[$100M Playbook Pricing, Page 41]

---

## 2. Student Discount (via Coach Link)

When a student / rep signs up through a coach’s partner link:

- They choose any paid plan (usually Solo).  
- They get either:
  - **Extra 7 days on their free trial**, or  
  - **20% off first month** (pick one and stick to it).

So the pitch is:  
“Use my CallVault link and you get a better deal than going direct.”

---

## 3. Coach Partner / Affiliate Structure

### Who is a Coach Partner?

- Runs a program / cohort / sales team.  
- Wants to see student calls, not pay for all the seats.

They get a **free Partner Account** with:

- Coach dashboard  
- Ability to connect to students and see shared calls / leave notes  
- No personal recording included (if they want their own library, they buy Solo/Team like anyone else).

### Commission Rules

- Standard commission: **30% recurring for 12 months** on every referred paid subscription.  
- Once a coach has **20 active paid users**, bump to **40% recurring for 12 months** on new referrals going forward.

You track by:

- `partner_id` (or similar) on user / subscription  
- Partner dashboard showing:
  - Active referred paid users  
  - Current month’s estimated commission  
  - Payout history

### “3 Paid Clients” Threshold Benefit

At **3 active paid users** referred:

- Unlock “Coach Pro” features on the free partner account:
  - Full coaching dashboard  
  - Ability to set default sharing rules  
  - Filter / search across all their linked students’ calls  
- Still no personal recording library unless they buy Solo/Team.

This keeps them hungry (they want 3 as fast as possible) without you eating SaaS margin on day one.

---

## 4. High-Ticket Upsell: Custom GPT Coach

This is your premium back-end for top coaches.

### Offer

“Custom AI Coach for Your Program”:

- You ingest their scripts, objections, frameworks, scorecards.  
- You build a private CallVault agent that:
  - Auto-scores every student call against their methodology.  
  - Tags key moments, flags misses, and produces a score + notes.  
  - Optionally generates per-student progress reports.

### Pricing

- Setup fee: **$5,000–$10,000 one-time** (depending on scope).  
- Recurring: **$500–$1,500/mo** depending on student volume (tie this to call volume / seats, not vague “access”).

Tie access to an existing SaaS tier:

- Require Business or Enterprise as the base, then sell this on top.  
- This prevents you from servicing cheap accounts with a heavy, custom feature.

---

## 5. White-Label Tier (For Big Coaches / Agencies Only)

This is the *top* of the ladder. Use sparingly.

### Who qualifies

- Programs / agencies doing, say, **50+ active users** on CallVault and wanting “their own platform.”

### Structure

- You keep core infra; you reskin branding and domain.  
- Pricing options (choose one and commit):
  - **Per-seat**: e.g. $15–$20/user/mo with **50-seat minimum**.  
  - Or **Flat platform fee**: e.g. $2,000–$5,000/mo up to X users, plus overage per seat.

Keep it simple:

- No weird rev share on their program revenue.  
- They pay you as a bulk SaaS client.  
- You can still optionally give them an **internal** affiliate override (e.g. 10% on new subs they bring beyond contract minimum), but do not stack that with the external 30–40% coach program.

---

## 6. Simple summary for you and for the site

- End users pay normal SaaS prices (Free → Solo → Team → Business → Enterprise).  
- Coaches don’t buy seats; they **refer** seats.  
- Coaches earn **30–40% recurring for 12 months** plus free “Coach Pro” at 3+ paid.  
- Students using the link get a **bonus** (extra trial or first‑month discount).  
- Top coaches get:
  - Custom AI Coach as a high-ticket upsell.  
  - Optional white-label if they’re big enough.

That’s the full ladder. You can build this exactly as written and not have to rethink your economics in 12 months.