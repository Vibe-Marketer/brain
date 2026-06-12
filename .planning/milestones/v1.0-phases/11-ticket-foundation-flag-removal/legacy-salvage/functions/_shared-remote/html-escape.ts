/**
 * HTML-escape a string to prevent XSS when interpolating user-supplied
 * values into HTML templates (e.g., email bodies).
 *
 * Escapes the 5 characters that are meaningful in HTML attribute/text contexts:
 *   & → &amp;   < → &lt;   > → &gt;   " → &quot;   ' → &#39;
 */ export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
