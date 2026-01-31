# AI Visibility Audit Workflow

<objective>
Audit brand presence across AI-powered search systems (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews). Identify gaps, track competitor mentions, and create action plan to improve AI visibility.
</objective>

<inputs_required>
- Your company/product name
- Your category/niche
- 3-5 top competitors
- Key features/differentiators
</inputs_required>

<process>

## Phase 1: Direct Brand Queries

Test these exact prompts across multiple AI systems:

**ChatGPT (GPT-4):**
```
Open chat.openai.com with GPT-4 selected

Prompt 1: "What is [Your Company]?"
Prompt 2: "Tell me about [Your Product] and what it does"
Prompt 3: "What are the pros and cons of [Your Product]?"
Prompt 4: "Is [Your Product] good for [your primary use case]?"

Document: Accuracy, completeness, sentiment, any errors
```

**Perplexity:**
```
Open perplexity.ai

Prompt 1: "What is [Your Company]?"
Prompt 2: "[Your Product] features and pricing"
Prompt 3: "[Your Product] reviews"

Document: Answer quality AND which sources are cited
```

**Claude:**
```
Prompt 1: "What can you tell me about [Your Company]?"
Prompt 2: "How does [Your Product] work?"

Document: Accuracy, completeness, any knowledge gaps
```

**Google (AI Overview):**
```
Search on Google: "[Your Company]"
Search: "[Your Product] features"

Note: Does AI Overview appear? What does it say?
```

**Scoring Matrix:**

| Platform | Mentioned? | Accurate? | Positive? | Detailed? | Score (0-5) |
|----------|------------|-----------|-----------|-----------|-------------|
| ChatGPT | | | | | |
| Perplexity | | | | | |
| Claude | | | | | |
| Google AI | | | | | |

Scoring guide:
- 0: Not mentioned at all
- 1: Mentioned but incorrectly
- 2: Brief mention in list
- 3: Basic accurate description
- 4: Detailed accurate description
- 5: Recommended positively

## Phase 2: Category Leadership Queries

**Test category association:**
```
On each AI platform, ask:

"What are the best [your category] tools?"
"What [category] software do you recommend?"
"What are the leading [category] platforms?"
"Who are the main players in [category]?"
```

**Document for each platform:**
- Is your brand mentioned?
- What position (1st, 2nd, 5th, not at all)?
- Which competitors ARE mentioned?
- What reasons are given for recommendations?

**Category Association Score:**

| Platform | Your Brand Position | Top 3 Mentioned | You Included? |
|----------|---------------------|-----------------|---------------|
| ChatGPT | | | |
| Perplexity | | | |
| Claude | | | |
| Google AI | | | |

## Phase 3: Competitive Comparison Queries

**Test head-to-head perception:**
```
"How does [Your Product] compare to [Competitor 1]?"
"[Your Product] vs [Competitor 1]"
"Which is better, [Your Product] or [Competitor 1]?"
"What are alternatives to [Competitor 1]?" (should mention you)
```

Repeat for top 3 competitors.

**Comparison Matrix:**

| vs Competitor | ChatGPT | Perplexity | Claude | Google AI |
|---------------|---------|------------|--------|-----------|
| Comp 1 | | | | |
| Comp 2 | | | | |
| Comp 3 | | | | |

Score as: Win / Tie / Lose / Not compared

## Phase 4: Citation Source Analysis

**Perplexity Citation Tracking:**
```
For each query where your brand or competitors are mentioned:
Click "Sources" to see what websites are cited

Document:
- Your site cited: Yes/No
- Competitor sites cited: Which ones?
- Third-party sites cited: G2, Capterra, review blogs, etc.
- News/PR sources cited: Any publications?
```

**Citation Source Inventory:**

| Source Type | Cites You | Cites Competitors | Action |
|-------------|-----------|-------------------|--------|
| Your own site | | N/A | |
| G2/Capterra | | | |
| Review blogs | | | |
| Industry publications | | | |
| Wikipedia | | | |
| Reddit/forums | | | |

## Phase 5: Entity & Knowledge Gap Analysis

**Test entity recognition:**
```
"Who founded [Your Company]?"
"When was [Your Company] founded?"
"Where is [Your Company] headquartered?"
"How many customers does [Your Company] have?"
"What is [Your Company]'s pricing?"
```

**Entity Completeness Score:**

| Fact | ChatGPT | Perplexity | Claude | Google |
|------|---------|------------|--------|--------|
| Founding year | | | | |
| Founders | | | | |
| Headquarters | | | | |
| Customer count | | | | |
| Pricing | | | | |
| Key features | | | | |

Mark: ✓ Correct / ✗ Wrong / ? Unknown

## Phase 6: Competitor AI Visibility Comparison

Run Phase 1-2 queries for each competitor:
- Do they appear in category recommendations?
- How detailed is their description?
- Are they recommended positively?

**Competitive AI Visibility Matrix:**

| Company | ChatGPT Score | Perplexity Score | Claude Score | Overall |
|---------|---------------|------------------|--------------|---------|
| You | | | | |
| Comp 1 | | | | |
| Comp 2 | | | | |
| Comp 3 | | | | |

## Phase 7: Gap Analysis & Action Plan

**Identified Gaps:**
1. Brand awareness gaps (not mentioned at all)
2. Accuracy gaps (mentioned but wrong info)
3. Category association gaps (not in "best X" lists)
4. Citation gaps (competitors cited, you're not)
5. Entity gaps (missing factual information)

**Priority Actions:**

| Gap | Action | Effort | Impact | Timeline |
|-----|--------|--------|--------|----------|
| Not in category lists | Create comparison/listicle content | Medium | High | 30 days |
| Missing from citations | Get listed on cited sources (G2, etc.) | Low | High | 14 days |
| Inaccurate info | Update Wikipedia, Crunchbase, about page | Low | Medium | 7 days |
| Missing entity data | Add structured data, update PR/news | Medium | Medium | 30 days |
| Poor comparison perception | Create vs pages with fair comparisons | Medium | High | 45 days |

</process>

<output_template>
Save to: `ai-visibility-audit-[DATE].md`

Use template from: templates/ai-visibility-report.md
</output_template>

<success_criteria>
- All 4 AI platforms tested
- Brand queries completed and scored
- Category queries completed with positioning noted
- Citation sources identified
- At least 5 actionable improvements identified
- Competitive comparison completed
- 30/60/90 day action plan created
- Report saved to Downloads folder
</success_criteria>
