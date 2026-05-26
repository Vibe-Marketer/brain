import {
  getCanonicalSourceId,
  SOURCE_REGISTRY,
  tryGetSourceConfig,
} from "@/config/source-registry";

export const SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(SOURCE_REGISTRY.map(({ id, label }) => [id, label])),
  otter: 'Otter',
  riverside: 'Riverside',
  tldv: 'tl;dv',
  'tl-dv': 'tl;dv',
};

export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown';
  return (
    tryGetSourceConfig(getCanonicalSourceId(source))?.label ??
    SOURCE_LABELS[source] ??
    source
  );
}
