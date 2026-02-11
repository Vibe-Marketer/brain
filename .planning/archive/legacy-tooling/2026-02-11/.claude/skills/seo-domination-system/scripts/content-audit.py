#!/usr/bin/env python3
"""
Content Audit Tool
Analyzes web pages for SEO factors: word count, headers, meta tags, images, links.

Usage:
    python content-audit.py --url https://example.com/page
    python content-audit.py --urls urls.txt --output audit.csv
    python content-audit.py --sitemap https://example.com/sitemap.xml --limit 50

Output: CSV/JSON with comprehensive SEO metrics per page
"""

import argparse
import csv
import json
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    print("Error: beautifulsoup4 required. Install with: pip install beautifulsoup4")
    sys.exit(1)

USER_AGENTS = [
    "Mozilla/5.0 (compatible; ContentAuditBot/1.0; +https://example.com/bot)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
]


def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }


def count_words(text: str) -> int:
    """Count words in text."""
    words = re.findall(r'\b\w+\b', text)
    return len(words)


def analyze_page(url: str) -> dict:
    """Analyze a single page for SEO metrics."""
    result = {
        "url": url,
        "timestamp": datetime.now().isoformat(),
        "status_code": None,
        "load_time_ms": None,

        # Meta
        "title": None,
        "title_length": 0,
        "meta_description": None,
        "meta_description_length": 0,
        "canonical": None,
        "robots": None,

        # Content
        "word_count": 0,
        "h1_count": 0,
        "h1_text": [],
        "h2_count": 0,
        "h2_text": [],
        "h3_count": 0,
        "paragraph_count": 0,

        # Images
        "image_count": 0,
        "images_without_alt": 0,
        "images_alt_texts": [],

        # Links
        "internal_links": 0,
        "external_links": 0,
        "broken_links": [],  # We don't check these by default

        # Schema
        "has_schema": False,
        "schema_types": [],

        # Issues
        "issues": [],
        "error": None,
    }

    try:
        start_time = time.time()
        response = requests.get(url, headers=get_headers(), timeout=30, allow_redirects=True)
        result["load_time_ms"] = int((time.time() - start_time) * 1000)
        result["status_code"] = response.status_code

        if response.status_code != 200:
            result["error"] = f"HTTP {response.status_code}"
            return result

        soup = BeautifulSoup(response.text, "html.parser")
        base_domain = urlparse(url).netloc

        # --- Meta Tags ---
        title_tag = soup.find("title")
        if title_tag:
            result["title"] = title_tag.get_text(strip=True)
            result["title_length"] = len(result["title"])
            if result["title_length"] > 60:
                result["issues"].append("Title too long (>60 chars)")
            elif result["title_length"] < 30:
                result["issues"].append("Title too short (<30 chars)")
        else:
            result["issues"].append("Missing title tag")

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            result["meta_description"] = meta_desc.get("content", "")
            result["meta_description_length"] = len(result["meta_description"])
            if result["meta_description_length"] > 160:
                result["issues"].append("Meta description too long (>160 chars)")
            elif result["meta_description_length"] < 70:
                result["issues"].append("Meta description too short (<70 chars)")
        else:
            result["issues"].append("Missing meta description")

        canonical = soup.find("link", attrs={"rel": "canonical"})
        if canonical:
            result["canonical"] = canonical.get("href", "")

        robots = soup.find("meta", attrs={"name": "robots"})
        if robots:
            result["robots"] = robots.get("content", "")

        # --- Content Analysis ---
        # Remove script and style elements
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()

        body = soup.find("body")
        if body:
            text = body.get_text(separator=" ", strip=True)
            result["word_count"] = count_words(text)

            if result["word_count"] < 300:
                result["issues"].append("Thin content (<300 words)")

        # Headers
        h1s = soup.find_all("h1")
        result["h1_count"] = len(h1s)
        result["h1_text"] = [h.get_text(strip=True)[:100] for h in h1s]

        if result["h1_count"] == 0:
            result["issues"].append("Missing H1 tag")
        elif result["h1_count"] > 1:
            result["issues"].append(f"Multiple H1 tags ({result['h1_count']})")

        h2s = soup.find_all("h2")
        result["h2_count"] = len(h2s)
        result["h2_text"] = [h.get_text(strip=True)[:100] for h in h2s[:10]]

        h3s = soup.find_all("h3")
        result["h3_count"] = len(h3s)

        paragraphs = soup.find_all("p")
        result["paragraph_count"] = len(paragraphs)

        # --- Images ---
        images = soup.find_all("img")
        result["image_count"] = len(images)

        for img in images:
            alt = img.get("alt", "").strip()
            if not alt:
                result["images_without_alt"] += 1
            else:
                result["images_alt_texts"].append(alt[:50])

        if result["images_without_alt"] > 0:
            result["issues"].append(f"{result['images_without_alt']} images missing alt text")

        # --- Links ---
        links = soup.find_all("a", href=True)
        for link in links:
            href = link.get("href", "")
            if href.startswith("#") or href.startswith("javascript:"):
                continue

            full_url = urljoin(url, href)
            link_domain = urlparse(full_url).netloc

            if base_domain in link_domain:
                result["internal_links"] += 1
            else:
                result["external_links"] += 1

        # --- Schema Markup ---
        schema_scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
        if schema_scripts:
            result["has_schema"] = True
            for script in schema_scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict):
                        schema_type = data.get("@type", "Unknown")
                        if schema_type not in result["schema_types"]:
                            result["schema_types"].append(schema_type)
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                schema_type = item.get("@type", "Unknown")
                                if schema_type not in result["schema_types"]:
                                    result["schema_types"].append(schema_type)
                except:
                    pass

        # Limit alt texts for output
        result["images_alt_texts"] = result["images_alt_texts"][:5]

    except requests.exceptions.Timeout:
        result["error"] = "Request timed out"
    except requests.exceptions.RequestException as e:
        result["error"] = str(e)
    except Exception as e:
        result["error"] = f"Unexpected error: {str(e)}"

    return result


