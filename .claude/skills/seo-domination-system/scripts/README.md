# SEO Automation Scripts

Python scripts for automating SEO analysis tasks. These complement the main workflows and can run standalone or be integrated into larger processes.

## Requirements

All scripts require Python 3.8+ and the following packages:

```bash
pip install requests beautifulsoup4
```

## Scripts Overview

### 1. bulk-keyword-check.py

Check Google rankings for multiple keywords at once.

```bash
# Check rankings for keywords in a file
python bulk-keyword-check.py --domain yourdomain.com --keywords keywords.txt

# Check a comma-separated list
python bulk-keyword-check.py --domain yourdomain.com --keywords "seo tips, keyword research"

# Output as JSON with custom delay
python bulk-keyword-check.py --domain yourdomain.com --keywords keywords.txt --json --delay 5
```

**Output:** CSV/JSON with keyword, position, ranking URL, timestamp

**Options:**
- `--domain, -d` - Your domain to check (required)
- `--keywords, -k` - Keywords file or comma-separated list (required)
- `--output, -o` - Output file path
- `--delay, -t` - Delay between requests (default: 3s)
- `--max-results` - Results to check per keyword (default: 100)
- `--json` - Output JSON instead of CSV

---

### 2. serp-scraper.py

Extract SERP features: People Also Ask questions, featured snippets, related searches.

```bash
# Scrape single keyword
python serp-scraper.py --keyword "how to start a blog"

# Scrape multiple keywords
python serp-scraper.py --keywords keywords.txt --output serp-data.json

# Get only PAA questions
python serp-scraper.py --keyword "seo tips" --paa-only
```

**Output:** JSON with PAA questions, featured snippet data, related searches, top results

**Options:**
- `--keyword, -k` - Single keyword
- `--keywords, -K` - Keywords file or comma-separated list
- `--output, -o` - Output JSON file
- `--delay, -t` - Delay between requests (default: 3s)
- `--paa-only` - Only extract PAA questions
- `--pretty` - Pretty print JSON

---

### 3. content-audit.py

Analyze web pages for SEO factors: word count, headers, meta tags, images, links.

```bash
# Audit single URL
python content-audit.py --url https://example.com/page

# Audit multiple URLs from file
python content-audit.py --urls urls.txt --output audit.csv

# Audit from sitemap (limit to 50 pages)
python content-audit.py --sitemap https://example.com/sitemap.xml --limit 50
```

**Output:** CSV/JSON with comprehensive SEO metrics per page

**Metrics analyzed:**
- Title tag (presence, length)
- Meta description (presence, length)
- Word count
- Header structure (H1, H2, H3 counts)
- Image count and alt text presence
- Internal/external link counts
- Schema markup detection
- Load time

**Options:**
- `--url, -u` - Single URL
- `--urls, -U` - URLs file or comma-separated list
- `--sitemap, -s` - Sitemap URL to crawl
- `--output, -o` - Output file (CSV or JSON)
- `--delay, -t` - Delay between requests (default: 1s)
- `--limit, -l` - Limit URLs to audit
- `--json` - Force JSON output

---

### 4. schema-validator.py

Validate JSON-LD schema markup against Schema.org specifications.

```bash
# Validate schema on a URL
python schema-validator.py --url https://example.com/article

# Validate multiple URLs
python schema-validator.py --urls urls.txt --output report.json

# Validate a local JSON file
python schema-validator.py --file my-schema.json --verbose
```

**Output:** Validation report with errors, warnings, and schema details

**Supported schema types:**
- Article, BlogPosting
- Product, LocalBusiness
- Organization, Person
- FAQPage, HowTo
- Recipe, Review, Event
- WebPage, BreadcrumbList
- VideoObject, Service
- SoftwareApplication

**Options:**
- `--url, -u` - URL to validate
- `--urls, -U` - File with URLs
- `--file, -f` - JSON file to validate
- `--output, -o` - Output JSON report
- `--verbose, -v` - Verbose output
- `--delay, -t` - Delay between requests

---

### 5. sitemap-analyzer.py

Parse and analyze XML sitemaps for SEO issues.

```bash
# Basic analysis
python sitemap-analyzer.py --url https://example.com/sitemap.xml

# Check URL status codes (samples 20 URLs)
python sitemap-analyzer.py --url https://example.com/sitemap.xml --check-urls

# Export all URLs to CSV
python sitemap-analyzer.py --url https://example.com/sitemap.xml --export-urls urls.csv
```

**Output:** Analysis of sitemap structure, URL issues, and recommendations

**Checks performed:**
- URL count and structure
- Lastmod date coverage and freshness
- Duplicate URL detection
- URL depth analysis
- Content type distribution
- Optional: HTTP status checking

**Options:**
- `--url, -u` - Sitemap URL (required)
- `--output, -o` - Output JSON file
- `--check-urls` - Check HTTP status of sample URLs
- `--sample-size` - Sample size for URL checks (default: 20)
- `--export-urls` - Export all URLs to CSV

---

## Usage Tips

### Rate Limiting

All scripts include configurable delays to avoid being rate-limited. Recommended minimums:
- Google searches: 3-5 seconds
- Regular page fetching: 1-2 seconds

### Keywords File Format

Create a text file with one keyword per line:

```
keyword research tools
seo best practices
# This is a comment (ignored)
how to improve rankings
```

### URLs File Format

Create a text file with one URL per line:

```
https://example.com/page-1
https://example.com/page-2
# Comments are ignored
https://example.com/page-3
```

### Combining Scripts

Run a complete audit workflow:

```bash
# 1. Get all URLs from sitemap
python sitemap-analyzer.py --url https://example.com/sitemap.xml --export-urls urls.csv

# 2. Audit content on all pages
python content-audit.py --urls urls.csv --output content-audit.csv

# 3. Validate schema markup
python schema-validator.py --urls urls.csv --output schema-report.json

# 4. Research SERP features for target keywords
python serp-scraper.py --keywords target-keywords.txt --output serp-data.json

# 5. Check current rankings
python bulk-keyword-check.py --domain example.com --keywords target-keywords.txt --output rankings.csv
```

---

## Troubleshooting

### "Rate limited by Google"
Increase delay between requests: `--delay 10`

### "beautifulsoup4 not installed"
```bash
pip install beautifulsoup4
```

### Timeouts
Scripts default to 30-second timeouts. For slow sites, this may need adjustment in the source code.

### SSL Errors
If you encounter SSL certificate errors, you may need to update your Python certificates:
```bash
pip install --upgrade certifi
```
