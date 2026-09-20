import { escapeHtml } from './html-escape.ts';

const APP_ORIGIN = 'https://app.callvaultai.com';

export interface ParticipationClaimEmail {
  subject: string;
  html: string;
  text: string;
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'the stated expiration date';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

export function buildParticipationClaimUrl(rawToken: string): string {
  return `${APP_ORIGIN}/claim-participation?token=${encodeURIComponent(rawToken)}`;
}

export function renderParticipationClaimEmail(input: {
  claimUrl: string;
  expiresAt: string;
  reminder?: boolean;
}): ParticipationClaimEmail {
  const claimUrl = escapeHtml(input.claimUrl);
  const expiry = escapeHtml(formatExpiry(input.expiresAt));
  const subject = input.reminder
    ? 'Reminder: claim your participation in CallVault'
    : 'Claim your participation in CallVault';
  const heading = 'Connect your email to your events';
  const body = 'You were invited to verify this email and find events connected to you in CallVault.';
  const cta = 'Claim participation';
  const expiryNote = `This link expires on ${formatExpiry(input.expiresAt)}.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f9fafb;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr><td style="padding:36px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">${body}</p>
          <a href="${claimUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${cta}</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">This link expires on ${expiry}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text: [heading, '', body, '', `${cta}: ${input.claimUrl}`, '', expiryNote].join('\n'),
  };
}
