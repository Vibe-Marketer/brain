# CallVault Pricing Rubric (Draft v1)

## 1. Core SaaS Plans (End Users: Students / Reps / ICs)

**Principle:** All metered usage is billed per user. Collaboration / coaching layers sit on top.

### 1.1 Free

- Users: 1  
- Usage caps:
  - Max minutes / month (e.g. 300)  
  - Limited storage (exact GB to be defined)  
- Features:
  - Transcription, basic AI summary on a limited number of calls  
  - No Teams  
  - No coaching relationships  
  - View-only access to shared links

### 1.2 Solo

- Price:
  - $29 / month  
  - $278 / year (20% discount)  
- Users: 1  
- Features:
  - “Unlimited” calls and AI summaries (within fair use)  
  - Folders, tags, AI search  
  - Coaching capabilities:
    - Max 1 coach  
    - Max 1 coachee  
    - Max 10 notes per call  
  - No Teams access

### 1.3 Team

- Price:
  - $99 / month  
  - $950 / year  
- Included seats:
  - Up to 5 full users (record/store calls)  
- Additional seats:
  - $20 / month per user, up to 20 total seats  
- Features:
  - Team hierarchy  
  - Manager auto-access to team calls  
  - Shared folders  
  - Coaching capabilities:
    - Max 2 coaches  
    - Max 3 coachees  
    - Unlimited notes

### 1.4 Business

- Price:
  - $249 / month  
  - $2,390 / year  
- Included seats:
  - Up to 20 full users  
- Additional seats:
  - $18 / month per user above 20 until Enterprise threshold  
- Features:
  - All Team features  
  - Advanced admin and analytics  
  - Priority support  
  - Coaching capabilities:
    - Max 5 coaches  
    - Max 10 coachees  

### 1.5 Enterprise

- Price:
  - Custom, starting ≈ $1,500 / month  
- Seats:
  - 20+  
- Features:
  - All Business features  
  - Volume discounts  
  - SSO / SAML  
  - Custom security / compliance  
  - Dedicated CSM  
  - SLA  

### 1.6 Billing Defaults

- Display monthly and annual options.  
- Default highlight: “Save 20% with annual billing.”

---

## 2. Student Discount via Coach Link

**Condition:** User signs up using a valid Coach Partner referral link.

- Eligible plans: any paid plan (Solo / Team / Business / Enterprise self-serve).  
- Discount option (choose one global policy):
  - Option A: Extend free trial by +7 days.  
  - Option B: 20% discount on first paid month.  

---

## 3. Coach Partner / Affiliate Rubric

### 3.1 Definition

Coach Partner:

- Runs a program / cohort / sales team.  
- Primary intent: view / coach student calls.  
- Does not purchase bulk seats.

### 3.2 Account Type

Coach Partner Account (free):

- Coach dashboard  
- Ability to connect to students and view shared calls  
- Ability to leave notes  
- No personal recording library (unless on a paid plan as an end user)

### 3.3 Commission Rules

- Standard commission:
  - 30% recurring on subscription revenue from referred users  
  - Commission duration per user: 12 months from that user’s initial subscription start  
- Tiered upgrade:
  - Threshold: 20 active paid referred users  
  - New rate on future referrals: 40% recurring for 12 months per new user  
- Tracking:
  - Store `partner_id` on user/subscription  
  - Provide partner dashboard:
    - Count of active paid referred users  
    - Current month commission estimate  
    - Payout history

### 3.4 “3 Paid Clients” Threshold: Coach Pro Unlock

**Condition:** Coach Partner reaches ≥ 3 active paid referred users.

- Unlock “Coach Pro” feature set on partner account:
  - Full coaching dashboard  
  - Ability to set default sharing rules for new students  
  - Search / filter across all linked students’ calls  
- Limitation:
  - Still no personal recording library unless the coach purchases Solo/Team/Business as a standard user.

---

## 4. High-Ticket Upsell: Custom GPT Coach

### 4.1 Offer Definition

Custom AI Coach for a specific program:

- Inputs:
  - Client’s scripts, objection handling, frameworks, scorecards  
- Capabilities:
  - Auto-score calls against client methodology  
  - Tag key call moments and flag misses  
  - Generate per-call score and notes  
  - Optional per-student progress reports

### 4.2 Pricing

- Setup fee:
  - $5,000–$10,000 one-time  
- Recurring fee:
  - $500–$1,500 / month  
  - Pricing tied to student count and/or call volume

### 4.3 Eligibility & Dependencies

- Base requirement:
  - Client must be on Business or Enterprise (no exception).  
- Positioning:
  - Sold only to high-volume coaches / teams with meaningful call volume.

---

## 5. White-Label Rubric

### 5.1 Eligibility

- Programs / agencies with ≥ 50 active CallVault end users.  
- Desire branded / custom domain experience.

### 5.2 Structure

- You maintain infrastructure.  
- Deliverables:
  - Custom branding  
  - Custom domain  
  - Optional minor UI tweaks (non-core feature changes)

### 5.3 Pricing Models (choose one global policy)

- Option A: Per-seat white-label
  - $15–$20 / user / month  
  - 50-seat minimum commitment  
- Option B: Flat platform fee
  - $2,000–$5,000 / month up to an agreed user cap  
  - Per-seat overage fee above cap

### 5.4 Constraints

- No revenue share on the coach’s program revenue.  
- White-label client is billed as a standard B2B SaaS account.  
- Internal overrides (e.g. 10% extra on new users above contract) are allowed but must not stack with standard 30–40% Coach Partner commissions.
