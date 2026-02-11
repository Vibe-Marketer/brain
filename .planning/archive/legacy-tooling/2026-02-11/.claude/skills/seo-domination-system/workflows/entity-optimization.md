# Entity Optimization Workflow

<objective>
Build topical authority by establishing your brand and content as recognized entities in Google's Knowledge Graph. Output: Entity optimization strategy with schema implementation plan.
</objective>

<inputs_required>
- Brand name and variations
- Key people (founders, experts, authors)
- Core topics you want to own
- Existing web presence inventory
- Competitor entity analysis
</inputs_required>

<process>

## Phase 1: Entity Audit

**Check your current entity status:**

```
1. Google your brand name
   - Does a Knowledge Panel appear?
   - What information shows?
   - Are there any entity associations?

2. Google "[Brand] + [topic]"
   - Does Google associate you with your topics?

3. Search Google Knowledge Graph:
   - Use: https://kgsearch.googleapis.com/v1/entities:search?query=[brand]&key=[API_KEY]
   - Or search manually and check for entity cards
```

**Entity audit checklist:**

| Entity Element | Status | Notes |
|----------------|--------|-------|
| Brand Knowledge Panel | Yes/No | |
| Founder Knowledge Panel | Yes/No | |
| Wikipedia presence | Yes/No | |
| Wikidata entry | Yes/No | |
| Topic associations | List | |
| Schema markup present | Yes/No | |

## Phase 2: Entity Architecture

**Map your entity ecosystem:**

```
                    ┌─────────────────┐
                    │  BRAND ENTITY   │
                    │  (Organization) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────┴────┐        ┌─────┴─────┐       ┌────┴────┐
    │ PEOPLE  │        │  CONTENT  │       │ TOPICS  │
    │ ENTITIES│        │  ENTITIES │       │ ENTITIES│
    └────┬────┘        └─────┬─────┘       └────┬────┘
         │                   │                   │
    - Founder           - Blog posts       - Core topic 1
    - Team members      - Guides           - Core topic 2
    - Authors           - Products         - Core topic 3
```

**Define your entity relationships:**

| Primary Entity | Related Entities | Relationship |
|----------------|------------------|--------------|
| [Brand] | [Founder Name] | founder |
| [Brand] | [Product/Service] | offers |
| [Brand] | [Core Topic] | expertise |
| [Founder] | [Brand] | founderOf |
| [Founder] | [Topic] | expert |

## Phase 3: Schema Implementation for Entities

**Organization Schema (for brand entity):**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://yourdomain.com/#organization",
  "name": "Your Brand Name",
  "alternateName": ["Brand Nickname", "BRAND"],
  "url": "https://yourdomain.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://yourdomain.com/logo.png",
    "width": 600,
    "height": 60
  },
  "sameAs": [
    "https://www.linkedin.com/company/yourbrand",
    "https://twitter.com/yourbrand",
    "https://www.facebook.com/yourbrand",
    "https://www.youtube.com/yourbrand",
    "https://en.wikipedia.org/wiki/Your_Brand"
  ],
  "founder": {
    "@type": "Person",
    "@id": "https://yourdomain.com/about#founder",
    "name": "Founder Name"
  },
  "foundingDate": "2020",
  "description": "Brief description of what your organization does",
  "knowsAbout": [
    "Core Topic 1",
    "Core Topic 2",
    "Core Topic 3"
  ]
}
```

**Person Schema (for key people):**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://yourdomain.com/about#founder",
  "name": "Founder Name",
  "jobTitle": "Founder & CEO",
  "worksFor": {
    "@id": "https://yourdomain.com/#organization"
  },
  "url": "https://yourdomain.com/about",
  "sameAs": [
    "https://www.linkedin.com/in/foundername",
    "https://twitter.com/foundername"
  ],
  "knowsAbout": [
    "Topic Expertise 1",
    "Topic Expertise 2"
  ],
  "alumniOf": {
    "@type": "Organization",
    "name": "University Name"
  }
}
```

