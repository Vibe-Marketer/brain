export function parseFirefliesTranscriptIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const piece of raw.split(/[\n,]/)) {
    const id = piece.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}