def load_urls_from_sitemap(sitemap_url: str, limit: int = None) -> list:
    """Load URLs from a sitemap."""
    urls = []

    try:
        response = requests.get(sitemap_url, headers=get_headers(), timeout=30)
        response.raise_for_status()

        # Parse XML
        root = ET.fromstring(response.content)

        # Handle namespace
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

        # Check if it's a sitemap index
        sitemaps = root.findall(".//sm:sitemap/sm:loc", ns)
        if sitemaps:
            print(f"Found sitemap index with {len(sitemaps)} sitemaps")
            # Get URLs from first sitemap only
            first_sitemap = sitemaps[0].text
            return load_urls_from_sitemap(first_sitemap, limit)

        # Get URLs
        for url_elem in root.findall(".//sm:url/sm:loc", ns):
            urls.append(url_elem.text)
            if limit and len(urls) >= limit:
                break

        # Try without namespace if no results
        if not urls:
            for url_elem in root.findall(".//loc"):
                urls.append(url_elem.text)
                if limit and len(urls) >= limit:
                    break

    except Exception as e:
        print(f"Error loading sitemap: {e}")

    return urls


def load_urls(urls_input: str) -> list:
    """Load URLs from file or comma-separated string."""
    urls = []

    path = Path(urls_input)
    if path.exists() and path.is_file():
        with open(path, "r") as f:
            for line in f:
                url = line.strip()
                if url and not url.startswith("#") and url.startswith("http"):
                    urls.append(url)
    else:
        urls = [u.strip() for u in urls_input.split(",") if u.strip().startswith("http")]

    return urls


