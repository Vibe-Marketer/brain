# SEO + AEO + GEO Prompt Library

**Copy-paste ready prompts for browser automation. Replace [BRACKETS] with your specifics.**

---

## Quick Reference

| Task | Jump to Section |
|------|-----------------|
| Keyword Research | [Keyword Research Prompts](#keyword-research-prompts) |
| Competitor Analysis | [Competitor Analysis Prompts](#competitor-analysis-prompts) |
| On-Page Audit | [On-Page Audit Prompts](#on-page-audit-prompts) |
| Content Gap | [Content Gap Prompts](#content-gap-prompts) |
| Featured Snippets | [AEO Prompts](#aeo-prompts) |
| AI Visibility | [GEO Prompts](#geo-prompts) |
| GBP/Local | [Local SEO Prompts](#local-seo-prompts) |
| Link Building | [Link Building Prompts](#link-building-prompts) |

---

## Keyword Research Prompts

### Find Questions People Ask

```
Go to ahrefs.com/keywords-explorer
Enter "[YOUR_SEED_KEYWORD]" in the search box
Click search
Click "Questions" in the left sidebar under "Keyword ideas"
Set filters:
- KD (Keyword Difficulty) less than 30
- Volume greater than 100
Extract the top 20 questions showing: Question, Volume, KD, Parent Topic
Present in a table sorted by volume (highest first)
Identify which questions have commercial intent (contain words like: best, review, cost, pricing, vs, compare, alternative)
```

### Find Low-Competition Keywords

```
Go to ahrefs.com/keywords-explorer
Enter "[YOUR_SEED_KEYWORD]"
Click "All keyword ideas" in left sidebar
Set filters:
- KD less than 20
- Volume greater than 50
- Include results where lowest DR in top 10 is under 30
Extract top 30 keywords with: Keyword, Volume, KD, Lowest DR ranking
These are realistic keywords to rank for
Flag any that match bottom-funnel intent (pricing, buy, best, alternative, vs, review)
```

### SaaS Bottom-Funnel Keywords

```
Go to ahrefs.com/keywords-explorer
Enter "[YOUR_PRODUCT_NAME]"
Review keyword ideas for:
- "[product] pricing"
- "[product] alternatives"
- "[product] vs"
- "[product] review"
- "[product] free trial"

Then enter "[MAIN_COMPETITOR]" and check:
- "[competitor] alternative"
- "[competitor] vs [your product]"
- "best [category] software"

Extract all with volume > 50
Create prioritized list: keyword, volume, KD, current ranking (if any)
```

### PAA (People Also Ask) Mining

```
Go to google.com
Search "[YOUR_KEYWORD]"
Find the "People Also Ask" box
Click on EACH question to expand (this reveals more questions)
Keep clicking until you have 15-20 questions
Document all questions exactly as written
Group by intent:
- Informational (what, why, how does)
- Commercial (best, vs, review, cost)
- Transactional (buy, pricing, free trial)
```

---

## Competitor Analysis Prompts

### Full Competitor Overview

```
Go to ahrefs.com/site-explorer
Enter "[COMPETITOR_DOMAIN]"
Extract and document:
- Domain Rating
- Organic traffic (monthly)
- Number of ranking keywords
- Number of referring domains
- Traffic value
Click "Top pages" and extract top 10 pages by traffic
Click "Organic keywords" > filter Position 1-10, Volume > 500
Extract top 30 keywords they rank well for

Repeat for [COMPETITOR_2] and [COMPETITOR_3]
Create comparison table of all metrics
```

### Competitor Content Audit

```
Go to ahrefs.com/site-explorer
Enter "[COMPETITOR_DOMAIN]"
Click "Top pages"
Export top 50 pages by organic traffic

For each of the top 10 pages, note:
- URL and title
- Estimated traffic
- Number of keywords ranking
- Content type (blog, landing page, comparison, etc.)

Categorize their content:
- Comparison pages (vs, alternative)
- How-to guides
- Feature pages
- Listicles (best, top)
- Case studies
- Glossary/definitions

Identify content types they invest in most
Identify content gaps they're missing
```

### Competitor Backlink Analysis

```
Go to ahrefs.com/site-explorer
Enter "[COMPETITOR_DOMAIN]"
Click "Backlinks" in left menu
Set filters:
- Link type: Dofollow
- One link per domain
Sort by DR (Domain Rating) descending

Extract top 30 linking domains with:
- Referring domain
- DR
- Anchor text
- Target URL
- Link type (guest post, directory, resource, news, etc.)

Identify patterns:
- Are they doing guest posting? (check for author bios)
- Getting listed on resource pages?
- PR/news coverage?
- Directory submissions?
- Integration partner links?
```

### Link Intersect (Replicable Links)

```
Go to ahrefs.com/site-explorer
Enter "[YOUR_DOMAIN]"
Click "Link intersect" in left menu
Add competitors:
- [COMPETITOR_1]
- [COMPETITOR_2]
- [COMPETITOR_3]

Show: Sites linking to at least 2 competitors but not to you
Filter: DR > 20

Extract list with: Domain, DR, Links to which competitors
These are your priority outreach targets - they already link to similar sites
```

---

## On-Page Audit Prompts

### Quick Page Audit

```
Navigate to [TARGET_URL]
Analyze the page for:

1. TITLE TAG: Extract the title, check if it's under 60 chars, contains keyword
2. META DESCRIPTION: Extract it, check length (under 160), has CTA
3. H1: Extract H1, verify only one exists, contains keyword
4. H2s: List all H2 headings, check if descriptive and contain keywords
5. WORD COUNT: Estimate total content length
6. IMAGES: Count images, check if they have alt text
7. INTERNAL LINKS: Count links to other pages on the site
8. EXTERNAL LINKS: Count outbound links
9. SCHEMA: Check if any schema markup exists

Create audit report with:
- What's working well
- What needs improvement
- Priority fixes (ranked by impact)
```

### Page Speed Check

```
Go to pagespeed.web.dev
Enter "[TARGET_URL]"
Wait for results

Extract:
- Mobile performance score
- Desktop performance score
- Core Web Vitals:
  - LCP (target: under 2.5s)
  - INP/FID (target: under 100ms)
  - CLS (target: under 0.1)

Document top 3 opportunities for improvement
Note any critical issues in red
```

### Content Quality Audit

```
Navigate to [TARGET_URL]

Analyze content for:
1. Search intent match - does it answer what someone searching this would want?
2. Comprehensiveness - covers all subtopics? (compare to top 3 ranking pages)
3. Freshness - when was it last updated? Any outdated info?
4. E-E-A-T signals:
   - Author byline present?
   - Author credentials shown?
   - Sources cited for claims?
   - Contact info accessible?

5. Featured snippet optimization:
   - Any Q&A formatted content?
   - Direct answers under H2 questions?
   - Lists properly formatted?

6. Entity richness (for AI):
   - Specific names vs vague terms?
   - Statistics included?
   - Named examples?

Provide score 1-10 for each category with specific improvement recommendations
```

---

## Content Gap Prompts

### Find Keyword Gaps

```
Go to ahrefs.com/site-explorer
Enter "[YOUR_DOMAIN]"
Click "Content gap" in left menu

Add competitors:
- [COMPETITOR_1]
- [COMPETITOR_2]
- [COMPETITOR_3]

Settings:
- Show keywords where at least 2 targets rank
- But [YOUR_DOMAIN] doesn't rank in top 100

Filter results:
- Volume > 100
- KD < 40

Export keywords with: Keyword, Volume, KD, Which competitors rank

Group keywords by topic/intent
Prioritize by: Volume × (1/KD) = opportunity score
These are proven keywords you're missing
```

### Content Type Gap Analysis

```
For [YOUR_DOMAIN] and [COMPETITOR_1], [COMPETITOR_2], [COMPETITOR_3]:

Search each site for these content types:
1. "[competitor] vs" pages - comparison content
2. "alternative to" pages - competitor alternative pages
3. "best [category]" pages - listicle content
4. "how to" pages - tutorial content
5. "[product] for [industry]" pages - use case pages
6. Integration pages - "[product] + [tool]" pages
7. Feature pages - individual feature landing pages
8. Pricing page - "[product] pricing"

Create matrix showing which competitors have which content types
Identify gaps where competitors have content you don't
Prioritize based on search volume of target keywords
```

---

## AEO Prompts

### Featured Snippet Opportunities

```
Go to ahrefs.com/site-explorer
Enter "[YOUR_DOMAIN]"
Click "Organic keywords"
Filter:
- Position 2-10
- SERP features includes "Featured snippet"
- Volume > 100

These are snippets you can steal - you're already ranking but not winning the snippet

Extract: Keyword, Your Position, Volume, Current Snippet URL

For each opportunity:
1. Google the keyword
2. Note what type of snippet shows (paragraph, list, table)
3. Note how the current winner formats their answer
4. Document how you can create a better answer
```

### PAA Domination

```
Go to google.com
Search "[YOUR_TARGET_KEYWORD]"
Expand all PAA questions (click each one)
Document every question that appears

For your target page [URL]:
1. Check if you already answer these questions
2. Identify questions you should add as H2 sections
3. For each question, draft a 40-60 word direct answer

Format for snippet capture:
## [Exact Question]

[Direct answer in 40-60 words, complete and standalone]

[Expanded explanation continues...]
```

### Schema Implementation Check

```
Go to [YOUR_URL]
View page source or use browser developer tools
Search for "application/ld+json" or "schema.org"

Check for presence of:
- [ ] Article schema
- [ ] FAQPage schema (if has Q&A content)
- [ ] HowTo schema (if has steps/tutorial)
- [ ] Product schema (if product page)
- [ ] BreadcrumbList schema
- [ ] Organization schema (sitewide)

Validate any found schema at: validator.schema.org

Identify missing schema that should be added
Provide implementation code snippets for missing schema
```

---

## GEO Prompts

### AI Brand Visibility Test

```
Open these platforms in separate tabs:
- chat.openai.com (ChatGPT)
- perplexity.ai
- claude.ai

On EACH platform, ask:
1. "What is [YOUR_COMPANY]?"
2. "What are the best [YOUR_CATEGORY] tools?"
3. "How does [YOUR_PRODUCT] compare to [TOP_COMPETITOR]?"
4. "What are alternatives to [TOP_COMPETITOR]?"

Document for each:
- Were you mentioned? (Yes/No)
- Accuracy of description (Correct/Partially/Wrong/N/A)
- Position in lists (1st, 2nd, 5th, Not listed)
- Sentiment (Positive/Neutral/Negative)
- Sources cited (Perplexity shows these)

Calculate AI Visibility Score: [mentions out of 12 queries] × accuracy rating
```

### Citation Source Research

```
Open perplexity.ai
Search: "best [YOUR_CATEGORY] tools 2024"
Search: "[YOUR_CATEGORY] software comparison"
Search: "top [YOUR_CATEGORY] platforms"

For each search:
1. Click "Sources" to see what sites are cited
2. Document every unique source URL
3. Note if your site is ever cited
4. Note which competitor sites are cited

Create list of:
- Sites that cite competitors but not you (priority outreach)
- Types of sites that get cited (G2, blogs, publications)
- Content formats that get cited (comparisons, reviews, listicles)
```

### Entity Association Check

```
On ChatGPT, Perplexity, and Claude, ask:
"Who are the leaders in [YOUR_CATEGORY]?"
"What companies are known for [YOUR_CATEGORY]?"
"Name the top [YOUR_CATEGORY] providers"

Document:
- Which companies are mentioned?
- In what order?
- Are you included?
- What attributes are associated with each company?

If you're not mentioned:
- Identify what the mentioned companies have in common
- Check their Wikipedia presence
- Check their coverage in industry publications
- Note their review profiles (G2, Capterra)
These are the signals you need to build
```

---

## Local SEO Prompts

### GBP Competitor Analysis

```
Go to google.com/maps
Search "[SERVICE] [LOCATION]" (e.g., "plumber austin tx")

For the top 3 business results:
Click each business profile and extract:
- Business name
- Rating and total reviews
- Number of reviews in last 30 days (estimate from recent)
- Primary category
- Secondary categories (if visible)
- Services listed
- Number of photos
- Latest posts (what type, how recent)
- Q&A section content

Create comparison table
Identify what top performers do that lower performers don't
Note: categories, review counts, post frequency, services listed
```

### GBP Post Ideas Generator

```
Go to google.com/maps
Search "[YOUR_SERVICE] [YOUR_LOCATION]"
Find top 3 competitors
Click into each profile
Look at their "Updates" / posts section

Document:
- What types of posts? (offers, updates, events, products)
- What topics covered?
- How often do they post?
- Which posts have engagement?

Based on what works for competitors, generate 5 GBP posts for [YOUR_BUSINESS]:

Post 1: [Offer post with specific deal]
Post 2: [Service highlight with benefit]
Post 3: [Seasonal/timely topic]
Post 4: [Customer success story angle]
Post 5: [FAQ answer as post]

Include: Image suggestions, CTA button choice
```

### Local Citation Check

```
Search Google for:
"[YOUR_BUSINESS_NAME]" "[YOUR_CITY]"
"[YOUR_PHONE_NUMBER]"
"[YOUR_ADDRESS]"

Document everywhere your business appears:
- Google Business Profile
- Yelp
- Facebook
- Industry directories
- Local directories
- Review sites

Check for NAP consistency:
- Name exactly the same everywhere?
- Address formatted consistently?
- Phone number matches?

Flag any inconsistencies that need fixing
List directories where competitors appear but you don't
```

---

## Link Building Prompts

### Guest Post Opportunity Finder

```
Search Google for:
"[YOUR_TOPIC] write for us"
"[YOUR_TOPIC] guest post"
"[YOUR_TOPIC] contribute"
"[YOUR_TOPIC] submit article"

For top 20 results:
- Check if site accepts guest posts
- Note their DR (use Ahrefs bar extension or check manually)
- Check relevance to your niche
- Note any specific requirements

Create outreach list:
| Site | DR | Requirements | Topic Ideas |
Sort by DR descending
Prioritize DR 30+ sites in your niche
```

### Resource Page Link Opportunities

```
Search Google for:
"[YOUR_TOPIC] resources"
"[YOUR_TOPIC] useful links"
"[YOUR_TOPIC] tools list"
"best [YOUR_TOPIC] resources"
intitle:resources [YOUR_KEYWORD]

Find pages that link to resources/tools in your space

For each promising page:
- Note the URL
- Check if they link to competitors
- Identify what resource of yours would fit
- Find contact email

Create outreach list with personalized angles
```

### Broken Link Building

```
Go to ahrefs.com/site-explorer
Enter "[COMPETITOR_OR_NICHE_SITE]"
Click "Broken backlinks"

Find broken links that:
- Point to content you could replace
- Come from DR 20+ sites
- Have multiple linking domains

For each opportunity:
- Note the broken URL topic
- Check if you have similar content (or could create it)
- Find the linking page contact

Pitch: "I noticed [broken link]. I have a similar resource at [your URL] that might be helpful"
```

---

## Full Workflow Prompts

### Complete Competitor Research (20-30 min)

```
I need a full competitive analysis. Here are my details:
- My domain: [YOUR_DOMAIN]
- My category: [YOUR_CATEGORY]
- Main competitors: [COMP1], [COMP2], [COMP3]

Please complete these tasks:

1. TRAFFIC OVERVIEW
Go to ahrefs.com/site-explorer
For my domain and each competitor, extract:
- Domain Rating, Organic Traffic, Ranking Keywords, Referring Domains

2. TOP KEYWORDS
For each competitor, get their top 20 keywords (position 1-10, volume > 200)

3. CONTENT GAP
Run content gap: keywords they rank for that I don't (volume > 100, KD < 40)

4. BACKLINK ANALYSIS
For each competitor, get top 20 backlinks by DR

5. LINK INTERSECT
Find sites linking to 2+ competitors but not me

6. AI VISIBILITY
Check ChatGPT and Perplexity for category queries - who gets mentioned?

Create full report with:
- Comparison tables
- Top opportunities
- Priority recommendations
- 30-day action plan
```

### Complete Page Optimization (15-20 min)

```
I need a full SEO optimization for: [TARGET_URL]
Target keyword: [PRIMARY_KEYWORD]

1. CURRENT STATE AUDIT
Navigate to my page and document:
- Title, meta description, H1, H2 structure
- Word count, image count
- Internal/external links
- Schema present

2. COMPETITOR BENCHMARK
Google my target keyword
Analyze top 3 ranking pages:
- Their word count, structure, topics covered
- What they have that I don't

3. PAGE SPEED
Check pagespeed.web.dev for my URL
Document Core Web Vitals scores

4. FEATURED SNIPPET CHECK
Does a snippet exist for my keyword?
What format? Who owns it?
How can I win it?

5. RECOMMENDATIONS
Create prioritized list:
- Critical fixes (do immediately)
- High priority (this week)
- Medium priority (this month)
- Content additions needed
- Schema to implement
- Snippet optimization format
```

### Content Brief Creation (15 min)

```
Create a comprehensive content brief for:
Target keyword: [PRIMARY_KEYWORD]
Content type: [blog/comparison/guide/landing page]
My product: [YOUR_PRODUCT]

Research and provide:

1. KEYWORD DATA
Search volume, KD, intent for primary keyword
10 secondary keywords to include

2. SERP ANALYSIS
Top 10 results: title, word count, content type
Featured snippet analysis
PAA questions

3. COMPETITOR CONTENT AUDIT
What do top 3 pages cover?
What do they miss?
How can we beat them?

4. CONTENT OUTLINE
Full H2/H3 structure
Topic requirements for each section
Featured snippet target section

5. AEO REQUIREMENTS
Schema to implement
Q&A sections needed
Direct answer formats

6. GEO REQUIREMENTS
Entity density targets
Statistics to include
Citation-worthy elements to add

Output as complete content brief with all specs
```

---

## Pro Tips

**Run Tasks in Parallel:**
You can run multiple browser tasks simultaneously. Start 2-3 research tasks at once and compile results after.

**Batch Similar Tasks:**
Instead of researching competitors one by one, create a single prompt that does all 3-5 competitors in sequence.

**Save Time with Templates:**
Copy these prompts into a document. Fill in your specifics once, then reuse.

**Schedule Regular Audits:**
Run the AI visibility test monthly. Run competitor analysis quarterly. Run quick win finder weekly.

**Export Everything:**
Always ask to export data as tables or save to files. This creates records you can track over time.
