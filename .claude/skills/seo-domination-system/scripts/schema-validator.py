#!/usr/bin/env python3
"""
Schema Markup Validator
Validates JSON-LD schema markup on web pages against Schema.org specifications.

Usage:
    python schema-validator.py --url https://example.com/page
    python schema-validator.py --urls urls.txt --output schema-report.json
    python schema-validator.py --file schema.json

Output: Validation report with errors, warnings, and schema details
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: beautifulsoup4 required. Install with: pip install beautifulsoup4")
    sys.exit(1)

# Common Schema.org types and their required/recommended properties
SCHEMA_SPECS = {
    "Article": {
        "required": ["headline", "author", "datePublished"],
        "recommended": ["image", "publisher", "dateModified", "description"],
    },
    "BlogPosting": {
        "required": ["headline", "author", "datePublished"],
        "recommended": ["image", "publisher", "dateModified", "description", "mainEntityOfPage"],
    },
    "Product": {
        "required": ["name"],
        "recommended": ["image", "description", "offers", "brand", "sku", "review", "aggregateRating"],
    },
    "LocalBusiness": {
        "required": ["name", "address"],
        "recommended": ["telephone", "openingHours", "image", "priceRange", "geo"],
    },
    "Organization": {
        "required": ["name"],
        "recommended": ["url", "logo", "sameAs", "contactPoint", "address"],
    },
    "Person": {
        "required": ["name"],
        "recommended": ["url", "image", "jobTitle", "sameAs"],
    },
    "FAQPage": {
        "required": ["mainEntity"],
        "recommended": [],
    },
    "Question": {
        "required": ["name", "acceptedAnswer"],
        "recommended": [],
    },
    "Answer": {
        "required": ["text"],
        "recommended": [],
    },
    "HowTo": {
        "required": ["name", "step"],
        "recommended": ["image", "totalTime", "estimatedCost", "supply", "tool"],
    },
    "Recipe": {
        "required": ["name", "recipeIngredient", "recipeInstructions"],
        "recommended": ["image", "author", "datePublished", "prepTime", "cookTime", "nutrition"],
    },
    "Review": {
        "required": ["itemReviewed", "reviewRating", "author"],
        "recommended": ["datePublished", "reviewBody"],
    },
    "Event": {
        "required": ["name", "startDate", "location"],
        "recommended": ["endDate", "description", "image", "offers", "performer", "organizer"],
    },
    "WebPage": {
        "required": [],
        "recommended": ["name", "description", "url", "mainEntity"],
    },
    "BreadcrumbList": {
        "required": ["itemListElement"],
        "recommended": [],
    },
    "VideoObject": {
        "required": ["name", "description", "thumbnailUrl", "uploadDate"],
        "recommended": ["duration", "contentUrl", "embedUrl"],
    },
    "ImageObject": {
        "required": ["contentUrl"],
        "recommended": ["name", "description", "author", "datePublished"],
    },
    "Service": {
        "required": ["name"],
        "recommended": ["description", "provider", "areaServed", "offers"],
    },
    "SoftwareApplication": {
        "required": ["name"],
        "recommended": ["operatingSystem", "applicationCategory", "offers", "aggregateRating"],
    },
}


def extract_schema_from_html(html: str) -> list:
    """Extract JSON-LD schema blocks from HTML."""
    schemas = []

    soup = BeautifulSoup(html, "html.parser")
    script_tags = soup.find_all("script", attrs={"type": "application/ld+json"})

    for script in script_tags:
        try:
            content = script.string
            if content:
                # Clean the content
                content = content.strip()
                data = json.loads(content)

                # Handle @graph arrays
                if isinstance(data, dict) and "@graph" in data:
                    schemas.extend(data["@graph"])
                elif isinstance(data, list):
                    schemas.extend(data)
                else:
                    schemas.append(data)

        except json.JSONDecodeError as e:
            schemas.append({"_parse_error": str(e), "_raw": content[:500]})

    return schemas


def validate_schema(schema: dict) -> dict:
    """Validate a single schema object."""
    result = {
        "type": None,
        "valid": True,
        "errors": [],
        "warnings": [],
        "info": [],
        "properties_found": [],
    }

    # Check for parse errors
    if "_parse_error" in schema:
        result["valid"] = False
        result["errors"].append(f"JSON parse error: {schema['_parse_error']}")
        return result

    # Get schema type
    schema_type = schema.get("@type")
    if not schema_type:
        result["valid"] = False
        result["errors"].append("Missing @type property")
        return result

    # Handle array of types
    if isinstance(schema_type, list):
        schema_type = schema_type[0]

    result["type"] = schema_type

    # Get properties
    result["properties_found"] = [k for k in schema.keys() if not k.startswith("@")]

    # Validate against spec if we have one
    if schema_type in SCHEMA_SPECS:
        spec = SCHEMA_SPECS[schema_type]

        # Check required properties
        for prop in spec["required"]:
            if prop not in schema or schema[prop] is None:
                result["errors"].append(f"Missing required property: {prop}")
                result["valid"] = False
            elif schema[prop] == "" or schema[prop] == []:
                result["errors"].append(f"Empty required property: {prop}")
                result["valid"] = False

        # Check recommended properties
        for prop in spec["recommended"]:
            if prop not in schema or schema[prop] is None:
                result["warnings"].append(f"Missing recommended property: {prop}")

    else:
        result["info"].append(f"No validation spec for type: {schema_type}")

    # Common validations
    if "@context" not in schema:
        # Check if it's nested (nested schemas don't need @context)
        if "@id" not in schema:
            result["warnings"].append("Missing @context (should be 'https://schema.org')")

    # Validate URLs
    url_props = ["url", "@id", "image", "logo", "sameAs", "mainEntityOfPage"]
    for prop in url_props:
        if prop in schema:
            value = schema[prop]
            if isinstance(value, str):
                if not value.startswith(("http://", "https://", "/")):
                    if value and not value.startswith("#"):
                        result["warnings"].append(f"Property '{prop}' may not be a valid URL: {value[:50]}")

    # Validate dates
    date_props = ["datePublished", "dateModified", "startDate", "endDate", "uploadDate"]
    for prop in date_props:
        if prop in schema:
            value = schema[prop]
            if isinstance(value, str):
                # Check for ISO 8601 format
                if not re.match(r'^\d{4}-\d{2}-\d{2}', value):
                    result["warnings"].append(f"Property '{prop}' should be ISO 8601 format: {value}")

    # Validate nested objects
    if "author" in schema:
        author = schema["author"]
        if isinstance(author, dict):
            if "@type" not in author:
                result["warnings"].append("author object missing @type")
            elif author.get("@type") not in ["Person", "Organization"]:
                result["warnings"].append(f"author @type should be Person or Organization, got: {author.get('@type')}")

    if "publisher" in schema:
        publisher = schema["publisher"]
        if isinstance(publisher, dict):
            if "@type" not in publisher:
                result["warnings"].append("publisher object missing @type")
            if "logo" not in publisher:
                result["warnings"].append("publisher missing logo property")

    # FAQPage specific
    if schema_type == "FAQPage":
        main_entity = schema.get("mainEntity", [])
        if isinstance(main_entity, list):
            result["info"].append(f"FAQPage contains {len(main_entity)} questions")
            for i, q in enumerate(main_entity[:3]):  # Check first 3
                if isinstance(q, dict):
                    if q.get("@type") != "Question":
                        result["warnings"].append(f"FAQ item {i+1} @type should be 'Question'")
                    if "acceptedAnswer" not in q:
                        result["errors"].append(f"FAQ question {i+1} missing acceptedAnswer")
                        result["valid"] = False

    return result


def validate_url(url: str) -> dict:
    """Fetch URL and validate all schema markup."""
    report = {
        "url": url,
        "timestamp": datetime.now().isoformat(),
        "status_code": None,
        "schemas_found": 0,
        "schemas": [],
        "summary": {
            "valid": 0,
            "invalid": 0,
            "errors": 0,
            "warnings": 0,
        },
        "error": None,
    }

    try:
        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SchemaValidator/1.0)"
        }, timeout=30)

        report["status_code"] = response.status_code

        if response.status_code != 200:
            report["error"] = f"HTTP {response.status_code}"
            return report

        # Extract schemas
        schemas = extract_schema_from_html(response.text)
        report["schemas_found"] = len(schemas)

        # Validate each schema
        for schema in schemas:
            validation = validate_schema(schema)
            validation["raw_data"] = schema  # Include raw data for reference
            report["schemas"].append(validation)

            if validation["valid"]:
                report["summary"]["valid"] += 1
            else:
                report["summary"]["invalid"] += 1

            report["summary"]["errors"] += len(validation["errors"])
            report["summary"]["warnings"] += len(validation["warnings"])

    except requests.exceptions.Timeout:
        report["error"] = "Request timed out"
    except requests.exceptions.RequestException as e:
        report["error"] = str(e)
    except Exception as e:
        report["error"] = f"Unexpected error: {str(e)}"

    return report


def validate_file(filepath: str) -> dict:
    """Validate schema from a JSON file."""
    report = {
        "file": filepath,
        "timestamp": datetime.now().isoformat(),
        "schemas_found": 0,
        "schemas": [],
        "summary": {
            "valid": 0,
            "invalid": 0,
            "errors": 0,
            "warnings": 0,
        },
        "error": None,
    }

    try:
        with open(filepath, "r") as f:
            data = json.load(f)

        # Handle different structures
        schemas = []
        if isinstance(data, dict):
            if "@graph" in data:
                schemas = data["@graph"]
            else:
                schemas = [data]
        elif isinstance(data, list):
            schemas = data

        report["schemas_found"] = len(schemas)

        for schema in schemas:
            validation = validate_schema(schema)
            report["schemas"].append(validation)

            if validation["valid"]:
                report["summary"]["valid"] += 1
            else:
                report["summary"]["invalid"] += 1

            report["summary"]["errors"] += len(validation["errors"])
            report["summary"]["warnings"] += len(validation["warnings"])

    except json.JSONDecodeError as e:
        report["error"] = f"JSON parse error: {str(e)}"
    except FileNotFoundError:
        report["error"] = f"File not found: {filepath}"
    except Exception as e:
        report["error"] = f"Unexpected error: {str(e)}"

    return report


def print_report(report: dict, verbose: bool = False):
    """Print a validation report."""
    print(f"\n{'='*60}")

    if "url" in report:
        print(f"URL: {report['url']}")
    elif "file" in report:
        print(f"File: {report['file']}")

    if report["error"]:
        print(f"ERROR: {report['error']}")
        return

    print(f"Schemas found: {report['schemas_found']}")
    print(f"Valid: {report['summary']['valid']}, Invalid: {report['summary']['invalid']}")
    print(f"Errors: {report['summary']['errors']}, Warnings: {report['summary']['warnings']}")

    for i, schema in enumerate(report["schemas"], 1):
        print(f"\n--- Schema {i}: {schema['type']} ---")

        if schema["errors"]:
            print("  ERRORS:")
            for err in schema["errors"]:
                print(f"    ❌ {err}")

        if schema["warnings"]:
            print("  WARNINGS:")
            for warn in schema["warnings"]:
                print(f"    ⚠️  {warn}")

        if schema["info"]:
            for info in schema["info"]:
                print(f"    ℹ️  {info}")

        if verbose:
            print(f"  Properties: {', '.join(schema['properties_found'])}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate JSON-LD schema markup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python schema-validator.py --url https://example.com/article
    python schema-validator.py --urls urls.txt --output report.json
    python schema-validator.py --file my-schema.json

Supported schema types:
    Article, BlogPosting, Product, LocalBusiness, Organization,
    Person, FAQPage, HowTo, Recipe, Review, Event, WebPage,
    BreadcrumbList, VideoObject, Service, SoftwareApplication
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", "-u", help="URL to validate")
    group.add_argument("--urls", "-U", help="File with URLs to validate")
    group.add_argument("--file", "-f", help="JSON file to validate")

    parser.add_argument("--output", "-o", help="Output JSON file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--delay", "-t", type=float, default=1.0, help="Delay between requests")

    args = parser.parse_args()

    reports = []

    if args.file:
        report = validate_file(args.file)
        reports.append(report)
        print_report(report, args.verbose)

    elif args.url:
        report = validate_url(args.url)
        reports.append(report)
        print_report(report, args.verbose)

    else:
        # Multiple URLs
        urls = []
        path = Path(args.urls)
        if path.exists():
            with open(path) as f:
                urls = [line.strip() for line in f if line.strip() and line.strip().startswith("http")]

        print(f"Validating {len(urls)} URLs...")

        for i, url in enumerate(urls, 1):
            print(f"\n[{i}/{len(urls)}] {url[:50]}...")
            report = validate_url(url)
            reports.append(report)

            if report["error"]:
                print(f"  ERROR: {report['error']}")
            else:
                s = report["summary"]
                print(f"  Schemas: {report['schemas_found']}, Errors: {s['errors']}, Warnings: {s['warnings']}")

            if i < len(urls):
                time.sleep(args.delay)

    # Save output
    if args.output:
        with open(args.output, "w") as f:
            json.dump(reports, f, indent=2, default=str)
        print(f"\nReport saved to: {args.output}")

    # Final summary
    if len(reports) > 1:
        print("\n" + "=" * 60)
        print("OVERALL SUMMARY")
        print("=" * 60)
        total_schemas = sum(r["schemas_found"] for r in reports)
        total_errors = sum(r["summary"]["errors"] for r in reports if not r["error"])
        total_warnings = sum(r["summary"]["warnings"] for r in reports if not r["error"])
        pages_with_errors = sum(1 for r in reports if r["summary"]["invalid"] > 0)

        print(f"URLs checked: {len(reports)}")
        print(f"Total schemas found: {total_schemas}")
        print(f"Total errors: {total_errors}")
        print(f"Total warnings: {total_warnings}")
        print(f"Pages with invalid schema: {pages_with_errors}")


if __name__ == "__main__":
    main()
