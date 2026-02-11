#!/usr/bin/env python3
"""
Bulk Keyword Rank Checker
Checks Google rankings for a list of keywords for your domain.

Usage:
    python bulk-keyword-check.py --domain yourdomain.com --keywords keywords.txt
    python bulk-keyword-check.py --domain yourdomain.com --keywords "keyword1, keyword2, keyword3"

Output: CSV file with keyword, position, URL, and timestamp
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
from urllib.parse import quote_plus, urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

# User agents to rotate
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]


def get_random_headers():
    """Return randomized headers to avoid detection."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


def check_ranking(keyword: str, domain: str, max_results: int = 100) -> dict:
    """
    Check Google ranking for a keyword.

    Returns dict with:
        - keyword: the search term
        - position: ranking position (1-100) or None if not found
        - url: the ranking URL or None
        - title: the page title or None
        - error: error message if any
    """
    result = {
        "keyword": keyword,
        "position": None,
        "url": None,
        "title": None,
        "error": None,
    }

    # Clean domain
    domain = domain.lower().replace("https://", "").replace("http://", "").rstrip("/")

    try:
        # Google search URL
        search_url = f"https://www.google.com/search?q={quote_plus(keyword)}&num={max_results}"

        response = requests.get(
            search_url,
            headers=get_random_headers(),
            timeout=30
        )

        if response.status_code == 429:
            result["error"] = "Rate limited by Google. Wait and try again."
            return result

        if response.status_code != 200:
            result["error"] = f"HTTP {response.status_code}"
            return result

        html = response.text

        # Extract organic results using regex patterns
        # Look for result links
        url_pattern = r'<a href="(/url\?q=|)(https?://[^"&]+)'
        matches = re.findall(url_pattern, html)

        position = 0
        for _, url in matches:
            # Skip Google's own URLs
            if "google.com" in url or "googleapis.com" in url:
                continue
            if "webcache" in url or "translate.google" in url:
                continue

            position += 1

            # Check if this URL matches our domain
            parsed = urlparse(url)
            url_domain = parsed.netloc.lower().replace("www.", "")

            if domain.replace("www.", "") in url_domain:
                result["position"] = position
                result["url"] = url
                return result

            if position >= max_results:
                break

        # Not found in top results
        result["position"] = None
        result["url"] = None

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

    # Check if it's a file path
    path = Path(keywords_input)
    if path.exists() and path.is_file():
        with open(path, "r") as f:
            for line in f:
                kw = line.strip()
                if kw and not kw.startswith("#"):
                    keywords.append(kw)
    else:
        # Treat as comma-separated list
        keywords = [kw.strip() for kw in keywords_input.split(",") if kw.strip()]

    return keywords


def main():
    parser = argparse.ArgumentParser(
        description="Check Google rankings for keywords",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python bulk-keyword-check.py --domain example.com --keywords keywords.txt
    python bulk-keyword-check.py --domain example.com --keywords "seo tips, keyword research"
    python bulk-keyword-check.py --domain example.com --keywords keywords.txt --output results.csv

Keywords file format (one per line):
    keyword research tools
    seo best practices
    # This is a comment (ignored)
    content marketing strategy
        """
    )

    parser.add_argument(
        "--domain", "-d",
        required=True,
        help="Your domain to check rankings for (e.g., example.com)"
    )
    parser.add_argument(
        "--keywords", "-k",
        required=True,
        help="Keywords file path or comma-separated list"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output CSV file (default: rankings_YYYYMMDD_HHMMSS.csv)"
    )
    parser.add_argument(
        "--delay", "-t",
        type=float,
        default=3.0,
        help="Delay between requests in seconds (default: 3.0)"
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=100,
        help="Maximum results to check per keyword (default: 100)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of CSV"
    )

    args = parser.parse_args()

    # Load keywords
    keywords = load_keywords(args.keywords)

    if not keywords:
        print("Error: No keywords found. Check your input.")
        sys.exit(1)

    print(f"Checking {len(keywords)} keywords for domain: {args.domain}")
    print(f"Delay between requests: {args.delay}s")
    print("-" * 50)

    results = []

    for i, keyword in enumerate(keywords, 1):
        print(f"[{i}/{len(keywords)}] Checking: {keyword}...", end=" ", flush=True)

        result = check_ranking(keyword, args.domain, args.max_results)
        result["timestamp"] = datetime.now().isoformat()
        result["domain"] = args.domain
        results.append(result)

        if result["error"]:
            print(f"ERROR: {result['error']}")
        elif result["position"]:
            print(f"#{result['position']} - {result['url']}")
        else:
            print("Not in top 100")

        # Delay between requests (except after last one)
        if i < len(keywords):
            time.sleep(args.delay + random.uniform(0.5, 1.5))

    # Generate output filename
    if args.output:
        output_file = args.output
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = "json" if args.json else "csv"
        output_file = f"rankings_{timestamp}.{ext}"

    # Write results
    if args.json:
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
    else:
        with open(output_file, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "keyword", "position", "url", "domain", "timestamp", "error"
            ])
            writer.writeheader()
            writer.writerows(results)

    print("-" * 50)
    print(f"Results saved to: {output_file}")

    # Summary
    found = sum(1 for r in results if r["position"])
    top10 = sum(1 for r in results if r["position"] and r["position"] <= 10)
    top3 = sum(1 for r in results if r["position"] and r["position"] <= 3)
    errors = sum(1 for r in results if r["error"])

    print(f"\nSummary:")
    print(f"  Keywords checked: {len(results)}")
    print(f"  Ranking in top 100: {found}")
    print(f"  Ranking in top 10: {top10}")
    print(f"  Ranking in top 3: {top3}")
    if errors:
        print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
