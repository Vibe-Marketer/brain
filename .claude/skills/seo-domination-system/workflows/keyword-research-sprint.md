# Keyword Research Sprint Workflow

<objective>
Complete keyword research for a topic/category in under 20 minutes. Output: Prioritized keyword matrix with volume, difficulty, intent, and opportunity scores.
</objective>

<inputs_required>
- Seed keyword or topic
- Your domain (optional, for gap analysis)
- Target audience/buyer persona
- SEO tool access (Ahrefs, SEMrush)
</inputs_required>

<process>

## Phase 1: Seed Expansion (5 min)

**Generate keyword ideas from seed:**

```
Go to [SEO_TOOL]/keywords-explorer
Enter "[SEED_KEYWORD]"
Click "All keyword ideas" or "Matching terms"

Filter: Volume > 50
Sort by: Volume descending

Extract first 100 keywords with:
- Keyword
- Volume
- KD (Keyword Difficulty)
- CPC (indicates commercial value)
- Parent topic
```

**Also explore:**
- Related keywords/terms
- Questions (separate list)
- Newly discovered keywords (if available)

## Phase 2: Intent Classification (3 min)

**Categorize all keywords by intent:**

| Intent | Indicators | Funnel Stage |
|--------|------------|--------------|
| Informational | what, how, why, guide, tutorial | Top |
| Commercial | best, vs, compare, review, alternative | Middle |
| Transactional | buy, pricing, free trial, discount | Bottom |
| Navigational | [brand name], login, support | Variable |

**Flag high-value keywords:**
- Bottom-funnel (transactional) = Highest priority
- Commercial investigation = High priority
- Informational with volume = Content opportunities

## Phase 3: Competition Assessment (5 min)

**Quick competition check for top 30 keywords:**

```
For each promising keyword, note:
- KD score (from tool)
- Lowest DR in top 10 (can you compete?)
- SERP features (snippets, PAA, ads)
- Who ranks #1? (direct competitor or informational site?)
```

**Competition Scoring:**
- KD < 20 + DR < 30 in top 5 = Easy (Score: 3)
- KD 20-40 + some low DR sites = Medium (Score: 2)
- KD > 40 + all high DR sites = Hard (Score: 1)

## Phase 4: Opportunity Scoring (3 min)

**Calculate opportunity score for each keyword:**

```
Opportunity Score = (Volume × CPC × Competition Score) / KD

Where:
- Volume = monthly searches
- CPC = $ value (higher = more commercial intent)
- Competition Score = 1 (hard), 2 (medium), 3 (easy)
- KD = keyword difficulty (lower = easier)
```

**Alternative simple formula:**
```
Priority Score = Volume / KD

Higher score = better opportunity
```

## Phase 5: Gap Analysis (if you have a domain)

**Find keywords you should target:**

```
[SEO_TOOL] > Content Gap
Your domain vs competitors

Find keywords where:
- Competitors rank (position 1-20)
- You don't rank (or rank poorly)
- Volume > 100
- KD < your domain's DR

These are proven opportunities you're missing
```

## Phase 6: Final Matrix Assembly (4 min)

**Create keyword matrix spreadsheet:**

| Keyword | Volume | KD | CPC | Intent | Competition | Priority | Status |
|---------|--------|----|----|--------|-------------|----------|--------|
| [keyword] | [vol] | [kd] | [$] | [I/C/T/N] | [E/M/H] | [score] | [new/existing] |

**Group by topic clusters:**

Cluster 1: [Topic]
- Primary: [main keyword]
- Supporting: [list related keywords]
- Questions: [list questions]

Cluster 2: [Topic]
- Primary: [main keyword]
- Supporting: [list related keywords]
- Questions: [list questions]

**Priority tiers:**

**Tier 1 (Create First):**
- Bottom-funnel, low competition
- High volume commercial keywords
- Gap keywords (competitors rank, you don't)

**Tier 2 (Create Next):**
- Medium competition commercial
- High volume informational

**Tier 3 (Create Later):**
- Higher competition
- Lower volume informational

## Output Deliverable

**Keyword Research Summary:**

Total keywords analyzed: [X]
Total search volume potential: [X/month]

**Priority Keywords:**

| Priority | Keyword | Volume | KD | Intent | Action |
|----------|---------|--------|----|----|--------|
| 1 | | | | | Create [page type] |
| 2 | | | | | Create [page type] |
| 3 | | | | | Create [page type] |
| 4 | | | | | Optimize [existing URL] |
| 5 | | | | | Optimize [existing URL] |

**Topic Clusters Identified:** [X]

**Content Recommendations:**
1. [Content piece 1] targeting [keyword cluster]
2. [Content piece 2] targeting [keyword cluster]
3. [Content piece 3] targeting [keyword cluster]

**Quick Wins (existing pages to optimize):**
1. [URL] - add [keyword], currently ranking [position]
2. [URL] - add [keyword], currently ranking [position]

</process>

<output_template>
Save to: `keyword-research-[TOPIC]-[DATE].md`

Or export as CSV/spreadsheet for ongoing tracking.
</output_template>

<success_criteria>
- 50+ keywords analyzed
- All keywords categorized by intent
- Opportunity scores calculated
- Topic clusters identified
- Top 10-15 priority keywords identified
- Content recommendations provided
- Export saved to Downloads folder
</success_criteria>
