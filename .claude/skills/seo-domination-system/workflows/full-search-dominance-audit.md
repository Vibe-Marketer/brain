# Full Search Dominance Audit Workflow

<objective>
Complete audit covering traditional SEO, AEO (featured snippets/voice), and GEO (AI search visibility). Output: Comprehensive report with 90-day action plan across all search surfaces.
</objective>

<inputs_required>
- Your domain
- Primary category/niche
- Target keywords (3-5)
- Top competitors (3-5)
- Google Search Console access (recommended)
- SEO tool access (Ahrefs/SEMrush)
</inputs_required>

<estimated_duration>
45-60 minutes for full audit
</estimated_duration>

<process>

## Part 1: Traditional SEO Audit (20 min)

### 1.1 Technical Health Check

```
Run site audit in [SEO_TOOL] or Screaming Frog

Check:
- [ ] Crawlability issues
- [ ] Broken links (4xx errors)
- [ ] Missing/duplicate titles
- [ ] Missing/duplicate meta descriptions
- [ ] Missing H1s or multiple H1s
- [ ] Missing alt text
- [ ] Slow pages (>3s load time)
- [ ] Mobile issues
- [ ] HTTPS issues
- [ ] Sitemap issues
- [ ] Robots.txt issues
```

**Document top 10 technical issues by priority.**

### 1.2 Authority Metrics

```
[SEO_TOOL] > Site Explorer > [YOUR_DOMAIN]

Extract:
- Domain Rating/Authority
- Total organic traffic
- Total ranking keywords
- Total referring domains
- Traffic trend (last 12 months)
```

### 1.3 Top Performing Content

```
[SEO_TOOL] > Top Pages

Extract top 20 pages by:
- Traffic
- Keywords ranking
- Backlinks

Identify:
- Content types that work
- Topics that rank well
- Pages with most potential (high impressions, not #1)
```

### 1.4 Keyword Position Distribution

```
[SEO_TOOL] > Organic Keywords

Count keywords by position:
- Position 1: [X]
- Position 2-3: [X]
- Position 4-10: [X]
- Position 11-20: [X]
- Position 21-50: [X]
- Position 51-100: [X]

Focus areas:
- Position 4-10 = Striking distance (push to page 1)
- Position 11-20 = Need significant improvement
```

### 1.5 Google Search Console Analysis (if available)

```
GSC > Performance > Last 3 months

Top queries by:
- Impressions (brand awareness)
- Clicks (actual traffic)
- CTR (title/description optimization needs)

Find:
- High impression, low CTR queries (title optimization)
- High impression, low position queries (content improvement)
- Declining queries (content refresh needed)
```

### 1.6 Competitive Position

```
[SEO_TOOL] > Compare your domain vs 3 competitors

| Metric | You | Comp 1 | Comp 2 | Comp 3 |
|--------|-----|--------|--------|--------|
| DR | | | | |
| Traffic | | | | |
| Keywords | | | | |
| Backlinks | | | | |
```

---

## Part 2: AEO Audit (15 min)

### 2.1 Featured Snippet Inventory

```
[SEO_TOOL] > Organic Keywords
Filter: SERP features = "Featured snippet"

Count:
- Snippets you own: [X]
- Snippets you could win (position 2-10): [X]
- Total snippet opportunities for your keywords: [X]
```

### 2.2 Featured Snippet Capture Opportunities

```
Filter your keywords:
- Position 2-10
- Featured snippet exists
- Volume > 100

These are your priority snippet targets

For top 10 opportunities:
| Keyword | Your Position | Volume | Snippet Type | Current Owner |
```

### 2.3 PAA (People Also Ask) Presence

```
Google your top 5 target keywords
For each, check PAA box:
- Do you appear in any PAA answers?
- Are your competitors in PAA?
- What questions appear repeatedly?

Document top 20 PAA questions across all searches
```

### 2.4 Schema Markup Audit

```
Check key pages for schema:
- Homepage: Organization schema
- Blog posts: Article schema
- Product pages: Product schema
- FAQ content: FAQPage schema
- How-to content: HowTo schema

Validate at: validator.schema.org

Missing schema = opportunity
```

### 2.5 Voice Search Readiness

```
For your top 10 keywords:
- Do you have content answering question format?
- Are answers concise (< 30 words)?
- Is content in complete sentences?
- Do you rank position 1-3? (voice typically reads top result)
```

---

## Part 3: GEO Audit (15 min)

### 3.1 ChatGPT Visibility Test

```
Ask ChatGPT (GPT-4):
1. "What is [YOUR_COMPANY]?"
2. "What are the best [YOUR_CATEGORY] tools?"
3. "Compare [YOUR_PRODUCT] to [TOP_COMPETITOR]"
4. "What are alternatives to [TOP_COMPETITOR]?"

Score each:
- Mentioned: Yes/No
- Accurate: Yes/Partially/No
- Positive sentiment: Yes/Neutral/No
- Recommended: Yes/No
```