def main():
    parser = argparse.ArgumentParser(
        description="Audit web pages for SEO factors",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python content-audit.py --url https://example.com/page
    python content-audit.py --urls urls.txt --output audit.csv
    python content-audit.py --sitemap https://example.com/sitemap.xml --limit 20

Metrics analyzed:
    - Title tag (presence, length)
    - Meta description (presence, length)
    - Word count
    - Header structure (H1, H2, H3 counts)
    - Image count and alt text presence
    - Internal/external link counts
    - Schema markup detection
    - Load time
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", "-u", help="Single URL to audit")
    group.add_argument("--urls", "-U", help="File with URLs or comma-separated list")
    group.add_argument("--sitemap", "-s", help="Sitemap URL to crawl")

    parser.add_argument("--output", "-o", help="Output file (CSV or JSON based on extension)")
    parser.add_argument("--delay", "-t", type=float, default=1.0, help="Delay between requests (default: 1.0)")
    parser.add_argument("--limit", "-l", type=int, help="Limit number of URLs to audit")
    parser.add_argument("--json", action="store_true", help="Force JSON output")

    args = parser.parse_args()

    # Get URLs
    if args.url:
        urls = [args.url]
    elif args.sitemap:
        print(f"Loading URLs from sitemap: {args.sitemap}")
        urls = load_urls_from_sitemap(args.sitemap, args.limit)
        print(f"Found {len(urls)} URLs")
    else:
        urls = load_urls(args.urls)

    if args.limit and len(urls) > args.limit:
        urls = urls[:args.limit]

    if not urls:
        print("Error: No valid URLs found")
        sys.exit(1)

    print(f"Auditing {len(urls)} URL(s)")
    print("-" * 60)

    results = []

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url[:60]}...", end=" ", flush=True)

        result = analyze_page(url)
        results.append(result)

        if result["error"]:
            print(f"ERROR: {result['error']}")
        else:
            issues = len(result["issues"])
            print(f"Words: {result['word_count']}, Issues: {issues}")

        if i < len(urls):
            time.sleep(args.delay)

    # Determine output format
    output_json = args.json
    if args.output and args.output.endswith(".json"):
        output_json = True

    if args.output:
        if output_json:
            with open(args.output, "w") as f:
                json.dump(results, f, indent=2)
        else:
            # CSV output
            fieldnames = [
                "url", "status_code", "load_time_ms",
                "title", "title_length", "meta_description_length",
                "word_count", "h1_count", "h2_count", "h3_count",
                "image_count", "images_without_alt",
                "internal_links", "external_links",
                "has_schema", "issues"
            ]

            with open(args.output, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
                writer.writeheader()

                for r in results:
                    r["issues"] = "; ".join(r["issues"])
                    writer.writerow(r)

        print(f"\nResults saved to: {args.output}")

    # Summary
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)

    total = len(results)
    successful = sum(1 for r in results if not r["error"])
    avg_words = sum(r["word_count"] for r in results if not r["error"]) // max(successful, 1)
    thin_content = sum(1 for r in results if r["word_count"] < 300 and not r["error"])
    missing_h1 = sum(1 for r in results if r["h1_count"] == 0 and not r["error"])
    missing_meta = sum(1 for r in results if not r["meta_description"] and not r["error"])
    no_schema = sum(1 for r in results if not r["has_schema"] and not r["error"])
    missing_alt = sum(r["images_without_alt"] for r in results)

    print(f"Pages audited: {total}")
    print(f"Successful: {successful}")
    print(f"Average word count: {avg_words}")
    print(f"\nIssues found:")
    print(f"  - Thin content (<300 words): {thin_content}")
    print(f"  - Missing H1: {missing_h1}")
    print(f"  - Missing meta description: {missing_meta}")
    print(f"  - No schema markup: {no_schema}")
    print(f"  - Images without alt text: {missing_alt}")

    # List pages with most issues
    if not args.output:
        print("\nPages with issues:")
        issues_sorted = sorted(results, key=lambda x: len(x["issues"]), reverse=True)
        for r in issues_sorted[:5]:
            if r["issues"]:
                print(f"  {r['url'][:50]}: {', '.join(r['issues'][:3])}")


if __name__ == "__main__":
    main()
