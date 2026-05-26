import {
  getCanonicalSourceId,
  SOURCE_REGISTRY,
  tryGetSourceConfig,
} from "@/config/source-registry";
import { getSourceLabel } from "@/lib/source-labels";

const SOURCE_ORDER = new Map(
  SOURCE_REGISTRY.map((source, index) => [source.id, index]),
);

export function getCanonicalDisplaySource(source: string): string {
  return getCanonicalSourceId(source);
}

export function getSourceDisplayOrder(source: string): number {
  return SOURCE_ORDER.get(getCanonicalDisplaySource(source) as never) ?? 10_000;
}

export function sortSourcePlatforms<T extends string>(sources: T[]): T[] {
  return [...sources].sort(
    (a, b) =>
      getSourceDisplayOrder(a) - getSourceDisplayOrder(b) ||
      getSourceLabel(a).localeCompare(getSourceLabel(b)),
  );
}

export function isSourceVisibleInUi(source: string | null | undefined): boolean {
  if (!source) return false;
  return tryGetSourceConfig(getCanonicalDisplaySource(source))?.uiVisible !== false;
}

export function getSourceIndicatorClass(
  source: string | null | undefined,
): string | null {
  if (!source) return null;
  const canonicalSource = getCanonicalDisplaySource(source);
  return (
    tryGetSourceConfig(canonicalSource)?.indicatorClass ??
    "bg-muted-foreground"
  );
}
