/**
 * Masks an email address for safe display.
 * Pattern: keep first 2 chars of local part, replace rest with "***", keep domain.
 *
 * Examples:
 *   naegele412@gmail.com → na***@gmail.com
 *   ab@gmail.com         → ab***@gmail.com (local is exactly 2 chars — still masked tail)
 *   a@gmail.com          → a***@gmail.com (local is 1 char — kept as-is + tail)
 *   no-at-sign           → no-at-sign (input is not a valid email — returned unchanged)
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return email; // no @ or empty local
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex); // includes "@"
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}***${domain}`;
}
