#!/usr/bin/env python3
"""
SERP Feature Scraper
Extracts People Also Ask questions, featured snippets, and related searches from Google.

Usage:
    python serp-scraper.py --keyword "your keyword"
    python serp-scraper.py --keywords keywords.txt --output serp-data.json

Output: JSON with PAA questions, featured snippet data, and related searches
"""

import argparse
import json
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("Warning: beautifulsoup4 not installed. Using regex fallback.")
    print("For better results: pip install beautifulsoup4")

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]


def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
    }


def extract_paa_questions(html: str) -> list:
    """Extract People Also Ask questions from SERP HTML."""
    questions = []

    if HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")

        # PAA questions are typically in expandable divs
        # Look for common PAA patterns
        paa_patterns = [
            {"data-sgrd": True},  # Common PAA attribute
            {"class": re.compile(r"related-question", re.I)},
            {"role": "button", "aria-expanded": True},
        ]

        for pattern in paa_patterns:
            elements = soup.find_all(attrs=pattern)
            for el in elements:
                text = el.get_text(strip=True)
                if text and "?" in text and len(text) > 10 and len(text) < 200:
                    if text not in questions:
                        questions.append(text)

        # Fallback: look for question-like text in divs
        if not questions:
            for div in soup.find_all("div"):
                text = div.get_text(strip=True)
                if (text.endswith("?") and
                    len(text) > 15 and
                    len(text) < 150 and
                    text not in questions and
                    not text.startswith("http")):
                    questions.append(text)

    # Regex fallback
    if not questions:
        # Pattern for questions in the HTML
        patterns = [
            r'data-q="([^"]+\?)"',
            r'"([A-Z][^"]{15,100}\?)"',
            r'>([A-Z][^<]{15,100}\?)<',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                clean = match.strip()
                if clean and clean not in questions:
                    questions.append(clean)

    # Clean and deduplicate
    cleaned = []
    seen = set()
    for q in questions:
        q_lower = q.lower()
        if q_lower not in seen and len(q) > 10:
            seen.add(q_lower)
            cleaned.append(q)

    return cleaned[:20]  # Limit to 20 questions


def extract_featured_snippet(html: str) -> dict:
    """Extract featured snippet data if present."""
    snippet = {
        "present": False,
        "type": None,  # paragraph, list, table
        "content": None,
        "source_url": None,
        "source_title": None,
    }

    if HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")

        # Look for featured snippet containers
        # These often have specific classes or data attributes
        snippet_selectors = [
            {"class": re.compile(r"featured-snippet", re.I)},
            {"data-attrid": re.compile(r"answer", re.I)},
            {"class": re.compile(r"kp-blk", re.I)},
        ]

        for selector in snippet_selectors:
            container = soup.find(attrs=selector)
            if container:
                snippet["present"] = True

                # Check for list
                if container.find("ol") or container.find("ul"):
                    snippet["type"] = "list"
                    items = container.find_all("li")
                    snippet["content"] = [li.get_text(strip=True) for li in items]
                # Check for table
                elif container.find("table"):
                    snippet["type"] = "table"
                    snippet["content"] = "Table present (parse separately)"
                # Default to paragraph
                else:
                    snippet["type"] = "paragraph"
                    snippet["content"] = container.get_text(strip=True)[:500]

                # Try to find source
                link = container.find("a", href=True)
                if link:
                    snippet["source_url"] = link.get("href", "")
                    snippet["source_title"] = link.get_text(strip=True)

                break

    # Regex fallback for basic detection
    if not snippet["present"]:
        if re.search(r'featured-snippet|kp-blk|data-attrid.*answer', html, re.I):
            snippet["present"] = True
            snippet["type"] = "detected"
            snippet["content"] = "Featured snippet detected but could not extract content"

    return snippet


def extract_related_searches(html: str) -> list:
    """Extract related searches from bottom of SERP."""
    related = []

    if HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")

        # Related searches are usually at the bottom
        # Look for common patterns
        related_containers = soup.find_all(attrs={
            "class": re.compile(r"related|searches|brs_col", re.I)
        })

        for container in related_containers:
            links = container.find_all("a")
            for link in links:
                text = link.get_text(strip=True)
                if text and len(text) > 3 and len(text) < 100:
                    if text not in related:
                        related.append(text)

    # Regex fallback
    if not related:
        # Look for related searches pattern
        pattern = r'<a[^>]*class="[^"]*brs[^"]*"[^>]*>([^<]+)</a>'
        matches = re.findall(pattern, html)
        related = [m.strip() for m in matches if m.strip()]

    return related[:10]


def extract_organic_results(html: str, limit: int = 10) -> list:
    """Extract top organic results."""
    results = []

    if HAS_BS4:
        soup = BeautifulSoup(html, "html.parser")

        # Find result containers
        for g in soup.find_all("div", class_=re.compile(r"^g$|tF2Cxc")):
            link = g.find("a", href=True)
            if link:
                url = link.get("href", "")
                if url.startswith("http") and "google.com" not in url:
                    title_elem = g.find("h3")
                    title = title_elem.get_text(strip=True) if title_elem else ""

                    desc_elem = g.find(attrs={"data-content-feature": True}) or g.find("span", class_=re.compile(r"VwiC3b|st"))
                    desc = desc_elem.get_text(strip=True)[:200] if desc_elem else ""

                    results.append({
                        "position": len(results) + 1,
                        "url": url,
                        "title": title,
                        "description": desc
                    })

                    if len(results) >= limit:
                        break

    return results


def scrape_serp(keyword: str) -> dict:
    """Scrape Google SERP for a keyword."""
    result = {
        "keyword": keyword,
        "timestamp": datetime.now().isoformat(),
        "paa_questions": [],
        "featured_snippet": {},
        "related_searches": [],
        "top_results": [],
        "error": None,
    }

    try:
        url = f"https://www.google.com/search?q={quote_plus(keyword)}&num=20&hl=en"

        response = requests.get(url, headers=get_headers(), timeout=30)

        if response.status_code == 429:
            result["error"] = "Rate limited. Wait and try again."
            return result

        if response.status_code != 200:
            result["error"] = f"HTTP {response.status_code}"
            return result

        html = response.text

        # Extract all data
        result["paa_questions"] = extract_paa_questions(html)
        result["featured_snippet"] = extract_featured_snippet(html)
        result["related_searches"] = extract_related_searches(html)
        result["top_results"] = extract_organic_results(html)

    except requests.exceptions.Timeout:
        result["error"] = "Request timed out"
    except requests.exceptions.RequestException as e:
        result["error"] = str(e)
    except Exception as e:
        result["error"] = f"Unexpected error: {str(e)}"

    return result


def load_keywords(keywords_input: str) -> list:
    """Load keywords from file or comma-separated string."""
    keywords = []

    path = Path(keywords_input)
    if path.exists() and path.is_file():
        with open(path, "r") as f:
            for line in f:
                kw = line.strip()
                if kw and not kw.startswith("#"):
                    keywords.append(kw)
    else:
        keywords = [kw.strip() for kw in keywords_input.split(",") if kw.strip()]

    return keywords


def main():
    parser = argparse.ArgumentParser(
        description="Scrape SERP features (PAA, snippets, related searches)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python serp-scraper.py --keyword "how to start a blog"
    python serp-scraper.py --keywords keywords.txt --output serp-data.json
    python serp-scraper.py --keyword "seo tips" --paa-only
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--keyword", "-k", help="Single keyword to scrape")
    group.add_argument("--keywords", "-K", help="Keywords file or comma-separated list")

    parser.add_argument("--output", "-o", help="Output JSON file")
    parser.add_argument("--delay", "-t", type=float, default=3.0, help="Delay between requests (default: 3.0)")
    parser.add_argument("--paa-only", action="store_true", help="Only extract PAA questions")
    parser.add_argument("--pretty", action="store_true", help="Pretty print JSON output")

    args = parser.parse_args()

    # Get keywords
    if args.keyword:
        keywords = [args.keyword]
    else:
        keywords = load_keywords(args.keywords)

    if not keywords:
        print("Error: No keywords provided")
        sys.exit(1)

    print(f"Scraping SERP data for {len(keywords)} keyword(s)")
    print("-" * 50)

    results = []

    for i, keyword in enumerate(keywords, 1):
        print(f"[{i}/{len(keywords)}] Scraping: {keyword}...", end=" ", flush=True)

        result = scrape_serp(keyword)
        results.append(result)

        if result["error"]:
            print(f"ERROR: {result['error']}")
        else:
            paa_count = len(result["paa_questions"])
            snippet = "Yes" if result["featured_snippet"].get("present") else "No"
            related = len(result["related_searches"])
            print(f"PAA: {paa_count}, Snippet: {snippet}, Related: {related}")

        if i < len(keywords):
            time.sleep(args.delay + random.uniform(0.5, 1.5))

    # Filter if paa-only
    if args.paa_only:
        results = [
            {"keyword": r["keyword"], "paa_questions": r["paa_questions"]}
            for r in results
        ]

    # Output
    indent = 2 if args.pretty else None

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=indent)
        print(f"\nResults saved to: {args.output}")
    else:
        print("\n" + "=" * 50)
        print(json.dumps(results, indent=2))

    # Summary
    if not args.paa_only:
        print("\n" + "=" * 50)
        total_paa = sum(len(r.get("paa_questions", [])) for r in results)
        snippets = sum(1 for r in results if r.get("featured_snippet", {}).get("present"))
        print(f"Summary:")
        print(f"  Keywords scraped: {len(results)}")
        print(f"  Total PAA questions: {total_paa}")
        print(f"  Featured snippets found: {snippets}")


if __name__ == "__main__":
    main()
