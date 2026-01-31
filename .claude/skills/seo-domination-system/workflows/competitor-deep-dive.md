# Competitor Deep Dive Workflow

<objective>
Complete competitive intelligence on 3-5 competitors covering traffic, keywords, content strategy, backlink profile, and AI visibility. Output: Actionable intel report with strategic recommendations.
</objective>

<inputs_required>
- Your domain (if comparing)
- 3-5 competitor domains
- Primary keyword/category
- SEO tool access (Ahrefs, SEMrush, or similar)
</inputs_required>

<process>

## Phase 1: Traffic & Authority Overview (Browser)

For each competitor, extract from Ahrefs/SEMrush:

```
Go to [SEO_TOOL]/site-explorer. Enter "[COMPETITOR]".
Extract and document:
- Domain Rating (DR) / Domain Authority (DA)
- Organic traffic estimate (monthly)
- Number of ranking keywords
- Number of referring domains
- Top 5 traffic pages
```

Create comparison table:

| Metric | Comp 1 | Comp 2 | Comp 3 | You |
|--------|--------|--------|--------|-----|
| DR/DA | | | | |
| Organic Traffic | | | | |
| Ranking Keywords | | | | |
| Referring Domains | | | | |

## Phase 2: Keyword Intelligence

**Top Performing Keywords:**
```
For each competitor in [SEO_TOOL]:
Site Explorer > Organic keywords
Filter: Position 1-10, Volume > 200
Extract top 30 keywords with: keyword, position, volume, URL
```

**Keyword Overlap Analysis:**
```
[SEO_TOOL] > Content Gap (or Keyword Gap)
Compare your domain vs all competitors
Find keywords where 2+ competitors rank but you don't
Filter: Volume > 100, KD < 50
```

**Bottom-Funnel Keywords Check:**
For each competitor, identify which of these they rank for:
- [product] pricing
- [product] vs [competitor]
- [competitor] alternative
- best [category] software/tools
- [category] reviews

## Phase 3: Content Strategy Analysis

**Content Volume:**
```
[SEO_TOOL] > Top pages
Count total pages getting organic traffic
Identify content hubs/categories
Note publishing velocity (pages added last 6 months)
```

**Content Types Matrix:**

| Content Type | Comp 1 | Comp 2 | Comp 3 | You |
|--------------|--------|--------|--------|-----|
| Comparison pages ("vs") | | | | |
| Alternative pages | | | | |
| Listicles ("best X") | | | | |
| How-to guides | | | | |
| Feature pages | | | | |
| Integration pages | | | | |
| Case studies | | | | |
| Glossary/definitions | | | | |

**Featured Snippets Won:**
```
[SEO_TOOL] > Organic keywords
Filter: SERP features contains "Featured snippet"
Count how many snippets each competitor owns
Note which content types win snippets
```

## Phase 4: Backlink Analysis

**Link Profile Overview:**
```
[SEO_TOOL] > Backlinks
For each competitor:
- Total backlinks (dofollow)
- Unique referring domains
- Average DR of referring domains
```

**Link Acquisition Patterns:**
```
[SEO_TOOL] > Referring domains > New (last 6 months)
Filter: DR > 30
Identify patterns:
- Guest posts (author bios)
- Resource page links
- Directory listings
- PR/news mentions
- Integration partner pages
```

**Replicable Backlinks:**
```
[SEO_TOOL] > Link intersect
Find domains linking to 2+ competitors but not you
These are your immediate outreach targets
```

## Phase 5: AI Visibility Check

**Test in ChatGPT:**
```
"What is [Competitor]?"
"What are the best [category] tools?"
"How does [Competitor] compare to its alternatives?"
```

Score each competitor 0-5 on AI visibility.

**Test in Perplexity:**
```
"[category] software comparison"
"Best [category] tools 2024"
```

Note which competitors are cited and from what sources.

## Phase 6: Synthesize & Strategize

**Competitor SWOT for each:**
- Strengths (where they beat you)
- Weaknesses (gaps you can exploit)
- Content opportunities (what they don't cover well)
- Link opportunities (sources linking to them, not you)

**Strategic Recommendations:**
Based on analysis, identify:
1. Quick wins (30 days) - Low-effort high-impact actions
2. Medium-term plays (90 days) - Content/link building priorities
3. Long-term moats (6-12 months) - Sustainable advantages to build

</process>

<output_template>
Save to: `competitor-intel-report-[DATE].md`

Use template from: templates/competitor-report.md
</output_template>

<success_criteria>
- All 5 phases completed with data
- Comparison tables populated
- At least 10 actionable recommendations
- Prioritized by effort/impact
- AI visibility scores documented
- Report saved to Downloads folder
</success_criteria>
