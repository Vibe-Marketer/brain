# Quick Win Finder Workflow

<objective>
Identify low-effort, high-impact SEO opportunities that can show results in 30 days or less. Focus on keywords you can realistically rank for quickly.
</objective>

<inputs_required>
- Your domain
- Target category/niche
- SEO tool access (Ahrefs, SEMrush, or similar)
- Google Search Console access (highly recommended)
</inputs_required>

<process>

## Quick Win Type 1: Striking Distance Keywords

**Find keywords ranking 4-15 where small improvements = page 1:**

```
Google Search Console:
Performance > Search results > Last 3 months
Filter: Position 4-15, Impressions > 100

OR

[SEO_TOOL] > Site Explorer > Organic keywords
Filter: Position 4-15, Volume > 100

Extract:
- Keyword
- Current position
- Search volume
- URL ranking
- Impressions (if GSC)
- CTR (if GSC)
```

**Prioritization:**
```
Score = Volume × (1/Position) × (1/KD)

Higher score = better opportunity
Focus on positions 4-10 first (one push to page 1)
```

**Quick Fixes for Striking Distance:**
| Position | Typical Fix |
|----------|-------------|
| 4-5 | Add internal links, refresh content |
| 6-10 | Expand content, add schema, build 2-3 links |
| 11-15 | Significant content upgrade + links |

## Quick Win Type 2: Low-Competition Keywords

**Find keywords with weak competition:**

```
[SEO_TOOL] > Keywords Explorer
Enter your seed keywords

Filter:
- KD (Keyword Difficulty) < 20
- Volume > 50
- Show keywords where at least one DR < 20 site ranks in top 5

These are beatable keywords
```

**Validation:**
For each promising keyword, Google it and check:
- [ ] Any DR < 30 sites in top 5?
- [ ] Any forums/Reddit/Quora ranking? (easy to beat)
- [ ] Any thin content ranking? (easy to beat)
- [ ] Any outdated content (> 2 years)? (easy to beat)

## Quick Win Type 3: Featured Snippet Opportunities

**Find snippets you can steal:**

```
[SEO_TOOL] > Site Explorer > Your domain > Organic keywords
Filter:
- Position 2-10
- SERP features includes "Featured snippet"
- You don't own the snippet

These are snippets within reach
```

**Snippet Capture Tactics:**

| Current Snippet Type | How to Beat |
|---------------------|-------------|
| Paragraph | Write clearer 40-60 word answer directly under H2 question |
| List | Create better structured 5-8 item list |
| Table | Create cleaner table with better headers |
| No snippet yet | Be first to provide snippet-formatted answer |

## Quick Win Type 4: High Impression, Low CTR

**Find pages getting seen but not clicked:**

```
Google Search Console:
Performance > Search results > Last 28 days
Sort by Impressions (descending)
Filter: CTR < 3%, Position < 15

These pages need better titles/descriptions
```

**CTR Optimization:**
| Position | Expected CTR | If Below |
|----------|--------------|----------|
| 1 | 25-35% | Something wrong |
| 2-3 | 10-15% | Title needs work |
| 4-5 | 5-10% | Title/desc needs work |
| 6-10 | 3-5% | Significant title/desc rewrite |

**Title Formula That Gets Clicks:**
```
[Number] + [Adjective] + [Keyword] + [Year/Benefit]

Examples:
"7 Proven [Keyword] Strategies for 2024"
"The Complete [Keyword] Guide (Updated 2024)"
"[Keyword]: 15 Expert Tips That Actually Work"
```

## Quick Win Type 5: Content Refresh Candidates

**Find declining content to revive:**

```
Google Search Console:
Performance > Compare last 3 months vs previous 3 months
Sort by "Clicks difference" (ascending = biggest losses)

OR

[SEO_TOOL] > Site Explorer > Organic keywords
Check "Movement" column for position drops
```

**Refresh Checklist:**
- [ ] Update statistics (find 2024 data)
- [ ] Add new sections competitors have
- [ ] Fix any broken links
- [ ] Improve featured snippet formatting
- [ ] Add/update images
- [ ] Update date in content and meta
- [ ] Add internal links from newer content
- [ ] Expand thin sections

## Quick Win Type 6: Internal Link Opportunities

**Find orphan pages (no internal links pointing to them):**

```
Use site crawler (Screaming Frog, Sitebulb, or Ahrefs audit)
Find pages with 0-1 internal links pointing to them
Cross-reference with pages that get organic traffic

These deserve more internal link equity
```

**Link Building Quick Wins:**
```
For each target page:
1. Find 3-5 relevant existing pages to add links from
2. Add contextual links with descriptive anchor text
3. Prioritize links from high-authority pages

No new content needed - just internal linking
```

## Quick Win Type 7: Competitor Keyword Gaps

**Find keywords competitors rank for easily:**

```
[SEO_TOOL] > Content Gap
Your domain vs competitors

Filter:
- You: Not in top 100
- Competitors: Position 1-10
- KD < 30
- Volume > 100

These are proven keywords you're missing
```

## Quick Wins Summary Dashboard

**Compile all opportunities:**

| Opportunity | Type | Keyword/Page | Volume | Effort | Timeline | Priority |
|-------------|------|--------------|--------|--------|----------|----------|
| | Striking Distance | | | Low | 7 days | |
| | Low Competition | | | Medium | 14 days | |
| | Snippet Capture | | | Low | 7 days | |
| | CTR Optimization | | | Low | 3 days | |
| | Content Refresh | | | Medium | 14 days | |
| | Internal Links | | | Low | 3 days | |
| | Keyword Gap | | | Medium | 30 days | |

**30-Day Quick Win Sprint:**

Week 1:
- [ ] Fix top 5 CTR issues (title/meta rewrites)
- [ ] Add internal links to top 5 orphan pages
- [ ] Capture 2 featured snippets

Week 2:
- [ ] Refresh 3 declining content pieces
- [ ] Push 5 striking distance keywords with internal links
- [ ] Optimize 3 pages for low-competition keywords

Week 3-4:
- [ ] Create 2-3 new pages for gap keywords
- [ ] Continue internal linking campaign
- [ ] Monitor and iterate

</process>

<output_template>
Save to: `quick-wins-[DATE].md`

Include:
- Top 10 striking distance opportunities
- Top 5 snippet capture opportunities
- Top 5 CTR optimization needs
- 30-day sprint checklist
- Expected impact projections
</output_template>

<success_criteria>
- At least 20 quick win opportunities identified
- Each opportunity has effort/impact assessment
- 30-day action plan created
- Opportunities prioritized
- Export saved to Downloads folder
</success_criteria>
