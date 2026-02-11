# On-Page SEO Audit Workflow

<objective>
Complete technical and content audit of a page or site with prioritized fixes. Covers traditional SEO, AEO structure, and GEO optimization gaps.
</objective>

<inputs_required>
- Target URL (single page) or domain (site-wide)
- Primary target keyword for the page
- Audit scope: Quick (5 min) / Standard (15 min) / Deep (30 min)
</inputs_required>

<process>

## Phase 1: Technical SEO Audit

**Page Speed & Core Web Vitals:**
```
Go to pagespeed.insights.web.dev
Enter [TARGET_URL]

Extract:
- Mobile score: [0-100]
- Desktop score: [0-100]
- LCP (Largest Contentful Paint): Target < 2.5s
- FID/INP (Interaction): Target < 100ms
- CLS (Cumulative Layout Shift): Target < 0.1

Document top 3 speed issues
```

**Mobile Friendliness:**
```
View page on mobile viewport (or Chrome DevTools mobile)
Check:
- [ ] Text readable without zooming
- [ ] Tap targets adequately sized (48px minimum)
- [ ] No horizontal scrolling
- [ ] Content fits viewport
```

**Indexability:**
```
Check these in browser DevTools or by viewing page source:

Robots meta:
- [ ] No "noindex" tag (unless intentional)
- [ ] No "nofollow" on important links

Canonical:
- [ ] Canonical tag present
- [ ] Canonical points to correct URL
- [ ] No canonical conflicts

Check robots.txt:
- [ ] Page not blocked
- [ ] Important resources not blocked
```

**URL Structure:**
```
Evaluate the URL:
- [ ] Contains target keyword
- [ ] Is descriptive and readable
- [ ] No excessive parameters
- [ ] Uses hyphens (not underscores)
- [ ] Reasonable length (< 75 chars)
- [ ] No duplicate content issues (www vs non-www, http vs https)
```

## Phase 2: Title & Meta Audit

**Title Tag:**
```
Current title: "[extract title]"
Length: [XX characters]

Checklist:
- [ ] Contains primary keyword
- [ ] Keyword near beginning (first 60 chars)
- [ ] Under 60 characters (or at natural break point)
- [ ] Compelling/clickable
- [ ] Unique (not duplicated on site)
- [ ] Includes brand (at end)
```

**Meta Description:**
```
Current description: "[extract meta description]"
Length: [XX characters]

Checklist:
- [ ] Contains primary keyword
- [ ] Under 160 characters
- [ ] Includes call-to-action
- [ ] Unique and compelling
- [ ] Matches search intent
- [ ] Not auto-generated
```

**Improvement Recommendations:**
```
Suggested title: "[optimized title]"
Suggested description: "[optimized description]"
```

## Phase 3: Heading Structure Audit

**H1 Analysis:**
```
Current H1: "[extract H1]"
Number of H1s: [count]

Checklist:
- [ ] Exactly one H1 per page
- [ ] Contains primary keyword
- [ ] Matches page topic
- [ ] Different from title tag (but related)
```

**Heading Hierarchy:**
```
Extract all headings:
H1: [text]
  H2: [text]
    H3: [text]
  H2: [text]
...

Checklist:
- [ ] Logical hierarchy (no H3 before H2)
- [ ] H2s cover main topics
- [ ] Keywords naturally included
- [ ] Headings are descriptive (not "Introduction", "Conclusion")
- [ ] Questions used where appropriate (for PAA)
```

**Heading Optimization for AEO:**
```
For featured snippet capture:
- [ ] At least one H2 is a question format
- [ ] Answer follows immediately after H2
- [ ] Answer is 40-60 words (paragraph) or 5-8 items (list)
```

## Phase 4: Content Quality Audit

**Content Depth:**
```
Word count: [number]
Competitor average: [number]

Analysis:
- [ ] Meets or exceeds competitor word count
- [ ] All major subtopics covered
- [ ] No thin sections (< 100 words under an H2)
- [ ] Content matches search intent
```

**Keyword Optimization:**
```
Primary keyword density: [X%]
Target: 1-2% for primary keyword

Keyword placement:
- [ ] In title
- [ ] In H1
- [ ] In first 100 words
- [ ] In at least one H2
- [ ] In conclusion/summary
- [ ] In image alt text
- [ ] In URL
```

