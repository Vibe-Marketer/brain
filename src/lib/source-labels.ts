export const SOURCE_LABELS: Record<string, string> = {
  fathom: 'Fathom',
  // Phase 24: paste-source recordings show as 'Fathom' in the table since
  // they originate from a Fathom share link. The recording detail page
  // surfaces the user-paste origin via a dedicated "From Fathom share link"
  // pill so paste vs API-import is still distinguishable when needed.
  'fathom-paste': 'Fathom',
  zoom: 'Zoom',
  youtube: 'YouTube',
  'file-upload': 'Upload',
};

export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown';
  return SOURCE_LABELS[source] || source;
}
