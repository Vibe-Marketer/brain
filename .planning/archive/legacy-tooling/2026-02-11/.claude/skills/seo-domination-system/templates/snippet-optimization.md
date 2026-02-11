# Featured Snippet & AEO Optimization Guide Template

## Overview
- **Domain:** [your-domain.com]
- **Analysis Date:** [YYYY-MM-DD]
- **Keywords Analyzed:** [X]
- **Snippet Opportunities Found:** [X]

---

## Current Snippet Status

### Snippets You Own

| Keyword | Snippet Type | Monthly Volume | Page URL |
|---------|--------------|----------------|----------|
| [keyword] | Paragraph | [X] | [url] |
| [keyword] | List | [X] | [url] |
| [keyword] | Table | [X] | [url] |

**Total Snippets Owned:** [X]
**Estimated Additional Traffic:** [X] clicks/month

### Snippet Opportunities (You Rank Page 1)

| Keyword | Your Position | Current Holder | Snippet Type | Volume | Priority |
|---------|---------------|----------------|--------------|--------|----------|
| [keyword] | #3 | competitor.com | Paragraph | [X] | High |
| [keyword] | #5 | competitor.com | List | [X] | High |
| [keyword] | #2 | wikipedia.org | Table | [X] | Medium |

---

## Optimization Recommendations

### Priority 1: Paragraph Snippets

**Target Keywords:**
1. [keyword] - Volume: [X]
2. [keyword] - Volume: [X]
3. [keyword] - Volume: [X]

**Optimization Template:**
```html
<h2>[Exact Search Query as Question]?</h2>
<p>[40-60 word direct answer. Start with the key term/definition.
Include the core answer in the first sentence. Add one supporting
detail. End with context or importance.]</p>
```

**Page-Specific Recommendations:**

| Page | Current Content Issue | Recommended Fix |
|------|----------------------|-----------------|
| [url] | Answer buried in paragraph 3 | Move answer to directly after H2 |
| [url] | No H2 matching query | Add H2 with exact search phrase |
| [url] | Answer too long (120 words) | Condense to 50-60 words |

---

### Priority 2: List Snippets

**Target Keywords:**
1. [keyword] - Volume: [X]
2. [keyword] - Volume: [X]
3. [keyword] - Volume: [X]

**Optimization Template:**
```html
<h2>How to [Exact Search Query]</h2>
<p>[Brief 1-sentence intro]</p>
<ol>
  <li><strong>Step 1:</strong> [Action + brief detail]</li>
  <li><strong>Step 2:</strong> [Action + brief detail]</li>
  <li><strong>Step 3:</strong> [Action + brief detail]</li>
  <li><strong>Step 4:</strong> [Action + brief detail]</li>
  <li><strong>Step 5:</strong> [Action + brief detail]</li>
</ol>
```

**Page-Specific Recommendations:**

| Page | Current Content Issue | Recommended Fix |
|------|----------------------|-----------------|
| [url] | Steps in paragraphs, not list | Convert to numbered list |
| [url] | 15 steps (too many) | Consolidate to 6-8 steps |
| [url] | No H2 with how-to phrase | Add H2: "How to [query]" |

---

### Priority 3: Table Snippets

**Target Keywords:**
1. [keyword] vs [keyword] - Volume: [X]
2. [keyword] comparison - Volume: [X]
3. [category] pricing - Volume: [X]

**Optimization Template:**
```html
<h2>[X] vs [Y]: Quick Comparison</h2>
<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>[Option X]</th>
      <th>[Option Y]</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>[Feature 1]</td>
      <td>[X value]</td>
      <td>[Y value]</td>
    </tr>
    <tr>
      <td>[Feature 2]</td>
      <td>[X value]</td>
      <td>[Y value]</td>
    </tr>
    <tr>
      <td>[Feature 3]</td>
      <td>[X value]</td>
      <td>[Y value]</td>
    </tr>
    <tr>
      <td>Best For</td>
      <td>[Use case]</td>
      <td>[Use case]</td>
    </tr>
  </tbody>
</table>
```

**Page-Specific Recommendations:**

