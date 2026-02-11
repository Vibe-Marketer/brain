# Featured Snippet Capture Workflow

<objective>
Identify and capture featured snippet opportunities for your target keywords. Output: Optimized content sections formatted to win position zero.
</objective>

<inputs_required>
- Target keywords (preferably ones you already rank page 1 for)
- Current content URLs
- Competitor snippet examples
</inputs_required>

<process>

## Phase 1: Snippet Opportunity Research

**Find keywords with snippets you can target:**

```
For each target keyword:
1. Google the keyword
2. Note if there's a featured snippet
3. Identify snippet type (paragraph, list, table, video)
4. Check if you rank on page 1 (required for snippet capture)
5. Analyze current snippet holder's content
```

**Snippet-Triggering Query Types:**
- "What is [topic]" → Definition paragraph
- "How to [action]" → Step list or paragraph
- "Best [category]" → List
- "[X] vs [Y]" → Table or paragraph
- "Why does [thing]" → Explanation paragraph

## Phase 2: Snippet Type Analysis

| Snippet Type | Trigger Patterns | Optimal Format |
|--------------|------------------|----------------|
| **Paragraph** | What is, why, define | 40-60 word direct answer |
| **Numbered List** | How to, steps, process | 5-8 numbered steps |
| **Bulleted List** | Best, top, types, ways | 5-10 bullet points |
| **Table** | Comparison, vs, pricing | 3+ columns, 4+ rows |
| **Video** | Tutorial, demo, how to | YouTube with timestamps |

## Phase 3: Current Snippet Audit

For each target keyword, document:

| Keyword | Snippet Type | Current Holder | Your Rank | Your Content URL | Gap Analysis |
|---------|--------------|----------------|-----------|------------------|--------------|
| [kw] | List | competitor.com | #4 | /your-page | Missing H2 with exact query |
| [kw] | Paragraph | competitor.com | #7 | /your-page | Answer buried in paragraph 3 |

## Phase 4: Content Optimization for Snippets

### Paragraph Snippet Optimization

**Formula:**
```html
<h2>What is [Exact Query]?</h2>
<p>[Direct 40-60 word answer that completely answers the question.
Start with "[Query term] is..." Include the key definition or answer
in the first sentence. Add one supporting detail. End with relevance
or importance.]</p>
```

**Example:**
```html
<h2>What is a featured snippet?</h2>
<p>A featured snippet is a highlighted search result that appears at
the top of Google's organic results, often called "position zero."
It directly answers the searcher's question by extracting content
from a webpage. Featured snippets significantly increase click-through
rates and establish authority in your niche.</p>
```

### List Snippet Optimization

**Formula:**
```html
<h2>How to [Exact Query]</h2>
<p>[Brief intro sentence]</p>
<ol>
  <li><strong>Step 1:</strong> [Action + brief detail]</li>
  <li><strong>Step 2:</strong> [Action + brief detail]</li>
  <li><strong>Step 3:</strong> [Action + brief detail]</li>
  <!-- 5-8 steps total -->
</ol>
```

**Example:**
```html
<h2>How to Capture Featured Snippets</h2>
<p>Follow these steps to win position zero:</p>
<ol>
  <li><strong>Find snippet opportunities:</strong> Target queries where you rank page 1</li>
  <li><strong>Analyze current snippets:</strong> Study format and length of winning content</li>
  <li><strong>Format your answer:</strong> Match the snippet type with proper HTML structure</li>
  <li><strong>Place prominently:</strong> Put snippet-optimized content near the top of page</li>
  <li><strong>Use exact query in H2:</strong> Include the search phrase in your heading</li>
</ol>
```

### Table Snippet Optimization

**Formula:**
```html
<h2>[Query] Comparison</h2>
<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>[Option A]</th>
      <th>[Option B]</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[Feature 1]</td>
      <td>[Value]</td>
      <td>[Value]</td>
    </tr>
    <!-- 4+ rows -->
  </tbody>
</table>
```

## Phase 5: Placement Strategy

**Where to place snippet-optimized content:**

1. **Above the fold** - First 300 words of content
2. **Immediately after H2** - Don't bury in long sections
3. **Before detailed explanation** - Answer first, elaborate after
4. **In dedicated FAQ section** - For question-based queries

**The "Inverted Pyramid" for Snippets:**
```
┌─────────────────────────────┐
│ Direct Answer (snippet bait)│  ← Google extracts this
├─────────────────────────────┤
│ Supporting Details          │
├─────────────────────────────┤
│ Deep Dive / Examples        │
├─────────────────────────────┤
│ Related Information         │
└─────────────────────────────┘
```

## Phase 6: Technical Requirements

**HTML best practices for snippets:**

- Use semantic HTML (h2, h3, ol, ul, table)
- Keep lists to 8 items or fewer (Google truncates at ~8)
- Tables should be properly formatted with thead/tbody
- Paragraphs should be 40-60 words for definitions
- Include the exact query in H2 when natural

**Schema markup to support snippets:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "[Exact search query]",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[Your snippet-optimized answer]"
    }
  }]
}
```

## Phase 7: Monitoring & Iteration

**Track snippet performance:**

1. Google Search Console → Search Results
2. Filter by "Search appearance" → "FAQ rich results" or monitor manually
3. Track position changes for target keywords
4. Note when you win/lose snippets

**If you lose a snippet:**
- Compare your content to new winner
- Check if format changed (list → paragraph)
- Update content to match winning format
- Re-submit URL in GSC

</process>

<snippet_templates>

**Definition Template:**
```
## What is [Term]?

[Term] is [category] that [primary function/definition]. It [key characteristic] and [benefit or use case]. [Why it matters in one sentence].
```

**How-To Template:**
```
## How to [Action]

Here's how to [action] in [X] steps:

1. **[First step]:** [Brief explanation]
2. **[Second step]:** [Brief explanation]
3. **[Third step]:** [Brief explanation]
[Continue for 5-8 steps]
```

**Comparison Template:**
```
## [A] vs [B]: Key Differences

| Feature | [A] | [B] |
|---------|-----|-----|
| [Feature 1] | [A's approach] | [B's approach] |
| [Feature 2] | [Value] | [Value] |
| [Feature 3] | [Value] | [Value] |
| Best For | [Use case] | [Use case] |
```

</snippet_templates>

<success_criteria>
- 10+ snippet opportunities identified
- Current snippet holders analyzed
- Content sections optimized with proper formatting
- H2s include exact search queries
- Answers placed prominently in content
- Schema markup recommendations included
- Tracking plan established
</success_criteria>
