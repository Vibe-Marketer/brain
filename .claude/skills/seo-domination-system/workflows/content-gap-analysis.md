# Content Gap Analysis Workflow

<objective>
Identify content opportunities your competitors rank for that you don't. Output: Prioritized list of content gaps with traffic potential and difficulty scores.
</objective>

<inputs_required>
- Your domain
- 3-5 competitor domains
- Your current keyword list (optional)
- Target audience/niche
</inputs_required>

<process>

## Phase 1: Competitor Keyword Harvesting

**Using Ubersuggest (Free - 3/day):**
```
Go to neilpatel.com/ubersuggest
Enter competitor domain #1
Navigate to "Keywords" → "By Traffic"
Export top 100 keywords they rank for
Note: Volume, Position, Traffic, SD (SEO Difficulty)
```

**Using Google Search Console (Your Site):**
```
Go to search.google.com/search-console
Select your property
Go to Performance → Search Results
Export all queries (last 3 months)
This is your current keyword footprint
```

## Phase 2: Gap Identification

Create a comparison matrix:

| Keyword | Your Rank | Comp 1 | Comp 2 | Comp 3 | Volume | Difficulty | Gap Type |
|---------|-----------|--------|--------|--------|--------|------------|----------|
| [keyword] | - | #3 | #7 | - | 2,400 | 35 | Missing |
| [keyword] | #45 | #5 | #3 | #8 | 1,800 | 42 | Underperforming |

**Gap Types:**
- **Missing**: You have no content, competitors rank
- **Underperforming**: You rank 20+, competitors rank top 10
- **Opportunity**: Low competition, no one ranks well

## Phase 3: Gap Categorization

Sort gaps into buckets:

### Quick Wins (Priority 1)
- You rank 11-20, competitors rank 1-10
- Low difficulty (SD < 40)
- Decent volume (500+ monthly)
- **Action**: Optimize existing content

### New Content Opportunities (Priority 2)
- You have no content
- Multiple competitors rank
- High volume (1,000+ monthly)
- **Action**: Create new content

### Strategic Gaps (Priority 3)
- High difficulty but high value
- Competitors dominate
- Core to your business
- **Action**: Plan long-term content campaign

### Ignore (Low Priority)
- Very low volume (< 100)
- Not relevant to your business
- Extremely high difficulty with low ROI

## Phase 4: Traffic Potential Scoring

For each gap, calculate potential:

```
Traffic Potential = Monthly Volume × Expected CTR × 12

Expected CTR by position:
- Position 1: 28%
- Position 2: 15%
- Position 3: 11%
- Position 4-10: 2-8%
```

**Example:**
- Keyword: "coaching software for consultants"
- Volume: 1,200/month
- Realistic target: Position 3
- Potential: 1,200 × 0.11 × 12 = 1,584 visits/year

## Phase 5: Competitor Content Analysis

For top 20 gaps, analyze what competitors created:

| Keyword | Competitor URL | Content Type | Word Count | Key Sections | Backlinks |
|---------|---------------|--------------|------------|--------------|-----------|
| [kw] | [url] | Guide | 2,500 | 8 sections | 23 |

**What to note:**
- Content format (guide, list, comparison, tool)
- Depth and comprehensiveness
- Unique angles or data
- What's missing you could add

## Phase 6: Prioritization Matrix

Score each gap (1-10 scale):

| Factor | Weight | Score |
|--------|--------|-------|
| Traffic Potential | 30% | ? |
| Business Relevance | 25% | ? |
| Difficulty (inverse) | 20% | ? |
| Competitor Weakness | 15% | ? |
| Quick Win Potential | 10% | ? |

**Final Score** = Weighted average

## Phase 7: Action Plan Output

Create prioritized content gap report:

```
## Content Gap Report: [Your Domain]
Generated: [Date]
Competitors Analyzed: [List]

### Executive Summary
- Total gaps identified: [X]
- Quick wins: [X] keywords
- New content needed: [X] pieces
- Estimated traffic opportunity: [X] visits/year

### Priority 1: Quick Wins (Optimize Existing)
| Keyword | Current Rank | Target | Volume | Action |
|---------|--------------|--------|--------|--------|
| [kw] | #15 | #5 | 2,400 | Add section on [topic], improve title |

### Priority 2: New Content (Create)
| Keyword | Volume | Difficulty | Recommended Format | Competitor Benchmark |
|---------|--------|------------|-------------------|---------------------|
| [kw] | 3,200 | 38 | Comprehensive guide | [competitor] ranks #2 with 2,800 words |

### Priority 3: Strategic (Long-term)
| Keyword | Volume | Difficulty | Notes |
|---------|--------|------------|-------|
| [kw] | 8,500 | 72 | Build authority first, target in Q3 |

### Content Calendar Recommendation
| Week | Keyword | Action | Content Type |
|------|---------|--------|--------------|
| 1 | [kw1] | Optimize | Update existing |
| 2 | [kw2] | Create | New guide |
| 3 | [kw3] | Create | Comparison post |
```

</process>

<tools_prioritization>
1. Google Search Console (free, unlimited) - Your current rankings
2. Ubersuggest (free, 3/day) - Competitor keywords
3. Manual SERP analysis - Validate opportunities
4. Google Keyword Planner (free) - Volume verification
</tools_prioritization>

<success_criteria>
- 50+ content gaps identified
- Gaps categorized by priority
- Traffic potential calculated for top 20
- Competitor content analyzed for top gaps
- Actionable content calendar created
- Report saved to Downloads folder
</success_criteria>
