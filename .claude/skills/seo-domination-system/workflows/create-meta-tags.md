# Meta Tags & Title Optimization Workflow

<objective>
Create or optimize meta titles and descriptions for a batch of pages. Output: Spreadsheet of optimized meta tags ready for implementation.
</objective>

<inputs_required>
- List of URLs to optimize
- Target keyword for each URL
- Current titles/descriptions (or note if missing)
- Brand name
</inputs_required>

<process>

## Phase 1: Analyze Current State

For each URL, document:
- Current title (length, keyword presence)
- Current description (length, CTA presence)
- Primary target keyword
- Current ranking position (if known)
- CTR (if GSC data available)

## Phase 2: Research SERP

For each target keyword:
- Google the keyword
- Note what titles appear for top 5 results
- Identify patterns that stand out
- Note what makes you want to click

## Phase 3: Write Optimized Titles

**Title Formula Templates:**

**For Blog Posts:**
```
[Number] [Adjective] [Keyword] [Modifier] ([Year])
Example: "7 Proven Email Marketing Strategies That Actually Work (2024)"

[Keyword]: [Promise/Benefit] | [Brand]
Example: "Email Marketing: How to 3X Your Open Rates | HubSpot"
```

**For Product/Service Pages:**
```
[Keyword] - [Benefit] | [Brand]
Example: "Project Management Software - Ship 2x Faster | Asana"

[Primary Keyword] | [Secondary Keyword] | [Brand]
Example: "CRM Software | Sales Automation Tools | Salesforce"
```

**For Comparison Pages:**
```
[Product A] vs [Product B]: [Year] Comparison | [Brand]
Example: "Notion vs Asana: 2024 Comparison Guide | ProjectManager"

[X] Best [Competitor] Alternatives ([Year])
Example: "10 Best Slack Alternatives for Remote Teams (2024)"
```

**For Local Pages:**
```
[Service] in [Location] | [Differentiator] | [Brand]
Example: "Roof Repair in Austin | 24/7 Emergency Service | ABC Roofing"

[Location] [Service]: [Promise] | [Brand]
Example: "Austin Plumbers: Same-Day Service Guaranteed | QuickFix"
```

**Title Rules:**
- Under 60 characters (or natural break point)
- Keyword as close to front as possible
- Include year for time-sensitive content
- Brand at end (after | or -)
- Make it click-worthy, not just keyword-stuffed

## Phase 4: Write Meta Descriptions

**Description Formula Templates:**

**For Informational Content:**
```
[What they'll learn]. [Specific benefit or promise]. [CTA].
Example: "Learn the exact email sequences that generated $100M in sales. Includes templates, examples, and automation tips. Read the guide →"
```

**For Product Pages:**
```
[What it is] that [benefit]. [Social proof or differentiator]. [CTA].
Example: "Project management software that keeps teams on track. Trusted by 100,000+ teams. Start your free trial today."
```

**For Comparison Content:**
```
[Compare X and Y] to find [benefit]. [What's included]. [CTA].
Example: "Comparing Notion vs Asana? See features, pricing, and real user reviews to pick the right tool. Full comparison inside."
```

**For Local Services:**
```
[Service] in [Location] with [differentiator]. [Trust signal]. [CTA].
Example: "Fast, affordable roof repair in Austin. Licensed, insured, 5-star rated. Get your free estimate today."
```

**Description Rules:**
- 150-160 characters (will truncate after)
- Include target keyword naturally
- Include a CTA (Learn more, Get started, Read the guide, etc.)
- Add specifics (numbers, timeframes, prices if relevant)
- Don't start with "This page is about..." or "We offer..."

## Phase 5: Create Deliverable

**Output Format:**

| URL | Current Title | New Title | Title Length | Current Desc | New Desc | Desc Length | Target Keyword |
|-----|---------------|-----------|--------------|--------------|----------|-------------|----------------|
| /page-1 | [old] | [new] | [#] | [old] | [new] | [#] | [keyword] |
| /page-2 | [old] | [new] | [#] | [old] | [new] | [#] | [keyword] |

## Phase 6: Prioritization

**Priority 1 (Fix First):**
- Missing titles or descriptions
- Duplicate titles/descriptions
- Titles > 70 characters (severe truncation)
- High-impression, low-CTR pages

**Priority 2 (Fix Next):**
- Keyword not in title
- No CTA in description
- Generic/boring copy

**Priority 3 (Ongoing):**
- A/B test variations
- Seasonal updates
- Year updates

</process>

<ctr_optimization_tips>

**Words that increase CTR:**
- Numbers (7, 10, 2024)
- "How to"
- "Best"
- "Guide"
- "Free"
- "New"
- Power words: Ultimate, Complete, Proven, Essential, Quick

**Words that may decrease CTR:**
- "Simple" (implies basic)
- "Easy" (can seem low-value)
- Generic superlatives without proof

**Patterns that work:**
- Questions: "Looking for [X]?"
- Direct benefit: "Save [X] hours with..."
- Curiosity gap: "[Number] [Things] You Didn't Know About..."
- Social proof: "Trusted by [X] companies"

</ctr_optimization_tips>

<success_criteria>
- All URLs have optimized title under 60 chars
- All URLs have optimized description under 160 chars
- Keywords included naturally
- CTAs included in descriptions
- Prioritized by impact
- Spreadsheet saved to Downloads folder
</success_criteria>
