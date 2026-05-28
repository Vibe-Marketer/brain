---
created: 2026-05-28
title: DIY Compliance Bootstrap — Interceptor + AskUserQuestion plan
status: plan-only
companion_to: .planning/research/compliance-readiness-2026-05-28.md
---

# DIY Compliance Bootstrap — How far can we get for $0

> Companion to the readiness matrix. The matrix said SOC 2 Type I = $25–45K. This plan is the FREE work we can do right now — pre-positioning so when budget arrives, the audit is the only thing left to pay for.

---

## What the $25–45K actually buys

| Component | Cost slice | Replaceable by DIY? |
|-----------|-----------|---------------------|
| Compliance automation platform (Vanta/Drata/Oneleet subscription) | $12–20K/yr | **~70–80% yes** — continuous-control-monitoring is the hard 20% |
| Policy library (30 policies) | $2–5K (templates) or bundled with platform | **100% yes** — open templates + substitute facts |
| CAIQ/SIG questionnaire completion | bundled or $1–3K consultant | **100% yes** — Interceptor + AskUserQuestion does this |
| Trust page / customer-facing security docs | bundled or $500 | **100% yes** — static `/trust` route |
| Gap-analysis / readiness scoring | $3–8K consultant or bundled | **100% yes** — codify the AICPA TSP criteria, score in TS |
| **The actual CPA audit** | $10–20K | **0% — must come from a licensed CPA firm** |
| Penetration test (Type II requires) | $5–15K | **30%** — can defer to Type II, negotiate with security researchers, or use a budget firm |

**Bottom line:** of the $25–45K, **$15–25K is replaceable**. The remaining $10–20K is the audit itself. Goal of this plan: get to the audit fully prepped so when budget hits, it's "send invoice → 8 weeks → attestation," not "send invoice → 6 months of platform onboarding → attestation."

---

## Architecture: what we're building

Three persistent stores, four pipelines, all in this repo under `tools/compliance/`.

### Stores

1. **Evidence vault** — `.compliance/evidence/{YYYY-MM-DD}/{platform}-{capture}.{png|json|md}` — timestamped, append-only, machine-grepable.
2. **Facts ledger** — `.compliance/facts.yaml` — the answers to questions only Andrew can answer (headcount, incidents, customer list, vendor list, etc.). Single source of truth fed by AskUserQuestion.
3. **Policy library** — `.compliance/policies/*.md` — generated from open templates, parameterized by facts.yaml. Regenerated on facts.yaml change.

### Pipelines

1. **Evidence capture** (Interceptor-driven) — automated screenshots + JSON exports from Supabase / Vercel / GitHub / Stripe / DNS / domain configs.
2. **Facts gathering** (AskUserQuestion-driven) — periodic structured interview that updates facts.yaml.
3. **Policy generation** (Bun/TS-driven) — template + facts.yaml → policy MD files, committed to git.
4. **Questionnaire fill** (Bun/TS-driven) — CAIQ-Lite + SIG-Lite JSON answer files, exportable to PDF.

---

## Phase A — Evidence vault (Interceptor primary)

**Goal:** Automated, repeatable capture of every fact an auditor/buyer would ask us to prove.

### A1. Supabase dashboard

| Evidence | Why it matters | Capture |
|----------|----------------|---------|
| Project region | Data residency for GDPR + customer transparency | Screenshot of Project Settings → General |
| Backup schedule + retention | DR control (CC7.5) | Screenshot of Database → Backups |
| Daily backup history | Proof backups actually run | Screenshot of last 7 days of backup list |
| RLS policy count + status | Access control (CC6.1) | Screenshot of Database → Policies, JSON export |
| MFA enforced on team | Identity (CC6.2) | Screenshot of Organization → Team |
| Audit log retention | Logging (CC7.2) | Screenshot of Logs → Audit |
| HIPAA/SOC2 plan tier | Inheritance claim | Screenshot of Organization → Billing |

### A2. Vercel dashboard

| Evidence | Why | Capture |
|----------|-----|---------|
| Project region | Residency | Settings → General |
| Team members + MFA | Access control | Team settings |
| Production branch protection | Change mgmt (CC8.1) | Git → Production Branch |
| Environment variable count (NOT values — just count + names) | Secret management | Settings → Environment Variables, redacted screenshot |
| Build & deploy logs retention | Logging | Deployments tab |
| Edge config / firewall rules | Network security | Settings → Firewall (if used) |

