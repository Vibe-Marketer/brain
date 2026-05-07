#!/usr/bin/env bash
#
# lighthouse_audit.sh
#
# Run Lighthouse against a target URL with launch-gate thresholds.
# Fails (exit 1) if any threshold is missed.
#
# Usage:
#   bash lighthouse_audit.sh https://your-app.com
#   bash lighthouse_audit.sh https://your-app.com --json-only
#
# Thresholds (launch gates):
#   Performance     >= 85
#   Accessibility   >= 95
#   Best Practices  >= 90
#   SEO             >= 90
#   LCP             <  2500ms
#   CLS             <  0.1
#   TBT             <  300ms
#
# Requires: node + npm in PATH. Lighthouse runs via `npx lighthouse`.

set -euo pipefail

URL="${1:-}"
JSON_ONLY="${2:-}"
REPORT_PATH="./lighthouse-report.json"

if [[ -z "$URL" ]]; then
  echo "Usage: bash lighthouse_audit.sh <url> [--json-only]" >&2
  exit 2
fi

# Thresholds
MIN_PERFORMANCE=85
MIN_ACCESSIBILITY=95
MIN_BEST_PRACTICES=90
MIN_SEO=90
MAX_LCP_MS=2500
MAX_CLS=0.1
MAX_TBT_MS=300

# Check for node
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found in PATH" >&2
  exit 2
fi

if [[ "$JSON_ONLY" != "--json-only" ]]; then
  echo "================================================================"
  echo "  Lighthouse Audit — Launch Readiness"
  echo "================================================================"
  echo "  Target: $URL"
  echo "  Report: $REPORT_PATH"
  echo "================================================================"
  echo ""
fi

# Run Lighthouse via npx (no global install needed)
# --quiet: suppress progress output
# --chrome-flags: headless mode
# --output=json: machine-readable report
# --output-path: write report to disk
# --preset=desktop: more realistic for SaaS dashboards (mobile preset is the default)
npx --yes lighthouse "$URL" \
  --quiet \
  --chrome-flags="--headless --no-sandbox" \
  --output=json \
  --output-path="$REPORT_PATH" \
  --preset=desktop \
  >/dev/null 2>&1 || {
    echo "Error: Lighthouse run failed. Check that the URL is reachable and node is recent." >&2
    exit 2
  }

# Parse the JSON report and extract scores via node
SCORES=$(node -e '
  const fs = require("fs");
  const report = JSON.parse(fs.readFileSync("'"$REPORT_PATH"'", "utf8"));
  const cat = report.categories;
  const audits = report.audits;
  const out = {
    performance: Math.round((cat.performance?.score ?? 0) * 100),
    accessibility: Math.round((cat.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cat["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((cat.seo?.score ?? 0) * 100),
    lcpMs: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    cls: Number((audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
    tbtMs: Math.round(audits["total-blocking-time"]?.numericValue ?? 0),
    fcpMs: Math.round(audits["first-contentful-paint"]?.numericValue ?? 0),
    speedIndexMs: Math.round(audits["speed-index"]?.numericValue ?? 0),
  };
  console.log(JSON.stringify(out));
')

PERF=$(echo "$SCORES" | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).performance))')
A11Y=$(echo "$SCORES" | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessibility))')
BP=$(echo "$SCORES"   | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).bestPractices))')
SEO=$(echo "$SCORES"  | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).seo))')
LCP=$(echo "$SCORES"  | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).lcpMs))')
CLS=$(echo "$SCORES"  | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).cls))')
TBT=$(echo "$SCORES"  | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).tbtMs))')
FCP=$(echo "$SCORES"  | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).fcpMs))')
SI=$(echo "$SCORES"   | node -e 'let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).speedIndexMs))')

if [[ "$JSON_ONLY" == "--json-only" ]]; then
  echo "$SCORES"
  exit 0
fi

# Pretty print scores + check thresholds
FAILED=0
status() {
  local label="$1"; local actual="$2"; local op="$3"; local threshold="$4"; local unit="${5:-}"
  local pass
  if [[ "$op" == "ge" ]]; then
    pass=$(node -e "console.log($actual >= $threshold ? 'PASS' : 'FAIL')")
  else
    pass=$(node -e "console.log($actual < $threshold ? 'PASS' : 'FAIL')")
  fi
  printf "  [%s]  %-22s %s%s   (gate: %s%s%s)\n" "$pass" "$label" "$actual" "$unit" "$([ "$op" = "ge" ] && echo ">= " || echo "< ")" "$threshold" "$unit"
  [[ "$pass" == "FAIL" ]] && FAILED=1
}

echo "SCORES (0-100)"
echo "----------------------------------------------------------------"
status "Performance"     "$PERF"  "ge" "$MIN_PERFORMANCE"
status "Accessibility"   "$A11Y"  "ge" "$MIN_ACCESSIBILITY"
status "Best Practices"  "$BP"    "ge" "$MIN_BEST_PRACTICES"
status "SEO"             "$SEO"   "ge" "$MIN_SEO"
echo ""
echo "CORE WEB VITALS"
echo "----------------------------------------------------------------"
status "LCP"             "$LCP"   "lt" "$MAX_LCP_MS" "ms"
status "CLS"             "$CLS"   "lt" "$MAX_CLS"
status "TBT"             "$TBT"   "lt" "$MAX_TBT_MS" "ms"
echo ""
echo "OTHER METRICS (not gated)"
echo "----------------------------------------------------------------"
printf "  [-]     %-22s %sms\n" "FCP" "$FCP"
printf "  [-]     %-22s %sms\n" "Speed Index" "$SI"
echo ""
echo "================================================================"
if [[ $FAILED -eq 0 ]]; then
  echo "  RESULT: All Lighthouse launch gates PASSED"
  echo "================================================================"
  exit 0
else
  echo "  RESULT: One or more launch gates FAILED — fix before launch"
  echo "================================================================"
  echo ""
  echo "Common fixes:"
  echo "  - LCP > 2.5s    -> preload hero images, lazy-load below-fold, check CDN"
  echo "  - CLS > 0.1     -> set width/height on images, reserve space for ads/embeds"
  echo "  - TBT > 300ms   -> code-split with React.lazy, defer third-party scripts"
  echo "  - A11y < 95     -> run axe DevTools locally; usually missing ARIA labels or contrast"
  exit 1
fi
