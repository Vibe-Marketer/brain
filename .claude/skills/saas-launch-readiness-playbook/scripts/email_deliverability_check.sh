#!/usr/bin/env bash
#
# email_deliverability_check.sh
#
# Verify SPF, DKIM, and DMARC are configured on your sending domain.
# Silent email failure (signups don't arrive, password resets bounce) is a
# top-5 launch killer that's invisible until users complain.
#
# Checks:
#   1. SPF — TXT record at root domain authorizing sending IPs
#   2. DKIM — TXT record at <selector>._domainkey.<domain>
#   3. DMARC — TXT record at _dmarc.<domain>
#   4. MX — domain has mail-receiving servers
#
# Exit code:
#   0 — all critical records present
#   1 — one or more missing (delivery will be flagged as spam)
#   2 — configuration error
#
# Usage:
#   bash email_deliverability_check.sh callvaultai.com
#   bash email_deliverability_check.sh callvaultai.com --selector resend
#
# Common DKIM selectors:
#   Resend:    'resend'
#   SendGrid:  's1' or 's2' (and the s1._domainkey alias)
#   Postmark:  '20231101' (date-based, check Postmark dashboard)
#   Mailgun:   'mailo' or your custom selector
#   AWS SES:   'amazonses' or your custom selector
#   Google:    'google'
#
# Tip: cross-check with https://mxtoolbox.com or https://www.mail-tester.com

set -uo pipefail

DOMAIN="${1:-}"
SELECTOR=""

# Parse --selector flag
shift 2>/dev/null
while [[ $# -gt 0 ]]; do
  case "$1" in
    --selector) SELECTOR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: bash email_deliverability_check.sh <domain> [--selector <dkim-selector>]" >&2
  echo "Example: bash email_deliverability_check.sh callvaultai.com --selector resend" >&2
  exit 2
fi

if ! command -v dig >/dev/null 2>&1; then
  echo "ERROR: dig not found. Install bind-tools (Linux) or it's preinstalled on macOS." >&2
  exit 2
fi

PASS=0
FAIL=0

echo "================================================================"
echo "  Email Deliverability Check — $DOMAIN"
echo "================================================================"
echo ""

# 1. MX record (does the domain accept mail?)
echo "[1/4] MX record — domain has mail servers"
MX=$(dig +short MX "$DOMAIN" 2>/dev/null | sort -n | head -3)
if [[ -n "$MX" ]]; then
  echo "      [PASS] MX records:"
  echo "$MX" | sed 's/^/             /'
  PASS=$((PASS+1))
else
  echo "      [WARN] No MX record. Replies to your transactional email will bounce."
  echo "             Set up at minimum a catchall via your provider."
  # Don't count as fail — many SaaS apps send-only and that's OK
fi
echo ""

# 2. SPF record
echo "[2/4] SPF — authorizes sending IPs"
SPF=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep -i "v=spf1" | head -1)
if [[ -n "$SPF" ]]; then
  echo "      [PASS] $SPF"
  # Check for common issues
  if echo "$SPF" | grep -qi "all\""; then
    echo "             [WARN] '+all' = anyone can send as you. Should be '~all' or '-all'."
  fi
  if [[ ${#SPF} -gt 450 ]]; then
    echo "             [WARN] SPF record is long — watch the 10 DNS lookup limit (RFC 7208)."
  fi
  PASS=$((PASS+1))
else
  echo "      [FAIL] No SPF record found at $DOMAIN"
  echo "             Mail from this domain will be flagged as spam by most providers."
  echo "             Add a TXT record at the root: 'v=spf1 include:<your-provider> ~all'"
  echo "             Resend:    v=spf1 include:_spf.resend.com ~all"
  echo "             SendGrid:  v=spf1 include:sendgrid.net ~all"
  echo "             Postmark:  v=spf1 a mx include:spf.mtasv.net ~all"
  FAIL=$((FAIL+1))
fi
echo ""

# 3. DKIM record
echo "[3/4] DKIM — cryptographic signing"
if [[ -z "$SELECTOR" ]]; then
  echo "      [SKIP] No --selector provided. Try common ones:"
  for s in resend google s1 s2 mail mailo selector1 amazonses; do
    DKIM=$(dig +short TXT "${s}._domainkey.${DOMAIN}" 2>/dev/null | head -1)
    if [[ -n "$DKIM" ]]; then
      echo "             [FOUND] selector '$s' -> ${DKIM:0:80}..."
      SELECTOR="$s"
      break
    fi
  done
  if [[ -z "$SELECTOR" ]]; then
    echo "             None of the common selectors returned a record."
    echo "             Re-run with --selector <name> from your email provider's dashboard."
    FAIL=$((FAIL+1))
  fi
else
  DKIM=$(dig +short TXT "${SELECTOR}._domainkey.${DOMAIN}" 2>/dev/null | head -1)
  if [[ -n "$DKIM" ]]; then
    DKIM_SHORT="${DKIM:0:120}"
    echo "      [PASS] ${SELECTOR}._domainkey.${DOMAIN}"
    echo "             ${DKIM_SHORT}..."
    PASS=$((PASS+1))
  else
    echo "      [FAIL] No DKIM record at ${SELECTOR}._domainkey.${DOMAIN}"
    echo "             Without DKIM, Gmail and Outlook will mark your email as suspicious."
    echo "             Get the DKIM record from your email provider and add it as TXT."
    FAIL=$((FAIL+1))
  fi
fi
echo ""

# 4. DMARC record
echo "[4/4] DMARC — policy for failed SPF/DKIM"
DMARC=$(dig +short TXT "_dmarc.${DOMAIN}" 2>/dev/null | head -1)
if [[ -n "$DMARC" ]]; then
  echo "      [PASS] $DMARC"
  # Check policy strictness
  if echo "$DMARC" | grep -q "p=none"; then
    echo "             [INFO] Policy is 'none' — monitoring only. Tighten to 'quarantine' once stable."
  fi
  if ! echo "$DMARC" | grep -q "rua="; then
    echo "             [WARN] No rua= aggregate report address. You won't see deliverability data."
  fi
  PASS=$((PASS+1))
else
  echo "      [FAIL] No DMARC record at _dmarc.${DOMAIN}"
  echo "             Gmail/Yahoo now REQUIRE DMARC for bulk senders. Without it,"
  echo "             your email will be delayed or junked."
  echo "             Start with: 'v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN}'"
  echo "             Tighten to 'p=quarantine' after a week of monitoring."
  FAIL=$((FAIL+1))
fi
echo ""

echo "================================================================"
if [[ $FAIL -eq 0 ]]; then
  echo "  RESULT: $PASS critical records present — email deliverability is configured"
  echo ""
  echo "  Final checks (do these manually):"
  echo "  1. Send a test email to your-name+test@gmail.com — verify it lands in Inbox, not Spam"
  echo "  2. Run https://www.mail-tester.com — get a 9/10 or higher"
  echo "  3. Confirm your password reset and signup confirmation emails actually arrive"
  echo "================================================================"
  exit 0
else
  echo "  RESULT: $FAIL critical record(s) MISSING — email will fail silently"
  echo "  ACTION: Fix before launch. Silent email failure = signups never arrive."
  echo "================================================================"
  exit 1
fi
