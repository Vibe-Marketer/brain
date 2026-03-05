export const SOURCE_LABELS: Record<string, string> = {
  fathom: 'Fathom',
  zoom: 'Zoom',
  youtube: 'YouTube',
  'file-upload': 'Upload',
};

export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown';
  return SOURCE_LABELS[source] || source;
}