**Article Schema with Author Entity:**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {
    "@type": "Person",
    "@id": "https://yourdomain.com/about#founder",
    "name": "Author Name"
  },
  "publisher": {
    "@id": "https://yourdomain.com/#organization"
  },
  "about": {
    "@type": "Thing",
    "name": "Core Topic",
    "sameAs": "https://en.wikipedia.org/wiki/Core_Topic"
  }
}
```

## Phase 4: Entity Signals & Citations

**Build entity recognition through:**

### 1. Consistent NAP+ (Name, Address, Phone, Plus)
- Same brand name everywhere
- Same descriptions
- Same social links
- Same founder attribution

### 2. Wikipedia & Wikidata
- Create Wikidata entry (if notable enough)
- Contribute to relevant Wikipedia articles
- Get mentioned in existing Wikipedia pages
- Note: Follow Wikipedia's notability guidelines

### 3. Knowledge Base Citations
- Crunchbase profile
- LinkedIn company page (complete)
- Google Business Profile
- Industry directories
- Professional associations

### 4. Author Entities
- Consistent author bios across all content
- Author pages on your site
- Guest posts with author schema
- Social profile connections

## Phase 5: Topical Entity Building

**Establish expertise in your core topics:**

### Content Cluster Strategy
```
                ┌─────────────────────┐
                │   PILLAR CONTENT    │
                │   (Main Topic)      │
                └──────────┬──────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───┴───┐              ┌───┴───┐              ┌───┴───┐
│Cluster│              │Cluster│              │Cluster│
│   1   │              │   2   │              │   3   │
└───┬───┘              └───┬───┘              └───┬───┘
    │                      │                      │
- Sub-topic A          - Sub-topic D          - Sub-topic G
- Sub-topic B          - Sub-topic E          - Sub-topic H
- Sub-topic C          - Sub-topic F          - Sub-topic I
```

### Topic Coverage Requirements
For each core topic, create:
- 1 comprehensive pillar page (3,000+ words)
- 5-10 supporting cluster articles
- Internal links between all related content
- Schema markup connecting content

## Phase 6: Entity Reconciliation

**Ensure Google connects your mentions:**

1. **Use consistent naming**
   - Always "Brand Name" not "BrandName" or "Brand"
   - Same founder name format everywhere

2. **Link entities together**
   - Website links to social profiles
   - Social profiles link back
   - All profiles link to each other

3. **Same-as declarations**
   - Schema sameAs property
   - Connects your profiles to your entity

4. **Avoid entity confusion**
   - If your brand name is common, differentiate
   - Use taglines and descriptions consistently
   - Consider disambiguation on Wikipedia/Wikidata

## Phase 7: Monitoring Entity Status

**Track entity development:**

| Metric | How to Check | Frequency |
|--------|--------------|-----------|
| Knowledge Panel | Google brand name | Monthly |
| Entity associations | Google "[brand] [topic]" | Monthly |
| Wikidata status | Search Wikidata | Quarterly |
| Schema validation | Rich Results Test | After changes |
| Brand mentions | Google Alerts | Ongoing |

**Signs of entity recognition:**
- Knowledge Panel appears for brand searches
- "People also search for" shows relevant entities
- Google autocomplete suggests your brand
- AI search engines (Perplexity, ChatGPT) know your brand

</process>

<entity_checklist>

**Brand Entity Checklist:**
- [ ] Organization schema on homepage
- [ ] Logo schema with proper dimensions
- [ ] sameAs links to all social profiles
- [ ] knowsAbout declares core topics
- [ ] Founder/team linked via schema
- [ ] Consistent NAP across web

**Person Entity Checklist (for founders/authors):**
- [ ] Person schema on about page
- [ ] Linked to Organization via worksFor
- [ ] sameAs to personal social profiles
- [ ] knowsAbout declares expertise
- [ ] Author schema on all authored content
- [ ] Consistent bio across guest posts

**Topic Entity Checklist:**
- [ ] Pillar content for each core topic
- [ ] Content clusters with internal linking
- [ ] Topic mentioned in Organization schema
- [ ] Article schema with "about" property
- [ ] Related Wikipedia/Wikidata links where relevant

</entity_checklist>

<success_criteria>
- Entity audit completed
- Organization schema implemented
- Person schema for key people
- sameAs connections established
- Content cluster strategy mapped
- All schemas validated
- Monitoring plan in place
</success_criteria>
