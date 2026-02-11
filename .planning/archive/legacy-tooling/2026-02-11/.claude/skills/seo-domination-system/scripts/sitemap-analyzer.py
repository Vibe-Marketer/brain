#!/usr/bin/env python3
"""
Sitemap Analyzer
Parses and analyzes XML sitemaps for SEO issues.

Usage:
    python sitemap-analyzer.py --url https://example.com/sitemap.xml
    python sitemap-analyzer.py --url https://example.com/sitemap.xml --check-urls
    python sitemap-analyzer.py --url https://example.com/sitemap.xml --output report.json

Output: Analysis of sitemap structure, URL issues, and recommendations
"""

import argparse
import csv
import json
import re
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)


def fetch_sitemap(url: str) -> tuple:
    """Fetch sitemap content and return (content, error)."""
    try:
        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SitemapAnalyzer/1.0)"
        }, timeout=30)

        if response.status_code != 200:
            return None, f"HTTP {response.status_code}"

        return response.content, None

    except requests.exceptions.Timeout:
        return None, "Request timed out"
    except requests.exceptions.RequestException as e:
        return None, str(e)


def parse_sitemap(content: bytes, base_url: str = None) -> dict:
    """Parse sitemap XML and extract data."""
    result = {
        "type": None,  # "sitemap" or "sitemapindex"
        "urls": [],
        "sitemaps": [],  # For sitemap index
        "parse_error": None,
    }

    try:
        root = ET.fromstring(content)

        # Handle namespace
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

        # Detect sitemap type
        root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

        if root_tag == "sitemapindex":
            result["type"] = "sitemapindex"

            # Extract nested sitemaps
            for sitemap in root.findall(".//sm:sitemap", ns) or root.findall(".//sitemap"):
                loc = sitemap.find("sm:loc", ns) or sitemap.find("loc")
                lastmod = sitemap.find("sm:lastmod", ns) or sitemap.find("lastmod")

                if loc is not None:
                    result["sitemaps"].append({
                        "loc": loc.text,
                        "lastmod": lastmod.text if lastmod is not None else None,
                    })

        elif root_tag == "urlset":
            result["type"] = "sitemap"

            # Extract URLs
            for url_elem in root.findall(".//sm:url", ns) or root.findall(".//url"):
                loc = url_elem.find("sm:loc", ns) or url_elem.find("loc")
                lastmod = url_elem.find("sm:lastmod", ns) or url_elem.find("lastmod")
                changefreq = url_elem.find("sm:changefreq", ns) or url_elem.find("changefreq")
                priority = url_elem.find("sm:priority", ns) or url_elem.find("priority")

                if loc is not None:
                    result["urls"].append({
                        "loc": loc.text,
                        "lastmod": lastmod.text if lastmod is not None else None,
                        "changefreq": changefreq.text if changefreq is not None else None,
                        "priority": priority.text if priority is not None else None,
                    })

        else:
            result["parse_error"] = f"Unknown root element: {root_tag}"

    except ET.ParseError as e:
        result["parse_error"] = f"XML parse error: {str(e)}"

    return result


