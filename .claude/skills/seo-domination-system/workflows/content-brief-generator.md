# Content Brief Generator Workflow

<objective>
Generate comprehensive, AI-optimized content briefs that rank in traditional search AND get cited by AI systems. Briefs include keyword targeting, structure, competitor analysis, and GEO optimization requirements.
</objective>

<inputs_required>
- Target keyword or topic
- Content type (blog, comparison, landing page, etc.)
- Target audience
- Primary CTA/goal
- SEO tool access (optional but helpful)
</inputs_required>

<process>

## Phase 1: Keyword & Intent Analysis

**Primary Keyword Research:**
```
Search "[TARGET KEYWORD]" in SEO tool

Extract:
- Search volume
- Keyword difficulty
- Search intent (informational, commercial, transactional)
- SERP features present (snippets, PAA, videos, etc.)
- CPC (indicates commercial value)
```

**Related Keywords:**
```
[SEO_TOOL] > Related keywords / Keyword ideas
Filter: Volume > 50
Extract 10-15 semantically related keywords to include
```

**Questions to Answer:**
```
[SEO_TOOL] > Questions filter
OR search "[keyword]" and expand all PAA boxes

Extract 8-12 questions people ask about this topic
These become H2s in the content
```

**Intent Classification:**
| Intent | Description | Content Approach |
|--------|-------------|------------------|
| Informational | Learning about topic | Educational, comprehensive |
| Commercial | Comparing options | Comparison, pros/cons |
| Transactional | Ready to buy | CTA-focused, pricing |
| Navigational | Looking for specific site | Targeted landing |

## Phase 2: SERP Analysis

**Top 10 Results Analysis:**
```
Google "[TARGET KEYWORD]"
For positions 1-10, document:

| Pos | URL | Title | Word Count | H2 Count | Content Type |
|-----|-----|-------|------------|----------|--------------|
| 1 | | | | | |
| 2 | | | | | |
...
```

**Content Gap Identification:**
Review top 10 results and identify:
- Topics they all cover (table stakes)
- Topics only 1-2 cover (opportunities)
- Topics none cover (unique angle)
- Outdated information you can update
- Missing depth you can provide

**Featured Snippet Analysis:**
```
If featured snippet exists:
- What type? (paragraph, list, table)
- What exact question does it answer?
- How long is the answer?
- What can you do better?
```

## Phase 3: Competitor Content Audit

**Analyze top 3 ranking pages in depth:**

For each competitor page:
```
Read the full content and document:

Structure:
- Total word count
- Number of H2s
- Number of H3s
- Images/videos included
- Tables/lists used

Content Quality:
- Unique insights provided
- Data/statistics cited
- Expert quotes included
- Examples given
- Originality score (1-10)

Weaknesses:
- Missing information
- Outdated facts
- Poor structure
- No visuals
- Thin sections
```

**Content Comparison Matrix:**

| Element | Comp 1 | Comp 2 | Comp 3 | Your Target |
|---------|--------|--------|--------|-------------|
| Word count | | | | |
| H2 sections | | | | |
| Images | | | | |
| Videos | | | | |
| Data points | | | | |
| Expert quotes | | | | |
| Internal links | | | | |
| External links | | | | |

## Phase 4: Content Structure Design

**Recommended Outline:**

Based on SERP analysis, create H2 structure:

```markdown
# [Title with Primary Keyword]

## [Question/Topic 1 - Most searched]
[Brief intro answering for featured snippet]
[Expanded content]

## [Question/Topic 2]
...

## [Question/Topic 3]
...

## [Comparison section if commercial intent]

## [FAQ Section - for PAA capture]
### [PAA Question 1]
### [PAA Question 2]
...

## [CTA Section]
```

**Content Requirements:**
- Minimum word count: [based on competitor average + 20%]
- H2 sections: [number]
- Images/visuals: [number]
- Tables: [number]
- Lists: [number]
- Internal links: [number]
- External links: [number to authoritative sources]