### A3. GitHub repo

| Evidence | Why | Capture |
|----------|-----|---------|
| Branch protection on `main` | Change mgmt | Settings → Branches |
| Required reviewers count | Segregation of duties (CC6.3) | Same |
| Secret scanning enabled | Vuln mgmt (CC7.1) | Settings → Code security |
| Dependabot status + alert count | Vuln mgmt | Security tab |
| Codeowners file existence | Access control | Repo file listing |
| MFA enforcement on org | Identity | Org settings |
| 2FA-required teams list | Identity | Org → People |

### A4. Stripe

| Evidence | Why | Capture |
|----------|-----|---------|
| Account owner email + MFA | Identity | Settings → Team |
| Webhook config | Integration security | Developers → Webhooks |
| PCI compliance attestation | PCI scope justification | Settings → Compliance (Stripe self-serve) |

### A5. Domain / DNS / email

| Evidence | Why | Capture |
|----------|-----|---------|
| WHOIS + registrar 2FA | Domain control | `dig` + registrar screenshot |
| SPF, DKIM, DMARC records | Email auth (CC6.6) | `dig TXT` outputs |
| TLS cert validity + grade | Encryption in transit | SSL Labs scan, saved HTML |
| HSTS + security headers | Encryption + transport | securityheaders.com scan |

### A6. Capture cadence

- **First run:** full sweep, ~45 minutes Interceptor + Bash, mostly automated, Andrew interrupts only for OAuth re-auth.
- **Monthly:** delta-only sweep, ~10 minutes — re-runs all captures, diffs vs prior, surfaces changes.
- **Per-deploy hook (optional later):** if a production deploy changes a security-relevant config, snapshot the change automatically.

### A7. Tool to build

`tools/compliance/EvidenceCapture.ts` — orchestrator that:
- Reads `.compliance/captures.yaml` (the list above as config)
- Drives Interceptor through each capture, saves to dated vault directory
- Outputs `.compliance/evidence/{date}/INDEX.md` enumerating what was captured
- Diffs against last run, writes `.compliance/evidence/{date}/CHANGES.md`

Bun/TS, ~400 lines. One day of work.

---

## Phase B — Facts ledger (AskUserQuestion primary)

**Goal:** the company facts an auditor will demand in a CMQ (control management questionnaire) or vendor security review. Things only Andrew knows.

### Questions to gather (one-time setup, then drift-check quarterly)

Each is an `AskUserQuestion` call with structured options.

**Organization & headcount**
- Legal entity name + state of incorporation
- Number of employees (with system access)
- Number of contractors (with system access)
- Office locations (or "remote-only")
- Onboarding/offboarding process owner

**Access control**
- Who has admin access to Supabase production? (list)
- Who has admin access to Vercel production? (list)
- Who has access to AWS / GCP / other cloud? (or "none")
- Password manager in use (1Password / Bitwarden / none)
- MFA on personal email accounts of admins? (yes/no/partial)

**Incident history (last 12 months)**
- Any security incidents? (yes/no, brief description if yes)
- Any data breaches? (yes/no)
- Any uptime SLA breaches? (yes/no, count)
- Process when an incident occurs (free-form)

**Customer data**
- Default retention period for call recordings
- Default retention period for transcripts
- Customer-initiated deletion process (URL or "email support")
- Data export available on request? (yes/no, mechanism)
- Customers in regulated verticals? (healthcare / financial / education / government — list)

**Vendors / subprocessors (the legally-required GDPR list)**
- Confirm the inferred list: Supabase, Vercel, Stripe, OpenRouter/Anthropic/OpenAI, [others]
- Each vendor: signed DPA on file? (yes/no/unknown)
- Each vendor: region of data processing
- Last vendor review date

**Code & change management**
- All production code reviewed before merge? (yes/no)
- Production access from personal laptops or only org-managed devices?
- Disk encryption on all dev machines? (FileVault/BitLocker)