def analyze_urls(urls: list) -> dict:
    """Analyze URL list for patterns and issues."""
    analysis = {
        "total_urls": len(urls),
        "with_lastmod": 0,
        "with_changefreq": 0,
        "with_priority": 0,
        "lastmod_stats": {
            "oldest": None,
            "newest": None,
            "never_updated": 0,
        },
        "changefreq_distribution": Counter(),
        "priority_distribution": Counter(),
        "path_depth_distribution": Counter(),
        "content_type_guesses": Counter(),
        "issues": [],
        "duplicate_urls": [],
        "url_patterns": Counter(),
    }

    seen_urls = set()
    lastmod_dates = []

    for url_data in urls:
        url = url_data["loc"]

        # Check for duplicates
        if url in seen_urls:
            analysis["duplicate_urls"].append(url)
        seen_urls.add(url)

        # Lastmod stats
        if url_data["lastmod"]:
            analysis["with_lastmod"] += 1
            try:
                # Parse date (handle various formats)
                date_str = url_data["lastmod"][:10]  # Get YYYY-MM-DD
                lastmod_dates.append(date_str)
            except:
                pass

        # Changefreq stats
        if url_data["changefreq"]:
            analysis["with_changefreq"] += 1
            analysis["changefreq_distribution"][url_data["changefreq"]] += 1

        # Priority stats
        if url_data["priority"]:
            analysis["with_priority"] += 1
            analysis["priority_distribution"][url_data["priority"]] += 1

        # URL analysis
        parsed = urlparse(url)
        path = parsed.path.rstrip("/")

        # Path depth
        depth = len([p for p in path.split("/") if p])
        analysis["path_depth_distribution"][depth] += 1

        # Content type guess based on URL pattern
        if re.search(r'/blog/|/posts?/|/articles?/', path, re.I):
            analysis["content_type_guesses"]["blog"] += 1
        elif re.search(r'/products?/|/shop/|/store/', path, re.I):
            analysis["content_type_guesses"]["product"] += 1
        elif re.search(r'/category|/categories/', path, re.I):
            analysis["content_type_guesses"]["category"] += 1
        elif re.search(r'/tags?/', path, re.I):
            analysis["content_type_guesses"]["tag"] += 1
        elif re.search(r'/pages?/', path, re.I):
            analysis["content_type_guesses"]["page"] += 1
        elif path in ["", "/", "/index.html"]:
            analysis["content_type_guesses"]["homepage"] += 1
        else:
            analysis["content_type_guesses"]["other"] += 1

        # URL pattern (first two path segments)
        segments = [s for s in path.split("/") if s][:2]
        pattern = "/" + "/".join(segments) if segments else "/"
        analysis["url_patterns"][pattern] += 1

    # Lastmod date analysis
    if lastmod_dates:
        sorted_dates = sorted(lastmod_dates)
        analysis["lastmod_stats"]["oldest"] = sorted_dates[0]
        analysis["lastmod_stats"]["newest"] = sorted_dates[-1]

        # Check for very old dates (potential issue)
        cutoff = "2020-01-01"
        old_count = sum(1 for d in sorted_dates if d < cutoff)
        if old_count > 0:
            analysis["lastmod_stats"]["never_updated"] = old_count

    # Generate issues
    total = analysis["total_urls"]

    if analysis["with_lastmod"] < total * 0.5:
        pct = int((1 - analysis["with_lastmod"] / total) * 100)
        analysis["issues"].append(f"{pct}% of URLs missing lastmod date")

    if analysis["duplicate_urls"]:
        analysis["issues"].append(f"{len(analysis['duplicate_urls'])} duplicate URLs found")

    if analysis["lastmod_stats"]["never_updated"] > total * 0.2:
        analysis["issues"].append(f"{analysis['lastmod_stats']['never_updated']} URLs have very old lastmod dates")

    # Check for overly deep URLs
    deep_urls = sum(v for k, v in analysis["path_depth_distribution"].items() if k > 4)
    if deep_urls > total * 0.1:
        analysis["issues"].append(f"{deep_urls} URLs have deep paths (>4 levels)")

    # Convert Counters to dicts for JSON serialization
    analysis["changefreq_distribution"] = dict(analysis["changefreq_distribution"])
    analysis["priority_distribution"] = dict(analysis["priority_distribution"])
    analysis["path_depth_distribution"] = dict(analysis["path_depth_distribution"])
    analysis["content_type_guesses"] = dict(analysis["content_type_guesses"])
    analysis["url_patterns"] = dict(analysis["url_patterns"].most_common(10))

    return analysis