**Content Freshness:**
```
Last updated: [date]
Age: [X months/years]

Checklist:
- [ ] Published/updated date visible
- [ ] No outdated information
- [ ] Statistics are current (< 2 years)
- [ ] Links still work
- [ ] Screenshots/examples current
```

**E-E-A-T Signals:**
```
Experience, Expertise, Authoritativeness, Trustworthiness

Checklist:
- [ ] Author byline present
- [ ] Author bio with credentials
- [ ] Author page exists on site
- [ ] Sources cited for claims
- [ ] External links to authoritative sources
- [ ] Contact information accessible
- [ ] About page exists
- [ ] Privacy policy present
```

## Phase 5: GEO Optimization Audit

**Entity Richness:**
```
Scan content for:
- Named companies: [count]
- Specific numbers/stats: [count]
- Named products: [count]
- Dates/timeframes: [count]
- Named people: [count]

Checklist:
- [ ] Uses specific names, not vague references
- [ ] Includes citable statistics
- [ ] Named examples throughout
- [ ] Comparative statements present
```

**Fact Density:**
```
Total content: ~[X] words
Statistics/data points: [count]
Ratio: [X per 200 words]

Target: At least 1 stat per 200 words
```

**Citation-Worthy Elements:**
```
Checklist:
- [ ] Contains original definition of key term
- [ ] Includes unique framework/methodology
- [ ] Has original data or findings
- [ ] Clear comparison statements
- [ ] Historical context provided
```

## Phase 6: Technical Elements Audit

**Image Optimization:**
```
Total images: [count]
Images with alt text: [count]
Images with descriptive alt text: [count]

Checklist:
- [ ] All images have alt text
- [ ] Alt text is descriptive (not "image1.jpg")
- [ ] Primary keyword in at least one alt
- [ ] Images compressed for web
- [ ] Next-gen formats used (WebP, AVIF)
- [ ] Lazy loading enabled
```

**Internal Linking:**
```
Internal links from page: [count]
Internal links to page: [count]

Checklist:
- [ ] Links to related content on site
- [ ] Anchor text is descriptive
- [ ] No broken internal links
- [ ] Important pages linked
- [ ] Links open in same tab (not new window for internal)
```

**External Linking:**
```
External links: [count]

Checklist:
- [ ] Links to authoritative sources
- [ ] Supports claims with citations
- [ ] Links work (not broken)
- [ ] Nofollow on sponsored/user-generated links
```

**Schema Markup:**
```
Current schema: [list types found]

Required for this page type:
- [ ] Article schema (if blog post)
- [ ] FAQPage schema (if has Q&A)
- [ ] HowTo schema (if tutorial)
- [ ] Product schema (if product page)
- [ ] LocalBusiness schema (if local)
- [ ] BreadcrumbList schema

Validate at: schema.org/validators
```

## Phase 7: Priority Actions

**Critical Issues (Fix Immediately):**
- [ ] [Issue]: [Specific fix]
- [ ] [Issue]: [Specific fix]

**High Priority (Fix This Week):**
- [ ] [Issue]: [Specific fix]
- [ ] [Issue]: [Specific fix]

**Medium Priority (Fix This Month):**
- [ ] [Issue]: [Specific fix]
- [ ] [Issue]: [Specific fix]

**Low Priority (Ongoing Improvement):**
- [ ] [Issue]: [Specific fix]
- [ ] [Issue]: [Specific fix]

**Effort/Impact Matrix:**

| Fix | Effort | Impact | Priority |
|-----|--------|--------|----------|
| | Low/Med/High | Low/Med/High | 1-10 |

</process>

<output_template>
Save to: `on-page-audit-[PAGE]-[DATE].md`

Use template from: templates/audit-report.md
</output_template>

<success_criteria>
- All 6 phases completed
- Page speed scores documented
- Title/meta analyzed with recommendations
- Heading structure mapped
- Content quality scored
- GEO elements audited
- Schema requirements identified
- Prioritized action list with effort/impact scores
- Report saved to Downloads folder
</success_criteria>