**Risk & business continuity**
- Last documented risk assessment? (date or "never")
- DR plan documented? (yes/no)
- Last backup restore test? (date or "never")
- Cyber insurance? (yes/no, carrier)

### Tool to build

`tools/compliance/FactsInterview.ts` — orchestrator that:
- Reads `.compliance/facts.yaml` (current state)
- For each question category, checks if facts are present + recent (within 90 days)
- AskUserQuestion for missing/stale ones
- Writes back to `.compliance/facts.yaml`
- Outputs `.compliance/facts-completeness.md` (X of Y answered, last refresh per section)

Bun/TS, ~300 lines. Half day to build, ~45 minutes for Andrew on first pass.

---

## Phase C — Policy library (generation primary)

**Goal:** the ~30 policies SOC 2 requires, customized to CallVault, generated from open templates + facts.yaml.

### Templates to seed from (all free, open-source)

- **CIS Critical Security Controls v8** — control mapping
- **NIST SP 800-53 Rev 5** — policy structure
- **JupiterOne open policy templates** ([github.com/jupiterone/security-policy-templates](https://github.com/JupiterOne/security-policy-templates)) — actual SOC 2-aligned templates, MIT licensed
- **Trail of Bits' Algo policies** — for technical control statements
- **Common Paper DPAs** — for the customer-facing DPA template

### Policies needed (SOC 2 Type I baseline)

1. Information Security Policy (master document)
2. Access Control Policy
3. Acceptable Use Policy
4. Asset Management Policy
5. Backup Policy
6. Business Continuity / DR Policy
7. Change Management Policy
8. Code of Conduct
9. Cryptography Policy
10. Data Classification Policy
11. Data Retention & Deletion Policy
12. Encryption Policy
13. HR Security Policy
14. Incident Response Plan
15. Information Security Awareness Policy
16. Logging & Monitoring Policy
17. Network Security Policy
18. Password Policy
19. Patch Management Policy
20. Physical Security Policy (trivial for remote-only)
21. Risk Assessment Policy
22. Secure Development Policy
23. Secure SDLC Policy
24. Security Awareness Training Policy
25. Subprocessor Management Policy
26. Supplier Security Policy
27. Third-party Risk Management Policy
28. Vendor Management Policy
29. Vulnerability Management Policy
30. Workstation Security Policy

### Tool to build

`tools/compliance/PolicyGenerator.ts`:
- Each policy is a Mustache/Handlebars template at `tools/compliance/templates/{policy-slug}.md.tmpl`
- Substitutes from `.compliance/facts.yaml`
- Outputs to `.compliance/policies/{policy-slug}.md`
- Each policy has a `last_reviewed` and `next_review_due` (annual)
- `--check` mode lists policies due for review

Bun/TS, ~250 lines + ~30 template files (1 day to write all templates referencing public sources).

---

## Phase D — Questionnaire fill (CAIQ-Lite + SIG-Lite)

**Goal:** auto-fill the two questionnaires mid-market buyers actually send.

### CAIQ-Lite (Cloud Security Alliance, free, ~120 questions)

- Public spec: [cloudsecurityalliance.org/research/cloud-controls-matrix](https://cloudsecurityalliance.org/research/cloud-controls-matrix)
- ~80% of answers derivable from `.compliance/facts.yaml` + evidence vault
- Remaining ~20% are written answers (data flow descriptions, etc.) — AskUserQuestion or hand-fill

### SIG-Lite (Shared Assessments, ~300 questions)

- Pricier license for full SIG, but SIG-Lite is more commonly accepted
- **Don't pay for SIG-Lite license unless a specific buyer demands it** (per the readiness matrix). Instead, build a CallVault-branded questionnaire that hits the same control families:
  - Information governance
  - Risk management
  - Security awareness training
  - Asset management
  - HR security
  - Physical & environmental security
  - Operations security
  - Communications security
  - Systems acquisition / development / maintenance
  - Supplier relationships
  - Incident management
  - BCDR
  - Compliance

### Tool to build

`tools/compliance/QuestionnaireFiller.ts`:
- Question bank in `tools/compliance/questions/{caiq|sig-equivalent}.yaml`
- Each question has `derived_from` (a facts.yaml path or evidence-vault path) OR `manual` (gets AskUserQuestion at fill time)
- Outputs JSON answer file + Markdown export + (optional) PDF
- Re-fill on `facts.yaml` change

Bun/TS, ~350 lines + the question banks (1 day to populate question→answer mapping).

---

## Phase E — Trust page (`/trust` on callvaultai.com)

**Goal:** a static page mid-market buyers can self-serve from. Reduces "send me your security docs" emails by 60–80%.

### Page structure

1. **Hero:** "CallVault security at a glance" — 3 stat tiles (encryption in transit/at rest, audit logs, data isolation)
2. **Certifications:** "SOC 2 Type I — in progress, target Q4 2026" + Supabase + Vercel inheritance badges with links
3. **Subprocessors:** table with name + purpose + region + DPA link
4. **Data handling:** retention, deletion, export — with link to DPA template
5. **Security controls:** brief description of access, encryption, monitoring, incident response
6. **Customer security review:** "Send security questionnaires to security@callvaultai.com — we typically respond within 5 business days"
7. **Status page:** link to public uptime page (UptimeRobot free tier or BetterStack)
8. **Downloads:** DPA, BAA template, CAIQ-Lite response, security whitepaper

### Tool to build

`tools/compliance/TrustPageBuilder.ts`:
- Reads `.compliance/facts.yaml` (subprocessor list, retention, certifications status)
- Generates a single `/src/pages/TrustPage.tsx` from a template
- Re-runs on `facts.yaml` change

Bun/TS, ~200 lines + a React page template. Half day.

**Companion artifact:** `docs/security/whitepaper.md` — 4-6 page architectural overview, hand-written first pass, then maintained.

---

## Phase F — Readiness scoring

**Goal:** at any moment, output "you are X% ready for SOC 2 Type I attestation, here are the Y blocking items."

### Score against AICPA TSP Section 100 — Trust Services Criteria

Five categories:
- **CC1 — Control Environment**
- **CC2 — Communication & Information**
- **CC3 — Risk Assessment**
- **CC4 — Monitoring**
- **CC5 — Control Activities**
- **CC6 — Logical & Physical Access**
- **CC7 — System Operations**
- **CC8 — Change Management**
- **CC9 — Risk Mitigation**

Plus optional categories: A (Availability), C (Confidentiality), P (Privacy).

### Tool to build

`tools/compliance/ReadinessScorer.ts`:
- Maps each AICPA control to one or more of: policy presence, evidence vault item, facts.yaml answer
- Scores each control as MET / PARTIAL / MISSING
- Outputs `.compliance/readiness/{date}-score.md` with rollup by category
- Diff vs last score → progress over time
- `--blocking` mode shows only MISSING items needed for Type I

Bun/TS, ~400 lines + the control mapping YAML (1.5 days — the mapping itself is the work).

---

## Phase G — Continuous evidence refresh

**Goal:** the one thing Vanta/Drata actually earn their money on — continuous control monitoring. We can DIY 70-80% of it with cron + Interceptor.

### Cadence

- **Daily:** Supabase + Vercel + GitHub status checks (status pages — 200/non-200, takes 30s)
- **Weekly:** evidence vault refresh, diff alert if security-relevant config changed
- **Monthly:** full evidence sweep, full readiness re-score, surface diff
- **Quarterly:** AskUserQuestion drift check on facts.yaml (employees, incidents, vendors)
- **Annually:** full policy review cycle, full risk assessment

### Tool to build

`tools/compliance/ContinuousMonitor.ts`:
- Cron-friendly (designed for `crontab` or GitHub Actions schedule)
- Runs the relevant Capture/Scorer/Diff
- Writes to `.compliance/monitor/{YYYY-MM}/` 
- On significant change, posts to Pulse/notification (so Andrew sees it)

Bun/TS, ~200 lines orchestrator + reuses tools from A/F.

---

## Effort & timeline (zero-dollar path)

| Week | Hours | Output |
|------|-------|--------|
| Week 1 | 8h Claude build + 2h Andrew | EvidenceCapture + FactsInterview tools done. First evidence sweep + facts gather complete. |
| Week 2 | 8h Claude build + 1h Andrew | PolicyGenerator + 30 policy templates done. First policy library generated. |
| Week 3 | 6h Claude + 2h Andrew | QuestionnaireFiller done. First CAIQ-Lite + custom SIG-equivalent filled. |
| Week 4 | 6h Claude + 2h Andrew | TrustPageBuilder + `/trust` route live. Whitepaper draft. |
| Week 5 | 8h Claude + 1h Andrew | ReadinessScorer done. First readiness score. Gap list. |
| Week 6 | 4h Claude + 0.5h Andrew | ContinuousMonitor + cron schedule live. Drift alerting wired. |
| Week 7–8 | gap closure | Patch the MISSING items the scorer flagged. Mostly policy gaps, not platform gaps. |

**Total: ~50 hours of Claude work + ~9 hours of Andrew's time spread over 8 weeks.**

After week 8, you have:
- Complete policy library
- Filled CAIQ-Lite + custom SIG-equivalent
- Public trust page
- Auto-refreshed evidence vault
- Quantified readiness score
- All artifacts mid-market buyers actually ask for

Cost: $0 in subscriptions.

---

## What you still pay for when the time comes

| Item | Cost | Why DIY can't replace |
|------|------|----------------------|
| CPA audit for SOC 2 Type I | $8–15K (if Vanta-style platform NOT used) | Must come from licensed CPA firm |
| Penetration test | $5–10K (alt: defer to Type II) | Outside-attacker perspective |
| Type II monitoring period audit | $10–20K | Must come from licensed CPA |

**Realistic fast path total when ready:** $13–25K (vs $40–60K with platforms), 6–9 months from "go" to "Type I attestation in hand."

The DIY work in this plan is the prerequisite that makes the auditor's job 80% smaller — and auditor pricing tracks engagement effort, not company revenue.

---

## What DOESN'T scale DIY

Honest list:
- **20% of continuous monitoring** that Vanta automates — specifically, cross-SaaS MFA/access verification at scale. If CallVault adds 20+ SaaS subscriptions, manual quarterly checks become a real burden.
- **Trust-platform branding** — buyers do recognize "powered by Vanta" badges on a trust page. There's a small psychological premium to it.
- **Pre-built vendor questionnaire library** — some platforms ship 200+ pre-filled buyer questionnaire templates. We'd build CallVault's own library as questionnaires arrive.

None of these matter at current stage. All become reconsiderable once a platform's $12–20K/yr is < 1 sales cycle saved.

---

## What this plan recommends building NOW vs LATER

**Build now (weeks 1–4):**
- EvidenceCapture
- FactsInterview
- PolicyGenerator
- QuestionnaireFiller
- TrustPageBuilder

Why: these unblock customer security reviews. Mid-market buyer asks for CAIQ → you send it within 24h instead of weeks. Trust page deflects half the asks before they happen. Direct, near-term revenue impact.

**Build later (weeks 5–6, only if Phase E doesn't kill the need):**
- ReadinessScorer
- ContinuousMonitor

Why: these only become valuable once Andrew is actively prepping for an audit engagement. Until then, they're maintenance burden.

---

## Open questions for Andrew (would gather via AskUserQuestion if approved to execute)

1. Is CallVault formally incorporated? If yes, what entity name + state?
2. Solo founder, or are there other employees/contractors with system access?
3. Any customers asking about SOC 2 / HIPAA / DPA today? Any deals lost because of it?
4. Any incidents in last 12 months you'd consider security-relevant?
5. Default call-recording retention currently — is there a policy or just "whatever the database holds"?
6. Cyber insurance — yes/no? If yes, carrier?
7. Should the trust page live at `app.callvaultai.com/trust` or `callvaultai.com/trust` (marketing site)?

These are the only blocking inputs to start Phase A + B work.

---

## Recommendation

Execute weeks 1–4 (EvidenceCapture + FactsInterview + PolicyGenerator + QuestionnaireFiller + TrustPageBuilder). That's ~28 hours of Claude work + ~7 hours of Andrew's time over 4 weeks. The output unblocks mid-market sales conversations on its own, regardless of whether SOC 2 Type I ever ships.

Hold weeks 5–6 (ReadinessScorer + ContinuousMonitor) until either a buyer demand or budget arrival triggers the audit prep window.