def check_url_status(urls: list, sample_size: int = 20, delay: float = 0.5) -> list:
    """Check HTTP status of sample URLs."""
    results = []

    # Sample URLs if too many
    import random
    if len(urls) > sample_size:
        sample = random.sample(urls, sample_size)
    else:
        sample = urls

    print(f"\nChecking {len(sample)} URLs for status codes...")

    for i, url_data in enumerate(sample, 1):
        url = url_data["loc"]
        print(f"  [{i}/{len(sample)}] {url[:50]}...", end=" ", flush=True)

        try:
            response = requests.head(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SitemapAnalyzer/1.0)"
            }, timeout=10, allow_redirects=True)

            status = response.status_code
            print(status)

            results.append({
                "url": url,
                "status": status,
                "final_url": str(response.url) if response.url != url else None,
            })

        except Exception as e:
            print(f"ERROR: {str(e)[:30]}")
            results.append({
                "url": url,
                "status": "error",
                "error": str(e),
            })

        time.sleep(delay)

    return results


def analyze_sitemap(url: str, check_urls: bool = False, sample_size: int = 20) -> dict:
    """Main analysis function."""
    report = {
        "url": url,
        "timestamp": datetime.now().isoformat(),
        "sitemap_type": None,
        "total_urls": 0,
        "nested_sitemaps": [],
        "analysis": None,
        "url_checks": None,
        "recommendations": [],
        "error": None,
    }

    print(f"Fetching sitemap: {url}")
    content, error = fetch_sitemap(url)

    if error:
        report["error"] = error
        return report

    parsed = parse_sitemap(content, url)

    if parsed["parse_error"]:
        report["error"] = parsed["parse_error"]
        return report

    report["sitemap_type"] = parsed["type"]

    if parsed["type"] == "sitemapindex":
        print(f"Found sitemap index with {len(parsed['sitemaps'])} sitemaps")
        report["nested_sitemaps"] = parsed["sitemaps"]

        # Fetch and analyze nested sitemaps
        all_urls = []
        for i, sm in enumerate(parsed["sitemaps"], 1):
            print(f"  [{i}/{len(parsed['sitemaps'])}] Fetching: {sm['loc'][:50]}...")
            sm_content, sm_error = fetch_sitemap(sm["loc"])

            if not sm_error:
                sm_parsed = parse_sitemap(sm_content, sm["loc"])
                if sm_parsed["urls"]:
                    all_urls.extend(sm_parsed["urls"])
                    print(f"    Found {len(sm_parsed['urls'])} URLs")

            time.sleep(0.5)

        report["total_urls"] = len(all_urls)
        report["analysis"] = analyze_urls(all_urls)

        if check_urls and all_urls:
            report["url_checks"] = check_url_status(all_urls, sample_size)

    else:
        print(f"Found {len(parsed['urls'])} URLs in sitemap")
        report["total_urls"] = len(parsed["urls"])
        report["analysis"] = analyze_urls(parsed["urls"])

        if check_urls and parsed["urls"]:
            report["url_checks"] = check_url_status(parsed["urls"], sample_size)

    # Generate recommendations
    if report["analysis"]:
        a = report["analysis"]

        if a["with_lastmod"] < report["total_urls"]:
            report["recommendations"].append(
                "Add lastmod dates to all URLs to help search engines prioritize crawling"
            )

        if a["duplicate_urls"]:
            report["recommendations"].append(
                f"Remove {len(a['duplicate_urls'])} duplicate URLs from sitemap"
            )

        if a["lastmod_stats"]["never_updated"] > 0:
            report["recommendations"].append(
                "Update lastmod dates for stale content or remove outdated pages"
            )

        deep_count = sum(v for k, v in a["path_depth_distribution"].items() if k > 4)
        if deep_count > 10:
            report["recommendations"].append(
                "Consider flattening URL structure - many URLs are >4 levels deep"
            )

        if report["total_urls"] > 50000:
            report["recommendations"].append(
                "Sitemap exceeds 50,000 URLs - split into multiple sitemaps"
            )

    # Check URL health
    if report["url_checks"]:
        errors = [c for c in report["url_checks"] if c.get("status") not in [200, 301, 302]]
        if errors:
            report["recommendations"].append(
                f"{len(errors)} URLs returned errors - review and fix or remove from sitemap"
            )

    return report