### 3.2 Perplexity Visibility Test

```
Search Perplexity:
1. "[YOUR_CATEGORY] tools comparison"
2. "Best [YOUR_CATEGORY] software 2024"
3. "[YOUR_COMPANY]" (direct brand search)

Document:
- Are you mentioned?
- What sources are cited?
- Are competitors mentioned more prominently?
```

### 3.3 Claude Visibility Test

```
Ask Claude:
1. "What can you tell me about [YOUR_COMPANY]?"
2. "What are the leading [YOUR_CATEGORY] tools?"

Document accuracy and completeness.
```

### 3.4 Google AI Overview Test

```
Google your top 5 keywords
Check if AI Overview appears
If yes:
- Are you mentioned/cited?
- Who is cited?
- What sources power the overview?
```

### 3.5 Entity & Citation Analysis

```
Based on Perplexity citations, identify:
- Sources that cite competitors but not you
- Content formats that get cited (reviews, comparisons, etc.)
- Platforms that appear often (G2, industry blogs, etc.)

Check your presence on:
- [ ] Wikipedia
- [ ] G2/Capterra
- [ ] Industry publications
- [ ] Crunchbase
- [ ] LinkedIn company page
```

### 3.6 AI Visibility Score

```
| Platform | Brand Query | Category Query | Comparison | Total |
|----------|-------------|----------------|------------|-------|
| ChatGPT | [0-5] | [0-5] | [0-5] | [/15] |
| Perplexity | [0-5] | [0-5] | [0-5] | [/15] |
| Claude | [0-5] | [0-5] | [0-5] | [/15] |
| Google AI | [0-5] | [0-5] | [0-5] | [/15] |
| TOTAL | | | | [/60] |

Competitor comparison:
| Company | AI Visibility Score |
|---------|---------------------|
| You | [X/60] |
| Comp 1 | [X/60] |
| Comp 2 | [X/60] |
```

---

## Part 4: Synthesis & Action Plan (10 min)

### 4.1 Score Summary

| Dimension | Score | Status | Priority |
|-----------|-------|--------|----------|
| Technical SEO | [/10] | 🔴🟡🟢 | |
| Content/Authority | [/10] | 🔴🟡🟢 | |
| Featured Snippets | [/10] | 🔴🟡🟢 | |
| Voice/AEO | [/10] | 🔴🟡🟢 | |
| AI Visibility | [/10] | 🔴🟡🟢 | |
| **TOTAL** | [/50] | | |

### 4.2 Top Issues by Impact

**Critical (Fix This Week):**
1. [Issue] - Impact: [description]
2. [Issue] - Impact: [description]

**High Priority (Fix This Month):**
1. [Issue] - Impact: [description]
2. [Issue] - Impact: [description]

**Medium Priority (Fix This Quarter):**
1. [Issue] - Impact: [description]
2. [Issue] - Impact: [description]

### 4.3 90-Day Action Plan

**Days 1-30: Foundation**

Week 1:
- [ ] Fix critical technical issues
- [ ] Update entity information (Wikipedia, Crunchbase, About page)
- [ ] Add missing schema markup to key pages
- [ ] Optimize titles for top 5 low-CTR pages

Week 2-3:
- [ ] Create/optimize comparison pages
- [ ] Target top 5 featured snippet opportunities
- [ ] Get listed on 3 citation sources (G2, etc.)

Week 4:
- [ ] Refresh top 3 declining content pieces
- [ ] Add internal links to orphan pages
- [ ] Publish 2 entity-rich content pieces

**Days 31-60: Growth**

- [ ] Target 10 more snippet opportunities
- [ ] Create content for top 5 keyword gaps
- [ ] Build 10 quality backlinks
- [ ] Expand presence on cited sources
- [ ] Create original research/data content

**Days 61-90: Scale**

- [ ] Scale content production (2-4 pieces/week)
- [ ] Launch link building campaign
- [ ] Create comprehensive resource content
- [ ] Pursue PR for citation building
- [ ] Re-audit AI visibility (measure progress)

### 4.4 KPIs to Track

**Monthly Metrics:**
- Organic traffic
- Ranking keywords
- Featured snippets owned
- AI visibility score
- Referring domains

**Quarterly Metrics:**
- Domain Rating growth
- Traffic growth %
- Keyword position distribution improvement
- Competitive position change

</process>

<output_template>
Save to: `full-search-audit-[DATE].md`

Include all sections with data filled in.
Attach raw data exports as appendices.
</output_template>

<success_criteria>
- All 3 parts (SEO, AEO, GEO) completed
- Scores calculated for each dimension
- Top 10 issues identified and prioritized
- 90-day action plan with specific tasks
- KPIs defined for tracking
- Report saved to Downloads folder
- Baseline metrics documented for future comparison
</success_criteria>