## Phase 5: AEO Optimization Requirements

**Featured Snippet Optimization:**
```
For the primary snippet opportunity:

Target question: "[exact question from PAA]"
Answer format: [paragraph/list/table]
Answer length: [40-60 words for paragraph, 5-8 items for list]
Placement: Immediately after H2

Template:
## [Question as H2]

[Direct, complete answer in first 40-60 words that could be extracted verbatim]

[Expanded explanation follows...]
```

**Schema Markup Requirements:**
```
Required schema:
- [ ] Article schema with author, datePublished, dateModified
- [ ] FAQPage schema (if FAQ section)
- [ ] HowTo schema (if tutorial)
- [ ] BreadcrumbList
- [ ] Organization (sitewide)

Optional based on content:
- [ ] Product schema
- [ ] Review schema
- [ ] Video schema
```

**Voice Search Optimization:**
```
Include at least 3 answers that:
- Are complete sentences
- Are under 29 words
- Directly answer conversational queries
- Use natural language
```

## Phase 6: GEO Optimization Requirements

**Entity-Rich Writing:**
```
Include these entity types:
- Company names (not "a leading company")
- Specific numbers (not "many users")
- Named examples (not "some businesses")
- Dates and timeframes
- Locations when relevant
- Named products/tools
```

**Fact Density Requirements:**
```
Every 200 words should include at least:
- 1 specific statistic or data point
- 1 named example or case
- 1 comparison or benchmark

Bad: "Many companies see improvement"
Good: "73% of companies report 2x faster workflows within 90 days"
```

**Citation-Worthy Content:**
```
Include content AI systems want to cite:
- [ ] Original definition of key term
- [ ] Unique framework or methodology
- [ ] Original data or research findings
- [ ] Clear comparison statements
- [ ] Historical context with dates
```

**Comparative Positioning:**
```
If mentioning competitors, use this format:
"Unlike [Competitor] which focuses on [X], [Your Product] is designed for [Y], making it ideal for [use case]."

This creates citable comparative content.
```

## Phase 7: Final Brief Assembly

**Content Brief Summary:**

```
CONTENT BRIEF: [Topic]
=====================================

TARGET KEYWORD: [primary keyword]
SECONDARY KEYWORDS: [list 5-10]
SEARCH VOLUME: [number]
DIFFICULTY: [KD score]
INTENT: [informational/commercial/transactional]

CONTENT SPECS:
- Word count: [minimum]
- Format: [blog/guide/comparison/etc]
- Tone: [professional/conversational/technical]
- Audience: [target reader]

STRUCTURE:
[Full H2/H3 outline]

MUST INCLUDE:
- [ ] [specific topic 1]
- [ ] [specific topic 2]
- [ ] [comparison to X]
- [ ] [data point about Y]
- [ ] [example of Z]

FEATURED SNIPPET TARGET:
- Question: [exact question]
- Format: [paragraph/list/table]
- Answer placement: [after which H2]

SCHEMA REQUIRED:
- [ ] [schema type 1]
- [ ] [schema type 2]

GEO REQUIREMENTS:
- Minimum [X] named entities
- Minimum [X] statistics
- Include [comparison format]
- Original [definition/framework]

COMPETITOR REFERENCE:
- Beat [URL 1] on: [specific weakness]
- Beat [URL 2] on: [specific weakness]
- Beat [URL 3] on: [specific weakness]

INTERNAL LINKS:
- Link to: [page 1], [page 2], [page 3]

CTA:
- Primary: [action]
- Placement: [where]
```

</process>

<output_template>
Save to: `content-brief-[KEYWORD]-[DATE].md`

Use template from: templates/content-brief.md
</output_template>

<success_criteria>
- Keyword research completed
- SERP analysis with top 10 documented
- Competitor content audited
- Full H2/H3 outline created
- AEO requirements specified
- GEO requirements specified
- Schema requirements listed
- Specific weaknesses to exploit identified
- Brief saved to Downloads folder
</success_criteria>