def print_report(report: dict):
    """Print analysis report."""
    print("\n" + "=" * 60)
    print("SITEMAP ANALYSIS REPORT")
    print("=" * 60)

    print(f"URL: {report['url']}")
    print(f"Type: {report['sitemap_type']}")

    if report["error"]:
        print(f"ERROR: {report['error']}")
        return

    print(f"Total URLs: {report['total_urls']}")

    if report["nested_sitemaps"]:
        print(f"Nested sitemaps: {len(report['nested_sitemaps'])}")

    if report["analysis"]:
        a = report["analysis"]
        print(f"\n--- URL Analysis ---")
        print(f"URLs with lastmod: {a['with_lastmod']} ({int(a['with_lastmod']/max(a['total_urls'],1)*100)}%)")

        if a["lastmod_stats"]["oldest"]:
            print(f"Oldest lastmod: {a['lastmod_stats']['oldest']}")
            print(f"Newest lastmod: {a['lastmod_stats']['newest']}")

        if a["changefreq_distribution"]:
            print(f"\nChangefreq distribution:")
            for freq, count in sorted(a["changefreq_distribution"].items()):
                print(f"  {freq}: {count}")

        if a["content_type_guesses"]:
            print(f"\nContent type breakdown:")
            for ctype, count in sorted(a["content_type_guesses"].items(), key=lambda x: -x[1]):
                print(f"  {ctype}: {count}")

        if a["url_patterns"]:
            print(f"\nTop URL patterns:")
            for pattern, count in list(a["url_patterns"].items())[:5]:
                print(f"  {pattern}: {count}")

        if a["issues"]:
            print(f"\n⚠️  Issues found:")
            for issue in a["issues"]:
                print(f"  - {issue}")

    if report["url_checks"]:
        print(f"\n--- URL Status Checks ---")
        status_counts = Counter(c.get("status") for c in report["url_checks"])
        for status, count in status_counts.most_common():
            print(f"  {status}: {count}")

    if report["recommendations"]:
        print(f"\n📋 Recommendations:")
        for i, rec in enumerate(report["recommendations"], 1):
            print(f"  {i}. {rec}")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze XML sitemaps for SEO issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python sitemap-analyzer.py --url https://example.com/sitemap.xml
    python sitemap-analyzer.py --url https://example.com/sitemap.xml --check-urls
    python sitemap-analyzer.py --url https://example.com/sitemap.xml --output report.json

Checks performed:
    - URL count and structure
    - Lastmod date coverage and freshness
    - Duplicate URL detection
    - URL depth analysis
    - Content type distribution
    - Optional: HTTP status checking
        """
    )

    parser.add_argument("--url", "-u", required=True, help="Sitemap URL to analyze")
    parser.add_argument("--output", "-o", help="Output JSON file")
    parser.add_argument("--check-urls", action="store_true", help="Check URL status codes (samples)")
    parser.add_argument("--sample-size", type=int, default=20, help="Sample size for URL checks")
    parser.add_argument("--export-urls", help="Export all URLs to CSV file")

    args = parser.parse_args()

    report = analyze_sitemap(
        args.url,
        check_urls=args.check_urls,
        sample_size=args.sample_size
    )

    print_report(report)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\nReport saved to: {args.output}")

    if args.export_urls and report.get("analysis"):
        # Re-fetch to get all URLs for export
        content, _ = fetch_sitemap(args.url)
        parsed = parse_sitemap(content, args.url)

        all_urls = parsed.get("urls", [])

        # If sitemap index, fetch nested
        if parsed["type"] == "sitemapindex":
            all_urls = []
            for sm in parsed["sitemaps"]:
                sm_content, _ = fetch_sitemap(sm["loc"])
                if sm_content:
                    sm_parsed = parse_sitemap(sm_content)
                    all_urls.extend(sm_parsed.get("urls", []))

        with open(args.export_urls, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["loc", "lastmod", "changefreq", "priority"])
            writer.writeheader()
            writer.writerows(all_urls)

        print(f"URLs exported to: {args.export_urls}")


if __name__ == "__main__":
    main()