| Page | Current Content Issue | Recommended Fix |
|------|----------------------|-----------------|
| [url] | No comparison table | Add table with 4+ rows |
| [url] | Table missing header row | Add proper thead/tbody |
| [url] | Comparison in prose | Convert to table format |

---

## PAA (People Also Ask) Optimization

### Current PAA Presence

| Question | You Appear? | Current Answer From | Your Page |
|----------|-------------|---------------------|-----------|
| [question] | ❌ | competitor.com | [url] |
| [question] | ❌ | wikihow.com | [url] |
| [question] | ✅ | your-domain.com | [url] |

### PAA Targeting Strategy

**Questions to Target:**

| Question | Recommended Answer (50-75 words) |
|----------|----------------------------------|
| [Question 1]? | [Write the ideal answer here] |
| [Question 2]? | [Write the ideal answer here] |
| [Question 3]? | [Write the ideal answer here] |

**FAQ Schema Implementation:**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Question 1]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Your optimized answer]"
      }
    }
  ]
}
```

---

## Voice Search Optimization

### Voice Query Targets

| Voice Query | Current Coverage | Optimization Needed |
|-------------|------------------|---------------------|
| "What is [term]?" | Partial | Add direct definition |
| "How do I [action]?" | None | Create how-to section |
| "Best [category] for [use case]?" | Good | Add speakable schema |

### Speakable Schema Implementation

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".snippet-answer", ".key-definition"]
  }
}
```

### Content Adjustments for Voice

| Current | Voice-Optimized |
|---------|-----------------|
| "Users can leverage..." | "You can use..." |
| "It is recommended that one should..." | "You should..." |
| "The aforementioned solution..." | "This solution..." |

**Voice Readability Targets:**
- Flesch Reading Ease: 60+ (currently: [X])
- Average sentence length: <20 words
- Use contractions (it's, you'll, don't)

---

## Implementation Checklist

### Immediate Actions (This Week)

- [ ] Add/update H2s with exact search queries
- [ ] Restructure [X] paragraphs to answer-first format
- [ ] Convert [X] prose sections to lists
- [ ] Create comparison tables for [X] pages
- [ ] Implement FAQ schema on [X] pages

### Short-Term (This Month)

- [ ] Optimize all pages ranking #2-5 for snippet capture
- [ ] Add FAQ sections to top 10 traffic pages
- [ ] Implement speakable schema
- [ ] Create voice-optimized intro paragraphs

### Ongoing Monitoring

- [ ] Weekly: Check snippet ownership for target keywords
- [ ] Monthly: Analyze new PAA questions
- [ ] Quarterly: Full snippet opportunity audit

---

## Content Templates

### Definition Snippet Template
```
## What is [Term]?

[Term] is [category] that [primary function]. It [key characteristic]
for [target user] to [benefit]. Most commonly, [term] is used
to [primary use case] and [secondary use case].
```

### Process Snippet Template
```
## How to [Action] in [X] Steps

[Brief intro sentence explaining what they'll accomplish.]

1. **[First Step]:** [What to do + why]
2. **[Second Step]:** [What to do + why]
3. **[Third Step]:** [What to do + why]
4. **[Fourth Step]:** [What to do + why]
5. **[Fifth Step]:** [What to do + why]

[Optional: Brief conclusion or next step]
```

### Comparison Snippet Template
```
## [A] vs [B]: Which is Better?

The main difference between [A] and [B] is [key differentiator].

| Feature | [A] | [B] |
|---------|-----|-----|
| [Feature 1] | [Value] | [Value] |
| [Feature 2] | [Value] | [Value] |
| [Feature 3] | [Value] | [Value] |
| Best For | [Use case] | [Use case] |

**Bottom line:** Choose [A] if [criteria]. Choose [B] if [other criteria].
```

---

## Expected Results

| Metric | Current | 30-Day Target | 90-Day Target |
|--------|---------|---------------|---------------|
| Featured Snippets Owned | [X] | [X] | [X] |
| PAA Appearances | [X] | [X] | [X] |
| Snippet Click-Through Rate | [X]% | [X]% | [X]% |
| Voice Search Visibility | Low/Med/High | Medium | High |

---

*Generated by SEO Domination System*
